import { readFile } from 'node:fs/promises';
import { analyzeProject } from '@silentfail/core';

const source = await readFile(new URL('../fixtures/demo-projects/discount.js', import.meta.url), 'utf8');
const tests = await readFile(new URL('../fixtures/demo-projects/discount.test.js', import.meta.url), 'utf8');
const run = await analyzeProject({
  project: {
    name: 'Discount rules (built-in demo)',
    isDemo: true,
    files: [
      { path: 'discount.js', content: source, kind: 'source' },
      { path: 'discount.test.js', content: tests, kind: 'test' },
    ],
  },
});

console.log(JSON.stringify({
  project: run.projectName,
  baseline: run.baseline.message,
  score: run.score,
  silentFailures: run.mutations.filter((mutation) => mutation.status === 'SURVIVED' || mutation.status === 'NO_COVERAGE').map((mutation) => ({
    id: mutation.mutationId,
    operator: mutation.operatorLabel,
    file: mutation.file,
    line: mutation.line,
    suggestion: mutation.suggestedTest?.inputs ?? null,
  })),
}, null, 2));
