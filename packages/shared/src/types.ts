/**
 * SILENTFAIL shared result model.
 *
 * These types are the contract between the deterministic engine (packages/core,
 * packages/mutation-engine), the HTTP API (apps/api) and the UI (apps/web).
 * Everything here is JSON-serialisable on purpose: a run can be stored, exported
 * and replayed without any database.
 */

/** Files that make up an analysed project. */
export type ProjectFileKind = 'source' | 'test';

export interface ProjectFile {
  /** Relative, POSIX-style path inside the virtual project (e.g. `discount.js`). */
  path: string;
  content: string;
  kind: ProjectFileKind;
}

export interface ProjectInput {
  name: string;
  files: ProjectFile[];
  /** True when the payload came from the bundled demo fixture. */
  isDemo?: boolean;
}

/** Mutation operator identifiers. Stable strings: they are stored in results. */
export type MutationOperatorId =
  | 'CONDITIONAL_BOUNDARY'
  | 'NEGATE_CONDITIONAL'
  | 'EQUALITY_OPERATOR'
  | 'ARITHMETIC_OPERATOR'
  | 'LOGICAL_OPERATOR'
  | 'BOOLEAN_LITERAL'
  | 'CONSTANT_REPLACEMENT'
  | 'RETURN_VALUE'
  | 'BRANCH_CONDITION'
  | 'UNARY_NOT_REMOVAL';

export type MutationCategory =
  | 'boolean'
  | 'comparison'
  | 'arithmetic'
  | 'boundary'
  | 'constant'
  | 'return'
  | 'branch';

export type MutationStatus = 'CAUGHT' | 'SURVIVED' | 'ERROR' | 'TIMEOUT' | 'NO_COVERAGE';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** A single mutation candidate produced by the mutation engine. */
export interface Mutation {
  mutationId: string;
  file: string;
  line: number;
  column: number;
  operator: MutationOperatorId;
  operatorLabel: string;
  category: MutationCategory;
  /** Exact original snippet that is replaced. */
  originalCode: string;
  /** Replacement snippet. */
  mutatedCode: string;
  /** Source line the mutation lives on, trimmed. Used for display. */
  originalLine: string;
  mutatedLine: string;
  /** Character offsets in the original file content. */
  start: number;
  end: number;
  /** Name of the enclosing function, when it could be determined. */
  functionName: string | null;
  /** Short human description, e.g. `>= became >`. */
  description: string;
}

export interface AssertionFailure {
  message: string;
  expected?: string;
  actual?: string;
}

export interface TestCaseResult {
  name: string;
  file: string;
  passed: boolean;
  durationMs: number;
  failure?: AssertionFailure;
}

export interface TestRunResult {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  tests: TestCaseResult[];
  /** Non-empty when the run itself could not complete (syntax error, crash...). */
  crash?: string;
  timedOut?: boolean;
  /** Captured stdout/stderr, truncated to the configured output limit. */
  output?: string;
}

export interface SuggestedTest {
  /** Ready-to-paste test code. */
  code: string;
  /** Test name used inside the generated code. */
  testName: string;
  /** How the inputs were found. */
  strategy: 'killing-input-search' | 'boundary-probe' | 'template-only';
  /** Inputs as source text, e.g. `[100, true]`. */
  inputs?: string;
  /** Expected value derived from the ORIGINAL (unmutated) implementation. */
  expected?: string;
  /** True when the generated test was executed and proved to kill the mutant. */
  verified: boolean;
  verification?: {
    passesOnOriginal: boolean;
    failsOnMutant: boolean;
    note: string;
  };
  targetFile: string;
}

export type ExplanationSource = 'deterministic' | 'ai';

export interface Explanation {
  /** One-line summary of the blind spot. */
  summary: string;
  /** Longer reasoning, plain text paragraphs. */
  detail: string;
  /** What could break in production if this mutation were a real bug. */
  impact: string;
  source: ExplanationSource;
  /** Deterministic confidence heuristic (0..1). */
  confidence: number;
  model?: string;
}

/** A mutation after execution: the full record shown in the UI. */
export interface MutationResult extends Mutation {
  status: MutationStatus;
  /** Tests that failed for this mutant (empty when it survived). */
  killedBy: string[];
  testResults: TestRunResult;
  executionTimeMs: number;
  severity: Severity;
  reason: string;
  explanation: Explanation;
  suggestedTest?: SuggestedTest;
}

export interface MutationScore {
  totalMutations: number;
  caught: number;
  survived: number;
  errors: number;
  timeouts: number;
  noCoverage: number;
  /** caught+timeouts over all executable mutants, as a percentage (1 decimal). */
  score: number;
  /** Mutants counted in the denominator. */
  denominator: number;
}

export interface BaselineResult {
  /** The untouched test suite must be green before mutation testing starts. */
  ok: boolean;
  testRun: TestRunResult;
  message: string;
}

export interface AnalysisWarning {
  code: string;
  message: string;
}

export interface AnalysisRun {
  runId: string;
  createdAt: string;
  projectName: string;
  isDemo: boolean;
  /** Set when this run was produced by re-running after adding generated tests. */
  parentRunId?: string;
  label: string;
  baseline: BaselineResult;
  mutations: MutationResult[];
  score: MutationScore;
  files: ProjectFile[];
  stats: {
    sourceFiles: number;
    testFiles: number;
    testCount: number;
    analysisTimeMs: number;
    criticalBlindSpots: number;
  };
  aiStatus: AiStatus;
  warnings: AnalysisWarning[];
  engine: {
    version: string;
    executor: string;
    deterministic: true;
  };
}

export interface AiStatus {
  enabled: boolean;
  configured: boolean;
  provider: string | null;
  model: string | null;
  /** Human readable reason shown in Settings / AI disclosure screen. */
  detail: string;
}

export interface ApiError {
  error: string;
  code: string;
  details?: string[];
}
