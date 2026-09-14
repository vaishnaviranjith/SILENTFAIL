export { OPERATORS, type OperatorMeta } from './operators.js';
export {
  applyMutation,
  enclosingFunctionName,
  generateMutations,
  generateMutationsForFile,
  type GenerateOptions,
} from './generate.js';
export { parseSource, SourceParseError, findOperatorRange, blankComments, lineOf, columnOf, lineTextAt } from './source.js';
export { extractFunctionSignatures, type FunctionSignature, type ParamInfo } from './signatures.js';
export {
  instrumentForCoverage,
  probeForRange,
  type InstrumentedSource,
  type StatementProbe,
} from './coverage.js';
