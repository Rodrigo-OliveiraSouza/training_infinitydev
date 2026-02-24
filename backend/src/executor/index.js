const config = require('../config');
const local = require('./local');
const docker = require('./docker');

async function prepareRunner(language, code) {
  const normalized = language.toLowerCase();
  const runner = config.execMode === 'docker' ? docker : local;

  if (normalized === 'python') {
    return runner.preparePython(code, {
      timeoutMs: config.runTimeoutMs,
      memoryMb: config.runMemoryMb
    });
  }

  if (normalized === 'java') {
    return runner.prepareJava(code, {
      timeoutMs: config.runTimeoutMs,
      memoryMb: config.runMemoryMb
    });
  }

  throw new Error('Unsupported language');
}

module.exports = { prepareRunner };

