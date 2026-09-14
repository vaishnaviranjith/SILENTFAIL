import { createServer } from 'node:http';
import { createApp } from './app.js';

const port = Number(process.env['PORT'] ?? 8787);
const server = createServer(createApp());

server.once('error', (error: NodeJS.ErrnoException) => {
  console.error(`SILENTFAIL API failed to start: ${error.code ?? error.message}`);
  process.exitCode = 1;
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SILENTFAIL API listening on http://localhost:${port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; stopping SILENTFAIL API.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
