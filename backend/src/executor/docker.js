const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const config = require('../config');
const { truncateOutput } = require('../utils/normalize');

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    // Best-effort cleanup.
  }
}

function runProcess(command, args, options) {
  const { input, timeoutMs } = options;
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(command, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        child.kill('SIGKILL');
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (code) => {
      finished = true;
      clearTimeout(timer);
      const runtimeMs = Date.now() - start;
      resolve({
        stdout: truncateOutput(stdout, config.maxOutputKb),
        stderr: truncateOutput(stderr, config.maxOutputKb),
        exitCode: code,
        runtimeMs
      });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function dockerArgs(baseArgs) {
  return [
    'run',
    '--rm',
    '--network',
    'none',
    '--pids-limit',
    '64',
    '--memory',
    `${config.runMemoryMb}m`,
    ...baseArgs
  ];
}

function preparePython(code) {
  const tempDir = createTempDir('codequest-py-');
  const filePath = path.join(tempDir, 'main.py');
  fs.writeFileSync(filePath, code, 'utf8');

  return {
    run: async (input) => {
      const args = dockerArgs([
        '-v',
        `${tempDir}:/sandbox`,
        '-w',
        '/sandbox',
        'codequest-python',
        'python',
        'main.py'
      ]);
      return runProcess('docker', args, {
        input,
        timeoutMs: config.runTimeoutMs
      });
    },
    cleanup: () => cleanupDir(tempDir)
  };
}

function prepareJava(code) {
  const tempDir = createTempDir('codequest-java-');
  const sourcePath = path.join(tempDir, 'Main.java');
  fs.writeFileSync(sourcePath, code, 'utf8');

  return {
    run: async (input) => {
      const command = 'sh';
      const script = 'javac Main.java && java -Xmx' + config.runMemoryMb + 'm Main';
      const args = dockerArgs([
        '-v',
        `${tempDir}:/sandbox`,
        '-w',
        '/sandbox',
        'codequest-java',
        command,
        '-c',
        script
      ]);
      return runProcess('docker', args, {
        input,
        timeoutMs: config.runTimeoutMs
      });
    },
    cleanup: () => cleanupDir(tempDir)
  };
}

module.exports = { preparePython, prepareJava };

