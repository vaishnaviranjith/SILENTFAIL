import { createHash, randomUUID } from 'node:crypto';
import {
  ENGINE_VERSION,
  LIMITS,
  validateProject,
  type AnalysisRun,
  type AnalysisWarning,
  type Mutation,
  type MutationResult,
  type MutationStatus,
  type ProjectFile,
  type ProjectInput,
} from '@silentfail/shared';
import { applyMutation, generateMutations, instrumentForCoverage, probeForRange, SourceParseError, type StatementProbe } from '@silentfail/mutation-engine';
import { mapWithConcurrency } from './concurrency.js';
import { NodeProcessExecutor } from './executor/node-process-executor.js';
import type { ExecutorAdapter } from './executor/types.js';
import { explainDeterministically } from './explain.js';
import { NullAiExplainer, type AiExplainer } from './ai/provider.js';
import { classifySeverity, computeScore, countCriticalBlindSpots } from './scoring.js';
import { suggestTargetedTest } from './suggest.js';
import { toTestRunResult } from './test-run.js';

export interface AnalyzeOptions {
  project: ProjectInput;
  executor?: ExecutorAdapter;
  ai?: AiExplainer;
  /** Shown in the history timeline, e.g. "Baseline" or "After adding 4 tests". */
  label?: string;
  parentRunId?: string;
  runId?: string;
  concurrency?: number;
  onProgress?: (progress: AnalysisProgress) => void;
}

export interface AnalysisProgress {
  phase: 'validate' | 'baseline' | 'coverage' | 'generate' | 'execute' | 'explain' | 'done';
  done: number;
  total: number;
  message: string;
}

export class AnalysisInputError extends Error {
  readonly details: string[];
  constructor(message: string, details: string[]) {
    super(message);
    this.name = 'AnalysisInputError';
    this.details = details;
  }
}

export class AnalysisTimeoutError extends Error {
  constructor() {
    super(`Analysis exceeded the ${LIMITS.analysisTimeoutMs}ms time limit.`);
    this.name = 'AnalysisTimeoutError';
  }
}

/**
 * The SILENTFAIL pipeline.
 *
 *   validate -> baseline run -> coverage run -> generate mutations ->
 *   execute every mutant in the sandbox -> classify -> explain ->
 *   search a killing input and generate a verified test for each survivor -> score
 *
 * Everything that ends up in the report is measured, not guessed: statuses come
 * from real test executions, coverage from an instrumented run of the original
 * code, and expected values in generated tests from the original implementation.
 */
export async function analyzeProject(options: AnalyzeOptions): Promise<AnalysisRun> {
  const startedAt = Date.now();
  const deadline = startedAt + LIMITS.analysisTimeoutMs;
  const validation = validateProject(options.project);
  if (!validation.ok || !validation.project) {
    throw new AnalysisInputError('Project rejected by validation.', validation.errors);
  }
  const project = validation.project;
  const executor = options.executor ?? new NodeProcessExecutor();
  const budgetedExecutor = withAnalysisDeadline(executor, deadline);
  const ai = options.ai ?? new NullAiExplainer();
  const progress = options.onProgress ?? (() => undefined);
  const warnings: AnalysisWarning[] = [];
  const inputFingerprint = fingerprint(project.files);

  const sourceFiles = project.files.filter((f) => f.kind === 'source');
  const testFiles = project.files.filter((f) => f.kind === 'test');
  const testPaths = testFiles.map((f) => f.path);
  const sandboxFiles = project.files.map(({ path, content }) => ({ path, content }));

  // 1. Baseline: mutation testing is only meaningful on a green suite.
  progress({ phase: 'baseline', done: 0, total: 1, message: 'Running the existing test suite' });
  const baselineRun = toTestRunResult(await budgetedExecutor.run({ entry: 'run-tests', files: sandboxFiles, config: { testFiles: testPaths } }));
  assertAnalysisBudget(deadline);
  const baseline = {
    ok: baselineRun.result.ok,
    testRun: baselineRun.result,
    message: baselineRun.result.ok
      ? `All ${baselineRun.result.total} tests pass. This is the suite SILENTFAIL will try to fool.`
      : baselineRun.result.crash
        ? `The test suite could not run: ${baselineRun.result.crash}`
        : `${baselineRun.result.failed} of ${baselineRun.result.total} tests fail. Fix the suite first: mutation testing needs a green baseline.`,
  };

  if (!baseline.ok) {
    return finish({
      project,
      baseline,
      mutations: [],
      warnings: [
        {
          code: 'BASELINE_RED',
          message: 'Mutation analysis was skipped because the unmodified test suite is not green.',
        },
      ],
      startedAt,
      executor,
      ai,
      options,
      testCount: baselineRun.result.total,
      sourceCount: sourceFiles.length,
      testFileCount: testFiles.length,
      inputFingerprint,
    });
  }

  // 2. Coverage: which statements does the green suite actually execute?
  progress({ phase: 'coverage', done: 0, total: 1, message: 'Measuring which statements the tests execute' });
  const coverage = await measureCoverage({ executor: budgetedExecutor, files: project.files, testPaths });
  assertAnalysisBudget(deadline);
  if (!coverage.ok) {
    warnings.push({
      code: 'COVERAGE_UNAVAILABLE',
      message: `Statement coverage could not be measured (${coverage.reason}). Survivors are still reported, but "never executed" cannot be distinguished from "executed but not asserted".`,
    });
  }

  // 3. Generate mutations from the AST.
  progress({ phase: 'generate', done: 0, total: 1, message: 'Generating mutations' });
  let mutations: Mutation[] = [];
  try {
    mutations = generateMutations(project.files, { maxMutations: LIMITS.maxMutations });
  } catch (error) {
    if (error instanceof SourceParseError) {
      throw new AnalysisInputError('Source file could not be parsed.', [
        `${error.message} (line ${error.line}, column ${error.column})`,
      ]);
    }
    throw error;
  }
  assertAnalysisBudget(deadline);
  if (mutations.length === 0) {
    warnings.push({
      code: 'NO_MUTATIONS',
      message: 'No mutation candidates were found. The source has no conditions, arithmetic, constants or returns to mutate.',
    });
  }
  if (mutations.length >= LIMITS.maxMutations) {
    warnings.push({
      code: 'MUTATION_LIMIT',
      message: `Mutation generation stopped at the configured limit of ${LIMITS.maxMutations} mutants.`,
    });
  }

  // 4. Execute every mutant in its own sandbox.
  let executed = 0;
  const executions = await mapWithConcurrency(mutations, options.concurrency ?? LIMITS.concurrency, async (mutation) => {
    const source = project.files.find((f) => f.path === mutation.file);
    const mutatedContent = applyMutation(source?.content ?? '', mutation);
    const response = await budgetedExecutor.run({
      entry: 'run-tests',
      files: sandboxFiles.map((file) => (file.path === mutation.file ? { ...file, content: mutatedContent } : file)),
      config: { testFiles: testPaths },
    });
    const parsed = toTestRunResult(response);
    executed += 1;
    progress({ phase: 'execute', done: executed, total: mutations.length, message: `Executed mutant ${mutation.mutationId}` });
    const covered = coverage.ok ? isCovered(coverage.probes.get(mutation.file) ?? [], coverage.hits, mutation) : null;
    return { mutation, parsed, response, covered, status: classifyStatus(parsed.result, response.timedOut, covered) };
  });
  assertAnalysisBudget(deadline);

  // 5. Survivors get the full treatment: killing-input probe + generated test.
  const survivors = executions.filter((e) => e.status === 'SURVIVED' || e.status === 'NO_COVERAGE');
  const deepTargets = survivors.slice(0, LIMITS.maxDeepAnalysis);
  if (survivors.length > deepTargets.length) {
    warnings.push({
      code: 'DEEP_ANALYSIS_LIMIT',
      message: `Targeted tests were generated for the first ${deepTargets.length} survivors of ${survivors.length}.`,
    });
  }

  const suggestionByMutation = new Map<string, Awaited<ReturnType<typeof suggestTargetedTest>>>();
  let explained = 0;
  await mapWithConcurrency(deepTargets, options.concurrency ?? LIMITS.concurrency, async (target) => {
    const targetTestFile = pickTargetTestFile(testFiles, target.mutation);
    if (!targetTestFile) return;
    const suggestion = await suggestTargetedTest({
      executor: budgetedExecutor,
      files: project.files,
      mutation: target.mutation,
      targetTestFile,
    });
    suggestionByMutation.set(target.mutation.mutationId, suggestion);
    explained += 1;
    progress({ phase: 'explain', done: explained, total: deepTargets.length, message: `Analysed survivor ${target.mutation.mutationId}` });
  });
  assertAnalysisBudget(deadline);

  // 6. Explain + classify severity. AI text is optional and additive.
  let aiCalls = 0;
  const results: MutationResult[] = [];
  for (const execution of executions) {
    const suggestion = suggestionByMutation.get(execution.mutation.mutationId);
    const killedBy = execution.parsed.result.tests.filter((t) => !t.passed).map((t) => t.name);
    const context = {
      mutation: execution.mutation,
      status: execution.status,
      covered: execution.covered,
      killedBy,
      killingInput: suggestion?.killingInput ?? null,
      expectedValue: suggestion?.expectedValue ?? null,
      totalTests: baselineRun.result.total,
    };
    const deterministic = explainDeterministically(context);
    let explanation = deterministic;
    const wantsAi = execution.status === 'SURVIVED' || execution.status === 'NO_COVERAGE';
    if (wantsAi && aiCalls < LIMITS.maxAiExplanations) {
      assertAnalysisBudget(deadline);
      aiCalls += 1;
      const aiExplanation = await ai.explain(context, deterministic);
      assertAnalysisBudget(deadline);
      if (aiExplanation) explanation = aiExplanation;
    }

    results.push({
      ...execution.mutation,
      status: execution.status,
      killedBy,
      testResults: execution.parsed.result,
      executionTimeMs: Math.round(execution.response.durationMs),
      severity: classifySeverity({
        status: execution.status,
        category: execution.mutation.category,
        covered: execution.covered,
        killingInputFound: Boolean(suggestion?.suggestion?.verified),
      }),
      reason: buildReason(execution.status, killedBy, suggestion?.note ?? null, execution.covered),
      explanation,
      ...(suggestion?.suggestion ? { suggestedTest: suggestion.suggestion } : {}),
    });
  }

  progress({ phase: 'done', done: mutations.length, total: mutations.length, message: 'Analysis complete' });
  assertAnalysisBudget(deadline);

  return finish({
    project,
    baseline,
    mutations: results,
    warnings,
    startedAt,
    executor,
    ai,
    options,
    testCount: baselineRun.result.total,
    sourceCount: sourceFiles.length,
    testFileCount: testFiles.length,
    inputFingerprint,
  });
}

function withAnalysisDeadline(executor: ExecutorAdapter, deadline: number): ExecutorAdapter {
  return {
    name: executor.name,
    run: (request) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new AnalysisTimeoutError();
      const requested = request.timeoutMs ?? remaining;
      return executor.run({ ...request, timeoutMs: Math.max(1, Math.min(requested, remaining)) });
    },
  };
}

function assertAnalysisBudget(deadline: number): void {
  if (Date.now() >= deadline) throw new AnalysisTimeoutError();
}

function classifyStatus(
  result: ReturnType<typeof toTestRunResult>['result'],
  timedOut: boolean,
  covered: boolean | null,
): MutationStatus {
  if (timedOut) return 'TIMEOUT';
  if (result.crash) return 'ERROR';
  if (result.failed > 0) return 'CAUGHT';
  if (covered === false) return 'NO_COVERAGE';
  return 'SURVIVED';
}

function buildReason(status: MutationStatus, killedBy: string[], note: string | null, covered: boolean | null): string {
  switch (status) {
    case 'CAUGHT':
      return `Killed by ${killedBy.length} test${killedBy.length === 1 ? '' : 's'}: ${killedBy.slice(0, 3).join(', ')}`;
    case 'TIMEOUT':
      return 'The mutant never finished: detected by the sandbox timeout.';
    case 'ERROR':
      return 'The mutant could not be executed, so it is excluded from the score.';
    case 'NO_COVERAGE':
      return 'No test executes this statement, so no test can fail on it.';
    default:
      return covered === true
        ? `Every test still passed with the mutated code. ${note ?? ''}`.trim()
        : `Every test still passed with the mutated code. ${note ?? ''}`.trim();
  }
}

/** Prefers a test file that already tests the mutated module. */
function pickTargetTestFile(testFiles: ProjectFile[], mutation: Mutation): ProjectFile | undefined {
  const base = mutation.file.replace(/\.[cm]?js$/, '');
  return (
    testFiles.find((f) => f.content.includes(mutation.file)) ??
    testFiles.find((f) => f.path.startsWith(base)) ??
    testFiles[0]
  );
}

interface CoverageOutcome {
  ok: boolean;
  reason: string;
  hits: Set<number>;
  probes: Map<string, StatementProbe[]>;
}

/** One extra sandbox run of instrumented ORIGINAL code gives real statement coverage. */
async function measureCoverage(args: {
  executor: ExecutorAdapter;
  files: ProjectFile[];
  testPaths: string[];
}): Promise<CoverageOutcome> {
  const probes = new Map<string, StatementProbe[]>();
  const instrumented: ProjectFile[] = [];
  let nextId = 0;
  try {
    for (const file of args.files) {
      if (file.kind !== 'source') {
        instrumented.push(file);
        continue;
      }
      const result = instrumentForCoverage(file.content, nextId);
      nextId += result.probes.length;
      probes.set(file.path, result.probes);
      instrumented.push({ ...file, content: result.code });
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error), hits: new Set(), probes };
  }

  const response = await args.executor.run({
    entry: 'run-tests',
    files: instrumented.map(({ path, content }) => ({ path, content })),
    config: { testFiles: args.testPaths },
  });
  const parsed = toTestRunResult(response);
  if (!parsed.result.ok) {
    return {
      ok: false,
      reason: parsed.result.crash ?? 'the instrumented run was not green',
      hits: new Set(),
      probes,
    };
  }
  return { ok: true, reason: 'measured', hits: new Set(parsed.hits), probes };
}

function isCovered(probes: StatementProbe[], hits: Set<number>, mutation: Mutation): boolean | null {
  const probe = probeForRange(probes, mutation.start, mutation.end);
  if (!probe) return null;
  return hits.has(probe.id);
}

/** SHA-256 of the exact input files: proves the analysis never mutated them. */
function fingerprint(files: ProjectFile[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(`${file.path}\u0000${file.content}\u0000`);
  }
  return hash.digest('hex');
}

function finish(args: {
  project: ProjectInput;
  baseline: AnalysisRun['baseline'];
  mutations: MutationResult[];
  warnings: AnalysisWarning[];
  startedAt: number;
  executor: ExecutorAdapter;
  ai: AiExplainer;
  options: AnalyzeOptions;
  testCount: number;
  sourceCount: number;
  testFileCount: number;
  inputFingerprint: string;
}): AnalysisRun {
  const warnings = [...args.warnings];
  if (fingerprint(args.project.files) !== args.inputFingerprint) {
    warnings.push({
      code: 'INPUT_MUTATED',
      message: 'Internal check failed: the input files changed during analysis. Please report this.',
    });
  }
  const score = computeScore(args.mutations);
  return {
    runId: args.options.runId ?? randomUUID(),
    createdAt: new Date().toISOString(),
    projectName: args.project.name,
    isDemo: args.project.isDemo === true,
    ...(args.options.parentRunId ? { parentRunId: args.options.parentRunId } : {}),
    label: args.options.label ?? 'Analysis',
    baseline: args.baseline,
    mutations: args.mutations,
    score,
    files: args.project.files,
    stats: {
      sourceFiles: args.sourceCount,
      testFiles: args.testFileCount,
      testCount: args.testCount,
      analysisTimeMs: Date.now() - args.startedAt,
      criticalBlindSpots: countCriticalBlindSpots(args.mutations),
    },
    aiStatus: args.ai.status(),
    warnings,
    engine: { version: ENGINE_VERSION, executor: args.executor.name, deterministic: true },
  };
}
