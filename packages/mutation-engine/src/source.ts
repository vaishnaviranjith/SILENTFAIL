import * as acorn from 'acorn';

export interface ParsedSource {
  ast: acorn.Program;
  code: string;
}

export class SourceParseError extends Error {
  readonly line: number;
  readonly column: number;
  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = 'SourceParseError';
    this.line = line;
    this.column = column;
  }
}

/**
 * Parses analysed JavaScript with acorn.
 *
 * The analysed project is CommonJS (`require` / `module.exports`), which is why
 * `sourceType: 'script'` is used. Positions are needed because mutations are
 * applied as exact character-range replacements on the original text.
 */
export function parseSource(code: string): ParsedSource {
  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: 'script',
      locations: true,
      ranges: true,
      allowReturnOutsideFunction: false,
    });
    return { ast, code };
  } catch (error) {
    const err = error as Error & { loc?: { line: number; column: number } };
    throw new SourceParseError(err.message ?? 'Failed to parse source', err.loc?.line ?? 1, err.loc?.column ?? 0);
  }
}

/** Replaces comment bodies with spaces so index-based operator lookups stay valid. */
export function blankComments(fragment: string): string {
  let out = '';
  let i = 0;
  while (i < fragment.length) {
    if (fragment.startsWith('//', i)) {
      const end = fragment.indexOf('\n', i);
      const stop = end === -1 ? fragment.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    if (fragment.startsWith('/*', i)) {
      const end = fragment.indexOf('*/', i + 2);
      const stop = end === -1 ? fragment.length : end + 2;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    out += fragment[i];
    i += 1;
  }
  return out;
}

/**
 * Finds the exact character range of a binary/logical operator token.
 *
 * acorn does not expose operator positions, so the gap between the left and right
 * operand is scanned. Comments in that gap are blanked first, and the longest
 * matching token is preferred so `>=` is never mistaken for `>`.
 */
export function findOperatorRange(
  code: string,
  operator: string,
  leftEnd: number,
  rightStart: number,
): { start: number; end: number } | null {
  const gap = blankComments(code.slice(leftEnd, rightStart));
  const index = gap.indexOf(operator);
  if (index === -1) return null;
  // Reject a partial match such as finding `>` inside `>>>`.
  const before = gap[index - 1] ?? ' ';
  const after = gap[index + operator.length] ?? ' ';
  if (/[=<>!&|*+/%-]/.test(before) || /[=<>&|]/.test(after)) return null;
  return { start: leftEnd + index, end: leftEnd + index + operator.length };
}

/** 1-based line of a character offset. */
export function lineOf(code: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i += 1) {
    if (code[i] === '\n') line += 1;
  }
  return line;
}

/** 1-based column of a character offset. */
export function columnOf(code: string, offset: number): number {
  const lineStart = code.lastIndexOf('\n', offset - 1) + 1;
  return offset - lineStart + 1;
}

/** The full text of the line containing `offset`. */
export function lineTextAt(code: string, offset: number): string {
  const start = code.lastIndexOf('\n', offset - 1) + 1;
  const nl = code.indexOf('\n', offset);
  const end = nl === -1 ? code.length : nl;
  return code.slice(start, end);
}
