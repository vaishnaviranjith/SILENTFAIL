# SILENTFAIL

> **Find the failure nobody noticed.**

Mutation testing that shows you where your test suite is blind.

SILENTFAIL is a local-first developer tool for the uncomfortable case where CI is
green but the implementation is still under-protected. It makes a small, meaningful
change to real JavaScript, runs the real test suite in an isolated process, and
explains every mutation that survives.

## The problem

Line coverage can say that a branch ran without proving that the branch's behaviour
was asserted. A suite can check `isMember = false` forever and still pass when the
member-discount logic is wrong. Passing tests are evidence, not proof.

## The solution

```text
code + tests
     -> parse source
     -> generate AST mutations
     -> run baseline
     -> execute isolated mutants
     -> caught / survived / error / timeout
     -> explain the blind spot
     -> find a real distinguishing input
     -> generate and verify a targeted test
```

The bundled discount demo is intentionally correct but intentionally under-tested.
It immediately shows a real survivor such as the member branch, then derives and
verifies a test using `calculateDiscount(100, true) -> 90`.

## How mutation testing works

SILENTFAIL parses source with Acorn and applies one exact character-range change at a
time in an isolated temporary workspace. A mutation is **CAUGHT** when a test fails,
**SURVIVED** when all tests still pass, and **TIMEOUT** when it hangs long enough to hit
the sandbox limit. The score is caught plus timeouts over executable mutants.

## How SILENTFAIL is different

It combines deterministic mutation execution, coverage-aware survivor explanations,
and verified targeted-test generation in one understandable local workflow. It does
not claim to be the only mutation tester. Its specific focus is making the silent
moment legible to a developer during a short review or demo.

## Architecture

```text
React + Vite + Tailwind
          |
       Express API ---------------- optional OpenAI-compatible explainer
          |
  @silentfail/core pipeline
     |       |       |
 shared  AST engine  ExecutorAdapter
                    |
          temp workspace + child Node process
```

### Project structure

```text
apps/web                 React developer-tool interface
apps/api                 Express API and process-local run history
packages/shared          JSON result model, limits, validation
packages/mutation-engine Acorn parser, operators, coverage probes
packages/core            sandbox, orchestration, scoring, explanations
fixtures/demo-projects   deterministic discount demo
docs/SECURITY.md         threat model and hardening notes
```

## Supported functionality

- JavaScript ES2022 CommonJS source files: `.js`, `.cjs`.
- Test files use the built-in `test(name, fn)` / `expect(value)` API.
- Operators: condition boundaries, comparison/equality changes, arithmetic changes,
  logical swaps, boolean inversion, constant replacement, return-value replacement,
  branch forcing, and unary-negation removal.
- The demo and core analysis work without an API key, database, or network access.
- TypeScript, ESM syntax, npm dependencies, I/O-heavy modules, and arbitrary network
  code are outside this intentionally small first version.

## Run locally

Requirements: Node.js 20.11 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. The API is available at `http://localhost:8787`.
The launcher resolves npm through Node's `npm_execpath` when available, with a
Windows `npm.cmd` fallback, so the same `npm run dev` command works on Unix and
Windows. `npm run dev:windows` is retained as an explicit alias, but is not needed.

For individual commands:

```bash
npm run dev:api
npm run dev:web
npm run demo
```

The API has `GET /api/health`, `GET /api/demo`, `POST /api/analyze`,
`POST /api/verify`, `GET /api/history`, and `GET /api/runs/:runId`.

## Demo walkthrough

1. Open the app and choose **Try the live demo**.
2. Select **Run mutation analysis**.
3. Open a red **SURVIVED** row, especially the member-discount branch.
4. Read the original/mutated diff and the deterministic explanation.
5. Open **Suggested tests** and choose **Apply all & verify**.
6. Compare the new verification run with the baseline dashboard.

The UI labels demo data clearly. Statistics are calculated from actual sandbox runs,
not fixture metadata.

## Testing and validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The test suite covers validation, mutation operators, generation, scoring,
explanations, sandbox execution, timeout/error classification, suggestion probing,
the demo API, and the end-to-end analysis pipeline.

## Security

Uploaded source is untrusted. The API validates paths and sizes, creates temporary
workspaces, strips inherited environment variables, blocks filesystem/network/
process capabilities, applies time/heap/output limits, kills process groups, and
cleans up. See [`docs/SECURITY.md`](docs/SECURITY.md) for the realistic limitation:
the local guard is defense in depth, not a kernel boundary for hostile multi-tenant
uploads. A container or microVM executor is the production hardening path.

## AI usage disclosure

AI is optional and disabled by default. The deterministic engine owns mutation
generation, execution status, score, severity, coverage signal, and expected values.
If `SILENTFAIL_AI_API_KEY` is configured, an OpenAI-compatible provider may rewrite
the explanation text. Failed or unavailable AI calls fall back to deterministic
explanations. No API key is committed, returned by the API, or required for the demo.

Copy `.env.example` to your server environment only if you explicitly want optional
AI wording.

## Learning and commit progression

During the hackathon, commits should reflect genuine work rather than be created
retroactively. A clear progression is: scaffold, UI shell, input model, mutation
operators, sandbox execution, survivor explanations, test suggestions, security,
automated tests, UI polish, documentation, and final validation.

## Limitations and future improvements

- Replace the local executor with a rootless container or microVM for hostile public
  uploads.
- Add TypeScript compilation and ESM support behind an explicit project adapter.
- Add persistent history and line/branch coverage visualisation.
- Add streaming progress over Server-Sent Events for very large projects.
- Expand the operator catalogue and detect equivalent mutants more aggressively.

## Buyer and release readiness

See [`docs/BUYER_GUIDE.md`](docs/BUYER_GUIDE.md) for target users, supported use cases, honest sales positioning, and release/hosting gates. See [`docs/SELLING_PLAN.md`](docs/SELLING_PLAN.md) for the revenue-first pilot strategy, proposed pricing tests, source-code sale route, listing copy, and deal checklist, and [`docs/OUTREACH_TEMPLATES.md`](docs/OUTREACH_TEMPLATES.md) for first-customer outreach and demo scripts. GitHub Actions runs the automated verification suite on pushes and pull requests; a green CI result does not replace manual browser and security checks.

## License

MIT. See [`LICENSE`](LICENSE).
