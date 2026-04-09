/**
 * MPBT .MAP room-record parser.
 *
 * The proprietary map files are not committed. This parser mirrors the leading
 * room-record load performed by MPBTWIN.EXE Map_LoadFile (FUN_004100c0), so M5
 * work can be reproduced against a local licensed installation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface MapBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MapAuxFields {
  aux0: number;
  aux1: number;
  aux2: number;
}

export interface MapRoomRecord {
  source: string;
  offset: number;
  roomId: number;
  flags: number;
  bounds: MapBounds;
  aux: MapAuxFields;
  nameLength: number;
  descriptionLength: number;
  name: string;
  description: string;
}

export interface ParsedMapFile {
  path: string;
  source: string;
  roomCount: number;
  rooms: MapRoomRecord[];
  remainingOffset: number;
  remainingBytes: number;
}

function requireBytes(buf: Buffer, offset: number, count: number, label: string, filePath: string): void {
  if (offset + count > buf.length) {
    throw new Error(
      `${path.basename(filePath)}: truncated while reading ${label} at 0x${offset.toString(16)}`,
    );
  }
}

function readCStringField(buf: Buffer, offset: number, length: number, label: string, filePath: string): string {
  if (length < 1) {
    throw new Error(
      `${path.basename(filePath)}: invalid ${label} length ${length} at 0x${offset.toString(16)}`,
    );
  }
  requireBytes(buf, offset, length, label, filePath);
  const raw = buf.subarray(offset, offset + length);
  const nul = raw.indexOf(0);
  return (nul >= 0 ? raw.subarray(0, nul) : raw).toString('latin1');
}

function readU16(buf: Buffer, offset: number, label: string, filePath: string): number {
  requireBytes(buf, offset, 2, label, filePath);
  return buf.readUInt16LE(offset);
}

/**
 * Parse the leading room-record table from an MPBT .MAP file.
 *
 * Confirmed layout:
 *   [u16 count]
 *   repeated count times:
 *     [u16 room_id]
 *     [u16 flags]
 *     [u16 x1] [u16 y1] [u16 x2] [u16 y2]
 *     [u16 aux0] [u16 aux1] [u16 aux2]
 *     [u16 name_len_including_nul] [name bytes]
 *     [u16 desc_len_including_nul] [description bytes]
 *
 * MPBTWIN.EXE passes bytes after the room table to Picture_ReadFromFile
 * (FUN_00428770). Those trailing bytes are intentionally preserved only as an
 * offset/count until the picture format matters for gameplay.
 */
export function parseMapFile(filePath: string, source = path.basename(filePath).toUpperCase()): ParsedMapFile {
  const buf = fs.readFileSync(filePath);
  let offset = 0;

  const roomCount = readU16(buf, offset, 'room count', filePath);
  offset += 2;

  const rooms: MapRoomRecord[] = [];
  for (let i = 0; i < roomCount; i += 1) {
    const recordOffset = offset;

    const roomId = readU16(buf, offset, 'room id', filePath);
    offset += 2;
    const flags = readU16(buf, offset, 'flags', filePath);
    offset += 2;

    const bounds: MapBounds = {
      x1: readU16(buf, offset, 'x1', filePath),
      y1: readU16(buf, offset + 2, 'y1', filePath),
      x2: readU16(buf, offset + 4, 'x2', filePath),
      y2: readU16(buf, offset + 6, 'y2', filePath),
    };
    offset += 8;

    const aux: MapAuxFields = {
      aux0: readU16(buf, offset, 'aux0', filePath),
      aux1: readU16(buf, offset + 2, 'aux1', filePath),
      aux2: readU16(buf, offset + 4, 'aux2', filePath),
    };
    offset += 6;

    const nameLength = readU16(buf, offset, 'name length', filePath);
    offset += 2;
    const name = readCStringField(buf, offset, nameLength, 'name', filePath);
    offset += nameLength;

    const descriptionLength = readU16(buf, offset, 'description length', filePath);
    offset += 2;
    const description = readCStringField(buf, offset, descriptionLength, 'description', filePath);
    offset += descriptionLength;

    rooms.push({
      source,
      offset: recordOffset,
      roomId,
      flags,
      bounds,
      aux,
      nameLength,
      descriptionLength,
      name,
      description,
    });
  }

  return {
    path: filePath,
    source,
    roomCount,
    rooms,
    remainingOffset: offset,
    remainingBytes: buf.length - offset,
  };
}

// ── World-room abstraction ─────────────────────────────────────────────────

/**
 * A single room entry derived from a parsed MAP file, suitable for use as
 * the server-side room model.
 */
export interface WorldRoom {
  roomId: number;
  name: string;
  /** Raw flags word from the map record (faction / type; exact semantics TBD). */
  flags: number;
  /**
   * Map X coordinate.
   *   SOLARIS.MAP: identity (raw_x as-is).
   *   IS.MAP:      raw_x / 3 + 380.
   * Derived as the horizontal midpoint of the record's bounding box.
   */
  centreX: number;
  /**
   * Map Y coordinate.
   *   SOLARIS.MAP: identity (raw_y as-is).
   *   IS.MAP:      raw_y / −3 + 248.
   * Derived as the vertical midpoint of the record's bounding box.
   */
  centreY: number;
  /** 0-based position in the SOLARIS.MAP room list (used as scene-slot index). */
  sceneIndex: number;
}

function projectRoot(): string {
  // __dirname equiv: src/data/ → ../../ = project root
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(dir, '../../');
}

function findMapFile(filename: string): string | undefined {
  const root = projectRoot();
  const dirs = [
    process.env['MPBT_DATA_DIR'],
    root,
    process.cwd(),
    path.resolve(root, '..'),
    path.resolve(root, 'research'),
  ].filter((d): d is string => Boolean(d));

  for (const dir of dirs) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Load the SOLARIS.MAP room table and return it as an ordered WorldRoom array.
 *
 * Returns `null` if SOLARIS.MAP cannot be found — callers should warn and fall
 * back to a hardcoded room list so the server still starts without the
 * proprietary assets.
 *
 * Throws if the file is found but fails to parse (data corruption).
 *
 * @param filePath  Optional explicit path; omit to search default locations.
 */
export function loadSolarisRooms(filePath?: string): WorldRoom[] | null {
  const resolved = filePath ?? findMapFile('SOLARIS.MAP');
  if (!resolved) return null;

  const parsed = parseMapFile(resolved, 'SOLARIS.MAP');
  return parsed.rooms.map((room, index): WorldRoom => ({
    roomId:     room.roomId,
    name:       room.name,
    flags:      room.flags,
    centreX:    (room.bounds.x1 + room.bounds.x2) / 2,
    centreY:    (room.bounds.y1 + room.bounds.y2) / 2,
    sceneIndex: index,
  }));
}
