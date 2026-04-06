# GhidrAssist Workflow for MPBT World Protocol RE

This playbook sets up a repeatable AI-assisted reverse-engineering loop for the
current post-lobby targets in this repo. The goal is to use AI for triage,
naming, summarization, and hypothesis generation while keeping Ghidra, packet
captures, and manual validation as the source of truth.

If you are specifically using the `bethington/ghidra-mcp` bridge and plugin,
follow the bridge-aware companion docs:

- [`ghidra-mcp-workflow.md`](./ghidra-mcp-workflow.md)
- [`ghidra-mcp-prompts.md`](./ghidra-mcp-prompts.md)
- [`ghidra-mcp-session-01-world-handshake.md`](./ghidra-mcp-session-01-world-handshake.md)

## Scope

Use this workflow for the targets that start after the lobby redirect:

- Post-`REDIRECT` world handshake
- RPS/world command expansion beyond the first confirmed handlers
- F7/F8 chat channel differentiation
- World movement, room list, and player event packets
- Combat mode crossover and combat command tracing

Start with the local references already in this repo:

- [`RESEARCH.md`](../RESEARCH.md)
- [`ROADMAP.md`](../ROADMAP.md)
- [`symbols.json`](../symbols.json)
- [`research/README.md`](../research/README.md)

## Toolchain

Recommended Ghidra-side stack:

1. `GhidrAssist`
   - Repo: <https://github.com/symgraph/GhidrAssist>
   - Use it for chat, summaries, RAG, and controlled agentic investigation.
2. `GhidrAssistMCP`
   - Repo: <https://github.com/symgraph/GhidrAssistMCP>
   - Use it to expose Ghidra program state and actions to the AI through MCP.

The official READMEs currently describe:

- `Ghidra 11.4+`
- `GhidrAssistMCP` install via `File -> Install Extensions -> Add Extension`
- `GhidrAssistMCP` plugin enablement via `File -> Configure -> Configure Plugins`
- `GhidrAssistMCP` control panel via `Window -> GhidrAssistMCP`
- default `GhidrAssistMCP` host `localhost` and port `8080`
- `GhidrAssist` support for OpenAI v1-compatible APIs and built-in support for `GhidrAssistMCP`

## One-Time Setup

### 1. Install the two Ghidra extensions

1. Install `GhidrAssistMCP` from its release ZIP, restart Ghidra, and enable the plugin.
2. Install `GhidrAssist`, restart Ghidra, and enable it in the CodeBrowser.
3. Open both windows:
   - `Window -> GhidrAssistMCP`
   - `Window -> GhidraAssistPlugin`

### 2. Configure the AI provider in GhidrAssist

Use one of these modes:

- Local model for bulk naming/summarization work
- Strong reasoning model for packet schema and control-flow tracing

Set the API host and key in GhidrAssist. Keep reasoning turned up for packet and
dispatcher work; use a lighter mode for repetitive rename passes.

### 3. Turn on the local MCP server

In `GhidrAssistMCP`:

1. Confirm host `localhost`
2. Confirm port `8080`
3. Enable the server
4. Keep the logging pane visible while you work

In `GhidrAssist`:

1. Open the MCP Servers tab
2. Add the local `GhidrAssistMCP` server using the endpoint shown in the MCP panel
3. Verify tool access before starting an investigation

### 4. Load the right binaries together

Open these in the same Ghidra project:

- `MPBTWIN.EXE`
- `COMMEG32.DLL`
- `INITAR.DLL`

This matters because the current world targets cross between the launcher,
network DLL, and game client.

## Repo Context to Feed Into RAG

Add these files to GhidrAssist RAG before doing world-protocol work:

- [`RESEARCH.md`](../RESEARCH.md)
- [`ROADMAP.md`](../ROADMAP.md)
- [`symbols.json`](../symbols.json)
- [`README.md`](../README.md)
- [`BT-MAN.txt`](../BT-MAN.txt)

Optional local-only RAG material from `research/`:

- `BT-MAN.decrypted.txt`
- `IS.MAP`
- `SOLARIS.MAP`
- `Gnum*.txt`

Use RAG for project context, not binary truth. If the model says something that
the decompile or capture contradicts, trust the decompile or capture.

## Current Target Queue

Work top to bottom unless a live capture gives you a better opening.

| Target | Binary focus | Good entry points | Deliverable |
|---|---|---|---|
| World handshake after `REDIRECT` | `COMMEG32.DLL`, `MPBTWIN.EXE` | `FUN_100014e0`, `FUN_00429870`, strings `MMW` / `MMC` | exact byte flow and first required server responses |
| RPS world command expansion | `MPBTWIN.EXE` | `DAT_00470198`, `FUN_00402cf0`, first unknown non-null handlers | canonical names and per-command packet schemas |
| Chat channels `F7` / `F8` | `MPBTWIN.EXE` | key handlers, send helpers, text-window code | client-send packet format and team/all routing rule |
| Movement and room transitions | `MPBTWIN.EXE`, map files | cmd 4, 8, 9, 10, 11-13 handlers plus `IS.MAP` / `SOLARIS.MAP` | room/state packet layouts and movement state model |
| Combat crossover | `MPBTWIN.EXE` | `g_combatMode`, `Frame_VerifyCRC`, `MMC` path, combat dispatch table | precise transition trigger and first combat frames |
| Combat input tracing | `MPBTWIN.EXE` | weapon, TIC, jump, stand, eject key paths | client-send packet schemas and server expectations |

## Session Loop

Use the same loop every time:

1. Pick one target and define one concrete question.
2. Manually collect anchors first:
   - current function
   - xrefs
   - nearby strings
   - globals touched
   - one packet capture if available
3. Ask GhidrAssist for a bounded answer:
   - candidate name
   - packet field table
   - state machine summary
   - next 2 manual checks
4. Use MCP tools to fetch the missing context:
   - current function
   - decompile/disassembly
   - caller/callee chain
   - strings or imports
   - data at dispatch-table addresses
5. Re-ask with the richer context and demand confidence labels.
6. Validate the claim manually in Ghidra.
7. Only after validation:
   - rename functions/globals
   - update comments
   - update [`symbols.json`](../symbols.json)
   - update [`RESEARCH.md`](../RESEARCH.md)

## Recommended MCP-First Work Pattern

Prefer this sequence inside GhidrAssist:

1. `get_current_function` or `search_functions_by_name`
2. `analyze_function`
3. `get_code` with `decompiler`
4. `get_code` with `disassembly` if control flow looks suspicious
5. `get_strings` or `search_strings`
6. `get_data_at` for dispatch tables, globals, or embedded packet constants

That keeps the model grounded in concrete binary evidence before it starts
suggesting names or schemas.

## MPBT-Specific Ground Rules

- Treat AI output as `hypothesis`, not `finding`, until it is confirmed by
  xrefs, disassembly, or packet captures.
- Do not bulk-rename unknown command handlers in one pass.
- Keep RPS/world and combat work separate unless the evidence clearly crosses
  through `g_combatMode`.
- Preserve the repo's naming conventions from [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- When a claim depends on proprietary local files in `research/`, record the
  conclusion in public terms and do not paste copyrighted content into the repo.

## What to Commit After a Good Session

At the end of a successful investigation, capture the result in this order:

1. `symbols.json`
2. `RESEARCH.md`
3. code changes, if the protocol is now understood well enough
4. `ROADMAP.md`, only if the milestone state actually changed

Use a `research/...` branch name when the session is mostly RE and docs work.

## Suggested First Session

If you want the fastest high-value loop, start here:

1. Open `MPBTWIN.EXE` and `COMMEG32.DLL`
2. Add repo docs to GhidrAssist RAG
3. Target: post-`REDIRECT` world handshake
4. Trace:
   - `FUN_100014e0`
   - `FUN_00429870`
   - `"\x1b?MMW Copyright Kesmai Corp. 1991"`
5. Produce:
   - exact welcome gate conditions
   - first world command emitted by the client
   - minimum server frame sequence needed to keep the world client stable

Then move to the next unknown world command entry instead of jumping straight to
combat.
