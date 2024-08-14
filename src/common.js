// exec should be preferred as it is part of the toolkit but it doesn't support signal handling
// https://github.com/actions/toolkit/issues/1534
//const exec = require('@actions/exec') // https://github.com/actions/toolkit/tree/main/packages/exec
const core = require('@actions/core') // https://github.com/actions/toolkit/tree/main/packages/core
const process = require('process')
const { spawn } = require("child_process");

// read action inputs
const input = {
  run: core.getInput('run'),
  post: core.getInput('post'),
  workingDirectory: core.getInput('working-directory'),
  shell: core.getInput('shell'),
  postShell: core.getInput('post-shell'),
}

function run() {
  return runCommands(input.run, input.shell)
}

function post() {
  return runCommands(input.post, input.postShell ? input.postShell : input.shell)
}

function runCommands(commands, shell) {
  const options = {
    cwd: input.workingDirectory,
    env: process.env,
    stdio: 'inherit',
    shell: shell
  }

  console.log(`Running commands in shell: ${shell}`);
  console.log(`Commands:\n${commands}\n`);

  // The child process should handle any signals sent to the parent process so it can handle its shutdown.
  // The parent process should not handle any signal otherwise it might send a signal twice to the child process or parent process (event loop) might terminate before the child process.
  // https://github.com/nodejs/tooling/issues/42
  const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP']
  if (commands) {
    core.info(`Starting new spawn process`);
    const subprocess = spawn(commands, options)
      .on('error', (error) => {
        core.error(`Error: ${error.message}`);
        process.exit(subprocess.exitCode);
      });
    core.info(`Child process with pid: ${subprocess.pid}`);

    SIGNALS.forEach(signal => {
      process.on(signal, () => {
        core.info(`Child process will handle the signal: ${signal}`);
        process.kill(subprocess.pid, signal);
      });
    });

    // Set the child process exit code as the parent process exit code
    ['close', 'exit'].forEach(event => {
      subprocess.on(event, (code, signal) => {
        core.info(`Child process ${event} with code ${code}`);
        process.exit(code);
      });
    });

  }
}

module.exports = {
  run,
  post
}
