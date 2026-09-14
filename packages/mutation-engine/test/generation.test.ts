import { describe, expect, it } from 'vitest';
import { applyMutation, generateMutations, generateMutationsForFile } from '../src/index.js';

const source = {
  path: 'rules.js',
  kind: 'source' as const,
  content: `function rule(amount, enabled) {
  if (enabled === true && amount >= 10) return amount * 2;
  return amount - 1;
}
module.exports = { rule };`,
};

describe('mutation generation', () => {
  it('emits deterministic operator records with exact replacements', () => {
    const first = generateMutationsForFile(source);
    const second = generateMutationsForFile(source);
    expect(first).toEqual(second);
    expect(first.some((mutation) => mutation.operator === 'CONDITIONAL_BOUNDARY')).toBe(true);
    expect(first.some((mutation) => mutation.operator === 'EQUALITY_OPERATOR')).toBe(true);
    expect(first.some((mutation) => mutation.operator === 'ARITHMETIC_OPERATOR')).toBe(true);
    expect(first.every((mutation) => mutation.originalCode.length > 0)).toBe(true);
  });

  it('applies one mutation without changing the source object', () => {
    const mutation = generateMutationsForFile(source)[0]!;
    const mutated = applyMutation(source.content, mutation);
    expect(mutated).not.toBe(source.content);
    expect(source.content).toContain('amount >= 10');
    expect(mutated).toContain(mutation.mutatedCode);
  });

  it('only generates source-file mutations', () => {
    const results = generateMutations([
      source,
      { path: 'rules.test.js', kind: 'test', content: 'test("x", () => {});' },
    ]);
    expect(results.every((mutation) => mutation.file === 'rules.js')).toBe(true);
  });
});
