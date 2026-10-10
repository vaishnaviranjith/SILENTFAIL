import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

async function withServer<T>(fn: (base: string) => Promise<T>) {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try { return await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

describe('API contract', () => {
  it('serves health and the committed demo', async () => {
    await withServer(async (base) => {
      const health = await fetch(`${base}/api/health`);
      expect(health.status).toBe(200);
      expect((await health.json()).ok).toBe(true);
      const demo = await fetch(`${base}/api/demo`);
      const project = await demo.json();
      expect(demo.status).toBe(200);
      expect(project.isDemo).toBe(true);
      expect(project.files).toHaveLength(2);
    });
  });

  it('allows the local web app origin but does not reflect arbitrary origins', async () => {
    await withServer(async (base) => {
      const local = await fetch(`${base}/api/health`, { headers: { origin: 'http://localhost:5173' } });
      expect(local.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

      const untrusted = await fetch(`${base}/api/health`, { headers: { origin: 'https://untrusted.example' } });
      expect(untrusted.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  it('returns structured validation errors and never accepts an unsafe path', async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'bad', files: [{ path: '../secret.js', content: 'x', kind: 'source' }] }) });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.code).toBe('INVALID_PROJECT');
      expect(body.details.join(' ')).toContain('safe relative path');
    });
  });

  it('public demo mode never executes visitor-supplied source and disables custom verification', async () => {
    const previous = process.env['SILENTFAIL_DEMO_ONLY'];
    process.env['SILENTFAIL_DEMO_ONLY'] = 'true';
    try {
      await withServer(async (base) => {
        const demoResponse = await fetch(`${base}/api/demo`);
        const demo = await demoResponse.json();
        demo.files[0].content += '\\nprocess.exit(0);';
        const analyze = await fetch(`${base}/api/analyze`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(demo),
        });
        expect(analyze.status).toBe(403);
        expect((await analyze.json()).code).toBe('PUBLIC_DEMO_ONLY');

        const verify = await fetch(`${base}/api/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project: demo }),
        });
        expect(verify.status).toBe(403);
        expect((await verify.json()).code).toBe('PUBLIC_DEMO_ONLY');
      });
    } finally {
      if (previous === undefined) delete process.env['SILENTFAIL_DEMO_ONLY'];
      else process.env['SILENTFAIL_DEMO_ONLY'] = previous;
    }
  });
});
