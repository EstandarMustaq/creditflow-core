import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const heartbeatFile = resolve(currentDir, '../../../.runtime/worker-heartbeat.json');

export interface WorkerHeartbeatPayload {
  status: 'active';
  timestamp: string;
  pid: number;
  source: string;
}

export async function writeWorkerHeartbeat(source = 'worker') {
  const payload: WorkerHeartbeatPayload = {
    status: 'active',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    source
  };

  await mkdir(dirname(heartbeatFile), { recursive: true });
  await writeFile(heartbeatFile, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export async function readWorkerHeartbeat() {
  try {
    const raw = await readFile(heartbeatFile, 'utf8');
    return JSON.parse(raw) as WorkerHeartbeatPayload;
  } catch {
    return null;
  }
}

export async function getWorkerHealth(maxAgeMs = 90_000) {
  const heartbeat = await readWorkerHeartbeat();
  if (!heartbeat) {
    return {
      active: false,
      state: 'offline' as const,
      lastHeartbeatAt: null,
      staleMs: null
    };
  }

  const staleMs = Date.now() - new Date(heartbeat.timestamp).getTime();
  const active = staleMs <= maxAgeMs;

  return {
    active,
    state: active ? ('online' as const) : ('offline' as const),
    lastHeartbeatAt: heartbeat.timestamp,
    staleMs,
    pid: heartbeat.pid,
    source: heartbeat.source
  };
}
