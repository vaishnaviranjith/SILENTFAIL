import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve npm without relying on a Unix-only executable name.
 *
 * npm sets `npm_execpath` while running package scripts. Calling that script
 * through the current Node executable works on both Unix and Windows and avoids
 * the Windows `spawn npm ENOENT` failure. Direct execution still has a fallback
 * for environments that do not provide npm_execpath.
 */
export function resolveNpmInvocation(platform = process.platform, env = process.env) {
  const npmExecPath = env.npm_execpath ?? env.NPM_EXEC_PATH;
  if (npmExecPath) return { command: process.execPath, prefix: [npmExecPath] };
  return { command: platform === 'win32' ? 'npm.cmd' : 'npm', prefix: [] };
}

export function startDev() {
  const npm = resolveNpmInvocation();
  const processes = [
    ['api', ['run', 'dev', '-w', '@silentfail/api']],
    ['web', ['run', 'dev', '-w', '@silentfail/web']],
  ].map(([name, args]) => {
    const child = spawn(npm.command, [...npm.prefix, ...args], {
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });
    child.on('error', (error) => {
      console.error(`${name} failed to start: ${error.message}`);
      process.exitCode = 1;
    });
    child.on('exit', (code) => {
      if (code && code !== 0) console.error(`${name} stopped with code ${code}`);
    });
    return child;
  });

  function stop() {
    for (const child of processes) child.kill('SIGTERM');
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startDev();
