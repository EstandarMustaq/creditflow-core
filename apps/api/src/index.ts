import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const server = await buildServer();
await server.listen({ port, host });

console.log(`Creditflow API running on http://${host}:${port}`);
