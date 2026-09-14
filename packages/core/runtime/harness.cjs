'use strict';
/**
 * SILENTFAIL sandbox test harness.
 *
 * Deliberately dependency-free plain CommonJS: it is copied into a throwaway
 * workspace and executed by a bare `node` process, so it cannot rely on anything
 * being installed. It provides the tiny API that analysed projects are written
 * against: test/it/describe/expect, plus the coverage hook `__sfHit`.
 */

class AssertionError extends Error {
  constructor(message, expected, actual) {
    super(message);
    this.name = 'AssertionError';
    this.expected = expected;
    this.actual = actual;
  }
}

/** Stable, readable representation used in assertion messages. */
function repr(value, seen) {
  seen = seen || new Set();
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return value.toString();
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return `[${value.map((v) => repr(v, seen)).join(', ')}]`;
  if (value instanceof Error) return `${value.name}(${JSON.stringify(value.message)})`;
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${key}: ${repr(value[key], seen)}`);
  return `{ ${entries.join(', ')} }`;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i += 1) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (!deepEqual(a[aKeys[i]], b[bKeys[i]])) return false;
  }
  return true;
}

function createMatchers(actual, negated) {
  const fail = (message, expected) => {
    throw new AssertionError(message, expected, repr(actual));
  };
  const check = (pass, message, expected) => {
    if (negated ? pass : !pass) fail(message, expected);
  };
  const not = negated ? undefined : createMatchers(actual, true);
  const prefix = negated ? 'expected NOT ' : 'expected ';

  const matchers = {
    toBe(expected) {
      check(Object.is(actual, expected), `${prefix}${repr(expected)} but received ${repr(actual)}`, repr(expected));
    },
    toEqual(expected) {
      check(deepEqual(actual, expected), `${prefix}${repr(expected)} (deep) but received ${repr(actual)}`, repr(expected));
    },
    toBeCloseTo(expected, digits) {
      const precision = typeof digits === 'number' ? digits : 2;
      const pass = Math.abs(actual - expected) < Math.pow(10, -precision) / 2;
      check(pass, `${prefix}${repr(expected)} (±1e-${precision}) but received ${repr(actual)}`, repr(expected));
    },
    toBeTruthy() {
      check(Boolean(actual), `${prefix}truthy but received ${repr(actual)}`, 'truthy');
    },
    toBeFalsy() {
      check(!actual, `${prefix}falsy but received ${repr(actual)}`, 'falsy');
    },
    toBeNull() {
      check(actual === null, `${prefix}null but received ${repr(actual)}`, 'null');
    },
    toBeUndefined() {
      check(actual === undefined, `${prefix}undefined but received ${repr(actual)}`, 'undefined');
    },
    toBeGreaterThan(expected) {
      check(actual > expected, `${prefix}> ${repr(expected)} but received ${repr(actual)}`, `> ${repr(expected)}`);
    },
    toBeGreaterThanOrEqual(expected) {
      check(actual >= expected, `${prefix}>= ${repr(expected)} but received ${repr(actual)}`, `>= ${repr(expected)}`);
    },
    toBeLessThan(expected) {
      check(actual < expected, `${prefix}< ${repr(expected)} but received ${repr(actual)}`, `< ${repr(expected)}`);
    },
    toBeLessThanOrEqual(expected) {
      check(actual <= expected, `${prefix}<= ${repr(expected)} but received ${repr(actual)}`, `<= ${repr(expected)}`);
    },
    toContain(expected) {
      const pass =
        (typeof actual === 'string' && actual.indexOf(expected) !== -1) ||
        (Array.isArray(actual) && actual.some((item) => deepEqual(item, expected)));
      check(pass, `${prefix}to contain ${repr(expected)} but received ${repr(actual)}`, repr(expected));
    },
    toHaveLength(expected) {
      const length = actual == null ? undefined : actual.length;
      check(length === expected, `${prefix}length ${repr(expected)} but received ${repr(length)}`, repr(expected));
    },
    toThrow(expected) {
      if (typeof actual !== 'function') fail('expect(...).toThrow() needs a function', 'function');
      let thrown = null;
      try {
        actual();
      } catch (error) {
        thrown = error;
      }
      if (!expected) {
        check(thrown !== null, `${prefix}the function to throw but it returned normally`, 'throw');
        return;
      }
      const message = thrown ? String(thrown.message || thrown) : '';
      check(
        thrown !== null && message.indexOf(String(expected)) !== -1,
        `${prefix}a thrown error containing ${repr(expected)} but received ${repr(message || 'no error')}`,
        repr(expected),
      );
    },
  };
  if (not) matchers.not = not;
  return matchers;
}

function createHarness() {
  const queue = [];
  const suites = [];
  const hits = new Set();

  function test(name, fn) {
    if (typeof name !== 'string' || typeof fn !== 'function') {
      throw new Error('test(name, fn) requires a string name and a function');
    }
    const fullName = suites.length > 0 ? `${suites.join(' > ')} > ${name}` : name;
    queue.push({ name: fullName, fn, file: currentFile() });
  }

  function describe(name, fn) {
    suites.push(name);
    try {
      fn();
    } finally {
      suites.pop();
    }
  }

  let activeFile = '<unknown>';
  function currentFile() {
    return activeFile;
  }
  function setActiveFile(file) {
    activeFile = file;
  }

  function expect(actual) {
    return createMatchers(actual, false);
  }

  function hit(id) {
    hits.add(id);
  }

  async function runAll() {
    const results = [];
    for (const item of queue) {
      const startedAt = process.hrtime.bigint();
      let passed = true;
      let failure;
      try {
        const outcome = item.fn();
        if (outcome && typeof outcome.then === 'function') await outcome;
      } catch (error) {
        passed = false;
        failure =
          error instanceof AssertionError
            ? { message: error.message, expected: error.expected, actual: error.actual }
            : { message: `${error && error.name ? error.name : 'Error'}: ${error && error.message ? error.message : String(error)}` };
      }
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      results.push({ name: item.name, file: item.file, passed, durationMs, failure });
    }
    return results;
  }

  return { test, describe, expect, runAll, setActiveFile, hit, hits, queue };
}

module.exports = { createHarness, AssertionError, repr, deepEqual };
