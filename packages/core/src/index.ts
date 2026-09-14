export { analyzeProject, AnalysisInputError, AnalysisTimeoutError, type AnalyzeOptions, type AnalysisProgress } from './analyze.js';
export { computeScore, classifySeverity, countCriticalBlindSpots, type SeverityInput } from './scoring.js';
export { explainDeterministically, type ExplainContext } from './explain.js';
export {
  suggestTargetedTest,
  buildCandidateValues,
  buildCombos,
  findEnclosingExportedFunction,
  type SuggestionRequest,
  type SuggestionResult,
  type ProbeOutcome,
} from './suggest.js';
export { toTestRunResult, type ParsedTestRun } from './test-run.js';
export { mapWithConcurrency } from './concurrency.js';
export {
  NodeProcessExecutor,
  createSandboxEnvironment,
  killSandboxTree,
  parseMarkerPayload,
  stripMarker,
  type NodeProcessExecutorOptions,
} from './executor/node-process-executor.js';
export type { ExecutorAdapter, SandboxRequest, SandboxResponse, SandboxFile, SandboxEntry } from './executor/types.js';
export {
  OpenAiCompatibleExplainer,
  NullAiExplainer,
  readAiConfig,
  type AiExplainer,
  type AiConfig,
} from './ai/provider.js';
