"use client";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  AuiIf,
} from "@assistant-ui/react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, RefreshCwIcon, SquareIcon, Undo2Icon, FileCodeIcon, HomeIcon } from "lucide-react";
import type { FC } from "react";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Thread: FC = () => (
  <ThreadPrimitive.Root
    className="aui-root flex h-full flex-col bg-background"
    style={{
      ["--thread-max-width" as string]: "48rem",
      ["--composer-radius" as string]: "1.25rem",
      ["--composer-padding" as string]: "0.625rem",
    }}
  >
    <ThreadPrimitive.Viewport className="relative flex flex-1 flex-col overflow-y-scroll scroll-smooth px-4 pt-4">
      <div className="mx-auto flex w-full max-w-[--thread-max-width] flex-1 flex-col">
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <ThreadWelcome />
        </AuiIf>
        <div className="mb-10 flex flex-col gap-y-8">
          <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
        </div>
        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto flex flex-col gap-4 bg-background pb-4">
          <ThreadScrollToBottom />
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </div>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
);

const ThreadWelcome: FC = () => (
  <div className="my-auto flex grow flex-col items-center justify-center gap-6 px-4 py-16">
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
        ⬡
      </div>
      <h1 className="text-2xl font-semibold text-foreground">ChatBPMN</h1>
      <p className="max-w-sm text-muted-foreground">
        Describe any business process and I'll generate a BPMN diagram. Ask me to model workflows,
        approval processes, or any sequence of steps.
      </p>
    </div>
    <div className="grid w-full max-w-sm gap-2">
      {[
        "Model an employee onboarding process",
        "Create a purchase approval workflow",
        "Design a customer support escalation flow",
      ].map((prompt) => (
        <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} method="replace" autoSend asChild>
          <button className="rounded-xl border border-border bg-card px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            {prompt}
          </button>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  </div>
);

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="Scroll to bottom"
      variant="outline"
      className="absolute -top-12 self-center rounded-full p-4 disabled:invisible"
    >
      <ArrowDownIcon />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

const ThreadMessage: FC = () => {
  const isUser = true; // will be overridden by MessagePrimitive context
  return (
    <MessagePrimitive.Root data-role="unknown" className="contents">
      <AuiIf condition={(s) => s.message.role === "user"}>
        <UserMessage />
      </AuiIf>
      <AuiIf condition={(s) => s.message.role === "assistant"}>
        <AssistantMessage />
      </AuiIf>
    </MessagePrimitive.Root>
  );
};

const UserMessage: FC = () => (
  <div className="flex justify-end px-2">
    <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
      <MessagePrimitive.Parts />
    </div>
  </div>
);

const AssistantMessage: FC = () => (
  <div className="flex flex-col gap-1 px-2">
    <div className="wrap-break-word text-foreground text-sm leading-relaxed">
      <MessagePrimitive.Parts components={{ Text: () => <MarkdownText /> }} />
    </div>
    <AssistantActionBar />
  </div>
);

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="-ms-1 flex gap-1 text-muted-foreground"
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="Copy">
        <AuiIf condition={(s) => s.message.isCopied}>
          <CheckIcon />
        </AuiIf>
        <AuiIf condition={(s) => !s.message.isCopied}>
          <CopyIcon />
        </AuiIf>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload asChild>
      <TooltipIconButton tooltip="Regenerate">
        <RefreshCwIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
    {/* Download SVG */}
    <TooltipIconButton
      tooltip="Download SVG"
      onClick={() => {
        if (typeof document !== "undefined") {
          const svgElement = document.querySelector('.bjs-container svg') as SVGElement | null;
          if (svgElement) {
            const svgString = svgElement.outerHTML;
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'workflow.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } else {
            alert('SVG not ready yet. Please wait for the diagram to render.');
          }
        }
      }}
      className="ml-2"
    >
      <FileCodeIcon />
    </TooltipIconButton>
    {/* Home – refreshes chat pane to initial state */}
    <TooltipIconButton
      tooltip="Home (Start Over)"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }}
      className="ml-2"
    >
      <HomeIcon />
    </TooltipIconButton>
    <BranchPicker />
  </ActionBarPrimitive.Root>
);

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => (
  <BranchPickerPrimitive.Root
    hideWhenSingleBranch
    className={cn("inline-flex items-center text-muted-foreground text-xs", className)}
    {...rest}
  >
    <BranchPickerPrimitive.Previous asChild>
      <TooltipIconButton tooltip="Previous">
        <ChevronLeftIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Previous>
    <span className="font-medium">
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <TooltipIconButton tooltip="Next">
        <ChevronRightIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);

const Composer: FC = () => (
  <ComposerPrimitive.Root className="relative flex w-full flex-col">
    <div className="flex w-full flex-col gap-2 rounded-[--composer-radius] border border-border bg-card p-[--composer-padding] transition-shadow focus-within:border-ring/75 focus-within:ring-2 focus-within:ring-ring/20">
      <ComposerPrimitive.Input
        placeholder="Describe a business process to model as BPMN…"
        className="max-h-40 min-h-10 w-full resize-none bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        rows={1}
        autoFocus
      />
      <div className="flex items-center justify-end">
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              tooltip="Send"
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              className="size-8 rounded-full"
            >
              <ArrowUpIcon className="size-4" />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button type="button" variant="default" size="icon" className="size-8 rounded-full">
              <SquareIcon className="size-3 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  </ComposerPrimitive.Root>
);
