# Security model

SILENTFAIL treats every submitted source file and test as untrusted.

## Current protections

- The API accepts only small, relative `.js` and `.cjs` files. It rejects
  absolute paths, `..` segments, control characters, duplicate names, oversized
  files, oversized projects, and missing source/test inputs.
- Each run uses a fresh temporary directory. User files are copied into it; the
  originals remain in memory and are never modified.
- Each mutant runs in a separate short-lived child process. Processes have a wall
  clock timeout, a heap cap, POSIX CPU/file-size limits where available, detached
  process-group cleanup, and a hard output cap.
- The sandbox strips the inherited environment, blocks filesystem, network,
  process, VM, worker, and inspector modules, removes network globals, and pins
  time/randomness for reproducibility.
- The API returns generic internal errors and never returns server filesystem
  paths, environment values, or provider credentials.
- Optional AI credentials are read only by the API process. They are not included
  in analysis results or the health response.

## Realistic limitation

The local child-process guard is defense in depth, not a kernel security boundary:
JavaScript code that intentionally attacks Node itself may be able to bypass an
in-process module guard. For multi-tenant or hostile public uploads, replace the
`ExecutorAdapter` with a rootless container, microVM, or isolated worker service
with a deny-by-default network policy. The core pipeline already isolates that
boundary behind `ExecutorAdapter`.

The built-in demo is pure logic and runs safely offline. No project dependencies
are installed inside a submitted-project sandbox.
