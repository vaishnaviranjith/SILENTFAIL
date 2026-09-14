# Built-in demo

`discount.js` is intentionally correct. `discount.test.js` is intentionally
incomplete: it checks a non-member, a large order, and an approved payment, but it
never checks the member discount, the shipping boundary, or a declined payment.

SILENTFAIL executes the original files and isolated mutated copies. The numbers in
the UI are produced by those executions; they are not fixture metadata.
