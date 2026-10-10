# SILENTFAIL marketplace launch pack

Status date: 2026-10-10

This document prepares truthful listing copy and a platform-by-platform decision. It does not mean a seller account or listing has been created.

## Release status we can verify

- GitHub Actions run 38042072045 passed typecheck, lint, tests, and frontend build on Node.js 20.19 for the pre-remediation branch commit.
- The dependency remediation workflow run 38042285314 upgraded Vitest, applied compatible audit fixes, passed `npm audit --audit-level=high` with zero vulnerabilities reported, and passed `npm run verify`. Its bot commit is `b6e9f624cc262690693292f78e32a9f32ac30b8a`.
- Rebuild the final marketplace package and verify the exact final commit after dependency remediation before publishing; the earlier ZIP is a valid pre-remediation artifact, not the final sales package.
- Pull request #1 is still open as a draft and is not merged into `main`.
- Automated CI is not a browser smoke test, hosted deployment, security audit, or proof that a buyer can install the package without help.
- No live public product URL, demo recording, seller account, customer, or revenue has been verified.
- Do not host arbitrary customer code execution publicly until the executor has hardened isolation.

## Important ownership and license check

The repository currently declares the MIT license and is publicly accessible. That permits broad reuse, redistribution, and modification under the license terms. Do not market a sale as exclusive ownership of all publicly available repository code unless the ownership and licensing position has been reviewed and the deal is actually possible. A more defensible first offer is a packaged source-code product, guided setup, customization, or a fixed-scope paid test-gap review. Disclose the MIT license prominently and verify third-party dependency licenses before submitting a marketplace package.

## Platform decisions

### 1. Codester — first marketplace to try for a packaged code asset

Seller portal: https://www.codester.com/info/author

Fit: potentially suitable under Scripts & Code, subject to reviewer approval and their current rules. Codester says authors receive 70% commission, can set a price, and are not required to be exclusive. New items are reviewed before publication.

Before submission:
- Create/sign in to a seller account and complete the seller/payout profile.
- Package only the files a buyer needs; exclude secrets, local environment files, caches, node_modules, and development artifacts.
- Include installation instructions, Node.js version, demo instructions, supported scope, limitations, security disclosure, screenshots from the real app, and a changelog.
- Make clear that the MIT-licensed public repository is available and explain what extra value the paid package includes.
- Submit for review. Publication and acceptance are not guaranteed.

Suggested title:
SILENTFAIL — JavaScript Mutation Testing Toolkit

Suggested summary:
Find JavaScript behaviors that passing tests may fail to protect. SILENTFAIL generates deterministic mutations, runs a supported test suite, identifies caught and surviving cases, and helps developers review targeted tests.

Suggested package contents:
- Source code and required project files
- README and setup guide
- Bundled demo fixture
- Verification/test instructions
- Known limitations and security notes
- Changelog and support policy

Do not upload a product package until the owner has confirmed the exact distributable archive and license disclosure.

### 2. Flippa — possible, but validate category and fee before paying

Seller portal and current fees: https://flippa.com/pricing

Fit: possible as a small digital asset or software project if Flippa's current intake flow accepts it. This is an early project without verified revenue, customers, traffic, or a public hosted product. Do not list it as an established SaaS business or imply income. The pricing page currently advertises self-service packages starting at $29 for 60 days for smaller assets; confirm the exact category, fee, and success fee in the live seller flow before paying.

Suggested listing title:
SILENTFAIL: Local-First JavaScript Mutation Testing Tool

Suggested asset description:
SILENTFAIL is an early-stage developer tool for reviewing test quality in supported JavaScript CommonJS projects. It applies deterministic mutations, executes the project's supported tests, classifies caught and surviving mutations, and provides explanations and suggested tests for developer review. The repository includes source code, a bundled demo fixture, documentation, and automated CI checks. It has no verified revenue or paying customers. It is not a public hosted service and must not be used to execute hostile customer code in a shared public environment. Initial support is limited to CommonJS .js/.cjs and the documented built-in test/expect API; TypeScript, ESM, arbitrary dependency installation, and I/O-heavy projects are not promised. The repository is MIT-licensed and publicly accessible.

Evidence to prepare if the platform requests it:
- Current repository URL and exact commit
- Green CI run link
- Actual screenshots / short unedited screen recording
- Clear asset inventory and transfer steps
- Accurate traffic, users, revenue, expenses, and customer counts (use zero/not applicable where true; never invent numbers)
- Ownership and MIT/dependency-license disclosure

Do not pay a listing fee until the seller flow confirms that this asset type is eligible and the terms are understood.

### 3. Acquire.com — defer until there is a secure live product and real usage

Seller information: https://help.acquire.com/seller-faqs-1

Fit today: weak. Acquire's published guidance says pre-revenue listings are selective and generally expects a SaaS product under $25,000, a useful/niche product, active customers, and a decent SSL-certified website. SILENTFAIL currently has no verified active customers and no verified public hosted product, so it should not be represented as meeting those criteria. Revisit after a secure deployment, real active users/customers, and evidence that can be verified.

Do not create misleading customer, revenue, analytics, or traction claims to pass curation.

## Public listing rules

- State that CI passed only for the exact commit and workflow run actually checked.
- Never say the app is “fully production-ready” based only on CI.
- Do not promise support for TypeScript, ESM, all test runners, or arbitrary JavaScript projects.
- Do not claim a hardened security sandbox or public hosted execution.
- Do not claim paying customers, revenue, traffic, or valuation without evidence.
- Use actual screenshots and an actual recording; do not fabricate metrics or UI.
- Use a written scope and support period for any paid service.
- Do not send customer code to a public hosted service; use only approved, non-sensitive samples.

## Listing status tracker

- [ ] Confirm the final branch/commit and decide whether PR #1 should be merged.
- [ ] Manually complete the real browser walkthrough.
- [ ] Capture genuine screenshots and an unedited demo recording.
- [ ] Prepare and test a clean distributable ZIP.
- [ ] Confirm ownership, MIT license, and dependency licenses.
- [ ] Create/complete Codester seller account and submit package for review.
- [ ] Review Flippa eligibility and current fees before paying; list only if accepted as an early-stage software asset.
- [ ] Revisit Acquire.com after secure hosting and real customer activity exist.
- [ ] Track listing URLs, review decisions, buyer enquiries, and actual payments.
