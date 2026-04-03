import 'dotenv/config';
import { ensureCoreSchema } from '@creditflow-core/db';
import { buildServer } from './server.js';
import { parseEnv } from './config/env.js';

const env = parseEnv();
const port = env.PORT;
const host = process.env.HOST ?? '0.0.0.0';

await ensureCoreSchema();
const server = await buildServer();
await server.listen({ port, host });

console.log(`Creditflow API running on http://${host}:${port}`);
