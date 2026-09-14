import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  NodeProcessExecutor,
  analyzeProject,
  createSandboxEnvironment,
  computeScore,
  explainDeterministically,
  type SandboxFile,
} from '../src/index.js';
import { generateMutations } from '@silentfail/mutation-engine';
import { LIMITS } from '@silentfail/shared';

async function demoProject() {
  const source = await readFile(new URL('../../../fixtures/demo-projects/discount.js', import.meta.url), 'utf8');
  const tests = await readFile(new URL('../../../fixtures/demo-projects/discount.test.js', import.meta.url), 'utf8');
  return { name: 'demo', isDemo: true, files: [{ path: 'discount.js', content: source, kind: 'source' as const }, { path: 'discount.test.js', content: tests, kind: 'test' as const }] };
}

describe('core execution and scoring', () => {
  it('builds a Windows-safe sandbox environment without leaking secrets', () => {
    const env = createSandboxEnvironment('win32', {
      Path: 'C:\\Windows\\System32;C:\\nodejs',
      SystemRoot: 'C:\\Windows',
      ComSpec: 'C:\\Windows\\System32\\cmd.exe',
      TEMP: 'C:\\Temp',
      SECRET_TOKEN: 'must-not-cross-the-boundary',
    });
    expect(env.Path).toContain('nodejs');
    expect(env.SystemRoot).toBe('C:\\Windows');
    expect(env.SECRET_TOKEN).toBeUndefined();
    expect(env.NODE_OPTIONS).toBeUndefined();
  });

  it('executes a real sandbox test suite', async () => {
    const executor = new NodeProcessExecutor();
    const files: SandboxFile[] = [
      { path: 'math.js', content: 'module.exports = { add: (a, b) => a + b };' },
      { path: 'math.test.js', content: 'const { add } = require("./math.js"); test("adds", () => expect(add(2, 3)).toBe(5));' },
    ];
    const response = await executor.run({ entry: 'run-tests', files, config: { testFiles: ['math.test.js'] } });
    expect(response.payload).not.toBeNull();
    expect((response.payload as { ok: boolean }).ok).toBe(true);
  });

  it('kills a mutant with an assertion and detects a survivor', async () => {
    const project = await demoProject();
    const run = await analyzeProject({ project, concurrency: 2 });
    expect(run.baseline.ok).toBe(true);
    expect(run.score.totalMutations).toBeGreaterThan(0);
    expect(run.score.caught).toBeGreaterThan(0);
    expect(run.mutations.some((mutation) => mutation.status === 'SURVIVED' || mutation.status === 'NO_COVERAGE')).toBe(true);
    expect(run.mutations.some((mutation) => mutation.suggestedTest?.verified)).toBe(true);
    expect(run.mutations.find((mutation) => mutation.suggestedTest?.inputs === '100, true')?.suggestedTest?.expected).toBe('90');
  }, 30_000);

  it('classifies timeouts and blocked execution', async () => {
    const executor = new NodeProcessExecutor({ timeoutMs: 100 });
    const timeout = await executor.run({
      entry: 'run-tests',
      files: [
        { path: 'hang.js', content: 'while (true) {}' },
        { path: 'hang.test.js', content: 'require("./hang.js"); test("never", () => expect(true).toBe(true));' },
      ],
      config: { testFiles: ['hang.test.js'] },
    });
    expect(timeout.timedOut).toBe(true);

    const blocked = await new NodeProcessExecutor({ timeoutMs: 5_000 }).run({
      entry: 'run-tests',
      files: [
        { path: 'unsafe.js', content: 'require("fs"); module.exports = {};' },
        { path: 'unsafe.test.js', content: 'require("./unsafe.js"); test("never", () => {});' },
      ],
      config: { testFiles: ['unsafe.test.js'] },
    });
    expect(blocked.payload).not.toBeNull();
    expect((blocked.payload as { ok: boolean }).ok).toBe(false);
  }, 10_000);

  it('rejects module resolution outside the temporary workspace', async () => {
    const executor = new NodeProcessExecutor();
    const response = await executor.run({
      entry: 'run-tests',
      files: [{ path: 'escape.test.js', content: `require(${JSON.stringify(process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd')}); test("never", () => {});` }],
      config: { testFiles: ['escape.test.js'] },
    });
    expect(response.payload).not.toBeNull();
    expect((response.payload as { crash?: string }).crash).toContain('outside the sandbox workspace');
  });

  it('enforces the whole-analysis time budget', async () => {
    vi.useFakeTimers();
    try {
      const project = await demoProject();
      const executor = {
        name: 'clock-advancing-test-executor',
        run: async () => {
          vi.advanceTimersByTime(LIMITS.analysisTimeoutMs + 1);
          return { exitCode: 0, signal: null, timedOut: false, stdout: '', stderr: '', outputTruncated: false, payload: { ok: true, tests: [{ name: 'ok', passed: true }], hits: [] }, durationMs: 0 };
        },
      };
      await expect(analyzeProject({ project, executor })).rejects.toThrow('time limit');
    } finally {
      vi.useRealTimers();
    }
  });

  it('computes score without counting errors as success', () => {
    expect(computeScore([{ status: 'CAUGHT' }, { status: 'TIMEOUT' }, { status: 'SURVIVED' }, { status: 'ERROR' }])).toEqual({ totalMutations: 4, caught: 1, survived: 1, errors: 1, timeouts: 1, noCoverage: 0, score: 66.7, denominator: 3 });
  });

  it('explains a survivor deterministically', () => {
    const mutation = generateMutations([{ path: 'x.js', kind: 'source', content: 'function x(v){ return v >= 10; } module.exports={x};' }])[0]!;
    const explanation = explainDeterministically({ mutation, status: 'SURVIVED', covered: true, killedBy: [], killingInput: 'x(10)', expectedValue: 'true', totalTests: 1 });
    expect(explanation.source).toBe('deterministic');
    expect(explanation.detail).toContain('no existing test');
  });
});
