# SILENTFAIL: buyer and deployment readiness

## Who should use it first?

SILENTFAIL is best positioned as a developer productivity tool for small JavaScript teams that already have a passing test suite and want to find important behavior their tests do not actually protect.

Primary early users:
- **Frontend and Node.js engineers** maintaining business-critical discount, pricing, permission, validation, and decision logic.
- **Tech leads and engineering managers** who need a concrete review artifact beyond line coverage.
- **Consultants and QA engineers** who want to demonstrate specific test blind spots and verify the added tests.

It is not a replacement for unit tests, code review, coverage tools, or a full enterprise mutation-testing platform. Its value is a focused workflow: run a green test suite, inspect caught and surviving mutations, review a suggested distinguishing test, then rerun analysis to see whether the blind spot was reduced.

## The first repeatable use case

1. Start with a small JavaScript CommonJS project (.js or .cjs) whose existing tests pass.
2. Run the analysis and inspect surviving mutations.
3. Review the original and mutated behavior; do not blindly accept generated tests.
4. Apply a verified suggested test and rerun verification.
5. Keep the report with the pull request or release review.

The current engine intentionally does not support TypeScript, ESM, installing dependencies inside the submitted project, or arbitrary I/O-heavy applications. Qualify early users against these limits before promising compatibility.

## What makes the product useful?

- **Evidence, not a made-up score:** mutation status comes from test executions; the baseline must pass before mutation analysis proceeds.
- **Actionable survivors:** explanations and suggested tests help turn a surviving mutation into a test change.
- **Local-first workflow:** the demo and deterministic engine do not require an AI key or external AI service.
- **Repeatable verification:** users can compare an original run with a follow-up run after adding tests.

## Security and hosting boundary

The current executor uses a guarded child process. The repository's security notes correctly describe this as defense in depth, not a hardened kernel boundary. Do **not** expose arbitrary customer code execution on a public multi-tenant hosted service yet.

Until a rootless container, microVM, or isolated worker service is implemented and independently tested, offer the product as a local developer tool or a private, controlled internal deployment only. Never market it as safe for hostile public uploads or as an enterprise security boundary.

## Release gate

Before calling a release production-ready, require all of the following:

- `npm ci` succeeds from the committed lockfile.
- `npm run verify` passes (typecheck, lint, tests, and frontend build).
- A human manually checks the demo from the landing page through analysis, survivor details, suggested tests, and verification.
- API error responses are checked for invalid JSON, unsafe paths, timeout handling, and generic internal errors.
- The deployment environment and threat model match the intended users.
- Release notes state the current language and runtime limitations.

The GitHub Actions workflow in `.github/workflows/verify.yml` automates the first two checks. A green CI run does not replace the manual browser and security checks.

## Honest early-sales positioning

Use a narrow promise such as:

> Find JavaScript behaviors your passing tests still fail to protect. SILENTFAIL runs deterministic mutation tests, explains survivors, and helps you verify targeted tests.

Do not promise that the tool catches every bug, guarantees test quality, supports every JavaScript project, or is ready for public multi-tenant hosting. Validate demand with a working demo, documented limitations, a short screen recording, and feedback from real JavaScript teams before claiming traction or a sale value.
