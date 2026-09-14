import { parseSource } from './source.js';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface ParamInfo {
  name: string;
  /** Source text of a default value, when the parameter has one. */
  defaultValue: string | null;
  /** Raw literals this parameter is compared to or combined with inside the body. */
  relatedLiterals: string[];
  usedAsBoolean: boolean;
  usedInArithmetic: boolean;
  usedAsString: boolean;
}

export interface FunctionSignature {
  name: string;
  params: ParamInfo[];
  /** True when the function is reachable through module.exports. */
  exported: boolean;
  startLine: number;
  start: number;
  end: number;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
}

function walk(node: AstNode, visit: (n: AstNode) => void): void {
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit);
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

function paramName(param: AstNode): { name: string; defaultValue: string | null } | null {
  if (param.type === 'Identifier') return { name: param['name'] as string, defaultValue: null };
  if (param.type === 'AssignmentPattern') {
    const left = param['left'] as AstNode | undefined;
    const right = param['right'] as AstNode | undefined;
    if (left?.type === 'Identifier') {
      return {
        name: left['name'] as string,
        defaultValue: right && 'raw' in right ? String(right['raw']) : null,
      };
    }
  }
  return null;
}

function identifierName(node: unknown): string | null {
  return isNode(node) && node.type === 'Identifier' ? ((node['name'] as string) ?? null) : null;
}

/** Collects usage evidence for one parameter inside a function body. */
function analyseParam(body: AstNode, name: string): Omit<ParamInfo, 'name' | 'defaultValue'> {
  const relatedLiterals: string[] = [];
  let usedAsBoolean = false;
  let usedInArithmetic = false;
  let usedAsString = false;

  walk(body, (node) => {
    if (node.type === 'BinaryExpression') {
      const left = node['left'];
      const right = node['right'];
      const operator = node['operator'] as string;
      const other = identifierName(left) === name ? right : identifierName(right) === name ? left : null;
      if (other) {
        if (isNode(other) && other.type === 'Literal' && typeof other['raw'] === 'string') {
          relatedLiterals.push(other['raw'] as string);
          if (typeof other['value'] === 'string') usedAsString = true;
          if (typeof other['value'] === 'boolean') usedAsBoolean = true;
        }
        if ('+-*/%'.includes(operator)) usedInArithmetic = true;
      }
    }
    if (node.type === 'LogicalExpression') {
      if (identifierName(node['left']) === name || identifierName(node['right']) === name) usedAsBoolean = true;
    }
    if (node.type === 'UnaryExpression' && node['operator'] === '!' && identifierName(node['argument']) === name) {
      usedAsBoolean = true;
    }
    if ((node.type === 'IfStatement' || node.type === 'ConditionalExpression') && identifierName(node['test']) === name) {
      usedAsBoolean = true;
    }
  });

  return { relatedLiterals: [...new Set(relatedLiterals)], usedAsBoolean, usedInArithmetic, usedAsString };
}

function collectExportedNames(ast: AstNode): Set<string> {
  const names = new Set<string>();
  walk(ast, (node) => {
    if (node.type !== 'AssignmentExpression') return;
    const left = node['left'];
    const right = node['right'];
    if (!isNode(left) || left.type !== 'MemberExpression') return;
    const objectName = identifierName(left['object']);
    const propertyName = identifierName(left['property']);
    // module.exports = { a, b } / exports.foo = foo / module.exports.foo = foo
    const isModuleExports =
      (objectName === 'module' && propertyName === 'exports') ||
      objectName === 'exports' ||
      (isNode(left['object']) &&
        (left['object'] as AstNode).type === 'MemberExpression' &&
        identifierName((left['object'] as AstNode)['object']) === 'module');

    if (!isModuleExports) return;
    if (objectName === 'exports' && propertyName) names.add(propertyName);
    if (isNode(right) && right.type === 'ObjectExpression') {
      for (const prop of (right['properties'] as AstNode[] | undefined) ?? []) {
        const key = identifierName(prop['key']);
        const valueName = identifierName(prop['value']);
        if (key) names.add(key);
        if (valueName) names.add(valueName);
      }
    }
    if (isNode(right) && right.type === 'Identifier') names.add(right['name'] as string);
    if (propertyName && objectName !== 'module') names.add(propertyName);
  });
  return names;
}

/**
 * Extracts function signatures plus lightweight usage evidence per parameter.
 *
 * The evidence (which literals a parameter is compared against, whether it is used
 * as a flag, ...) is what lets SILENTFAIL build a small, targeted set of candidate
 * inputs when it searches for an input that kills a surviving mutant. It is a
 * deterministic heuristic, not a solver: candidates come from the code itself.
 */
export function extractFunctionSignatures(code: string): FunctionSignature[] {
  const { ast } = parseSource(code);
  const root = ast as unknown as AstNode;
  const exported = collectExportedNames(root);
  const signatures: FunctionSignature[] = [];

  walk(root, (node) => {
    let name: string | null = null;
    let fn: AstNode | null = null;

    if (node.type === 'FunctionDeclaration') {
      name = identifierName(node['id']);
      fn = node;
    } else if (node.type === 'VariableDeclarator') {
      const init = node['init'];
      if (isNode(init) && (init.type === 'FunctionExpression' || init.type === 'ArrowFunctionExpression')) {
        name = identifierName(node['id']);
        fn = init;
      }
    }
    if (!name || !fn) return;

    const params: ParamInfo[] = [];
    const body = (fn['body'] as AstNode | undefined) ?? fn;
    for (const param of (fn['params'] as AstNode[] | undefined) ?? []) {
      const info = paramName(param);
      if (!info) {
        params.push({
          name: `arg${params.length}`,
          defaultValue: null,
          relatedLiterals: [],
          usedAsBoolean: false,
          usedInArithmetic: false,
          usedAsString: false,
        });
        continue;
      }
      params.push({ ...info, ...analyseParam(body, info.name) });
    }

    const startLine = code.slice(0, fn.start).split('\n').length;
    signatures.push({ name, params, exported: exported.has(name), startLine, start: fn.start, end: fn.end });
  });

  return signatures.sort((a, b) => a.start - b.start);
}
