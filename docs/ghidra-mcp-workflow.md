# GhidraMCP Workflow for MPBT World Protocol RE

This playbook assumes your local environment already has:

- `Ghidra 12.0.3`
- `GhidraMCP` installed and enabled in CodeBrowser
- `bridge_mcp_ghidra.py` running
- the Ghidra-side HTTP server started from `Tools -> GhidraMCP -> Start MCP Server`

The goal here is not installation. It is to turn the running
[`bethington/ghidra-mcp`](https://github.com/bethington/ghidra-mcp) stack into a
repeatable reverse-engineering loop for the current MPBT world-protocol targets.

## Mental Model

The stack has three layers:

1. your AI client talks MCP to `bridge_mcp_ghidra.py`
2. the bridge talks HTTP to the local Ghidra plugin, usually at `127.0.0.1:8089`
3. the plugin talks to the open Ghidra program through the Ghidra API

For MPBT, this matters because we want to keep the workflow evidence-first:

- use read-only tools to inspect
- validate with decompile, xrefs, and strings
- only then rename, type, or comment

## Current MPBT Targets

Use `ghidra-mcp` mainly for the targets that start after lobby completion:

- post-`REDIRECT` world handshake
- world/RPS dispatch-table expansion
- `F7` / `F8` chat differentiation
- movement / room-state packets
- combat-mode crossover
- combat input tracing

Project references:

- [`RESEARCH.md`](../RESEARCH.md)
- [`ROADMAP.md`](../ROADMAP.md)
- [`symbols.json`](../symbols.json)
- [`BT-MAN.txt`](../BT-MAN.txt)

## Recommended Program Set

Keep these open in one Ghidra project:

- `MPBTWIN.EXE`
- `COMMEG32.DLL`
- `INITAR.DLL`

Then use multi-program support explicitly instead of assuming the active program
is the one you wanted.

## Session Start Checklist

Run these first at the beginning of every session:

1. `check_connection`
2. `get_version`
3. `list_open_programs`
4. `get_current_program_info`
5. `switch_program` to the binary you actually want
6. `save_program` only after meaningful confirmed edits

If the bridge is healthy but analysis looks incomplete:

1. `list_analyzers`
2. `run_analysis`

## Safe Tool Set for Early RE

Default to these first:

- `check_connection`
- `list_open_programs`
- `switch_program`
- `get_current_program_info`
- `search_memory_strings`
- `list_strings`
- `get_xrefs_to`
- `get_xrefs_from`
- `get_function_by_address`
- `decompile_function`
- `force_decompile`
- `disassemble_function`
- `get_function_callers`
- `get_function_callees`
- `get_function_xrefs`
- `analyze_function_complete`
- `analyze_control_flow`
- `read_memory`
- `inspect_memory_content`

These are the workhorse tools for packet and dispatcher RE.

## Write Tools to Delay Until Confirmation

Use these only after you have validated the claim in code:

- `rename_function_by_address`
- `rename_global_variable`
- `rename_data`
- `rename_variables`
- `set_plate_comment`
- `set_decompiler_comment`
- `set_disassembly_comment`
- `set_function_prototype`
- `set_local_variable_type`
- `set_parameter_type`
- `create_struct`
- `add_struct_field`
- `apply_data_type`

Do not let convention enforcement drive naming for this repo. MPBT already has a
project-specific naming style documented in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## MPBT Tool Recipes

### 1. World Handshake After `REDIRECT`

Goal: confirm the exact byte flow and identify the minimum server sequence needed
to keep the world client stable.

Tool sequence:

1. `switch_program` to `COMMEG32.DLL`
2. `search_memory_strings` for `MMW`
3. `search_memory_strings` for `MMC`
4. `get_xrefs_to` on the matching string addresses
5. `decompile_function` on the key xref functions
6. `switch_program` to `MPBTWIN.EXE`
7. `decompile_function` for `FUN_00429870`
8. `get_function_callers` / `get_function_callees`
9. `analyze_function_complete`

Deliverable:

- exact welcome-gate logic
- first client world command
- flags/globals changed by the handshake

### 2. RPS Dispatch Expansion

Goal: turn unknown non-null `DAT_00470198` handlers into conservative canonical names.

Tool sequence:

1. `switch_program` to `MPBTWIN.EXE`
2. `read_memory` or `inspect_memory_content` at `DAT_00470198`
3. `get_function_by_address` for target handler addresses
4. `decompile_function`
5. `disassemble_function`
6. `get_function_xrefs`
7. `get_function_callers`
8. `get_function_callees`

Deliverable:

- command index
- wire schema guess
- side effects
- conservative handler name

### 3. Chat Channels `F7` / `F8`

Goal: determine whether team vs all-chat differs by command index, a flag, or a routing field.

Tool sequence:

1. `switch_program` to `MPBTWIN.EXE`
2. `search_memory_strings` for obvious chat UI strings
3. `get_xrefs_to` on those strings
4. `decompile_function` on input and send-path handlers
5. `get_function_callees`
6. `analyze_control_flow`
7. `disassemble_function` where encoder helpers are unclear

Deliverable:

- key path
- send helper path
- packet format
- receive/display path

### 4. Movement and Room State

Goal: separate static room data from live movement/state updates.

Tool sequence:

1. `switch_program` to `MPBTWIN.EXE`
2. `decompile_function` for the already-known world handlers around commands 4 and 8-13
3. `get_function_callees`
4. `list_globals`
5. `get_xrefs_to` on candidate room-state globals
6. `analyze_data_region` around room/event buffers
7. `read_memory` for dispatch-adjacent tables

Deliverable:

- room id globals
- player-event globals
- next likely movement packet handler

### 5. Combat Crossover

Goal: find the exact trigger that flips from RPS/world parsing to combat parsing.

Tool sequence:

1. `switch_program` to `MPBTWIN.EXE`
2. `search_memory_strings` for `MMC`
3. `get_xrefs_to`
4. `decompile_function`
5. `get_xrefs_to` on `DAT_004e2cd0` (`g_combatMode`)
6. `decompile_function` on early writers
7. `disassemble_function` if the write path is buried in helper code

Deliverable:

- first meaningful write to `g_combatMode`
- CRC seed transition point
- first combat-only reachable handler

## Prompting Style for GhidraMCP

When you are using an MCP-aware AI client, make the prompt tool-directed.

Good pattern:

1. tell it the binary
2. tell it the concrete question
3. tell it which tools to call first
4. require separation of fact vs inference
5. forbid speculative renames

Example:

```text
Work on MPBT world-handshake RE.

Start with:
- check_connection
- list_open_programs
- switch_program to COMMEG32.DLL
- search_memory_strings for "MMW" and "MMC"
- get_xrefs_to for each result
- decompile_function on the best candidate xrefs

Then switch to MPBTWIN.EXE and analyze FUN_00429870.

Return:
1. observed facts
2. inferred handshake sequence
3. globals/flags changed
4. smallest next manual validation

Do not rename anything yet.
```

## Ground Rules

- Treat tool output as evidence and AI interpretation as hypothesis.
- Keep write operations out of the first pass.
- Prefer conservative names like `Cmd9_ParseRoomList` over story-rich names until
  the packet and side effects are confirmed.
- Preserve this repo's naming conventions, not the default `ghidra-mcp` project conventions.
- Use batch tools only after the naming/type pattern has already been proved on a
  small sample.

## After a Good Session

When a session produces a real finding:

1. rename only the validated symbols
2. add comments only where they encode evidence or packet structure
3. update [`symbols.json`](../symbols.json)
4. update [`RESEARCH.md`](../RESEARCH.md)
5. update [`ROADMAP.md`](../ROADMAP.md) only if milestone state changed

For the first few sessions, favor better notes over more edits.
