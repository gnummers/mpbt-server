/**
 * MPBT REST API server — modern client adapter.
 *
 * Provides a lightweight HTTP server on API_PORT (default 3002) for the
 * Godot 4 client.  The ARIES TCP protocol (ports 2000/2001) is unaffected.
 *
 * Endpoints:
 *   GET   /health               →  { ok: true, version, name }
 *   GET   /mechs                →  { ok: true, mechs: MechApiEntry[] }
 *   GET   /world/rooms          →  { ok: true, rooms: WorldRoom[], source_available: boolean }
 *   POST  /world/travel         →  { ok: true, room: WorldRoom | null }
 *                                   Body: { roomId: number }
 *                                   Header: X-Username (authenticated display name)
 *   GET   /world/presence       →  { ok: true, rooms: Array<{ roomId, occupants: string[] }> }
 *   POST  /world/chat           →  { ok: true }
 *                                   Body: { roomId: number, text: string (max 200 chars) }
 *                                   Header: X-Username
 *                                   Broadcasts room_chat WebSocket event to all clients
 *   PATCH /world/mech/select    →  { ok: true, mechId, typeString, slot }
 *                                   Body: { mechId: number }
 *                                   Header: X-Username
 *   WS    /ws                   →  real-time push: presence_update, room_chat events
 */

import * as http from 'http';
import { readFileSync } from 'fs';
import { Logger } from './util/logger.js';
import { loadSolarisRooms } from './data/maps.js';
import { WORLD_MECHS } from './world/world-data.js';
import { MECH_STATS } from './data/mech-stats.js';
import { findCharacterByDisplayName, updateCharacterMech } from './db/characters.js';
import { presenceStore } from './world/presence.js';
import { wsBroadcaster } from './world/ws_broadcaster.js';

const _pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

function setCors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Username');
}

function jsonOk(res: http.ServerResponse, body: object): void {
  const payload = JSON.stringify(body);
  setCors(res);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function jsonError(res: http.ServerResponse, status: number, message: string): void {
  const payload = JSON.stringify({ ok: false, error: message });
  setCors(res);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function startApiServer(log: Logger, host: string, port: number): http.Server {
  const apiLog = log.child('api');

  const server = http.createServer(async (req, res) => {
    const pathname = req.url?.split('?')[0] ?? '/';

    if (req.method === 'OPTIONS') {
      setCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && pathname === '/health') {
      jsonOk(res, { ok: true, version: _pkg.version, name: 'mpbt-server' });
      return;
    }

    if (req.method === 'GET' && pathname === '/mechs') {
      const mechs = WORLD_MECHS.map((entry) => {
        const stats = MECH_STATS.get(entry.typeString) ?? null;
        return {
          id:            entry.id,
          slot:          entry.slot,
          typeString:    entry.typeString,
          name:          stats?.name ?? '',
          weightClass:   stats?.weightClass ?? 'unknown',
          tonnage:       stats?.tonnage ?? entry.tonnage ?? null,
          maxSpeedKph:   stats?.maxSpeedKph ?? null,
          armor:         stats?.armor ?? null,
          jumpMeters:    stats?.jumpMeters ?? null,
          armament:      stats?.armament ?? [],
          effectiveRange: stats?.effectiveRange ?? null,
          disabled:      stats?.disabled ?? true,
        };
      });
      jsonOk(res, { ok: true, mechs });
      return;
    }

    if (req.method === 'GET' && pathname === '/world/rooms') {
      const rooms = loadSolarisRooms() ?? [];
      jsonOk(res, { ok: true, rooms, source_available: rooms.length > 0 });
      return;
    }

    if (req.method === 'POST' && pathname === '/world/travel') {
      const username = (req.headers['x-username'] ?? '') as string;
      if (!username) {
        jsonError(res, 400, 'X-Username header required');
        return;
      }
      let body: string;
      try {
        body = await readBody(req);
      } catch {
        jsonError(res, 400, 'failed to read request body');
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        jsonError(res, 400, 'invalid JSON body');
        return;
      }
      const roomId =
        parsed !== null &&
        typeof parsed === 'object' &&
        'roomId' in parsed &&
        typeof (parsed as Record<string, unknown>).roomId === 'number'
          ? ((parsed as Record<string, unknown>).roomId as number)
          : NaN;
      if (!Number.isFinite(roomId)) {
        jsonError(res, 400, 'roomId must be a number');
        return;
      }
      presenceStore.travel(username, roomId);
      apiLog.info('%s traveled to room %d', username, roomId);
      wsBroadcaster.broadcast('presence_update', { rooms: presenceStore.getAll() });
      const rooms = loadSolarisRooms() ?? [];
      const room = rooms.find((r) => r.roomId === roomId) ?? null;
      jsonOk(res, { ok: true, room });
      return;
    }

    if (req.method === 'GET' && pathname === '/world/presence') {
      jsonOk(res, { ok: true, rooms: presenceStore.getAll() });
      return;
    }

    if (req.method === 'POST' && pathname === '/world/chat') {
      const username = (req.headers['x-username'] ?? '') as string;
      if (!username) {
        jsonError(res, 400, 'X-Username header required');
        return;
      }
      let body: string;
      try {
        body = await readBody(req);
      } catch {
        jsonError(res, 400, 'failed to read request body');
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        jsonError(res, 400, 'invalid JSON body');
        return;
      }
      const p = parsed as Record<string, unknown>;
      const roomId =
        parsed !== null && typeof parsed === 'object' && typeof p.roomId === 'number'
          ? (p.roomId as number)
          : NaN;
      const rawText =
        parsed !== null && typeof parsed === 'object' && typeof p.text === 'string'
          ? (p.text as string).trim()
          : '';
      if (!Number.isFinite(roomId)) {
        jsonError(res, 400, 'roomId must be a number');
        return;
      }
      if (!rawText) {
        jsonError(res, 400, 'text must be a non-empty string');
        return;
      }
      if (rawText.length > 200) {
        jsonError(res, 400, 'text must be 200 characters or fewer');
        return;
      }
      apiLog.info('chat room %d [%s]: %s', roomId, username, rawText.slice(0, 40));
      wsBroadcaster.broadcast('room_chat', { roomId, username, text: rawText });
      jsonOk(res, { ok: true });
      return;
    }

    if (req.method === 'PATCH' && pathname === '/world/mech/select') {
      const username = (req.headers['x-username'] ?? '') as string;
      if (!username) {
        jsonError(res, 400, 'X-Username header required');
        return;
      }
      let body: string;
      try {
        body = await readBody(req);
      } catch {
        jsonError(res, 400, 'failed to read request body');
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        jsonError(res, 400, 'invalid JSON body');
        return;
      }
      const mechId =
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof (parsed as Record<string, unknown>).mechId === 'number'
          ? ((parsed as Record<string, unknown>).mechId as number)
          : NaN;
      if (!Number.isFinite(mechId)) {
        jsonError(res, 400, 'mechId must be a number');
        return;
      }
      const entry = WORLD_MECHS.find((m) => m.id === mechId);
      if (!entry) {
        jsonError(res, 404, `mech id ${mechId} not in roster`);
        return;
      }
      const character = await findCharacterByDisplayName(username);
      if (!character) {
        jsonError(res, 404, 'character not found');
        return;
      }
      await updateCharacterMech(character.account_id, mechId, entry.slot);
      apiLog.info('%s selected mech %s (id=%d slot=%d)', username, entry.typeString, mechId, entry.slot);
      jsonOk(res, { ok: true, mechId, typeString: entry.typeString, slot: entry.slot });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  wsBroadcaster.attach(server);

  server.on('error', (err: Error) => {
    apiLog.error('HTTP server error: %s', err.message);
  });

  server.listen(port, host, () => {
    apiLog.info('HTTP server listening on %s:%d', host, port);
  });

  return server;
}
