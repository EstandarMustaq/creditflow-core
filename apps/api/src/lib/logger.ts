export function logInfo(message: string, meta: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: 'info', message, meta, ts: new Date().toISOString() }));
}
