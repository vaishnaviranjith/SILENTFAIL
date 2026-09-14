import type { Mutation, MutationOperatorId, ProjectFile } from '@silentfail/shared';
import { LIMITS } from '@silentfail/shared';
import {
  ARITHMETIC_MAP,
  BOUNDARY_MAP,
  COMPOUND_ASSIGN_MAP,
  EQUALITY_MAP,
  LOGICAL_MAP,
  MUTANT_STRING,
  NEGATION_MAP,
  OPERATORS,
} from './operators.js';
import { columnOf, findOperatorRange, lineOf, lineTextAt, parseSource } from './source.js';

/** Minimal structural view of the acorn nodes this engine touches. */
interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

interface RawMutation {
  operator: MutationOperatorId;
  start: number;
  end: number;
  mutatedCode: string;
  description: string;
}

/** Depth-first walk over every AST node, tracking ancestors. */
function walk(node: AstNode, ancestors: AstNode[], visit: (n: AstNode, a: AstNode[]) => void): void {
  visit(node, ancestors);
  const nextAncestors = [...ancestors, node];
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) walk(item, nextAncestors, visit);
      }
    } else if (isNode(value)) {
      walk(value, nextAncestors, visit);
    }
  }
}

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
}

/** Literals inside `require(...)` must never be mutated: it would break the import. */
function insideRequireCall(ancestors: AstNode[]): boolean {
  return ancestors.some((a) => {
    if (a.type !== 'CallExpression') return false;
    const callee = a['callee'] as AstNode | undefined;
    return !!callee && callee.type === 'Identifier' && callee['name'] === 'require';
  });
}

function isPropertyKey(node: AstNode, ancestors: AstNode[]): boolean {
  const parent = ancestors[ancestors.length - 1];
  return !!parent && parent.type === 'Property' && parent['key'] === node;
}

/** `'use strict'` and other directives are not business logic. */
function isDirective(ancestors: AstNode[]): boolean {
  const parent = ancestors[ancestors.length - 1];
  return !!parent && parent.type === 'ExpressionStatement' && parent['directive'] !== undefined;
}

/** Best-effort name of the function a node lives in; used for readable reports. */
export function enclosingFunctionName(ancestors: AstNode[]): string | null {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const node = ancestors[i];
    if (!node) continue;
    if (node.type === 'FunctionDeclaration') {
      const id = node['id'] as AstNode | undefined;
      return (id?.['name'] as string | undefined) ?? '(anonymous)';
    }
    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      const parent = ancestors[i - 1];
      if (parent?.type === 'VariableDeclarator') {
        const id = parent['id'] as AstNode | undefined;
        return (id?.['name'] as string | undefined) ?? '(anonymous)';
      }
      if (parent?.type === 'Property') {
        const key = parent['key'] as AstNode | undefined;
        return (key?.['name'] as string | undefined) ?? (key?.['value'] as string | undefined) ?? '(anonymous)';
      }
      if (parent?.type === 'AssignmentExpression') {
        const left = parent['left'] as AstNode | undefined;
        const prop = left?.['property'] as AstNode | undefined;
        return (prop?.['name'] as string | undefined) ?? '(anonymous)';
      }
      return '(anonymous)';
    }
  }
  return null;
}

function operatorReplacements(node: AstNode, code: string): RawMutation[] {
  const out: RawMutation[] = [];
  const left = node['left'] as AstNode | undefined;
  const right = node['right'] as AstNode | undefined;
  const operator = node['operator'] as string | undefined;
  if (!left || !right || !operator) return out;
  const range = findOperatorRange(code, operator, left.end, right.start);
  if (!range) return out;

  const push = (id: MutationOperatorId, replacement: string) => {
    out.push({
      operator: id,
      start: range.start,
      end: range.end,
      mutatedCode: replacement,
      description: `\`${operator}\` became \`${replacement}\``,
    });
  };

  if (node.type === 'BinaryExpression') {
    if (BOUNDARY_MAP[operator]) push('CONDITIONAL_BOUNDARY', BOUNDARY_MAP[operator]);
    if (NEGATION_MAP[operator]) push('NEGATE_CONDITIONAL', NEGATION_MAP[operator]);
    if (EQUALITY_MAP[operator]) push('EQUALITY_OPERATOR', EQUALITY_MAP[operator]);
    if (ARITHMETIC_MAP[operator]) push('ARITHMETIC_OPERATOR', ARITHMETIC_MAP[operator]);
  } else if (node.type === 'LogicalExpression') {
    if (LOGICAL_MAP[operator]) push('LOGICAL_OPERATOR', LOGICAL_MAP[operator]);
  } else if (node.type === 'AssignmentExpression') {
    if (COMPOUND_ASSIGN_MAP[operator]) push('ARITHMETIC_OPERATOR', COMPOUND_ASSIGN_MAP[operator]);
  }
  return out;
}

function literalReplacements(node: AstNode, ancestors: AstNode[]): RawMutation[] {
  if (insideRequireCall(ancestors) || isPropertyKey(node, ancestors) || isDirective(ancestors)) return [];
  const value = node['value'];
  const raw = (node['raw'] as string | undefined) ?? '';

  if (typeof value === 'boolean') {
    const replacement = value ? 'false' : 'true';
    return [
      {
        operator: 'BOOLEAN_LITERAL',
        start: node.start,
        end: node.end,
        mutatedCode: replacement,
        description: `\`${raw}\` became \`${replacement}\``,
      },
    ];
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    let replacement: string;
    if (value === 0) replacement = '1';
    else if (value === 1) replacement = '0';
    else replacement = String(value + 1);
    return [
      {
        operator: 'CONSTANT_REPLACEMENT',
        start: node.start,
        end: node.end,
        mutatedCode: replacement,
        description: `constant \`${raw}\` became \`${replacement}\``,
      },
    ];
  }

  if (typeof value === 'string' && value.length > 0 && value.length <= 40) {
    return [
      {
        operator: 'CONSTANT_REPLACEMENT',
        start: node.start,
        end: node.end,
        mutatedCode: MUTANT_STRING,
        description: `string \`${raw}\` became \`${MUTANT_STRING}\``,
      },
    ];
  }

  return [];
}

function returnReplacements(node: AstNode, code: string): RawMutation[] {
  const argument = node['argument'] as AstNode | undefined;
  // `return;` and literal returns are already covered by the literal operators.
  if (!argument || argument.type === 'Literal') return [];
  const original = code.slice(argument.start, argument.end);
  if (original === 'null' || original === 'undefined') return [];
  return [
    {
      operator: 'RETURN_VALUE',
      start: argument.start,
      end: argument.end,
      mutatedCode: 'null',
      description: `returned value \`${truncate(original)}\` became \`null\``,
    },
  ];
}

function branchReplacements(node: AstNode, code: string): RawMutation[] {
  const test = node['test'] as AstNode | undefined;
  if (!test) return [];
  const original = code.slice(test.start, test.end);
  if (original === 'true' || original === 'false') return [];
  const kind = node.type === 'IfStatement' ? 'if' : 'ternary';
  return (['true', 'false'] as const).map((value) => ({
    operator: 'BRANCH_CONDITION' as MutationOperatorId,
    start: test.start,
    end: test.end,
    mutatedCode: value,
    description: `${kind} condition \`${truncate(original)}\` forced to \`${value}\``,
  }));
}

function unaryReplacements(node: AstNode): RawMutation[] {
  if (node['operator'] !== '!') return [];
  const argument = node['argument'] as AstNode | undefined;
  if (!argument) return [];
  return [
    {
      operator: 'UNARY_NOT_REMOVAL',
      start: node.start,
      end: argument.start,
      mutatedCode: '',
      description: 'removed the `!` negation',
    },
  ];
}

function truncate(text: string, max = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Applies a mutation to source text. Pure: the caller keeps the original string. */
export function applyMutation(code: string, mutation: Pick<Mutation, 'start' | 'end' | 'mutatedCode'>): string {
  return code.slice(0, mutation.start) + mutation.mutatedCode + code.slice(mutation.end);
}

export interface GenerateOptions {
  /** Upper bound on returned mutations (deterministic prefix of the sorted list). */
  maxMutations?: number;
  /** Restrict generation to these operators. */
  operators?: MutationOperatorId[];
}

/**
 * Generates every mutation candidate for one source file.
 *
 * Deterministic by construction: candidates are collected by a depth-first AST
 * walk, then sorted by position/operator/replacement and given sequential ids.
 * The same input always produces the same mutation list, which is what makes
 * mutation scores comparable between runs.
 */
export function generateMutationsForFile(file: ProjectFile, options: GenerateOptions = {}): Mutation[] {
  const { ast, code } = parseSource(file.content);
  const allowed = options.operators ? new Set(options.operators) : null;
  const collected: Array<RawMutation & { functionName: string | null }> = [];

  walk(ast as unknown as AstNode, [], (node, ancestors) => {
    let raws: RawMutation[] = [];
    switch (node.type) {
      case 'BinaryExpression':
      case 'LogicalExpression':
      case 'AssignmentExpression':
        raws = operatorReplacements(node, code);
        break;
      case 'Literal':
        raws = literalReplacements(node, ancestors);
        break;
      case 'ReturnStatement':
        raws = returnReplacements(node, code);
        break;
      case 'IfStatement':
      case 'ConditionalExpression':
        raws = branchReplacements(node, code);
        break;
      case 'UnaryExpression':
        raws = unaryReplacements(node);
        break;
      default:
        raws = [];
    }
    const functionName = raws.length > 0 ? enclosingFunctionName(ancestors) : null;
    for (const raw of raws) {
      if (allowed && !allowed.has(raw.operator)) continue;
      collected.push({ ...raw, functionName });
    }
  });

  const unique = new Map<string, RawMutation & { functionName: string | null }>();
  for (const item of collected) {
    const key = `${item.start}:${item.end}:${item.operator}:${item.mutatedCode}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  const sorted = [...unique.values()].sort(
    (a, b) =>
      a.start - b.start ||
      a.end - b.end ||
      a.operator.localeCompare(b.operator) ||
      a.mutatedCode.localeCompare(b.mutatedCode),
  );

  const limit = options.maxMutations ?? LIMITS.maxMutations;
  return sorted.slice(0, limit).map((raw, index) => {
    const meta = OPERATORS[raw.operator];
    const mutatedFull = applyMutation(code, raw);
    const originalCode = code.slice(raw.start, raw.end);
    return {
      mutationId: `${file.path}#${String(index + 1).padStart(3, '0')}`,
      file: file.path,
      line: lineOf(code, raw.start),
      column: columnOf(code, raw.start),
      operator: raw.operator,
      operatorLabel: meta.label,
      category: meta.category,
      originalCode: originalCode === '' ? '(nothing)' : originalCode,
      mutatedCode: raw.mutatedCode === '' ? '(removed)' : raw.mutatedCode,
      originalLine: lineTextAt(code, raw.start).trim(),
      mutatedLine: lineTextAt(mutatedFull, raw.start).trim(),
      start: raw.start,
      end: raw.end,
      functionName: raw.functionName,
      description: raw.description,
    } satisfies Mutation;
  });
}

/** Generates mutations for every `source` file of a project, in path order. */
export function generateMutations(files: ProjectFile[], options: GenerateOptions = {}): Mutation[] {
  const sources = files.filter((f) => f.kind === 'source').sort((a, b) => a.path.localeCompare(b.path));
  const out: Mutation[] = [];
  for (const file of sources) {
    const remaining = (options.maxMutations ?? LIMITS.maxMutations) - out.length;
    if (remaining <= 0) break;
    out.push(...generateMutationsForFile(file, { ...options, maxMutations: remaining }));
  }
  return out;
}
