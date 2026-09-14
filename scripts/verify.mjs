import { spawn } from 'node:child_process';

const checks = [
  ['typecheck', ['run', 'typecheck']],
  ['lint', ['run', 'lint']],
  ['tests', ['run', 'test']],
  ['build', ['run', 'build']],
];

for (const [name, args] of checks) {
  console.log(`\n== ${name} ==`);
  await run('npm', args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)));
  });
}
