/** Files materialised inside a throwaway sandbox workspace. */
export interface SandboxFile {
  /** Relative POSIX path inside the workspace. Validated before being written. */
  path: string;
  content: string;
}

export type SandboxEntry = 'run-tests' | 'probe';

export interface SandboxRequest {
  files: SandboxFile[];
  entry: SandboxEntry;
  /** JSON config handed to the sandbox entry script as a single argv. */
  config: unknown;
  timeoutMs?: number;
}

export interface SandboxResponse {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  outputTruncated: boolean;
  /** Parsed `__SILENTFAIL_JSON__` payload, when the run produced one. */
  payload: unknown | null;
  durationMs: number;
  /** Set when the sandbox itself failed (spawn error, no payload, ...). */
  error?: string;
}

/**
 * The only way SILENTFAIL ever executes untrusted code.
 *
 * Keeping this a one-method interface is what makes the security story
 * upgradeable: swapping the local child-process implementation for a container,
 * a microVM or a remote worker means implementing `run` again and changing one
 * line in the analysis pipeline.
 */
export interface ExecutorAdapter {
  readonly name: string;
  run(request: SandboxRequest): Promise<SandboxResponse>;
}
