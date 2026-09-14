import type { TestCaseResult, TestRunResult } from '@silentfail/shared';
import type { SandboxResponse } from './executor/types.js';

interface SandboxTestPayload {
  ok?: boolean;
  crash?: string;
  durationMs?: number;
  hits?: number[];
  tests?: Array<{
    name?: string;
    file?: string;
    passed?: boolean;
    durationMs?: number;
    failure?: { message?: string; expected?: string; actual?: string };
  }>;
}

export interface ParsedTestRun {
  result: TestRunResult;
  /** Statement ids executed during the run (only present for instrumented runs). */
  hits: number[];
}

/** Normalises a raw sandbox response into the shared `TestRunResult` model. */
export function toTestRunResult(response: SandboxResponse): ParsedTestRun {
  const payload = (response.payload ?? null) as SandboxTestPayload | null;
  const rawTests = payload?.tests ?? [];
  const tests: TestCaseResult[] = rawTests.map((test) => ({
    name: test.name ?? '(unnamed test)',
    file: test.file ?? '(unknown file)',
    passed: test.passed === true,
    durationMs: round(test.durationMs ?? 0),
    ...(test.failure ? { failure: { message: test.failure.message ?? 'assertion failed', expected: test.failure.expected, actual: test.failure.actual } } : {}),
  }));

  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.length - passed;
  const crash = response.timedOut
    ? 'Execution exceeded the sandbox time limit.'
    : (payload?.crash ?? (payload ? undefined : (response.error ?? 'The sandbox produced no result.')));

  const result: TestRunResult = {
    ok: !crash && tests.length > 0 && failed === 0,
    total: tests.length,
    passed,
    failed,
    durationMs: round(payload?.durationMs ?? response.durationMs),
    tests,
    ...(crash ? { crash } : {}),
    ...(response.timedOut ? { timedOut: true } : {}),
    ...(response.stdout || response.stderr
      ? { output: [response.stdout, response.stderr].filter(Boolean).join('\n').slice(0, 4000) }
      : {}),
  };

  return { result, hits: Array.isArray(payload?.hits) ? payload.hits.filter((h) => Number.isInteger(h)) : [] };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
