import { describe, expect, it } from 'vitest';
import { validateProject } from '../src/index.js';

const good = {
  name: 'safe',
  files: [
    { path: 'src.js', content: 'module.exports = {};', kind: 'source' },
    { path: 'src.test.js', content: 'test("ok", () => expect(1).toBe(1));', kind: 'test' },
  ],
};

describe('project validation', () => {
  it('accepts a supported project and preserves kind', () => {
    const result = validateProject(good);
    expect(result.ok).toBe(true);
    expect(result.project?.files[0]?.kind).toBe('source');
  });

  it('rejects traversal, unsupported files, and missing tests', () => {
    const result = validateProject({ files: [{ path: '../secret.js', content: 'x', kind: 'source' }, { path: 'readme.txt', content: 'x', kind: 'source' }] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('safe relative path');
    expect(result.errors.join(' ')).toContain('unsupported extension');
    expect(result.errors.join(' ')).toContain('No test file');
  });

  it('rejects oversized content before execution', () => {
    const result = validateProject({ ...good, files: [{ ...good.files[0], content: 'x'.repeat(20_001) }, good.files[1]] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('limit');
  });

  it('rejects ESM files because the sandbox runner is CommonJS-only', () => {
    const result = validateProject({ files: [{ path: 'source.mjs', content: 'export default 1;', kind: 'source' }, { path: 'source.test.js', content: 'test("ok", () => {});', kind: 'test' }] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('unsupported extension');
  });
});
