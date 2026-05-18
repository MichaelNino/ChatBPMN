#!/usr/bin/env bash
# =============================================================================
# setup.sh — ChatBPMN Full Stack Environment Setup
# Installs ALL prerequisites. Idempotent: safe to run multiple times.
# Tested on: Ubuntu 22.04+ / Debian 12+ (WSL or native)
# Usage: bash setup.sh
# =============================================================================
set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
NODE_VERSION="20"
OLLAMA_GEN_MODEL="phi4-mini"
OLLAMA_EMBED_MODEL="nomic-embed-text"
DB_DIR="data"
DB_FILE="${DB_DIR}/chatbpmn.db"
NVM_VERSION="v0.40.3"

# Files/dirs created by Next.js scaffold — wiped on re-run
NEXTJS_FILES=(
    node_modules .next package-lock.json
)
NEXTJS_DIRS=()

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

header() { echo -e "\n${BOLD}${BLUE}══════ $1 ══════${NC}\n"; }
info()   { echo -e "  ${BLUE}►${NC} $1"; }
ok()     { echo -e "  ${GREEN}✓${NC} $1"; }
warn()   { echo -e "  ${YELLOW}⚠${NC} $1"; }
die()    { echo -e "  ${RED}✗ ERROR:${NC} $1"; exit 1; }

PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$PROJECT_DIR"

echo -e "${BOLD}${BLUE}"
echo "  ██████╗██╗  ██╗ █████╗ ████████╗██████╗ ██████╗ ███╗   ███╗███╗   ██╗"
echo "  ██╔════╝██║  ██║██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗████╗ ████║████╗  ██║"
echo "  ██║     ███████║███████║   ██║   ██████╔╝██████╔╝██╔████╔██║██╔██╗ ██║"
echo "  ██║     ██╔══██║██╔══██║   ██║   ██╔══██╗██╔═══╝ ██║╚██╔╝██║██║╚██╗██║"
echo "  ╚██████╗██║  ██║██║  ██║   ██║   ██████╔╝██║     ██║ ╚═╝ ██║██║ ╚████║"
echo "   ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝     ╚═╝     ╚═╝╚═╝  ╚═══╝"
echo -e "${NC}"
echo -e "  AI-Native BPMN Workflow Builder + MCP Server"
echo -e "  Environment Setup — running from: ${PROJECT_DIR}\n"

# ─── 1. System Packages ───────────────────────────────────────────────────────
header "System Packages"

if command -v apt-get &>/dev/null; then
    info "Updating apt package index..."
    sudo apt-get update -qq
    info "Installing system dependencies..."
    sudo apt-get install -y -qq curl git build-essential ca-certificates zstd
    ok "System packages ready"
elif command -v yum &>/dev/null; then
    info "Installing system dependencies via yum..."
    sudo yum install -y -q curl git gcc gcc-c++ make ca-certificates
    ok "System packages ready"
else
    warn "Unknown package manager. Ensure curl, git, and build-essential are installed."
fi

# ─── 2. Node.js via nvm ───────────────────────────────────────────────────────
header "Node.js Setup (via nvm)"

export NVM_DIR="$HOME/.nvm"

# Install nvm if not present
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    info "Installing nvm ${NVM_VERSION}..."
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    ok "nvm installed"
else
    ok "nvm already installed"
fi

# Source nvm for this session
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"

# Install and use Node.js LTS
if nvm ls "$NODE_VERSION" &>/dev/null; then
    ok "Node.js ${NODE_VERSION} already installed"
else
    info "Installing Node.js ${NODE_VERSION} LTS..."
    nvm install "$NODE_VERSION"
    ok "Node.js ${NODE_VERSION} installed"
fi

nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

ok "Node.js $(node -v) active"
ok "npm $(npm -v) active"

# ─── 3. Ollama ────────────────────────────────────────────────────────────────
header "Ollama Setup"

if command -v ollama &>/dev/null; then
    ok "Ollama already installed ($(ollama --version 2>&1 | head -1))"
else
    info "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    ok "Ollama installed"
fi

# Start Ollama server if not running
if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    ok "Ollama server is already running"
else
    info "Starting Ollama server in background..."
    ollama serve &>/tmp/ollama-chatbpmn.log &
    info "Waiting for Ollama to become ready..."
    for i in {1..20}; do
        sleep 1
        if curl -sf http://localhost:11434/api/tags &>/dev/null; then
            ok "Ollama server is ready"
            break
        fi
        if [ "$i" -eq 20 ]; then
            die "Ollama server did not start. Check /tmp/ollama-chatbpmn.log"
        fi
        echo -n "."
    done
    echo ""
fi

# Pull models (skips if already present)
for model in "$OLLAMA_GEN_MODEL" "$OLLAMA_EMBED_MODEL"; do
    if ollama list 2>/dev/null | grep -q "$model"; then
        ok "Model '${model}' already available"
    else
        info "Pulling model: ${model} (may take several minutes on first run)..."
        ollama pull "$model"
        ok "Model '${model}' ready"
    fi
done

# ─── 4. Clean Previous Next.js Installation ───────────────────────────────────
header "Cleaning Previous Installation"

for item in "${NEXTJS_FILES[@]}" "${NEXTJS_DIRS[@]}"; do
    if [ -e "$item" ]; then
        rm -rf "$item"
        info "Removed: $item"
    fi
done
ok "Workspace cleaned"

# ─── 5. Scaffold Next.js App ──────────────────────────────────────────────────
# header "Scaffolding Next.js App"
# 
# SCAFFOLD_TMP="/tmp/chatbpmn-scaffold"
# rm -rf "$SCAFFOLD_TMP"
# 
# npx -y create-next-app@latest "$SCAFFOLD_TMP" \
#     --typescript \
#     --eslint \
#     --no-tailwind \
#     --app \
#     --no-src-dir \
#     --import-alias "@/*" \
#     --yes
# 
# # Move generated files into the project root (skip .git)
# rsync -a --exclude='.git' --exclude='README.md' "$SCAFFOLD_TMP/" "$PROJECT_DIR/"
# rm -rf "$SCAFFOLD_TMP"
# 
# ok "Skipped create-next-app scaffold to preserve custom ChatBPMN source code"

# ─── 6. Install Additional Dependencies ───────────────────────────────────────
header "Installing Dependencies"

npm install \
    bpmn-js \
    better-sqlite3 \
    @modelcontextprotocol/sdk \
    uuid \
    zod \
    marked \
    @assistant-ui/react \
    @assistant-ui/react-ai-sdk \
    @assistant-ui/react-markdown \
    ai \
    ollama-ai-provider-v2 \
    class-variance-authority \
    radix-ui \
    @radix-ui/react-tooltip \
    @radix-ui/react-collapsible \
    remark-gfm \
    tw-shimmer \
    zustand \
    lucide-react \
    tailwindcss \
    @tailwindcss/postcss \
    clsx \
    tailwind-merge

npm install --save-dev \
    @types/better-sqlite3 \
    @types/uuid

ok "All dependencies installed"

# ─── 6b. Write Landing Page (README.md → HTML) ────────────────────────────────
# header "Writing Landing Page"
# The default README landing page logic is commented out because we now have a 
# real ChatBPMN app dashboard in app/page.tsx.

# ok "Skipped overwriting app/page.tsx and app/globals.css"

# ─── 7. Initialise Database Schema ────────────────────────────────────────────
header "Initialising Database"

mkdir -p "$DB_DIR"
mkdir -p lib/db

# Drop stale DB for a clean slate on re-run
if [ -f "$DB_FILE" ]; then
    rm -f "$DB_FILE"
    info "Removed previous database"
fi

cat > lib/db/schema.sql << 'SQL'
-- ChatBPMN Database Schema

CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    bpmn_xml    TEXT NOT NULL,       -- Raw BPMN 2.0 XML
    svg         TEXT,                -- Rendered SVG string
    embedding   BLOB,                -- Float32 vector (RAG)
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id         TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_session  ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created  ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_created ON workflows(created_at);
SQL

ok "Schema written → lib/db/schema.sql"
ok "Database will initialise on first app start → ${DB_FILE}"

# ─── 8. Environment Configuration ─────────────────────────────────────────────
header "Environment Configuration"

cat > .env.local << ENV
# ChatBPMN — Local Environment Configuration
# Auto-generated by setup.sh — safe to customise

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_GEN_MODEL=${OLLAMA_GEN_MODEL}
OLLAMA_EMBED_MODEL=${OLLAMA_EMBED_MODEL}

# Database
DB_PATH=${DB_FILE}
ENV

ok ".env.local created"

# ─── 9. Verification ─────────────────────────────────────────────────────────
header "Verification"

APP_PORT=3000
DEV_LOG="/tmp/chatbpmn-dev.log"

info "Starting dev server on port ${APP_PORT} for verification..."
npm run dev -- --hostname 0.0.0.0 --port "$APP_PORT" &> "$DEV_LOG" &
DEV_PID=$!

info "Waiting for http://localhost:${APP_PORT} to respond..."
VERIFIED=false
for i in {1..30}; do
    sleep 2
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}" 2>/dev/null || true)
    if [ "$HTTP_STATUS" = "200" ]; then
        VERIFIED=true
        break
    fi
done

# Shut down the dev server
kill "$DEV_PID" 2>/dev/null || true
wait "$DEV_PID" 2>/dev/null || true

if [ "$VERIFIED" = true ]; then
    ok "Verification passed — http://localhost:${APP_PORT} returned HTTP 200 ✓"
else
    warn "Verification failed — server did not respond with HTTP 200 within 60s"
    warn "Check log: ${DEV_LOG}"
fi

# ─── 10. Git — stage newly generated files ────────────────────────────────────
header "Updating Git"

git add -A
ok "All files staged (run 'git status' to review before committing)"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   ChatBPMN environment is ready!  ✓      ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Start dev server:${NC}   npm run dev"
echo -e "  ${BOLD}App URL:${NC}            http://localhost:3000"
echo -e "  ${BOLD}Ollama API:${NC}         http://localhost:11434"
echo -e "  ${BOLD}Database:${NC}           ${PROJECT_DIR}/${DB_FILE}"
echo ""
echo -e "  ${YELLOW}NOTE:${NC} If 'npm run dev' fails, source nvm first:"
echo -e "  ${BOLD}source ~/.nvm/nvm.sh && nvm use ${NODE_VERSION}${NC}"
echo ""
