"use client";

import { useEffect, useRef } from "react";
import Modeler from "bpmn-js/lib/Modeler";
// @ts-expect-error - no types available
import { layoutProcess } from "bpmn-auto-layout";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import { useDiagramStore } from "@/lib/store";

// No DEFAULT_BPMN_XML needed, Modeler has createDiagram()

function sanitizeBpmnXml(xml: string) {
  let cleanXml = xml;

  // 0. NORMALIZE ALL HALLUCINATED BPMN NAMESPACE PREFIXES (e.g. bpm2:, bpm:, bpmn:, bpmn7:) TO bpmn2:
  cleanXml = cleanXml.replace(/xmlns:bpm[n]?[0-9]*="/gi, 'xmlns:bpmn2="');
  cleanXml = cleanXml.replace(/<(<\/)?bpm[n]?[0-9]*:/gi, '<$1bpmn2:');
  cleanXml = cleanXml.replace(/<\/bpm[n]?[0-9]*:/gi, '</bpmn2:');

  // 1. Strip out all XML comments completely (both closed and unclosed) to prevent parser choking
  cleanXml = cleanXml.replace(/<!--[\s\S]*?-->/g, '');
  cleanXml = cleanXml.replace(/<!--[^<]*/g, '');

  // 2. Fix unescaped ampersands which cause fatal XML parsing errors in auto-layout
  cleanXml = cleanXml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/g, '&amp;');

  // 3. Fix spaces in id attributes hallucinated by small LLMs (e.g. id="Create Salary Package")
  cleanXml = cleanXml.replace(/\bid="([^"]+)"/g, (match, p1) => `id="${p1.replace(/\s+/g, '_')}"`);

  // 4. Fix malformed nested event tags hallucinated by small LLMs (e.g. <startEvent><endEvent/> Name="..."</startEvent>)
  cleanXml = cleanXml.replace(/<([a-z0-9]+:)?startEvent([^>]*)>\s*<([a-z0-9]+:)?endEvent\/>\s*name="([^"]*)"\s*<\/([a-z0-9]+:)?startEvent>/gi, '<$1endEvent$2 name="$4" />');

  // 4b. CONVERT CHILD NAME TAGS TO NAME ATTRIBUTES: If the LLM hallucinated <bpmn2:name> or <name> as a child tag instead of an attribute, inject it into the parent opening tag.
  cleanXml = cleanXml.replace(/<([a-z0-9]+:)?(task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|callActivity|startEvent|endEvent|intermediateCatchEvent|intermediateThrowEvent|boundaryEvent|exclusiveGateway|parallelGateway|eventBasedGateway|complexGateway|subProcess)([^>]*)>\s*<([a-z0-9]+:)?name>([\s\S]*?)<\/([a-z0-9]+:)?name>/gi, (match, p1, p2, p3, p4, p5) => {
    if (/name\s*=/i.test(p3)) {
      return `<${p1 || ''}${p2}${p3}>`;
    }
    return `<${p1 || ''}${p2}${p3} name="${p5.trim().replace(/"/g, '&quot;')}">`;
  });

  // 5. Safely remove unclosed sequenceFlow or task tags that collide with the next major element tag
  cleanXml = cleanXml.replace(/<([a-z0-9]+:)?sequenceFlow[^>]*?(?=<([a-z0-9]+:)?(task|subProcess|startEvent|endEvent|userTask|serviceTask|exclusiveGateway|parallelGateway))/gi, '');
  cleanXml = cleanXml.replace(/<([a-z0-9]+:)?[a-zA-Z0-9]+[^>]*?(?=<([a-z0-9]+:)?(task|subProcess|startEvent|endEvent|userTask|serviceTask|exclusiveGateway|parallelGateway|sequenceFlow))/gi, '');

  // 5b. ULTIMATE FLOW NODE NORMALIZER: Since all inner tags (incoming, outgoing, timers) are stripped, major flow nodes (except subProcess, process, definitions) have no valid inner elements.
  // We convert all opening tags for these flow nodes into self-closing tags (/>) and completely eliminate their closing tags. This permanently prevents any 'closing tag mismatch' or 'unparsable content' errors caused by LLMs wrapping tasks inside gateways or mismatching tags.
  const selfClosingNodes = [
    'task', 'userTask', 'serviceTask', 'scriptTask', 'manualTask', 'sendTask', 'receiveTask', 'businessRuleTask', 'callActivity',
    'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
    'exclusiveGateway', 'parallelGateway', 'eventBasedGateway', 'complexGateway'
  ];
  selfClosingNodes.forEach(tag => {
    // 1. Remove all separate closing tags for this node type
    cleanXml = cleanXml.replace(new RegExp(`<\/([a-z0-9]+:)?${tag}[^>]*>`, 'gi'), '');
    // 2. Ensure the opening tag is perfectly self-closing (ends with /> and has no invalid spacing like / >)
    cleanXml = cleanXml.replace(new RegExp(`<([a-z0-9]+:)?${tag}[^>]*>`, 'gi'), match => {
      let cleaned = match.replace(/\/+\s*>$/, '>').replace(/\s*>$/, '');
      if (cleaned.endsWith('/')) {
        cleaned = cleaned.slice(0, -1).trim();
      }
      return cleaned + ' />';
    });
  });

  // 5c. ORPHANED CLOSING TAG ELIMINATOR FOR CONTAINER NODES (subProcess)
  const containerTags = ['subProcess'];
  containerTags.forEach(tag => {
    const totalOpenRegex = new RegExp(`<([a-z0-9]+:)?${tag}[^>]*>`, 'gi');
    const selfClosingRegex = new RegExp(`<([a-z0-9]+:)?${tag}[^>]*\\/>`, 'gi');
    const closeRegex = new RegExp(`<\/([a-z0-9]+:)?${tag}>`, 'gi');
    const totalOpenCount = (cleanXml.match(totalOpenRegex) || []).length;
    const selfClosingCount = (cleanXml.match(selfClosingRegex) || []).length;
    const openCount = totalOpenCount - selfClosingCount;
    const closeCount = (cleanXml.match(closeRegex) || []).length;
    if (closeCount > openCount) {
      let diff = closeCount - openCount;
      while (diff > 0) {
        const lastCloseIndex = cleanXml.lastIndexOf(`</bpmn2:${tag}>`) !== -1 ? cleanXml.lastIndexOf(`</bpmn2:${tag}>`) : cleanXml.lastIndexOf(`</bpmn:${tag}>`);
        if (lastCloseIndex !== -1) {
          cleanXml = cleanXml.substring(0, lastCloseIndex) + cleanXml.substring(lastCloseIndex + `</bpmn2:${tag}>`.length);
        } else {
          break;
        }
        diff--;
      }
    }
  });

  // 6. Strip out known hallucinated invalid inner tags inside tasks and flows, including hallucinated namespaces (bpmn7:*, incoming, outgoing, extensionElements)
  // First, remove complete inner tag blocks including their text content (e.g. <bpmn2:incoming>Flow_1</bpmn2:incoming>)
  cleanXml = cleanXml.replace(/<([a-z0-9]+:)?(incoming|outgoing|extensionElements|messageIds|startEventRef|endEventRef|dataInputParameter|dataInputParameters|conditionExpression|createInstanceBusinessRuleExpression|stringParameter|textInputOutput|startTimer|timerEventDefinition|timeDuration|completionCondition|documentation|script|expression)[^>]*>([\s\S]*?<\/\1\2>)?/gi, '');
  cleanXml = cleanXml.replace(/<bpmn[3-9]:[^>]*>([\s\S]*?<\/bpmn[3-9]:[^>]*>)?/gi, '');

  // Second, remove self-closing inner tags
  cleanXml = cleanXml.replace(/<([a-z0-9]+:)?(incoming|outgoing|extensionElements|messageIds|startEventRef|endEventRef|dataInputParameter|dataInputParameters|conditionExpression|createInstanceBusinessRuleExpression|stringParameter|textInputOutput|startTimer|timerEventDefinition|timeDuration|completionCondition|documentation|script|expression)[^>]*\/>/gi, '');
  cleanXml = cleanXml.replace(/<bpmn[3-9]:[^>]*\/>/gi, '');

  // Third, completely remove any orphaned closing tags for inner elements to prevent 'missing open tag' errors
  cleanXml = cleanXml.replace(/<\/([a-z0-9]+:)?(incoming|outgoing|extensionElements|messageIds|startEventRef|endEventRef|dataInputParameter|dataInputParameters|conditionExpression|createInstanceBusinessRuleExpression|stringParameter|textInputOutput|startTimer|timerEventDefinition|timeDuration|completionCondition|documentation|script|expression)>/gi, '');
  cleanXml = cleanXml.replace(/<\/bpmn[3-9]:[^>]*>/gi, '');

  // Fourth, remove any lingering unclosed opening inner tags
  cleanXml = cleanXml.replace(/<([a-z0-9]+:)?(incoming|outgoing|extensionElements|messageIds|startEventRef|endEventRef|dataInputParameter|dataInputParameters|conditionExpression|createInstanceBusinessRuleExpression|stringParameter|textInputOutput|startTimer|timerEventDefinition|timeDuration|completionCondition|documentation|script|expression)[^>]*>/gi, '');
  cleanXml = cleanXml.replace(/<bpmn[3-9]:[^>]*>/gi, '');

  const requiredNamespace = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
  
  if (!cleanXml.includes(requiredNamespace)) {
    // Replace wrong namespaces if the LLM hallucinated them
    cleanXml = cleanXml.replace(/xmlns:bpmn2="[^"]*"/g, `xmlns:bpmn2="${requiredNamespace}"`);
    cleanXml = cleanXml.replace(/xmlns:bpmn="[^"]*"/g, `xmlns:bpmn="${requiredNamespace}"`);
    
    // If it was completely omitted, inject it into the definitions tag
    if (!cleanXml.includes(requiredNamespace)) {
      cleanXml = cleanXml.replace(/<([a-z0-9]+:)?definitions/, `<$1definitions xmlns:bpmn2="${requiredNamespace}" xmlns:bpmn="${requiredNamespace}" `);
    }
  }

  if (!cleanXml.includes('xmlns:bpmn2=')) {
    cleanXml = cleanXml.replace(/<([a-z0-9]+:)?definitions/, `<$1definitions xmlns:bpmn2="${requiredNamespace}" `);
  }

  // Gracefully handle LLM hallucinations of execution namespaces to prevent fatal parser crashes
  if (cleanXml.includes("camunda:") && !cleanXml.includes("xmlns:camunda")) {
    cleanXml = cleanXml.replace(/<([a-z0-9]+:)?definitions/, `<$1definitions xmlns:camunda="http://camunda.org/schema/1.0/bpmn" `);
  }
  if (cleanXml.includes("zeebe:") && !cleanXml.includes("xmlns:zeebe")) {
    cleanXml = cleanXml.replace(/<([a-z0-9]+:)?definitions/, `<$1definitions xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" `);
  }

  // 7. POWERHOUSE AUTO-WIRING ALGORITHM: Extract all valid flow nodes and ensure pristine sequenceFlow connections
  const nodeRegex = /<([a-z0-9]+:)?(startEvent|endEvent|task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|callActivity|exclusiveGateway|parallelGateway|eventBasedGateway|complexGateway|intermediateCatchEvent|intermediateThrowEvent|boundaryEvent|subProcess)\s+([^>]*id="[^"]+"[^>]*)>/gi;
  const nodes: { id: string; type: string; attrs: string; incoming: string[]; outgoing: string[] }[] = [];
  let match;
  while ((match = nodeRegex.exec(cleanXml)) !== null) {
    const type = match[2];
    let attrs = match[3].replace(/\/+$/, '').trim();
    const idMatch = attrs.match(/\bid="([^"]+)"/i);
    if (idMatch) {
      nodes.push({ id: idMatch[1], type, attrs, incoming: [], outgoing: [] });
    }
  }

  if (nodes.length > 1) {
    let autoFlows = "";
    let flowCount = 0;
    let lastGatewayIndex: number | null = null;

    for (let i = 0; i < nodes.length - 1; i++) {
      const curr = nodes[i];
      const next = nodes[i+1];

      if (curr.type === 'exclusiveGateway' || curr.type === 'parallelGateway') {
        lastGatewayIndex = i;
      }

      if (curr.type === 'endEvent') {
        if (lastGatewayIndex !== null) {
          const flowId = `Flow_Auto_${flowCount++}`;
          nodes[lastGatewayIndex].outgoing.push(flowId);
          next.incoming.push(flowId);
          autoFlows += `\n    <bpmn2:sequenceFlow id="${flowId}" sourceRef="${nodes[lastGatewayIndex].id}" targetRef="${next.id}" />`;
        } else if (i > 0) {
          const flowId = `Flow_Auto_${flowCount++}`;
          nodes[i-1].outgoing.push(flowId);
          next.incoming.push(flowId);
          autoFlows += `\n    <bpmn2:sequenceFlow id="${flowId}" sourceRef="${nodes[i-1].id}" targetRef="${next.id}" />`;
        }
        continue;
      }

      const flowId = `Flow_Auto_${flowCount++}`;
      curr.outgoing.push(flowId);
      next.incoming.push(flowId);
      autoFlows += `\n    <bpmn2:sequenceFlow id="${flowId}" sourceRef="${curr.id}" targetRef="${next.id}" />`;
    }

    let pristineNodesXml = "";
    nodes.forEach(node => {
      pristineNodesXml += `\n    <bpmn2:${node.type} ${node.attrs}>`;
      node.incoming.forEach(flowId => {
        pristineNodesXml += `\n      <bpmn2:incoming>${flowId}</bpmn2:incoming>`;
      });
      node.outgoing.forEach(flowId => {
        pristineNodesXml += `\n      <bpmn2:outgoing>${flowId}</bpmn2:outgoing>`;
      });
      pristineNodesXml += `\n    </bpmn2:${node.type}>`;
    });

    const processMatch = cleanXml.match(/<([a-z0-9]+:)?process([^>]*)>/i);
    const processAttrs = processMatch ? processMatch[2].trim() : 'id="Process_1" isExecutable="false"';
    const defsMatch = cleanXml.match(/<([a-z0-9]+:)?definitions([^>]*)>/i);
    const defsAttrs = defsMatch ? defsMatch[2].trim() : 'xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" targetNamespace="http://bpmn.io/schema/bpmn"';

    cleanXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions ${defsAttrs}>
  <bpmn2:process ${processAttrs}>${pristineNodesXml}${autoFlows}
  </bpmn2:process>
</bpmn2:definitions>`;
  }

  return cleanXml;
}

const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd" id="sample-diagram" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds height="36.0" width="36.0" x="412.0" y="240.0"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

function injectBpmnLabels(xml: string) {
  return xml.replace(/(<bpmndi:BPMNShape[^>]*>)([\s\S]*?)(<\/bpmndi:BPMNShape>)/gi, (match, p1, p2, p3) => {
    if (!p2.includes("BPMNLabel")) {
      return `${p1}${p2} <bpmndi:BPMNLabel />\n${p3}`;
    }
    return match;
  });
}

export default function BpmnViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { diagramXml } = useDiagramStore();

  useEffect(() => {
    // Suppress Next.js development overlay for harmless internal bpmn-js Canvas errors
    const suppressBpmnErrors = (event: PromiseRejectionEvent | ErrorEvent) => {
      const msg = 'reason' in event ? (event.reason?.message || '') : (event.message || '');
      if (msg && msg.includes("root-0")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('unhandledrejection', suppressBpmnErrors as EventListener, { capture: true });
    window.addEventListener('error', suppressBpmnErrors as EventListener, { capture: true });

    return () => {
      window.removeEventListener('unhandledrejection', suppressBpmnErrors as EventListener, { capture: true });
      window.removeEventListener('error', suppressBpmnErrors as EventListener, { capture: true });
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let modelerInstance: Modeler | null = null;
    let timer: NodeJS.Timeout;

    const initialize = async () => {
      if (isCancelled || !containerRef.current) return;

      // bpmn-js Canvas.getLayer crashes with root-0 if the container has 0 dimensions during initialization.
      // We must wait for Next.js to fully paint the layout before calling importXML or createDiagram.
      if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
        timer = setTimeout(initialize, 50);
        return;
      }

      try {
        modelerInstance = new Modeler({
          container: containerRef.current
        });

        const fitAndCenter = () => {
          if (!isCancelled && modelerInstance) {
            try {
              const canvas = modelerInstance.get("canvas") as any;
              canvas.zoom("fit-viewport", "auto");
              
              // Flawless mathematical centering calculation to guarantee dead-center alignment
              const viewbox = canvas.viewbox();
              if (viewbox && viewbox.inner && viewbox.outer) {
                canvas.viewbox({
                  x: viewbox.inner.x - (viewbox.outer.width - viewbox.inner.width) / 2,
                  y: viewbox.inner.y - (viewbox.outer.height - viewbox.inner.height) / 2,
                  width: viewbox.outer.width,
                  height: viewbox.outer.height,
                });
              }
            } catch (e) {
              // ignore canvas zoom errors
            }
          }
        };

        if (!diagramXml) {
          await modelerInstance.importXML(emptyBpmn);
          fitAndCenter();
        } else {
          const sanitizedXml = sanitizeBpmnXml(diagramXml);
          try {
            const laidOutXml = await layoutProcess(sanitizedXml);
            if (!isCancelled) {
              const finalXml = injectBpmnLabels(laidOutXml);
              await modelerInstance.importXML(finalXml);
              fitAndCenter();
              setTimeout(fitAndCenter, 50);
            }
          } catch (err) {
            console.warn("Auto-layout failed, attempting raw import...", err);
            if (!isCancelled) {
              const finalXml = injectBpmnLabels(sanitizedXml);
              await modelerInstance.importXML(finalXml);
              fitAndCenter();
              setTimeout(fitAndCenter, 50);
            }
          }
        }
      } catch (fatalErr: any) {
        if (!isCancelled && fatalErr?.message && !fatalErr.message.includes("root-0")) {
          console.error("Diagram import failed:", fatalErr);
        }
      }
    };

    // Start the initialization loop
    initialize();

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (modelerInstance) {
        try {
          modelerInstance.destroy();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [diagramXml]);

  return (
    <div className="relative w-full h-full bg-white text-black min-h-[500px]">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
