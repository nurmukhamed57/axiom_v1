import {
  convertToModelMessages,
  streamText,
  type UIMessage,
  type UIMessagePart,
} from "ai";
import type { Message as ModelMessage } from "ai";
import { createUIMessageStream } from "ai";
import { JsonToSseTransformStream } from "@/lib/ai/sse";
import { smoothStream } from "@ai-sdk/smooth-stream";
import { generateUUID } from "@ai-sdk/provider-utils";
import { auth } from "@/app/(auth)/auth";
import {
  createStreamId,
  getChatById,
  saveChat,
  saveMessages,
  updateChatLastContextById,
  getMessageCountByUserId,
} from "@/lib/db/queries";
import { myProvider } from "@/lib/ai/providers";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { promptTypes, DEFAULT_PROMPT_TYPE } from "@/lib/ai/prompt-types";
import { isProductionEnvironment } from "@/lib/constants";
import type { AppUsage } from "@/lib/usage";
import { getUsage } from "tokenlens/helpers";
import { fetchModels } from "tokenlens/fetch";
import type { ModelCatalog } from "tokenlens/core";
import { unstable_cache as cache } from "next/cache";
import { headers as nextHeaders } from "next/headers";
import { ChatSDKError } from "@/lib/errors";
import type { ChatModel } from "@/lib/ai/models";
import type { VisibilityType } from "@/components/visibility-selector";
import type { ChatMessage } from "@/lib/types";
import { generateTitleFromUserMessage } from "../../actions";
import { verifyLeanInMessage, formatLeanVerification } from "@/lib/lean-compiler";
import { parseK2ThinkResponse } from "@/lib/k2-think-parser";
import type { UserType } from "@/app/(auth)/auth";

// Export the runtime edge config
export const runtime = "edge";
export const dynamic = "force-dynamic";

// Rate limiter configuration
const rateLimiter: RateLimiter = createRateLimiter({
  tokensPerSecond: 100
});

// Helper function for rate limiting
async function applyRateLimit(request: Request, userId: string) {
  let rateLimitHeaders: Record<string, string> | undefined;
  const [, waitTime] = await rateLimiter.check(userId, 0);

  if (waitTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rateLimit, _] = await rateLimiter.check(userId, 60);

  if (!rateLimit.success) {
    rateLimitHeaders = {
      "X-RateLimit-Limit": rateLimit.limit.toString(),
      "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      "X-RateLimit-Reset": new Date(
        rateLimit.reset * 1000
      ).toISOString(),
    };

    throw new HTTPException(429, {
      message: "Too many requests. Please try again later.",
      res: new Response(null, { headers: rateLimitHeaders })
    });
  }
}

// Prepare messages for sending to model
function prepareSendMessagesRequest(messages: UIMessage[]): UIMessage[] {
  return messages
    .filter((msg): msg is UIMessage => msg !== null)
    .map((msg) => ({
      ...msg,
      parts:
        msg.role === "user"
          ? msg.parts.filter(
              (part): part is UIMessagePart =>
                part.type === "text" || part.type === "image"
            )
          : msg.parts,
    }));
}

// Convert conversation metadata
function convertChatToConversation(chat: ConversationSchema): {
  id: string;
  mode: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  title: string | null;
  description: string | null;
  systemPrompt: string | null;
} {
  return {
    id: chat.id,
    mode: chat.mode,
    userId: chat.userId,
    createdAt: new Date(chat.createdAt),
    updatedAt: new Date(chat.updatedAt),
    title: chat.title,
    description: chat.description,
    systemPrompt: chat.systemPrompt,
  };
}

// Validate inputs
function validateInput(messages: UIMessage[], promptType: PromptOption | undefined) {
  if (!messages || messages.length === 0) {
    throw new HTTPException(400, { message: "messages are required" });
  }

  if (!promptType) {
    throw new HTTPException(400, { message: "promptType is required" });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Track the request for monitoring
    await trackRequest("lean-chat");

    const session = await auth();
    if (!session?.user?.id) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    // Apply rate limiting
    await applyRateLimit(request, session.user.id);

    // Parse request body
    const {
      messages,
      promptType,
      selectedChatModel
    }: {
      messages?: UIMessage[];
      promptType?: PromptOption;
      selectedChatModel?: ChatModel;
    } = await request.json();

    // Validate input
    validateInput(messages as UIMessage[], promptType);

    // Check or create chat
    const headersList = await nextHeaders();
    const chatIdHeader = headersList.get("x-chat-id");

    if (!chatIdHeader) {
      throw new HTTPException(400, { message: "chatId header is missing" });
    }

    let chat = await getChatById({ id: chatIdHeader });

    if (!chat) {
      const chatTitle = messages?.[0]?.parts?.find((p) => p.type === "text")?.text?.slice(0, 100) ?? "New Chat";
      chat = await createChat({ userId: session.user.id, title: chatTitle });
    }

    if (chat.userId !== session.user.id) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const { id } = convertChatToConversation(chat);

    // Prepare messages
    const uiMessages = prepareSendMessagesRequest(messages as UIMessage[]);

    // Create stream ID for resumable streams
    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;
    let isVerificationPass = false;
    let leanVerificationResults: string = '';

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // First pass: Generate the initial response
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel || 'grok-3-mini'),
          system: promptType.systemPrompt,
          messages: convertToModelMessages(uiMessages),
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text-lean",
          },
          onFinish: async ({ text, usage }) => {
            // Parse K2-Think response to get the answer part
            const parsed = parseK2ThinkResponse(text);
            const answerContent = parsed.answer || text;

            // Verify any Lean code in the response
            const verification = await verifyLeanInMessage(answerContent);

            if (verification.hasLeanCode) {
              // Format verification results
              leanVerificationResults = formatLeanVerification(verification.leanVerifications);

              // Check if all verifications passed
              const allPassed = verification.leanVerifications.every(v => v.result.success);

              if (!allPassed) {
                isVerificationPass = true;

                // Create a follow-up message to K2-Think with verification results
                const verificationMessage: ModelMessage = {
                  role: "assistant",
                  content: text,
                };

                const feedbackMessage: ModelMessage = {
                  role: "user",
                  content: `The Lean compiler found some issues with your code. Here are the verification results:\n\n${leanVerificationResults}\n\nPlease review the errors and provide corrected Lean code that will compile successfully.`
                };

                // Second pass: Let K2-Think fix the errors
                const correctionResult = streamText({
                  model: myProvider.languageModel(selectedChatModel || 'grok-3-mini'),
                  system: promptType.systemPrompt + "\n\nIMPORTANT: You must provide corrected Lean code that compiles without errors.",
                  messages: [
                    ...convertToModelMessages(uiMessages),
                    verificationMessage,
                    feedbackMessage
                  ],
                  experimental_transform: smoothStream({ chunking: "word" }),
                  onFinish: async ({ text: correctedText, usage: correctedUsage }) => {
                    // Verify the corrected code
                    const correctedVerification = await verifyLeanInMessage(correctedText);
                    const correctedResults = formatLeanVerification(correctedVerification.leanVerifications);

                    // Add final verification status
                    dataStream.write({
                      type: "data-lean-verification",
                      data: {
                        originalResults: leanVerificationResults,
                        correctedResults: correctedResults,
                        allPassed: correctedVerification.leanVerifications.every(v => v.result.success)
                      }
                    });

                    // Merge usage data
                    finalMergedUsage = correctedUsage;
                  }
                });

                // Stream the corrected response
                dataStream.merge(correctionResult.toUIMessageStream({ sendReasoning: true }));
                await correctionResult.consumeStream();
              } else {
                // All verifications passed on first try
                dataStream.write({
                  type: "data-lean-verification",
                  data: {
                    originalResults: leanVerificationResults,
                    allPassed: true
                  }
                });
              }
            }

            // Handle usage data
            try {
              const providers = await getTokenlensCatalog();
              const modelId = myProvider.languageModel(selectedChatModel || 'grok-3-mini').modelId;

              if (modelId && providers) {
                const summary = getUsage({ modelId, usage, providers });
                finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              } else {
                finalMergedUsage = usage;
              }

              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        // Stream the initial response if not doing verification pass
        if (!isVerificationPass) {
          dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));
        }

        await result.consumeStream();
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        // Save messages to database
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        // Update chat context with usage data
        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      }
    });

    // Convert to SSE format and return
    return stream
      .pipe(new JsonToSseTransformStream())
      .pipe(toTextStreamResponse());

  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof HTTPException) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: error.status,
          headers: error.getResponse().headers
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}