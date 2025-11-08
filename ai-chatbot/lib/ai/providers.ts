import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : (() => {
      const k2think = createOpenAICompatible({
        name: "k2-think",
        baseURL: "https://llm-api.k2think.ai/v1",
        apiKey: process.env.K2_THINK_API_KEY,
      });

      return customProvider({
        languageModels: {
          "chat-model": k2think("MBZUAI-IFM/K2-Think"),
          "title-model": k2think("MBZUAI-IFM/K2-Think"),
          "artifact-model": k2think("MBZUAI-IFM/K2-Think"),
        },
      });
    })();
