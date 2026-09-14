export * from './types.js';
export * from './limits.js';
export * from './validate.js';

/** Engine version reported in every analysis run. */
export const ENGINE_VERSION = '1.0.0';

/** Supported project shape, surfaced in the UI when input is rejected. */
export const SUPPORT_MATRIX = {
  language: 'JavaScript (ES2022, CommonJS modules)',
  testApi: 'Built-in SILENTFAIL test harness: test(name, fn) + expect(value)',
  entry: 'Test files require the source under test, e.g. require("./discount.js")',
  notSupported: [
    'TypeScript sources (compile to JS first)',
    'npm dependencies inside the analysed project',
    'network access, filesystem access and child processes inside tests',
    'ESM import syntax in the analysed project',
  ],
} as const;
