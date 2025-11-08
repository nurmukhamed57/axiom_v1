import { leanFormalizationPrompt } from "./lean-formalization-prompt";
import { leanBrainstormingPrompt } from "./lean-brainstorming-prompt";

export const DEFAULT_PROMPT_TYPE: string = "formalization";

export type PromptType = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
};

export const promptTypes: PromptType[] = [
  {
    id: "formalization",
    name: "Formalization",
    description: "Convert informal math problems and solutions into formal Lean 4 code",
    systemPrompt: leanFormalizationPrompt,
  },
  {
    id: "brainstorming",
    name: "Brainstorming",
    description: "Explore proof strategies and discuss mathematical approaches",
    systemPrompt: leanBrainstormingPrompt,
  },
];
