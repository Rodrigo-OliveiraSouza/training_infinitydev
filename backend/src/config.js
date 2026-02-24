const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  tokenTtl: process.env.TOKEN_TTL || '7d',
  execMode: process.env.EXECUTION_MODE || 'local',
  pythonBin: process.env.PYTHON_BIN || 'python',
  javaBin: process.env.JAVA_BIN || 'java',
  javacBin: process.env.JAVAC_BIN || 'javac',
  runTimeoutMs: Number(process.env.RUN_TIMEOUT_MS || 3000),
  terminalTimeoutMs: Number(process.env.TERMINAL_TIMEOUT_MS || 20000),
  runMemoryMb: Number(process.env.RUN_MEMORY_MB || 128),
  maxOutputKb: Number(process.env.MAX_OUTPUT_KB || 64)
};

module.exports = config;

