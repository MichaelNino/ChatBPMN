"use client";

import { Thread } from "@/components/assistant-ui/thread";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the BPMN Modeler to prevent SSR window errors
const BpmnViewer = dynamic(() => import("@/components/diagram/bpmn-viewer"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-md" />,
});
export default function Page() {
  return (
    <main className="flex h-full w-full">
      {/* Chat Panel */}
      <section
        className="flex h-full flex-col border-r border-border"
        style={{ width: "42%" }}
        aria-label="Chat interface"
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          <span className="text-xl">⬡</span>
          <div>
            <h1 className="text-sm font-semibold text-foreground">ChatBPMN</h1>
            <p className="text-xs text-muted-foreground">AI-Native BPMN Workflow Builder</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-500" title="Ollama connected" />
            <span className="text-xs text-muted-foreground">phi4-mini</span>
          </div>
        </header>

        {/* Thread */}
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </section>

      {/* BPMN Diagram Panel */}
      <section
        className="flex h-full flex-col"
        style={{ width: "58%" }}
        aria-label="BPMN diagram viewer"
      >
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <span className="text-sm font-semibold text-foreground">BPMN Diagram</span>
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Preview
          </span>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <BpmnViewer />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
