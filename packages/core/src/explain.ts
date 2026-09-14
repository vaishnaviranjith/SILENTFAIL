import type { Explanation, Mutation, MutationStatus } from '@silentfail/shared';
import { OPERATORS } from '@silentfail/mutation-engine';

export interface ExplainContext {
  mutation: Mutation;
  status: MutationStatus;
  /** null when coverage instrumentation was unavailable for this file. */
  covered: boolean | null;
  killedBy: string[];
  killingInput: string | null;
  expectedValue: string | null;
  totalTests: number;
}

/**
 * Deterministic explanation of a mutation result.
 *
 * This is the *default* explanation and the only one that is ever used to make
 * decisions. Optional AI text (see ai/provider.ts) can add a friendlier paragraph
 * on top, but it can never change a status, a score or a severity.
 */
export function explainDeterministically(context: ExplainContext): Explanation {
  const { mutation, status, covered, killedBy, killingInput, expectedValue } = context;
  const meta = OPERATORS[mutation.operator];
  const where = mutation.functionName ? `${mutation.functionName}() at line ${mutation.line}` : `line ${mutation.line}`;

  if (status === 'CAUGHT') {
    const first = killedBy[0] ?? 'a test';
    return {
      summary: `Protected: ${killedBy.length} test${killedBy.length === 1 ? '' : 's'} failed when ${mutation.description}.`,
      detail: `SILENTFAIL changed ${mutation.originalCode} to ${mutation.mutatedCode} in ${where} and re-ran the suite. "${first}" failed, so this behaviour is genuinely asserted, not just executed.`,
      impact: 'No action needed. This line is guarded by an assertion that would notice a regression here.',
      source: 'deterministic',
      confidence: 0.99,
    };
  }

  if (status === 'ERROR') {
    return {
      summary: `Not measurable: the mutant could not be executed.`,
      detail: `Changing ${mutation.originalCode} to ${mutation.mutatedCode} in ${where} produced code that crashed before the tests could report (for example a syntax or reference error). Mutants like this are excluded from the mutation score instead of being counted as caught.`,
      impact: 'Nothing to fix in your tests. This mutant simply carries no information.',
      source: 'deterministic',
      confidence: 0.9,
    };
  }

  if (status === 'TIMEOUT') {
    return {
      summary: 'Detected by timeout: the mutant made the code hang.',
      detail: `With ${mutation.originalCode} changed to ${mutation.mutatedCode} in ${where}, the suite never finished inside the sandbox time limit. A hang is observable behaviour, so this mutant counts as caught.`,
      impact: 'Consider asserting termination explicitly if this loop is business critical.',
      source: 'deterministic',
      confidence: 0.8,
    };
  }

  // Surviving mutants: the interesting case.
  const operatorInsight = survivorInsight(context);
  if (status === 'NO_COVERAGE' || covered === false) {
    return {
      summary: `Silent failure: no test ever executes ${where}.`,
      detail: [
        `SILENTFAIL instrumented your original code and recorded which statements the ${context.totalTests} passing test${context.totalTests === 1 ? '' : 's'} actually run. The statement holding ${mutation.originalCode} was never reached.`,
        `That is why replacing it with ${mutation.mutatedCode} changed nothing: the suite cannot fail on code it does not run.`,
        operatorInsight,
      ].join(' '),
      impact: `This code path is completely unprotected. Any future edit inside ${where} can ship broken without a single red test.`,
      source: 'deterministic',
      confidence: 0.95,
    };
  }

  if (killingInput) {
    return {
      summary: `Silent failure: ${where} runs, but nothing asserts the difference.`,
      detail: [
        `The suite executes this statement, yet replacing ${mutation.originalCode} with ${mutation.mutatedCode} keeps every test green.`,
        `SILENTFAIL then searched for an input that separates the two versions and found one: ${killingInput}.`,
        expectedValue
          ? `On your original code that input produces ${expectedValue}; the mutant produces something else, and no existing test looks at it.`
          : 'Your original code and the mutant disagree on that input, and no existing test looks at it.',
        operatorInsight,
      ].join(' '),
      impact: `A real bug of exactly this shape would pass CI. ${meta.rationale}`,
      source: 'deterministic',
      confidence: 0.9,
    };
  }

  return {
    summary: `Survived, but possibly equivalent: no distinguishing input was found.`,
    detail: [
      `Replacing ${mutation.originalCode} with ${mutation.mutatedCode} in ${where} kept the suite green, and SILENTFAIL could not find an input where the two versions behave differently within its deterministic candidate budget.`,
      'That usually means the mutant is behaviourally equivalent to your code (impossible to kill) rather than a gap in your tests — but it can also mean the candidate inputs were too narrow.',
      operatorInsight,
    ].join(' '),
    impact: 'Low priority. Review manually and, if the two versions really are equivalent, simplify the code.',
    source: 'deterministic',
    confidence: 0.5,
  };
}

/** Operator-specific sentence that names the missing test case concretely. */
function survivorInsight(context: ExplainContext): string {
  const { mutation } = context;
  switch (mutation.operator) {
    case 'CONDITIONAL_BOUNDARY':
      return `Boundary blind spot: swapping ${mutation.originalCode} for ${mutation.mutatedCode} only changes behaviour for the exact boundary value, so your suite is missing a test that uses it.`;
    case 'NEGATE_CONDITIONAL':
      return 'Branch blind spot: the condition can be inverted without a failure, so at least one side of this decision is never asserted.';
    case 'EQUALITY_OPERATOR':
      return 'Equality blind spot: no test distinguishes the equal case from the unequal case here.';
    case 'ARITHMETIC_OPERATOR':
      return 'Arithmetic blind spot: no assertion pins the exact numeric result of this expression.';
    case 'LOGICAL_OPERATOR':
      return 'Logic blind spot: AND and OR are interchangeable here for every input your tests use, so the combinations that differ are untested.';
    case 'BOOLEAN_LITERAL':
      return 'Flag blind spot: this boolean can be inverted unnoticed, so it is only ever asserted in one state.';
    case 'CONSTANT_REPLACEMENT':
      return 'Constant blind spot: this business constant (rate, threshold, message) is not pinned by any assertion.';
    case 'RETURN_VALUE':
      return 'Return blind spot: the returned value can be replaced with null, so callers of this function are not asserted on.';
    case 'BRANCH_CONDITION':
      return 'Reachability blind spot: forcing this branch changes nothing, so the branch outcome is never verified.';
    case 'UNARY_NOT_REMOVAL':
      return 'Negation blind spot: the guard can be removed without a failure, so it is only tested with one kind of input.';
    default:
      return '';
  }
}
