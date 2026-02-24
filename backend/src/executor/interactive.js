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
  const { timeoutMs, cwd } = options;
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(command, args, { cwd, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        child.kill('SIGKILL');
      }
    }, timeoutMs);

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const runtimeMs = Date.now() - start;
      const message = `Falha ao executar: ${command}. Verifique a instalacao e o PATH.`;
      resolve({
        stdout: '',
        stderr: truncateOutput(`${message}\n${err.message}`, config.maxOutputKb),
        exitCode: -1,
        runtimeMs
      });
    });

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
  });
}

function preparePythonInteractive(code) {
  const tempDir = createTempDir('codequest-term-py-');
  const filePath = path.join(tempDir, 'main.py');
  fs.writeFileSync(filePath, code, 'utf8');

  const child = spawn(config.pythonBin, ['-u', filePath], {
    cwd: tempDir,
    stdio: 'pipe'
  });
  child.on('error', () => {});

  return {
    child,
    cleanup: () => cleanupDir(tempDir),
    kill: () => child.kill('SIGKILL')
  };
}

async function prepareJavaInteractive(code, options = {}) {
  const tempDir = createTempDir('codequest-term-java-');
  const sourcePath = path.join(tempDir, 'Main.java');
  fs.writeFileSync(sourcePath, code, 'utf8');

  const compileResult = await runProcess(config.javacBin, ['Main.java'], {
    timeoutMs: options.timeoutMs || config.runTimeoutMs,
    cwd: tempDir
  });

  if (compileResult.exitCode !== 0) {
    cleanupDir(tempDir);
    return { compileError: compileResult };
  }

  const memoryArg = `-Xmx${options.memoryMb || config.runMemoryMb}m`;
  const child = spawn(config.javaBin, [memoryArg, 'Main'], {
    cwd: tempDir,
    stdio: 'pipe'
  });
  child.on('error', () => {});

  return {
    child,
    cleanup: () => cleanupDir(tempDir),
    kill: () => child.kill('SIGKILL')
  };
}

async function prepareInteractiveRunner(language, code, options = {}) {
  const normalized = language.toLowerCase();
  if (normalized === 'python') {
    return preparePythonInteractive(code);
  }
  if (normalized === 'java') {
    return prepareJavaInteractive(code, options);
  }
  throw new Error('Unsupported language');
}

module.exports = { prepareInteractiveRunner };
