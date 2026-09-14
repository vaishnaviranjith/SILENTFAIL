'use strict';
/**
 * Sandbox guard, loaded with `node --require` BEFORE any analysed code runs.
 *
 * Layer 2 of the execution defence (layer 1 is the separate short-lived process
 * with a scrubbed environment, a throwaway cwd, a wall-clock timeout, a heap cap
 * and an output cap). This layer removes the capabilities that test code for a
 * pure-logic module never needs, and pins the sources of non-determinism so two
 * identical runs produce identical results.
 *
 * It is NOT a security boundary on its own: a determined attacker can defeat an
 * in-process guard. See docs/SECURITY.md for the container/VM path.
 */

const BLOCKED_MODULES = [
  'child_process',
  'cluster',
  'dgram',
  'dns',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'net',
  'os',
  'repl',
  'tls',
  'v8',
  'vm',
  'worker_threads',
];

const Module = require('module');
const path = require('node:path');
const originalLoad = Module._load;
const blocked = new Set(BLOCKED_MODULES.concat(BLOCKED_MODULES.map((name) => `node:${name}`)));
// The runner itself needs `path` to resolve the supplied relative test paths.
// It has no filesystem capability; all filesystem modules stay blocked.
const SAFE_BUILTINS = new Set(['path', 'node:path']);
const SANDBOX_ROOT = path.resolve(process.cwd());

function isInsideSandbox(filename) {
  const relative = path.relative(SANDBOX_ROOT, path.resolve(filename));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

Module._load = function guardedLoad(request, parent, isMain) {
  if (blocked.has(request)) {
    throw new Error(
      `SILENTFAIL sandbox: require('${request}') is blocked. Analysed projects must be pure logic (no I/O, no network, no processes).`,
    );
  }
  if (typeof request === 'string' && !SAFE_BUILTINS.has(request) && (request.startsWith('.') || path.isAbsolute(request))) {
    let resolved;
    try {
      resolved = Module._resolveFilename(request, parent, isMain);
    } catch {
      return originalLoad(request, parent, isMain);
    }
    if (typeof resolved === 'string' && !isInsideSandbox(resolved)) {
      throw new Error(`SILENTFAIL sandbox: module '${request}' resolves outside the sandbox workspace.`);
    }
  } else if (typeof request === 'string' && !SAFE_BUILTINS.has(request)) {
    // Bare specifiers cannot resolve anyway (no node_modules in the sandbox);
    // failing loudly is much clearer than a resolution stack trace.
    throw new Error(
      `SILENTFAIL sandbox: dependency '${request}' is not available. The analysed project must not import npm packages.`,
    );
  }
  return originalLoad(request, parent, isMain);
};

// Remove network globals.
for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator']) {
  try {
    Object.defineProperty(globalThis, name, { value: undefined, configurable: true, writable: false });
  } catch {
    /* ignore: not every runtime exposes all of these */
  }
}

// Pin non-determinism: a mutation score must not depend on the clock or on luck.
let seed = 0x2f6e2b1;
Math.random = function deterministicRandom() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const FIXED_NOW = Date.parse('2025-01-01T00:00:00.000Z');
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIXED_NOW);
    else super(...args);
  }
  static now() {
    return FIXED_NOW;
  }
}
globalThis.Date = FrozenDate;

process.on('uncaughtException', (error) => {
  process.stderr.write(`SILENTFAIL_UNCAUGHT: ${error && error.stack ? error.stack : String(error)}\n`);
  process.exit(97);
});
