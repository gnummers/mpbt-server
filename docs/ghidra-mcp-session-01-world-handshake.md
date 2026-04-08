# Session 01: World Handshake with `ghidra-mcp`

This is the first concrete session to run for MPBT using the live
`bridge_mcp_ghidra.py` setup.

## Goal

Confirm the post-`REDIRECT` world handshake well enough to answer:

- what exact bytes or strings gate RPS/world mode
- what the client sends first after the world welcome
- what minimum server behavior is required to avoid an immediate disconnect or stall

## Open Programs

Keep these open:

- `COMMEG32.DLL`
- `MPBTWIN.EXE`
- `INITAR.DLL`

## Step 1: Sanity Check the Bridge

Run:

1. `check_connection`
2. `get_version`
3. `list_open_programs`

Expected outcome:

- the bridge responds cleanly
- the relevant binaries are listed

If not, stop and fix the bridge/program state first.

## Step 2: Start in `COMMEG32.DLL`

Run:

1. `switch_program` to `COMMEG32.DLL`
2. `search_memory_strings` for `MMW`
3. `search_memory_strings` for `MMC`

Capture:

- matching string addresses
- any nearby protocol or copyright strings

## Step 3: Trace the Welcome Strings

For the best `MMW` and `MMC` hits, run:

1. `get_xrefs_to`
2. `get_function_by_address` for the referring code
3. `decompile_function`
4. `get_function_callers`
5. `get_function_callees`

Questions to answer:

- which handler sends or checks these strings?
- how does the redirect path re-enter the normal ARIES receive flow?
- does COMMEG32 distinguish world/RPS and combat before or after forwarding data to the game window?

## Step 4: Switch to `MPBTWIN.EXE`

Run:

1. `switch_program` to `MPBTWIN.EXE`
2. `decompile_function` for `FUN_00429870`
3. `get_function_callers`
4. `get_function_callees`
5. `analyze_function_complete`

Questions to answer:

- what does the WM receive handler do with `MMW`?
- what flags gate world-mode dispatch?
- what happens after the welcome string is accepted?

## Step 5: Follow the First World Dispatch

From the receive handler and its callees, run as needed:

1. `decompile_function`
2. `disassemble_function`
3. `get_function_by_address`
4. `get_function_xrefs`

Focus on:

- the first non-lobby command path after the welcome gate
- dispatch-table selection
- sequence/CRC reuse vs changes

## Step 6: Cross-Check Globals

If the decompile shows likely mode globals, run:

1. `get_xrefs_to` on the global address
2. `decompile_function` on early writers/readers
3. `disassemble_function` if the write path is still ambiguous

Primary targets:

- `DAT_004e2cd0` if reached
- any welcome-gate or dispatch-mode flags
- any world-session or room-state globals written immediately after the handshake

## Step 7: Write Down the Result Before Renaming

Before using any write tool, produce a short note with four buckets:

1. confirmed
2. inferred
3. unknown
4. next single best tool call

Only after that should you consider:

- `rename_function_by_address`
- `rename_global_variable`
- `set_plate_comment`

## Success Condition

This session is successful if you can state:

- the accepted world welcome string
- the function path that processes it
- the first client world command after the handshake
- one concrete missing server response needed for `server-world.ts`

That is enough to make the next session about implementation instead of vague RE.
