import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS, SAFE_PATH_RE } from '@silentfail/shared';
import type { ExecutorAdapter, SandboxRequest, SandboxResponse } from './types.js';

const MARKER = '__SILENTFAIL_JSON__';
const RUNTIME_DIR = fileURLToPath(new URL('../../runtime/', import.meta.url));

/** Runtime helpers copied into every sandbox workspace, with their sandbox names. */
const RUNTIME_FILES: Array<[source: string, target: string]> = [
  ['harness.cjs', 'sf-harness.cjs'],
  ['guard.cjs', 'sf-guard.cjs'],
  ['run-tests.cjs', 'sf-run-tests.cjs'],
  ['probe.cjs', 'sf-probe.cjs'],
];

const ENTRY_SCRIPTS: Record<SandboxRequest['entry'], string> = {
  'run-tests': './sf-run-tests.cjs',
  probe: './sf-probe.cjs',
};

export interface NodeProcessExecutorOptions {
  /** Default per-run wall clock timeout. */
  timeoutMs?: number;
  /** Keep the workspace on disk (debugging only; never enabled in production). */
  keepWorkspace?: boolean;
}

/**
 * Builds the minimal environment needed by a Node child on each platform.
 *
 * Windows needs the system runtime variables (`SystemRoot`, `ComSpec`, and a
 * real `Path`) even when the child executable itself is absolute. The old
 * implementation supplied `/usr/bin:/bin` on every platform, which made the
 * Windows child start unreliably and could leave the executor with no marker.
 */
export function createSandboxEnvironment(
  platform: NodeJS.Platform = process.platform,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'sandbox',
    SILENTFAIL_SANDBOX: '1',
  };
  if (platform === 'win32') {
    const pathValue = source.Path ?? source.PATH;
    if (pathValue) env.Path = pathValue;
    for (const name of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP']) {
      const value = source[name];
      if (value) env[name] = value;
    }
  } else {
    env.PATH = '/usr/bin:/bin';
  }
  return env;
}

/**
 * Terminates the complete sandbox process tree.
 *
 * POSIX uses a detached process group. Windows has no portable negative-PID
 * equivalent, so `taskkill /T /F` is invoked with fixed argument positions and
 * an absolute system path when available. The fallback still kills the direct
 * child if the system helper is unavailable.
 */
export function killSandboxTree(
  child: Pick<ReturnType<typeof spawn>, 'pid' | 'kill'>,
  platform: NodeJS.Platform = process.platform,
  source: NodeJS.ProcessEnv = process.env,
): void {
  if (!child.pid) return;
  if (platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }
    return;
  }

  const systemRoot = source.SystemRoot ?? source.windir;
  const taskkill = systemRoot ? path.join(systemRoot, 'System32', 'taskkill.exe') : 'taskkill.exe';
  const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], {
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
    env: createSandboxEnvironment('win32', source),
  });
  killer.once('error', () => {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  });
}

/**
 * Executes analysed code in a short-lived child `node` process.
 *
 * Isolation applied per run:
 *  - a fresh `mkdtemp` workspace, deleted in a `finally` block
 *  - a scrubbed environment (no inherited secrets, no `NODE_OPTIONS`)
 *  - `--require sf-guard.cjs` to block fs/net/process modules and pin Math.random/Date
 *  - `--max-old-space-size` heap cap and, on POSIX, `ulimit -t` CPU + `ulimit -f` file caps
 *  - a wall-clock timeout that SIGKILLs the whole process group
 *  - a hard cap on captured output, which also kills runaway producers
 *
 * The user's own files are never touched: only copies inside the temp workspace are
 * mutated, so "restore the original source" is structurally guaranteed.
 */
export class NodeProcessExecutor implements ExecutorAdapter {
  readonly name = 'node-child-process';
  private readonly timeoutMs: number;
  private readonly keepWorkspace: boolean;

  constructor(options: NodeProcessExecutorOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? LIMITS.testTimeoutMs;
    this.keepWorkspace = options.keepWorkspace ?? false;
  }

  async run(request: SandboxRequest): Promise<SandboxResponse> {
    const startedAt = Date.now();
    const workspace = await mkdtemp(path.join(tmpdir(), 'silentfail-'));
    try {
      await this.materialise(workspace, request);
      return await this.spawnSandbox(workspace, request, startedAt);
    } catch (error) {
      return {
        exitCode: null,
        signal: null,
        timedOut: false,
        stdout: '',
        stderr: '',
        outputTruncated: false,
        payload: null,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (!this.keepWorkspace) {
        await rm(workspace, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined);
      }
    }
  }

  /** Writes the request files, refusing anything that could escape the workspace. */
  private async materialise(workspace: string, request: SandboxRequest): Promise<void> {
    await writeFile(
      path.join(workspace, 'package.json'),
      `${JSON.stringify({ name: 'silentfail-sandbox', private: true, type: 'commonjs' }, null, 2)}\n`,
      'utf8',
    );
    for (const [source, target] of RUNTIME_FILES) {
      await copyFile(path.join(RUNTIME_DIR, source), path.join(workspace, target));
    }
    for (const file of request.files) {
      if (!SAFE_PATH_RE.test(file.path)) {
        throw new Error(`Unsafe sandbox path rejected: ${file.path}`);
      }
      const target = path.resolve(workspace, file.path);
      const relative = path.relative(workspace, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path traversal attempt rejected: ${file.path}`);
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, 'utf8');
    }
  }

  private async spawnSandbox(workspace: string, request: SandboxRequest, startedAt: number): Promise<SandboxResponse> {
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const nodeArgs = [
      '--require',
      './sf-guard.cjs',
      `--max-old-space-size=${LIMITS.maxHeapMb}`,
      ENTRY_SCRIPTS[request.entry],
      JSON.stringify(request.config ?? {}),
    ];

    const posix = process.platform !== 'win32';
    const env = createSandboxEnvironment();
    const child = posix
      ? spawn(
          '/bin/sh',
          [
            '-c',
            'ulimit -t 10 2>/dev/null; ulimit -f 20000 2>/dev/null; exec "$SF_NODE" "$@"',
            'silentfail-sandbox',
            ...nodeArgs,
          ],
          { cwd: workspace, env: { ...env, SF_NODE: process.execPath }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
        )
      : spawn(process.execPath, nodeArgs, { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let outputTruncated = false;
    let timedOut = false;

    const killTree = () => {
      killSandboxTree(child, process.platform);
    };

    const capture = (chunk: Buffer, target: 'out' | 'err') => {
      const remaining = LIMITS.maxOutputBytes - bytes;
      if (remaining <= 0) {
        if (!outputTruncated) {
          outputTruncated = true;
          killTree();
        }
        return;
      }
      const text = chunk.toString('utf8').slice(0, remaining);
      bytes += Buffer.byteLength(text, 'utf8');
      if (target === 'out') stdout += text;
      else stderr += text;
    };

    child.stdout?.on('data', (chunk: Buffer) => capture(chunk, 'out'));
    child.stderr?.on('data', (chunk: Buffer) => capture(chunk, 'err'));

    const exit = await new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true;
        killTree();
      }, timeoutMs);
      child.on('error', (error) => {
        clearTimeout(timer);
        stderr += `\nsandbox spawn error: ${error.message}`;
        resolve({ code: null, signal: null });
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });

    const payload = parseMarkerPayload(stdout);
    const response: SandboxResponse = {
      exitCode: exit.code,
      signal: exit.signal,
      timedOut,
      stdout: stripMarker(stdout),
      stderr,
      outputTruncated,
      payload,
      durationMs: Date.now() - startedAt,
    };
    if (!payload && !timedOut) {
      response.error = `Sandbox produced no result (exit code ${String(exit.code)}).`;
    }
    return response;
  }
}

/** Extracts the last `__SILENTFAIL_JSON__` line from captured stdout. */
export function parseMarkerPayload(stdout: string): unknown | null {
  const index = stdout.lastIndexOf(MARKER);
  if (index === -1) return null;
  const start = index + MARKER.length;
  const newline = stdout.indexOf('\n', start);
  const json = stdout.slice(start, newline === -1 ? undefined : newline);
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

/** Removes the machine-readable line so only real program output is shown to users. */
export function stripMarker(stdout: string): string {
  return stdout
    .split('\n')
    .filter((line) => !line.startsWith(MARKER))
    .join('\n')
    .trim();
}
