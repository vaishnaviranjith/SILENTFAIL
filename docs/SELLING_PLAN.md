# SILENTFAIL: revenue-first selling plan

## Objective

Generate the first legitimate customer revenue before spending time on a public SaaS launch. The shortest credible path is a paid pilot for JavaScript teams, followed by a source-code/license sale only if a buyer prefers to own and maintain the codebase.

Revenue is a goal, not a guarantee. Do not claim customers, revenue, profit, production readiness, or compatibility that has not been demonstrated.

## Product and buyer

**Product:** SILENTFAIL — a local-first mutation-testing tool that shows where a passing JavaScript test suite may not protect important behavior.

**Best initial buyer:** a small Node.js/JavaScript product team, QA consultant, or engineering lead with an existing CommonJS test suite and a need to improve test confidence.

**Current compatibility boundary:** JavaScript CommonJS `.js` / `.cjs`, built-in test/expect API. TypeScript, ESM, installing project dependencies, and arbitrary I/O-heavy projects are not currently promised.

## Revenue route, in order

### 1. Sell a paid pilot (first priority)

Offer a guided, fixed-scope test-gap review using a customer's small, non-sensitive JavaScript sample. Deliver:
- a walkthrough of caught and surviving mutations;
- a concise report of the most important uncovered behaviors;
- suggested tests that are reviewed before use;
- a feedback call and a prioritized feature list.

Suggested validation pricing for the first 3 pilot customers (test willingness to pay; these are proposed prices, not established market rates):
- **Starter pilot — ₹2,999:** one small eligible sample, one review session, short findings report.
- **Team pilot — ₹7,499:** up to three eligible modules, report, and one follow-up verification session.
- **Consultant pilot — ₹12,999:** up to five eligible modules and a reusable client-facing report template.

Scope, code access, data retention, payment terms, and customer consent must be agreed in writing. Do not ask customers to submit secrets or production credentials. Do not upload customer code to a public service.

### 2. Offer a source-code/license deal

For a buyer who wants to own the codebase, provide a transparent technical handover: repository, setup instructions, architecture, test results, limitations, and a list of remaining hardening work. Negotiate price only after confirming the buyer's intended use and support expectations. Do not claim a valuation based on revenue when there is no verified revenue.

### 3. Consider a hosted subscription later

Do not make arbitrary code execution publicly available until the executor runs in a hardened, independently tested isolation boundary such as a rootless container or microVM, with resource quotas, abuse controls, safe cleanup, and monitoring. Add authentication, rate limits, privacy/retention controls, and deployment smoke tests before accepting public customer code.

## Sales assets to prepare

1. A short demo recording showing a passing baseline, a surviving mutation, and a verified targeted test.
2. A sample report generated only from the bundled demo fixture.
3. A one-page landing page with a clear CTA: “Book a paid pilot”.
4. A buyer FAQ stating supported syntax, limitations, data handling, and what the pilot includes.
5. A short outreach message for JavaScript consultancies and small product teams.
6. A simple lead tracker: prospect, contact date, response, demo booked, objection, next action, payment status.

## Outreach cadence

- Day 1: contact 10 carefully selected JavaScript consultancies or small product teams with a personalized note and demo link.
- Day 3: follow up once with a specific example of a surviving mutation.
- Day 7: send a final concise follow-up; stop if they decline or do not want further contact.
- Weekly: record responses and objections; revise the offer based on evidence, not assumptions.

Success metrics for the first 2 weeks: 30 relevant prospects contacted, 5 conversations, 3 demos, and a goal of 1 paid pilot. These are targets, not forecasts or guarantees.

## Draft listing copy

### Short description

SILENTFAIL is a local-first JavaScript mutation-testing tool that helps developers find behavior their passing tests may not protect. It generates targeted mutations, classifies caught and surviving cases, explains blind spots, and supports follow-up verification.

### Longer description

A green test run does not always mean the important behavior is protected. SILENTFAIL helps developers inspect this gap by making small, deterministic mutations to supported JavaScript source, running the test suite, and showing which mutations survive. The workflow includes explanations and suggested tests that can be reviewed and verified.

Included: source repository, automated verification workflow, bundled demo fixture, architecture and buyer documentation, and the current test suite.

Current limitations: initial support is focused on JavaScript CommonJS and the built-in test/expect API. TypeScript, ESM, arbitrary dependency installation, and I/O-heavy projects are not currently promised. The current guarded process executor is not a hardened kernel boundary for hostile multi-tenant uploads, so this version should not be advertised as a public hosted service that executes arbitrary customer code.

No paid users, revenue, or customer traction are claimed unless independently documented.

## Deal checklist

Before accepting money, state clearly:
- what the buyer receives (pilot service, license, or full codebase transfer);
- whether exclusivity is included (default: no);
- what support period, if any, is included;
- third-party dependencies and the repository license;
- current limitations and known security boundary;
- whether any customer code or data is retained (default for pilots: minimize retention and delete agreed copies after delivery);
- payment milestones, refund terms, and transfer/handover conditions.

Do not promise guaranteed test coverage, bug elimination, security certification, or future income.
