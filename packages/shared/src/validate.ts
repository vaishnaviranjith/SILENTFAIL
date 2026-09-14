import { ALLOWED_EXTENSIONS, LIMITS, SAFE_PATH_RE } from './limits.js';
import type { ProjectFile, ProjectInput } from './types.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  project?: ProjectInput;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000\u0008\u001b]/;

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
}

/**
 * Validates an untrusted project payload.
 *
 * This is the single gate used by the HTTP API and by the engine entry point, so
 * the same rules apply no matter how the analysis is triggered. It never touches
 * the filesystem: it only decides whether the payload is *allowed* to be written
 * into a throwaway sandbox workspace later on.
 */
export function validateProject(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: ['Project payload must be an object.'] };
  }
  const raw = input as Partial<ProjectInput>;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Untitled project';

  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    return { ok: false, errors: ['Project must contain at least one source file and one test file.'] };
  }
  if (raw.files.length > LIMITS.maxFiles) {
    errors.push(`Too many files: ${raw.files.length}. Maximum is ${LIMITS.maxFiles}.`);
  }

  const files: ProjectFile[] = [];
  const seen = new Set<string>();
  let totalChars = 0;

  for (const [index, entry] of raw.files.entries()) {
    const label = `files[${index}]`;
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    const { path, content, kind } = entry as Partial<ProjectFile>;
    if (typeof path !== 'string' || !path.trim()) {
      errors.push(`${label}.path is required.`);
      continue;
    }
    if (!SAFE_PATH_RE.test(path)) {
      errors.push(`${label}.path "${path}" is not a safe relative path (letters, digits, . _ - / only, no "..").`);
      continue;
    }
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(path) as (typeof ALLOWED_EXTENSIONS)[number])) {
      errors.push(`${label}.path "${path}" has an unsupported extension. Supported: ${ALLOWED_EXTENSIONS.join(', ')}.`);
      continue;
    }
    if (seen.has(path)) {
      errors.push(`Duplicate file path "${path}".`);
      continue;
    }
    if (typeof content !== 'string') {
      errors.push(`${label}.content must be a string.`);
      continue;
    }
    if (content.length > LIMITS.maxFileChars) {
      errors.push(`${label} "${path}" is ${content.length} characters; limit is ${LIMITS.maxFileChars}.`);
      continue;
    }
    if (CONTROL_CHARS_RE.test(content)) {
      errors.push(`${label} "${path}" contains control characters that are not allowed.`);
      continue;
    }
    const resolvedKind: ProjectFile['kind'] =
      kind === 'source' || kind === 'test' ? kind : /\.(test|spec)\.[cm]?js$/.test(path) ? 'test' : 'source';

    seen.add(path);
    totalChars += content.length;
    files.push({ path, content, kind: resolvedKind });
  }

  if (totalChars > LIMITS.maxProjectChars) {
    errors.push(`Project is ${totalChars} characters; limit is ${LIMITS.maxProjectChars}.`);
  }
  if (!files.some((f) => f.kind === 'source')) {
    errors.push('No source file found. Mark at least one file as kind="source".');
  }
  if (!files.some((f) => f.kind === 'test')) {
    errors.push('No test file found. Test files must be named *.test.js (or marked kind="test").');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], project: { name, files, isDemo: raw.isDemo === true } };
}
