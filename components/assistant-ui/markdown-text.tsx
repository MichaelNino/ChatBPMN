"use client";

import "@assistant-ui/react-markdown/styles/dot.css";
import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { type FC, memo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";
import { useDiagramStore } from "@/lib/store";
import { useEffect } from "react";

const MarkdownTextImpl = () => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    className="aui-md"
    components={defaultComponents}
  />
);

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { setDiagramXml } = useDiagramStore();

  useEffect(() => {
    // Only push to the diagram store once the XML block is fully closed to prevent bpmn-js race conditions during streaming.
    if (code && code.includes("definitions") && code.includes("process")) {
      const match = code.match(/<\?xml[\s\S]*<\/.*definitions>/);
      if (match) {
        const extractedXml = match[0];
        // Only update if it actually changed to prevent concurrent importXML crashes
        if (useDiagramStore.getState().diagramXml !== extractedXml) {
          setDiagramXml(extractedXml);
        }
      }
    }
  }, [code, setDiagramXml]);

  const onCopy = () => {
    if (!code || isCopied) return;
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    });
  };
  return (
    <div className="mt-2.5 flex items-center justify-between rounded-t-lg border border-border/50 border-b-0 bg-muted/50 px-3 py-1.5 text-xs">
      <span className="font-medium text-muted-foreground lowercase">{language}</span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy}>
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </TooltipIconButton>
    </div>
  );
};

const XmlSyntaxHighlighter: FC<{ code: string }> = ({ code }) => {
  const parts: React.ReactNode[] = [];
  const tagRegex = /(<!--[\s\S]*?-->)|(<\?xml[\s\S]*?\?>)|(<[^>]+>)/gi;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(code)) !== null) {
    const textBefore = code.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(<span key={`text-${lastIndex}`} className="text-foreground">{textBefore}</span>);
    }
    lastIndex = tagRegex.lastIndex;

    const [fullMatch, comment, xmlDecl, tag] = match;

    if (comment) {
      parts.push(<span key={`com-${match.index}`} className="text-slate-500 italic">{comment}</span>);
    } else if (xmlDecl) {
      parts.push(<span key={`decl-${match.index}`} className="text-amber-400 font-semibold">{xmlDecl}</span>);
    } else if (tag) {
      const innerParts: React.ReactNode[] = [];
      const isClosingTag = tag.startsWith("</");
      const prefix = isClosingTag ? "</" : "<";
      const suffix = tag.endsWith("/>") ? "/>" : ">";
      const content = tag.substring(prefix.length, tag.length - suffix.length);

      innerParts.push(<span key="prefix" className="text-slate-400">{prefix}</span>);

      if (isClosingTag) {
        innerParts.push(<span key="tagname" className="text-blue-400 font-medium">{content}</span>);
      } else {
        const firstSpace = content.search(/\s/);
        if (firstSpace === -1) {
          innerParts.push(<span key="tagname" className="text-blue-400 font-medium">{content}</span>);
        } else {
          const tagName = content.substring(0, firstSpace);
          const attrString = content.substring(firstSpace);
          innerParts.push(<span key="tagname" className="text-blue-400 font-medium">{tagName}</span>);

          const attrRegex = /([a-z0-9_:-]+)\s*=\s*("[^"]*"|'[^']*')/gi;
          let attrLastIndex = 0;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(attrString)) !== null) {
            const beforeAttr = attrString.substring(attrLastIndex, attrMatch.index);
            if (beforeAttr) {
              innerParts.push(<span key={`before-${attrMatch.index}`} className="text-slate-300">{beforeAttr}</span>);
            }
            attrLastIndex = attrRegex.lastIndex;

            innerParts.push(
              <span key={`attr-${attrMatch.index}`}>
                <span className="text-purple-300">{attrMatch[1]}</span>
                <span className="text-slate-400">=</span>
                <span className="text-emerald-300">{attrMatch[2]}</span>
              </span>
            );
          }
          const remainingAttr = attrString.substring(attrLastIndex);
          if (remainingAttr) {
            innerParts.push(<span key="rem" className="text-slate-300">{remainingAttr}</span>);
          }
        }
      }

      innerParts.push(<span key="suffix" className="text-slate-400">{suffix}</span>);
      parts.push(<span key={`tag-${match.index}`}>{innerParts}</span>);
    }
  }

  const textAfter = code.substring(lastIndex);
  if (textAfter) {
    parts.push(<span key={`text-${lastIndex}`} className="text-foreground">{textAfter}</span>);
  }

  return <>{parts}</>;
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1 className={cn("mb-2 font-semibold text-base first:mt-0 last:mb-0", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("mt-3 mb-1.5 font-semibold text-sm first:mt-0 last:mb-0", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-2.5 mb-1 font-semibold text-sm first:mt-0 last:mb-0", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-2.5 leading-normal first:mt-0 last:mb-0", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a className={cn("text-primary underline underline-offset-2 hover:text-primary/80", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-2 ms-4 list-disc marker:text-muted-foreground [&>li]:mt-1", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-2 ms-4 list-decimal marker:text-muted-foreground [&>li]:mt-1", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn("my-2.5 border-muted-foreground/30 border-s-2 ps-3 text-muted-foreground italic", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre className={cn("overflow-x-auto rounded-t-none rounded-b-lg border border-border/50 border-t-0 bg-muted/30 p-3 text-xs leading-relaxed", className)} {...props} />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    if (isCodeBlock && typeof props.children === "string") {
      return (
        <code className={cn("font-mono", className)} {...props}>
          <XmlSyntaxHighlighter code={props.children} />
        </code>
      );
    }
    return (
      <code
        className={cn(
          !isCodeBlock && "rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]",
          className
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});
