/**
 * Lobby / room navigation handler.
 *
 * Current state: STUB.  The room and navigation system is well-hinted by
 * MPBT.MSG strings but the actual wire protocol is unknown.
 *
 * Known string templates from MPBT.MSG (server → client):
 *   "Here you see [X] and [Y], [Z]."       — room description
 *   "[name] enters the room."               — presence event
 *   "[name] leaves."                        — departure (no direction)
 *   "[name] leaves heading [dir]."          — departure with direction
 *   "To the [dir] you see [desc]"           — exit description
 *   "You are in [location]"                 — current location
 *   "You are [status]"                      — player status
 *   "Can't go that way!"                    — movement rejection
 *   "READY :"                               — post-auth, player is ready
 *
 * Direction tokens from MPBT.MSG: north / south / east / west
 */

import type { ClientSession } from '../state/players.js';
import type { World, Room } from '../state/world.js';
import type { Logger } from '../util/logger.js';
import { hexDump } from './aries.js';

// ── Room description builder ──────────────────────────────────────────────────

/**
 * Build a room description packet for the given room.
 * STUB — exact packet format is unknown; sending ASCII text to probe client.
 */
export function buildRoomDescription(room: Room, session: ClientSession): Buffer {
  // Build a human-readable room description matching the MPBT.MSG template.
  const others = room.players
    .filter(id => id !== session.id)
    .join(' and ');

  let desc: string;
  if (others.length > 0) {
    desc = `Here you see ${others}.\r\n`;
  } else {
    desc = `You are in ${room.name}.\r\n`;
  }

  const exits = room.exits
    .map(e => `To the ${e.direction} you see ${e.description}.`)
    .join('\r\n');

  return Buffer.from(desc + exits + '\r\n', 'ascii');
}

/**
 * Build a "player entered" event packet.
 * STUB — format unknown.
 */
export function buildPlayerEnter(username: string): Buffer {
  return Buffer.from(`${username} enters the room.\r\n`, 'ascii');
}

/**
 * Build a "player left" event packet.
 * STUB — format unknown.
 */
export function buildPlayerLeave(username: string, direction?: string): Buffer {
  if (direction) {
    return Buffer.from(`${username} leaves heading ${direction}.\r\n`, 'ascii');
  }
  return Buffer.from(`${username} leaves.\r\n`, 'ascii');
}

// ── Movement command parser ───────────────────────────────────────────────────

export type Direction = 'north' | 'south' | 'east' | 'west';

export interface MoveCommand {
  direction: Direction;
}

const DIRECTION_TOKENS = new Set<Direction>(['north', 'south', 'east', 'west']);

/**
 * Attempt to parse a movement command from a raw payload.
 * Returns null if the payload is not a movement command.
 *
 * STUB — will be replaced with proper packet parsing after RE.
 */
export function parseMoveCommand(
  payload: Buffer,
  log: Logger,
): MoveCommand | null {
  log.debug('[lobby] move payload:\n%s', hexDump(payload));

  const text = payload.toString('ascii').trim().toLowerCase();
  if (DIRECTION_TOKENS.has(text as Direction)) {
    return { direction: text as Direction };
  }
  return null;
}

/**
 * Build a movement rejection packet.
 * STUB — format unknown.
 */
export function buildCantGoThatWay(): Buffer {
  return Buffer.from("Can't go that way!\r\n", 'ascii');
}
