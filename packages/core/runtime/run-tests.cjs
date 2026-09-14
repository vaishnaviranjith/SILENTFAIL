'use strict';
/**
 * Sandbox entry point: runs the analysed project's test files and prints a single
 * machine-readable line. Started as:
 *
 *   node --require ./sf-guard.cjs ./sf-run-tests.cjs '<json config>'
 *
 * Config: { "testFiles": ["discount.test.js"] }
 * Output: a line `__SILENTFAIL_JSON__{...}` written to stdout.
 */

const path = require('path');
const { createHarness } = require('./sf-harness.cjs');

const MARKER = '__SILENTFAIL_JSON__';

function emit(payload) {
  process.stdout.write(`\n${MARKER}${JSON.stringify(payload)}\n`);
}

async function main() {
  let config;
  try {
    config = JSON.parse(process.argv[2] || '{}');
  } catch (error) {
    emit({ ok: false, crash: `Invalid sandbox config: ${error.message}`, tests: [], hits: [] });
    return;
  }

  const harness = createHarness();
  globalThis.test = harness.test;
  globalThis.it = harness.test;
  globalThis.describe = harness.describe;
  globalThis.expect = harness.expect;
  globalThis.__sfHit = harness.hit;

  const testFiles = Array.isArray(config.testFiles) ? config.testFiles : [];
  if (testFiles.length === 0) {
    emit({ ok: false, crash: 'No test files were provided to the sandbox runner.', tests: [], hits: [] });
    return;
  }

  for (const file of testFiles) {
    harness.setActiveFile(file);
    try {
      require(path.resolve(process.cwd(), file));
    } catch (error) {
      emit({
        ok: false,
        crash: `Failed to load ${file}: ${error && error.message ? error.message : String(error)}`,
        tests: [],
        hits: Array.from(harness.hits),
      });
      return;
    }
  }

  if (harness.queue.length === 0) {
    emit({
      ok: false,
      crash: 'No tests were registered. Use test("name", () => { ... }) in your test file.',
      tests: [],
      hits: Array.from(harness.hits),
    });
    return;
  }

  const started = process.hrtime.bigint();
  const tests = await harness.runAll();
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6;

  emit({
    ok: tests.every((t) => t.passed),
    tests,
    durationMs,
    hits: Array.from(harness.hits).sort((a, b) => a - b),
  });
}

main().catch((error) => {
  emit({
    ok: false,
    crash: `Sandbox runner crashed: ${error && error.stack ? error.stack : String(error)}`,
    tests: [],
    hits: [],
  });
});
