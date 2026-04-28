/**
 * MPBT REST API server — modern client adapter.
 *
 * Provides a lightweight HTTP server on API_PORT (default 3002) for the
 * Godot 4 client.  The ARIES TCP protocol (ports 2000/2001) is unaffected.
 *
 * Endpoints:
 *   GET /health       →  { ok: true, version, name }
 *   GET /world/rooms  →  { ok: true, rooms: WorldRoom[], source_available: boolean }
 */

import * as http from 'http';
import { readFileSync } from 'fs';
import { Logger } from './util/logger.js';
import { loadSolarisRooms } from './data/maps.js';

const _pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

function setCors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

export function startApiServer(log: Logger, host: string, port: number): http.Server {
  const apiLog = log.child('api');

  const server = http.createServer((req, res) => {
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

    if (req.method === 'GET' && pathname === '/world/rooms') {
      const rooms = loadSolarisRooms() ?? [];
      jsonOk(res, { ok: true, rooms, source_available: rooms.length > 0 });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (err: Error) => {
    apiLog.error('HTTP server error: %s', err.message);
  });

  server.listen(port, host, () => {
    apiLog.info('HTTP server listening on %s:%d', host, port);
  });

  return server;
}
