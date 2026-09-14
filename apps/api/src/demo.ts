import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ProjectInput } from '@silentfail/shared';

const FIXTURE_ROOT = fileURLToPath(new URL('../../../fixtures/demo-projects/', import.meta.url));

/** Loads only the two committed demo files; user input never reaches this path. */
export async function loadDemoProject(): Promise<ProjectInput> {
  const [source, tests] = await Promise.all([
    readFile(path.join(FIXTURE_ROOT, 'discount.js'), 'utf8'),
    readFile(path.join(FIXTURE_ROOT, 'discount.test.js'), 'utf8'),
  ]);
  return {
    name: 'Discount rules (built-in demo)',
    isDemo: true,
    files: [
      { path: 'discount.js', content: source, kind: 'source' },
      { path: 'discount.test.js', content: tests, kind: 'test' },
    ],
  };
}
