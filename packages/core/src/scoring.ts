import type { MutationCategory, MutationResult, MutationScore, MutationStatus, Severity } from '@silentfail/shared';

/**
 * Mutation score.
 *
 * `score = (caught + timeouts) / (caught + timeouts + survived + noCoverage)`
 *
 * Timeouts count as caught: a mutation that makes the code hang was detected by the
 * suite (it changed observable behaviour). Mutants that could not be executed at all
 * (`ERROR`, e.g. the mutated file no longer parses) are excluded from the
 * denominator instead of being silently counted as a success, so the score can never
 * be inflated by broken mutants.
 */
export function computeScore(mutations: Array<Pick<MutationResult, 'status'>>): MutationScore {
  const count = (status: MutationStatus) => mutations.filter((m) => m.status === status).length;
  const caught = count('CAUGHT');
  const survived = count('SURVIVED');
  const errors = count('ERROR');
  const timeouts = count('TIMEOUT');
  const noCoverage = count('NO_COVERAGE');

  const killed = caught + timeouts;
  const denominator = killed + survived + noCoverage;
  const score = denominator === 0 ? 0 : Math.round((killed / denominator) * 1000) / 10;

  return {
    totalMutations: mutations.length,
    caught,
    survived,
    errors,
    timeouts,
    noCoverage,
    score,
    denominator,
  };
}

const CATEGORY_WEIGHT: Record<MutationCategory, Severity> = {
  boundary: 'high',
  comparison: 'high',
  boolean: 'high',
  branch: 'high',
  arithmetic: 'medium',
  constant: 'medium',
  return: 'medium',
};

export interface SeverityInput {
  status: MutationStatus;
  category: MutationCategory;
  /** True when the statement is executed by the existing suite. */
  covered: boolean | null;
  /** True when a concrete input was proven to distinguish original from mutant. */
  killingInputFound: boolean;
}

/**
 * Deterministic severity rules. No model, no randomness — the same finding always
 * gets the same severity, which is what makes the report trustworthy.
 */
export function classifySeverity(input: SeverityInput): Severity {
  if (input.status === 'CAUGHT') return 'low';
  if (input.status === 'ERROR' || input.status === 'TIMEOUT') return 'low';
  // A mutation in code the suite never runs is the worst case: nothing protects it.
  if (input.status === 'NO_COVERAGE' || input.covered === false) return 'critical';
  if (input.killingInputFound && CATEGORY_WEIGHT[input.category] === 'high') return 'critical';
  if (input.killingInputFound) return 'high';
  // Survived, executed, but no distinguishing input was found: likely an
  // equivalent mutant rather than a real blind spot.
  return 'medium';
}

/** Findings a reviewer should look at first. */
export function countCriticalBlindSpots(mutations: Array<Pick<MutationResult, 'status' | 'severity'>>): number {
  return mutations.filter((m) => (m.status === 'SURVIVED' || m.status === 'NO_COVERAGE') && m.severity === 'critical')
    .length;
}
