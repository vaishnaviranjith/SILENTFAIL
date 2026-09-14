'use strict';
/**
 * Killing-input probe.
 *
 * Loads the ORIGINAL module and one MUTANT module in the same sandbox process and
 * calls the target function with a small, deterministic list of candidate inputs
 * (derived from literals in the source itself). The first input where the two
 * implementations disagree is, by definition, an input that a test could assert on
 * to kill the mutant.
 *
 * The expected value always comes from the ORIGINAL implementation, never from the
 * mutant and never from an LLM.
 *
 * Config: { originalFile, mutantFile, exportName, combos }
 * Output: a line `__SILENTFAIL_JSON__{...}`.
 */

const path = require('path');
const { repr, deepEqual } = require('./sf-harness.cjs');

const MARKER = '__SILENTFAIL_JSON__';
const UNDEFINED_TOKEN = '__SF_UNDEFINED__';
const NAN_TOKEN = '__SF_NAN__';

function emit(payload) {
  process.stdout.write(`\n${MARKER}${JSON.stringify(payload)}\n`);
}

function revive(value) {
  if (value === UNDEFINED_TOKEN) return undefined;
  if (value === NAN_TOKEN) return Number.NaN;
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = revive(value[key]);
    return out;
  }
  return value;
}

function callSafely(fn, args) {
  try {
    return { threw: false, value: fn(...args) };
  } catch (error) {
    return { threw: true, message: error && error.message ? String(error.message) : String(error) };
  }
}

function resolveFunction(moduleExports, exportName) {
  if (typeof moduleExports === 'function' && (!exportName || moduleExports.name === exportName)) return moduleExports;
  if (moduleExports && typeof moduleExports === 'object' && typeof moduleExports[exportName] === 'function') {
    return moduleExports[exportName];
  }
  return null;
}

function main() {
  let config;
  try {
    config = JSON.parse(process.argv[2] || '{}');
  } catch (error) {
    emit({ found: false, error: `Invalid probe config: ${error.message}` });
    return;
  }

  let originalFn;
  let mutantFn;
  try {
    originalFn = resolveFunction(require(path.resolve(process.cwd(), config.originalFile)), config.exportName);
    mutantFn = resolveFunction(require(path.resolve(process.cwd(), config.mutantFile)), config.exportName);
  } catch (error) {
    emit({ found: false, error: `Could not load modules: ${error && error.message ? error.message : String(error)}` });
    return;
  }

  if (!originalFn || !mutantFn) {
    emit({ found: false, error: `Function "${config.exportName}" is not exported from the analysed module.` });
    return;
  }

  const combos = Array.isArray(config.combos) ? config.combos : [];
  for (let index = 0; index < combos.length; index += 1) {
    const args = combos[index].map(revive);
    const original = callSafely(originalFn, args);
    const mutant = callSafely(mutantFn, args);

    if (original.threw && mutant.threw) {
      if (original.message === mutant.message) continue;
      emit({
        found: true,
        comboIndex: index,
        argsRepr: args.map((a) => repr(a)),
        mode: 'throw',
        expectedThrowMessage: original.message,
        mutantThrowMessage: mutant.message,
      });
      return;
    }
    if (original.threw !== mutant.threw) {
      emit({
        found: true,
        comboIndex: index,
        argsRepr: args.map((a) => repr(a)),
        mode: original.threw ? 'throw' : 'value',
        expectedThrowMessage: original.threw ? original.message : undefined,
        expectedRepr: original.threw ? undefined : repr(original.value),
        expectedIsInteger: !original.threw && typeof original.value === 'number' && Number.isInteger(original.value),
        expectedType: original.threw ? 'throw' : typeof original.value,
        mutantRepr: mutant.threw ? `throws ${JSON.stringify(mutant.message)}` : repr(mutant.value),
      });
      return;
    }
    if (!deepEqual(original.value, mutant.value)) {
      emit({
        found: true,
        comboIndex: index,
        argsRepr: args.map((a) => repr(a)),
        mode: 'value',
        expectedRepr: repr(original.value),
        expectedIsInteger: typeof original.value === 'number' && Number.isInteger(original.value),
        expectedType: typeof original.value,
        mutantRepr: repr(mutant.value),
      });
      return;
    }
  }

  emit({ found: false, tried: combos.length });
}

main();
