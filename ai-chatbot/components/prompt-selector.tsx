"use client";

import { Trigger } from "@radix-ui/react-select";
import { startTransition, useEffect, useState, memo } from "react";
import { SelectItem } from "@/components/ui/select";
import { promptTypes } from "@/lib/ai/prompt-types";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";
import { Button } from "./ui/button";
import { ChevronDownIcon, CpuIcon } from "./icons";

function PurePromptSelector({
  selectedPromptTypeId,
  onPromptTypeChange,
}: {
  selectedPromptTypeId: string;
  onPromptTypeChange?: (promptTypeId: string) => void;
}) {
  const [optimisticPromptTypeId, setOptimisticPromptTypeId] =
    useState(selectedPromptTypeId);

  useEffect(() => {
    setOptimisticPromptTypeId(selectedPromptTypeId);
  }, [selectedPromptTypeId]);

  const selectedPromptType = promptTypes.find(
    (pt) => pt.id === optimisticPromptTypeId
  );

  return (
    <PromptInputModelSelect
      onValueChange={(promptTypeName) => {
        const promptType = promptTypes.find((pt) => pt.name === promptTypeName);
        if (promptType) {
          setOptimisticPromptTypeId(promptType.id);
          onPromptTypeChange?.(promptType.id);
        }
      }}
      value={selectedPromptType?.name}
    >
      <Trigger asChild>
        <Button variant="ghost" className="h-8 px-2">
          <CpuIcon size={16} />
          <span className="hidden font-medium text-xs sm:block">
            {selectedPromptType?.name}
          </span>
          <ChevronDownIcon size={16} />
        </Button>
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {promptTypes.map((promptType) => (
            <SelectItem key={promptType.id} value={promptType.name}>
              <div className="truncate font-medium text-xs">
                {promptType.name}
              </div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {promptType.description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

export const PromptSelector = memo(PurePromptSelector);
