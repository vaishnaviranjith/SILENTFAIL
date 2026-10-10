import { spawn } from 'node:child_process';

const checks = [
  ['typecheck', ['run', 'typecheck']],
  ['lint', ['run', 'lint']],
  ['tests', ['run', 'test']],
  ['build', ['run', 'build']],
];

for (const [name, args] of checks) {
  console.log(`\n== ${name} ==`);
  // Render sets NODE_ENV=production for Node services. React's act() test
  // helper requires the test build, so override NODE_ENV only for test runs.
  const env = name === 'tests' ? { ...process.env, NODE_ENV: 'test' } : process.env;
  await run('npm', args, env);
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, env });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)));
  });
}
