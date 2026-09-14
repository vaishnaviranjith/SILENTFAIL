/**
 * Hard limits shared by API validation and the sandbox executor.
 * Untrusted input is bounded *before* anything is written to disk or executed.
 */
export const LIMITS = {
  /** Max files in one analysed project. */
  maxFiles: 12,
  /** Max characters per file. */
  maxFileChars: 20_000,
  /** Max characters for the whole project. */
  maxProjectChars: 60_000,
  /** Max mutations generated per run (keeps runs fast and predictable). */
  maxMutations: 120,
  /** Per-test-run wall clock budget, milliseconds. */
  testTimeoutMs: 5_000,
  /** Whole-analysis budget, milliseconds. */
  analysisTimeoutMs: 120_000,
  /** Max bytes captured from a sandbox process' stdout+stderr. */
  maxOutputBytes: 16_000,
  /** Max heap for a sandbox process, megabytes. */
  maxHeapMb: 128,
  /** Max input combinations tried when searching for a killing input. */
  maxKillingInputCombos: 240,
  /** Max surviving mutants that get the full probe + generated test treatment. */
  maxDeepAnalysis: 16,
  /** Max optional AI explanation calls per analysis run. */
  maxAiExplanations: 8,
  /** Sandbox processes run in parallel. */
  concurrency: 4,
  /** Runs kept in the in-memory API store. */
  maxStoredRuns: 40,
} as const;

/** Only these file extensions are accepted. Everything else is rejected. */
export const ALLOWED_EXTENSIONS = ['.js', '.cjs'] as const;

/** Filename must be a plain relative path: no `..`, no absolute paths, no NUL. */
export const SAFE_PATH_RE = /^(?!.*\.\.)(?!\/)[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
