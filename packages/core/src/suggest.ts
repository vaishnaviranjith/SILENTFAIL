import type { Mutation, ProjectFile, SuggestedTest } from '@silentfail/shared';
import { LIMITS } from '@silentfail/shared';
import { applyMutation, extractFunctionSignatures, type FunctionSignature, type ParamInfo } from '@silentfail/mutation-engine';
import type { ExecutorAdapter } from './executor/types.js';
import { toTestRunResult } from './test-run.js';

const UNDEFINED_TOKEN = '__SF_UNDEFINED__';

export interface ProbeOutcome {
  found: boolean;
  argsRepr?: string[];
  mode?: 'value' | 'throw';
  expectedRepr?: string;
  expectedThrowMessage?: string;
  expectedIsInteger?: boolean;
  expectedType?: string;
  mutantRepr?: string;
  error?: string;
  tried?: number;
}

/**
 * Candidate inputs for one parameter, most useful first.
 *
 * The pool is built from the code itself:
 *  - `100` first: a neutral, readable amount that makes a good example in a
 *    generated test and rarely collides with a boundary by accident
 *  - every numeric literal the parameter is compared against, plus its ±1
 *    neighbours (this is what kills off-by-one boundary mutants)
 *  - string literals the parameter is compared against
 *  - `true`/`false` when the parameter is used as a flag
 *  - a small generic tail so untyped parameters still get tried
 *
 * Deterministic: same source in, same ordered pool out.
 */
export function buildCandidateValues(param: ParamInfo, limit = 6): unknown[] {
  const pool: unknown[] = [];
  const push = (value: unknown) => {
    if (!pool.some((existing) => sameValue(existing, value))) pool.push(value);
  };

  const numericLiterals: number[] = [];
  const stringLiterals: string[] = [];
  let sawBoolean = param.usedAsBoolean;

  for (const raw of param.relatedLiterals) {
    if (raw === 'true' || raw === 'false') {
      sawBoolean = true;
      continue;
    }
    const asNumber = Number(raw);
    if (raw.trim() !== '' && !Number.isNaN(asNumber) && !/^['"]/.test(raw)) {
      numericLiterals.push(asNumber);
      continue;
    }
    const unquoted = raw.replace(/^['"]|['"]$/g, '');
    if (unquoted !== raw) stringLiterals.push(unquoted);
  }

  if (sawBoolean && numericLiterals.length === 0 && stringLiterals.length === 0) {
    push(true);
    push(false);
    return pool.slice(0, limit);
  }

  if (numericLiterals.length > 0 || param.usedInArithmetic) push(100);
  for (const value of numericLiterals) {
    push(value);
    push(value + 1);
    push(value - 1);
  }
  for (const value of stringLiterals) push(value);
  if (param.usedAsString) push('SILENTFAIL');
  if (sawBoolean) {
    push(true);
    push(false);
  }
  if (param.defaultValue !== null) {
    const parsed = parseLiteral(param.defaultValue);
    if (parsed !== undefined) push(parsed);
  }
  // Generic tail for parameters we learned nothing about.
  push(100);
  push(10);
  push(1);
  push(0);
  push(-1);
  push(true);
  push(false);

  return pool.slice(0, limit);
}

function parseLiteral(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const asNumber = Number(raw);
  if (raw.trim() !== '' && !Number.isNaN(asNumber)) return asNumber;
  const unquoted = raw.replace(/^['"]|['"]$/g, '');
  return unquoted === raw ? undefined : unquoted;
}

function sameValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b);
}

/**
 * Cartesian product of per-parameter candidates, ordered so the first values of
 * each pool are tried first, and truncated to a fixed budget so a wide signature
 * can never blow up the analysis time.
 */
export function buildCombos(params: ParamInfo[], budget = LIMITS.maxKillingInputCombos): unknown[][] {
  if (params.length === 0) return [[]];
  let perParam = params.map((param) => buildCandidateValues(param));
  // Shrink the widest pools until the product fits the budget.
  while (perParam.reduce((acc, values) => acc * Math.max(values.length, 1), 1) > budget) {
    const widest = perParam.reduce((best, values, index) => (values.length > (perParam[best]?.length ?? 0) ? index : best), 0);
    const current = perParam[widest] ?? [];
    if (current.length <= 1) break;
    perParam = perParam.map((values, index) => (index === widest ? values.slice(0, values.length - 1) : values));
  }

  let combos: unknown[][] = [[]];
  for (const values of perParam) {
    const next: unknown[][] = [];
    for (const combo of combos) {
      for (const value of values.length > 0 ? values : [undefined]) {
        next.push([...combo, value]);
      }
    }
    combos = next;
    if (combos.length > budget) {
      combos = combos.slice(0, budget);
      break;
    }
  }
  return combos.slice(0, budget);
}

/** JSON transport: `undefined` needs a token because JSON has no such value. */
function encodeArgs(combo: unknown[]): unknown[] {
  return combo.map((value) => (value === undefined ? UNDEFINED_TOKEN : value));
}

export interface SuggestionRequest {
  executor: ExecutorAdapter;
  files: ProjectFile[];
  mutation: Mutation;
  /** Test file the generated test is appended to. */
  targetTestFile: ProjectFile;
}

export interface SuggestionResult {
  probe: ProbeOutcome;
  suggestion: SuggestedTest | null;
  /** Human-readable killing input, e.g. `calculateDiscount(100, true)`. */
  killingInput: string | null;
  expectedValue: string | null;
  note: string;
}

/**
 * Searches for a targeted test that kills a surviving mutant, then proves it.
 *
 * 1. find the function that contains the mutation and is reachable via module.exports
 * 2. build candidate inputs from the source (see buildCandidateValues)
 * 3. run original and mutant side by side in the sandbox and keep the first input
 *    where they disagree — the expected value comes from the ORIGINAL code
 * 4. render a test using the project's test API
 * 5. verify it: it must PASS on the original code and FAIL on the mutant
 *
 * Every step is real execution. Nothing here is generated by a language model.
 */
export async function suggestTargetedTest(request: SuggestionRequest): Promise<SuggestionResult> {
  const { executor, files, mutation, targetTestFile } = request;
  const sourceFile = files.find((f) => f.path === mutation.file);
  if (!sourceFile) {
    return emptyResult('The mutated file is no longer part of the project.');
  }

  const signature = findEnclosingExportedFunction(sourceFile.content, mutation);
  if (!signature) {
    return emptyResult(
      'No exported function contains this mutation, so SILENTFAIL cannot call it directly. Export the function (module.exports) to get a generated test.',
    );
  }

  const combos = buildCombos(signature.params);
  const mutatedContent = applyMutation(sourceFile.content, mutation);
  const originalDir = 'sf-original';
  const mutantDir = 'sf-mutant';

  const probeResponse = await executor.run({
    entry: 'probe',
    files: [
      ...files.filter((f) => f.kind === 'source').map((f) => ({ path: `${originalDir}/${f.path}`, content: f.content })),
      ...files
        .filter((f) => f.kind === 'source')
        .map((f) => ({
          path: `${mutantDir}/${f.path}`,
          content: f.path === mutation.file ? mutatedContent : f.content,
        })),
    ],
    config: {
      originalFile: `${originalDir}/${mutation.file}`,
      mutantFile: `${mutantDir}/${mutation.file}`,
      exportName: signature.name,
      combos: combos.map(encodeArgs),
    },
  });

  const probe = (probeResponse.payload ?? { found: false, error: probeResponse.error ?? 'probe produced no result' }) as ProbeOutcome;
  if (!probe.found) {
    return {
      probe,
      suggestion: null,
      killingInput: null,
      expectedValue: null,
      note: probe.error
        ? `Killing-input search could not run: ${probe.error}`
        : `No input among ${probe.tried ?? combos.length} deterministic candidates distinguishes the original from the mutant. This mutant is probably equivalent to your code.`,
    };
  }

  const argsText = (probe.argsRepr ?? []).join(', ');
  const call = `${signature.name}(${argsText})`;
  const assertion = renderAssertion(call, probe);
  const testName = `${call} ${probe.mode === 'throw' ? 'throws as documented' : `returns ${probe.expectedRepr}`} [SILENTFAIL ${mutation.mutationId}]`;
  const needsRequire = !new RegExp(`\\b${escapeRegExp(signature.name)}\\b`).test(targetTestFile.content);
  const requireLine = needsRequire
    ? `const { ${signature.name} } = require('${relativeRequirePath(targetTestFile.path, mutation.file)}');\n\n`
    : '';
  const code = `${requireLine}test(${JSON.stringify(testName)}, () => {\n  ${assertion}\n});\n`;

  const verification = await verifySuggestion({ executor, files, mutation, targetTestFile, generatedCode: code });

  return {
    probe,
    suggestion: {
      code,
      testName,
      strategy: 'killing-input-search',
      inputs: argsText,
      expected: probe.mode === 'throw' ? `throws ${JSON.stringify(probe.expectedThrowMessage ?? '')}` : probe.expectedRepr,
      verified: verification.passesOnOriginal && verification.failsOnMutant,
      verification,
      targetFile: targetTestFile.path,
    },
    killingInput: call,
    expectedValue: probe.mode === 'throw' ? `a thrown ${JSON.stringify(probe.expectedThrowMessage ?? 'error')}` : (probe.expectedRepr ?? null),
    note: 'Generated from a real execution difference between your code and the mutant.',
  };
}

function renderAssertion(call: string, probe: ProbeOutcome): string {
  if (probe.mode === 'throw') {
    return `expect(() => ${call}).toThrow(${JSON.stringify(probe.expectedThrowMessage ?? '')});`;
  }
  const expected = probe.expectedRepr ?? 'undefined';
  if (probe.expectedType === 'number' && probe.expectedIsInteger === false) {
    return `expect(${call}).toBeCloseTo(${expected}, 6);`;
  }
  if (probe.expectedType === 'object') {
    return `expect(${call}).toEqual(${expected});`;
  }
  return `expect(${call}).toBe(${expected});`;
}

/** Runs the generated test against the original code and against the mutant. */
async function verifySuggestion(args: {
  executor: ExecutorAdapter;
  files: ProjectFile[];
  mutation: Mutation;
  targetTestFile: ProjectFile;
  generatedCode: string;
}): Promise<{ passesOnOriginal: boolean; failsOnMutant: boolean; note: string }> {
  const { executor, files, mutation, targetTestFile, generatedCode } = args;
  const patchedTests = `${targetTestFile.content.trimEnd()}\n\n${generatedCode}`;
  const withTest = files.map((f) => (f.path === targetTestFile.path ? { ...f, content: patchedTests } : f));
  const testFiles = withTest.filter((f) => f.kind === 'test').map((f) => f.path);

  const originalRun = toTestRunResult(
    await executor.run({
      entry: 'run-tests',
      files: withTest.map(({ path, content }) => ({ path, content })),
      config: { testFiles },
    }),
  );

  const mutatedSource = applyMutation(
    files.find((f) => f.path === mutation.file)?.content ?? '',
    mutation,
  );
  const mutantRun = toTestRunResult(
    await executor.run({
      entry: 'run-tests',
      files: withTest.map(({ path, content }) => ({
        path,
        content: path === mutation.file ? mutatedSource : content,
      })),
      config: { testFiles },
    }),
  );

  const passesOnOriginal = originalRun.result.ok;
  const failsOnMutant = mutantRun.result.failed > 0 || Boolean(mutantRun.result.crash);
  return {
    passesOnOriginal,
    failsOnMutant,
    note: passesOnOriginal
      ? failsOnMutant
        ? 'Verified by execution: the generated test passes on your code and fails on the mutant.'
        : 'The generated test passes on your code but does not fail on the mutant, so it does not close this blind spot.'
      : 'The generated test does not pass on your unmodified code; it is shown for review only.',
  };
}

function emptyResult(note: string): SuggestionResult {
  return { probe: { found: false }, suggestion: null, killingInput: null, expectedValue: null, note };
}

/** Innermost exported function whose body contains the mutation. */
export function findEnclosingExportedFunction(code: string, mutation: Mutation): FunctionSignature | null {
  const signatures = extractFunctionSignatures(code);
  const containing = signatures.filter((s) => s.start <= mutation.start && s.end >= mutation.end);
  const exported = containing.filter((s) => s.exported);
  if (exported.length === 0) return null;
  return exported.reduce((best, current) => (current.start > best.start ? current : best));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relativeRequirePath(fromFile: string, targetFile: string): string {
  const fromParts = fromFile.split('/');
  fromParts.pop();
  const targetParts = targetFile.split('/');
  while (fromParts.length > 0 && targetParts.length > 0 && fromParts[0] === targetParts[0]) {
    fromParts.shift();
    targetParts.shift();
  }
  const prefix = '../'.repeat(fromParts.length);
  return `${prefix || './'}${targetParts.join('/')}`;
}
