import type { MutationCategory, MutationOperatorId } from '@silentfail/shared';

export interface OperatorMeta {
  id: MutationOperatorId;
  label: string;
  category: MutationCategory;
  /** Why this operator finds real bugs. Shown in the UI and used in explanations. */
  rationale: string;
}

export const OPERATORS: Record<MutationOperatorId, OperatorMeta> = {
  CONDITIONAL_BOUNDARY: {
    id: 'CONDITIONAL_BOUNDARY',
    label: 'Boundary Change',
    category: 'boundary',
    rationale: 'Off-by-one boundary bugs only show up when a test uses the exact boundary value.',
  },
  NEGATE_CONDITIONAL: {
    id: 'NEGATE_CONDITIONAL',
    label: 'Condition Negation',
    category: 'comparison',
    rationale: 'If negating a comparison keeps the suite green, neither side of the branch is truly asserted.',
  },
  EQUALITY_OPERATOR: {
    id: 'EQUALITY_OPERATOR',
    label: 'Equality Change',
    category: 'comparison',
    rationale: 'Flipping equality proves whether a test distinguishes the equal case from the unequal case.',
  },
  ARITHMETIC_OPERATOR: {
    id: 'ARITHMETIC_OPERATOR',
    label: 'Arithmetic Change',
    category: 'arithmetic',
    rationale: 'Wrong arithmetic is silent unless a test asserts the exact numeric result.',
  },
  LOGICAL_OPERATOR: {
    id: 'LOGICAL_OPERATOR',
    label: 'Logical Operator Change',
    category: 'boolean',
    rationale: 'Swapping AND/OR exposes conditions where only one combination of inputs is ever tested.',
  },
  BOOLEAN_LITERAL: {
    id: 'BOOLEAN_LITERAL',
    label: 'Boolean Inversion',
    category: 'boolean',
    rationale: 'An inverted flag that keeps tests green means the flag is never asserted in both states.',
  },
  CONSTANT_REPLACEMENT: {
    id: 'CONSTANT_REPLACEMENT',
    label: 'Constant Replacement',
    category: 'constant',
    rationale: 'Business constants (rates, thresholds, limits) must be pinned by at least one assertion.',
  },
  RETURN_VALUE: {
    id: 'RETURN_VALUE',
    label: 'Return Value Change',
    category: 'return',
    rationale: 'A return value nobody asserts on can be replaced with anything and the suite still passes.',
  },
  BRANCH_CONDITION: {
    id: 'BRANCH_CONDITION',
    label: 'Branch Forcing',
    category: 'branch',
    rationale: 'Forcing a branch always-taken or never-taken reveals branches no test actually reaches.',
  },
  UNARY_NOT_REMOVAL: {
    id: 'UNARY_NOT_REMOVAL',
    label: 'Negation Removal',
    category: 'boolean',
    rationale: 'Removing a `!` shows whether the guarded path is exercised with both truthy and falsy input.',
  },
};

/** Boundary swaps: the classic off-by-one detector. */
export const BOUNDARY_MAP: Record<string, string> = {
  '>': '>=',
  '>=': '>',
  '<': '<=',
  '<=': '<',
};

/** Logical negation of a relational operator. */
export const NEGATION_MAP: Record<string, string> = {
  '>': '<=',
  '>=': '<',
  '<': '>=',
  '<=': '>',
};

export const EQUALITY_MAP: Record<string, string> = {
  '==': '!=',
  '!=': '==',
  '===': '!==',
  '!==': '===',
};

export const ARITHMETIC_MAP: Record<string, string> = {
  '+': '-',
  '-': '+',
  '*': '/',
  '/': '*',
  '%': '*',
};

export const COMPOUND_ASSIGN_MAP: Record<string, string> = {
  '+=': '-=',
  '-=': '+=',
  '*=': '/=',
  '/=': '*=',
};

export const LOGICAL_MAP: Record<string, string> = {
  '&&': '||',
  '||': '&&',
};

export const MUTANT_STRING = '"SILENTFAIL_MUTANT"';
