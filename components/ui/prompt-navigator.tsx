// "use client" ensures the component runs in the browser
"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { cn } from "@/lib/utils";

// Pre‑defined prompts that showcase a variety of BPMN examples
const PRESET_PROMPTS = [
  "Model an employee onboarding process",
  "Create a purchase approval workflow",
  "Design a customer support escalation flow",
  "Build a loan application process",
  "Generate an order fulfillment pipeline",
];

/**
 * PromptNavigator renders a grid of suggestion buttons.
 * Each button uses ThreadPrimitive.Suggestion with `autoSend` so the prompt is sent immediately.
 */
const PromptNavigator = () => {
  return (
    <div className={cn("grid w-full max-w-sm gap-2 p-2", "bg-muted/30 rounded-lg")}>
      {PRESET_PROMPTS.map((prompt) => (
        <ThreadPrimitive.Suggestion
          key={prompt}
          prompt={prompt}
          method="replace"
          autoSend
          asChild
        >
          <button
            className={cn(
              "rounded-xl border border-border bg-card px-4 py-2.5 text-left text-sm text-muted-foreground",
              "transition-colors hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {prompt}
          </button>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
};

export default PromptNavigator;
