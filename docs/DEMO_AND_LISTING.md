# SILENTFAIL demo and sales listing

## Purpose
Convert the existing deterministic demo into a credible sales conversation. This is an early product; the demo must show the actual app and must not imply that a public hosted service or paying customer already exists.

## Five-minute recording plan
Record the actual browser and narration. Use the bundled demo project only.

### 0:00–0:30 — The problem
Say: “A test suite can pass and still fail to catch a meaningful change. Line coverage tells us code ran; mutation testing checks whether the tests notice when behavior changes.”

### 0:30–1:15 — Open the demo
Open the SILENTFAIL app and select “Try the live demo”. Confirm that the demo project loads without an API key. If the screen does not load, stop and fix the problem; do not edit in a fake result.

### 1:15–2:15 — Run analysis
Select “Run mutation analysis”. Show the baseline result and the real mutation statuses. Explain caught versus survived mutations using a real row from the run.

### 2:15–3:15 — Inspect a survivor
Open a surviving mutation. Show the original and mutated behavior and read the deterministic explanation. Use only output actually produced by the current run.

### 3:15–4:15 — Verify a targeted test
Show the suggested test and its verification status. Review it before applying. Run verification and show the resulting status. If this path fails, document the failure and do not edit the recording to imply success.

### 4:15–5:00 — Buyer fit and boundaries
Say: “The first version is focused on JavaScript CommonJS projects using the supported built-in test/expect API. It is a local-first early product, not yet a public service for arbitrary customer code uploads. I’m inviting a small number of teams to validate the workflow through a scoped pilot.”

## Short product listing

**Title:** SILENTFAIL — JavaScript Mutation Testing and Test-Gap Review

**One-line summary:** Find important JavaScript behavior your passing tests may still fail to protect.

**Description:**

SILENTFAIL helps JavaScript developers inspect test quality beyond a green test run. It makes deterministic mutations to supported source files, runs the test suite, classifies caught and surviving mutations, explains potential test blind spots, and supports reviewing and verifying targeted tests.

The early-access pilot is a guided, fixed-scope test-gap review using an agreed non-sensitive sample. Deliverables can include a walkthrough, a concise findings report, and a follow-up verification session.

**Current scope:** JavaScript CommonJS .js and .cjs with the bundled built-in test/expect API. TypeScript, ESM, arbitrary dependency installation, and I/O-heavy projects are not currently promised.

**Security and hosting:** The current child-process guard is defense in depth, not a hardened kernel boundary for hostile multi-tenant uploads. The product is not currently offered as a public hosted service that executes arbitrary customer code.

**Call to action:** Request a short demo and confirm project fit before booking a pilot.

## Proposed pilot offers (pricing to validate)

- **Starter — ₹2,999:** one small eligible sample, findings summary, and one review session.
- **Team — ₹7,499:** up to three eligible modules, findings summary, and one follow-up verification session.
- **Consultant — ₹12,999:** up to five eligible modules and a reusable findings-report template.

These are proposed test prices, not validated market rates. Confirm scope and buyer willingness to pay before promising delivery. Do not guarantee bug detection, coverage improvements, or a particular score.

## Pre-publication checklist

- [ ] Latest GitHub Actions run is green for the exact commit being promoted.
- [ ] Browser walkthrough has been manually completed against the actual app.
- [ ] Demo recording shows real current behavior with no fabricated metrics.
- [ ] Screenshots are from the actual product.
- [ ] Listing states supported syntax, limitations, and current hosting boundary.
- [ ] Buyer receives a written scope, payment terms, delivery date, and support expectations.
- [ ] No private source code, secrets, or production data appear in the demo.
- [ ] No customer or revenue claims are made without evidence.

## First-customer goal
For the first two weeks, use a working target—not a forecast—of 30 relevant prospects, 5 conversations, 3 demos, and 1 paid pilot. Track the actual numbers and adjust the offer based on objections. Stop outreach to anyone who declines.