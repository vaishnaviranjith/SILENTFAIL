import { lineOf, parseSource } from './source.js';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface StatementProbe {
  /** Index used as the runtime hit id. */
  id: number;
  /** Character offset where the hit marker is inserted. */
  offset: number;
  /** Statement range, used to map a mutation to its innermost statement. */
  start: number;
  end: number;
  line: number;
}

export interface InstrumentedSource {
  code: string;
  probes: StatementProbe[];
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

/**
 * Instruments a copy of the source with statement hit markers.
 *
 * One extra sandbox run of the *unmutated* code then tells SILENTFAIL which
 * statements the existing test suite actually executes. That turns the vague
 * "this mutation survived" into two very different findings:
 *   - the line runs but nothing asserts on the result  -> weak assertion
 *   - the line never runs at all                       -> untested code path
 */
export function instrumentForCoverage(code: string, startId = 0): InstrumentedSource {
  const { ast } = parseSource(code);
  const probes: StatementProbe[] = [];
  const nextId = () => startId + probes.length;

  walk(ast as unknown as AstNode, (node) => {
    if (node.type !== 'Program' && node.type !== 'BlockStatement' && node.type !== 'SwitchCase') return;
    const listKey = node.type === 'SwitchCase' ? 'consequent' : 'body';
    const body = node[listKey];
    if (!Array.isArray(body)) return;
    for (const statement of body) {
      if (!isNode(statement)) continue;
      // Directives such as 'use strict' must stay first in their block.
      if (statement.type === 'ExpressionStatement' && statement['directive'] !== undefined) continue;
      probes.push({
        id: nextId(),
        offset: statement.start,
        start: statement.start,
        end: statement.end,
        line: lineOf(code, statement.start),
      });
    }
  });

  // Insert from the end so earlier offsets stay valid.
  let out = code;
  for (const probe of [...probes].sort((a, b) => b.offset - a.offset)) {
    out = `${out.slice(0, probe.offset)}__sfHit(${probe.id});${out.slice(probe.offset)}`;
  }
  return { code: out, probes };
}

/** Innermost instrumented statement containing the given character range. */
export function probeForRange(probes: StatementProbe[], start: number, end: number): StatementProbe | null {
  let best: StatementProbe | null = null;
  for (const probe of probes) {
    if (probe.start <= start && probe.end >= end) {
      if (!best || probe.start > best.start) best = probe;
    }
  }
  return best;
}
