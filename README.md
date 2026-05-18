# ⬡ ChatBPMN

![Next.js](https://img.shields.io/badge/Next.js-16.2%20Turbopack-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)
![Ollama](https://img.shields.io/badge/Ollama-phi4--mini-white?style=flat-square&logo=ollama)
![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?style=flat-square&logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)

**ChatBPMN** is an AI-native, 100% local, privacy-first business process modeling environment. It translates natural language workflow descriptions into pristine, industry-standard BPMN 2.0 diagrams using local LLMs, automatic geometric layout calculation, and an interactive diagram canvas.

---

## ✨ Key Features

- 🧠 **100% Local AI Inference**: Powered by Ollama (`phi4-mini`) for zero-latency, privacy-compliant workflow generation without sending proprietary business logic to third-party APIs.
- ⚡ **Automated Geometric Layout**: Integrated with `bpmn-auto-layout`, completely eliminating the need for LLMs to hallucinate complex Diagram Interchange (DI) bounding boxes or waypoint coordinates.
- 🎨 **Hydration-Safe Syntax Highlighting**: Features a custom, lightweight XML syntax highlighter that provides beautiful, colored XML code blocks in the chat stream without breaking AST parsers or diagram rendering.
- 📊 **Interactive BPMN Canvas**: Built on top of `bpmn-js`, allowing real-time diagram preview, panning, zooming, and direct SVG export.
- 🔌 **Model Context Protocol (MCP) Ready**: Built-in MCP server architecture for seamless integration with agentic IDEs, enterprise RAG pipelines, and external AI workflows.
- 📦 **Zero-Config Setup**: Includes an idempotent, fully automated `setup.sh` script that handles system dependencies, Node.js (
