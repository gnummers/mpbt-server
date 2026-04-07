# AI Handoff

This file is the shared handoff surface between Codex, GitHub Copilot, and the human maintainer.

## Current State

- Date: 2026-04-07
- Local checkout: `C:\MPBT\mpbt-server`
- Fork: `gnummers/mpbt-server`
- Upstream: `kenhuman/mpbt-server`
- Active branch: `codex/v123-combat-position-trace`
- Active upstream thread: Ken PR #55, `feat/re-research`
- Branch base: `upstream/feat/re-research`
- Current branch status before Copilot migration: clean and pushed
- After Copilot session (2026-04-07): `src/protocol/combat.ts` added, committed as `b827136`

## Open Work Threads

- PR #55 is Ken's v1.23 RE branch. Our stacked branch adds follow-up v1.23 combat documentation and has been linked in PR comments.
- PR #54 documents v1.23 `Solaris RPS` / `Solaris COMBAT` state handoff and the `Transition to combat - even` music-state correction.
- PR #50 tracks earlier M5 map/travel work against Ken's current master.

## Latest Stacked Combat Findings

- `Cmd64` / wire `0x65`: remote actor/mech add.
- `Cmd65` / wire `0x66`: server-to-client combat position/motion sync.
- `Cmd66` / wire `0x67`: actor damage code/value update.
- `Cmd67` / wire `0x68`: local actor damage code/value update.
- `Cmd68` / wire `0x69`: projectile/effect spawn, not direct damage.
- `Cmd69` / wire `0x6a`: impact/effect-at-coordinate feedback.
- `Cmd70` / wire `0x6b`: actor animation/status transition.
- `Cmd71` / wire `0x6c`: clears current projectile/effect globals.
- `Cmd72` / wire `0x6d`: local combat bootstrap.
- `Cmd73` / wire `0x6e`: actor rate/bias fields; exact meaning pending.
- v1.23 `.MEC` correction: `weapon_count` at `0x3a`, signed critical/equipment bound at `0x3c`, weapon ids at `0x3e + slot*2`.

## Completed This Session (Copilot, 2026-04-07)

- Created `src/protocol/combat.ts` with server→client builders for Cmd64–Cmd73.
- All commands from §19.6.1 are prototyped: Cmd65 (position sync), Cmd66/67
  (damage), Cmd68 (projectile spawn), Cmd69 (impact coord), Cmd70 (animation
  transition), Cmd71 (reset effect state), Cmd72 (local bootstrap), Cmd73
  (rate/bias fields).
- Naming convention documented: `ResearchCmdN` uses `buildGamePacket(N + 4, ..., true)`.
- Build passes clean (`npm run build`); `git diff --check` clean.
- **Ghidra live analysis (same session):** Used MCP to decompile
  `Combat_Cmd64_AddActor_v123` (0x0040d390) and `Combat_Cmd72_InitLocalActor_v123`
  (0x00445110) fully. Key findings applied:
  - Cmd64 was missing **two bytes**: `actorTypeByte` (slot[1]) and `statusByte`
    (after identity4, before mechId). Both added to interface and builder — bug
    would have caused client desync on every remote-actor packet.
  - 5-string identity layout (max 11/31/39/15/31) **confirmed** for both Cmd64
    and Cmd72 (identical strncpy sizes in decompile).
  - Cmd72 `unknownByte0` confirmed as a filler byte: client reads and discards it.
  - Terrain/arena point list formats confirmed: terrainResourceId (type2) + count +
    {type3 X, type3 Y, type2 Z} per point; arena = count + {type3 X, type3 Y}.
  - `Combat_ReadLocalActorMechState_v123` (0x004456c0) field sequence confirmed.

## Remaining Ghidra Assumptions (updated)

| Field | Status | Notes |
|---|---|---|
| Cmd64 `actorTypeByte` | semantics TBD | stored at DAT_004f2036+slot*0x49c; send 0 |
| Cmd64/72 `statusByte` | semantics TBD | stored at DAT_004f1fe6+slot*0x4ec; send 0 |
| Cmd72 `globalA/B/C` | semantics TBD | type2; DAT_004f56b4/1d24/5684; send 0 |
| Cmd72 `unknownType1Raw` | semantics TBD | type1; DAT_004ee944; send MOTION_NEUTRAL |
| Cmd65 signed conventions | needs capture | facing zero-north vs zero-east, ±throttle |
| Cmd73 `rateA`/`rateB` | semantics TBD | bias (val-0x2a)*0x38e; purpose unclear |

## Recommended Next Tasks

1. Wire `buildCmd72LocalBootstrapPacket` + `buildCmd64RemoteActorPacket` into
   the world server's combat-entry handoff so a client can actually enter an arena.
2. Capture a live combat entry to label `actorTypeByte`, `statusByte`, `globalA/B/C`,
   `unknownType1Raw`, and confirm Cmd65 signed motion conventions.
3. Correlate damage-code ranges with `.MEC` fields and live hit capture before
   finalizing `buildCmd66ActorDamagePacket` / `buildCmd67LocalDamagePacket`.
4. Decompile `FUN_0040e2f0` (Cmd73 handler) to confirm `rateA`/`rateB` semantics.

## Validation Commands

```powershell
git diff --check
npm run build
npm run map:dump
```

Use `npm run map:dump` only when map/parser work is involved.

## Copilot CLI + Ghidra MCP

- Copilot CLI is installed via WinGet as `GitHub.Copilot` and should be available as `copilot` in new shells.
- If an existing shell cannot find it, use `C:\Users\moose\AppData\Local\Microsoft\WinGet\Links\copilot.exe` or restart the shell so it inherits the updated user PATH.
- Copilot's user MCP config is `C:\Users\moose\.copilot\mcp-config.json`.
- The configured MCP server name is `ghidra`; it launches `C:\Users\moose\Downloads\bridge_mcp_ghidra.py` over stdio.
- The Ghidra plugin REST bridge must already be running in Ghidra on `http://127.0.0.1:8089/`.
- Verified on 2026-04-07: Copilot used the `ghidra` MCP server to call `list_open_programs` and reported current program `Mpbtwin.exe`.

Useful Copilot launch command:

```powershell
copilot --add-dir C:\MPBT\mpbt-server --allow-tool=ghidra
```

## Copilot Prompt Starter

Use this when starting a Copilot session:

```text
Read AGENTS.md and AI_HANDOFF.md first. Work in C:\MPBT\mpbt-server. Do not duplicate Ken's upstream PR #55 work. Continue from branch codex/v123-combat-position-trace unless I ask for a new branch. For v1.23 protocol work, treat RESEARCH.md §19 and ROADMAP.md M6/M7 as source of truth. Keep changes small, run git diff --check and npm run build, and summarize any unresolved Ghidra assumptions.
```

## Return-To-Codex Prompt Starter

Use this when switching back to Codex:

```text
Read AGENTS.md and AI_HANDOFF.md. Then inspect git status, latest commits, and any PR comments. Continue from the current branch without reverting Copilot changes. Validate with git diff --check and npm run build before pushing.
```
