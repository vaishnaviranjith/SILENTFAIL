# SILENTFAIL: first-customer outreach

Use these as starting points and personalize the first sentence to the recipient. Be transparent that SILENTFAIL is an early product and that the first offer is a paid pilot. Do not imply the recipient has been selected by an algorithm or that the product has customers.

## Email

**Subject:** Quick JavaScript test-quality pilot?

Hi {{FirstName}},

I’m building SILENTFAIL, a developer tool that helps find behavior a passing JavaScript test suite may still fail to protect. It makes small code mutations, runs the tests, and highlights the mutations that survive so a developer can review the gap and verify a targeted test.

I’m looking for a few early pilot users who maintain small CommonJS/Node.js projects. The pilot is fixed-scope, uses an agreed non-sensitive sample, and includes a short findings report and walkthrough. The current version has clear language/runtime limitations, which I’ll share before we start.

Would a 15-minute demo be useful? If it is not relevant, no worries.

Thanks,
Vaishnavi
SILENTFAIL
{{DemoOrRepositoryLink}}

## LinkedIn message

Hi {{FirstName}} — I’m building SILENTFAIL, a small JavaScript mutation-testing tool that highlights cases where tests pass even after behavior is changed. I’m looking for a few early pilot users and would value your feedback if your team maintains Node.js/CommonJS code. Happy to share a short demo and the current limitations. Would you be open to a quick look?

## Follow-up (send once, after 3–4 business days)

Hi {{FirstName}}, quick follow-up in case this got buried. The useful part of SILENTFAIL is seeing a concrete surviving mutation and then checking whether a targeted test catches it. If improving test confidence is relevant to your team, I can show the bundled demo in 10–15 minutes. If not, I won't keep following up.

## Discovery questions

1. What test runner and JavaScript module format does your project use?
2. Which code paths are expensive or risky when a regression slips through?
3. How do you currently decide whether a test suite protects the behavior—not just executes the lines?
4. Would you prefer a self-serve tool, a guided test-gap review, or a source-code license?
5. What would need to be proven before you would pay for this?

## Demo script (5 minutes)

1. Explain: line coverage does not prove an assertion would catch a behavior change.
2. Open the bundled demo and run the baseline.
3. Show one surviving mutation and the exact behavior that changed.
4. Show the suggested targeted test; explain that a developer should review it.
5. Run verification and compare the results.
6. State the current supported syntax, local-first model, and security/hosting limitations.
7. Ask what would make this useful enough to pay for.

## Qualification and trust rules

- Use only the bundled demo or customer-approved non-sensitive sample code.
- Do not ask for credentials, production secrets, or private repositories at the first contact.
- Do not promise support for TypeScript, ESM, arbitrary dependency installation, or all test frameworks.
- Do not claim paid customers, revenue, security certification, or guaranteed bug detection without evidence.
- Stop contacting anyone who declines or asks not to be contacted.
