const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getLevel, isLevelUnlocked } = require('../services/levels');
const { getDb } = require('../db');
const { prepareInteractiveRunner } = require('../executor/interactive');
const sessionInputs = require('../services/session-inputs');

function getLanguageName(languageId) {
  const db = getDb();
  const row = db.prepare('SELECT name FROM languages WHERE id = ?').get(languageId);
  return row ? row.name.toLowerCase() : null;
}

function safeSend(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function setupTerminalServer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/terminal' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const levelIdParam = url.searchParams.get('levelId');
    let userId = null;

    if (!token) {
      ws.close(1008, 'Auth required');
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      userId = payload.sub;
    } catch (err) {
      ws.close(1008, 'Invalid token');
      return;
    }

    let current = null;
    let currentSessionId = null;
    let timeoutTimer = null;

    const clearTimer = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    const stopCurrent = (reason) => {
      if (!current) return;
      current.kill();
      current.cleanup();
      current = null;
      clearTimer();
      if (reason) {
        safeSend(ws, { type: 'exit', reason });
      }
    };

    ws.on('message', async (raw) => {
      let message = null;
      try {
        message = JSON.parse(raw.toString());
      } catch (err) {
        safeSend(ws, { type: 'error', message: 'Mensagem invalida.' });
        return;
      }

      if (message.type === 'run') {
        const code = typeof message.code === 'string' ? message.code : '';
        const levelId = Number(message.levelId || levelIdParam);
        const sessionId = typeof message.sessionId === 'string' ? message.sessionId : null;

        if (!levelId || Number.isNaN(levelId)) {
          safeSend(ws, { type: 'error', message: 'levelId requerido.' });
          return;
        }

        const access = isLevelUnlocked(levelId, userId);
        if (!access.allowed) {
          safeSend(ws, { type: 'error', message: access.reason || 'Fase bloqueada.' });
          return;
        }

        const level = getLevel(levelId);
        if (!level) {
          safeSend(ws, { type: 'error', message: 'Fase nao encontrada.' });
          return;
        }

        const challenge = JSON.parse(level.challenge_json || '{}');
        if (challenge.mode === 'text') {
          safeSend(ws, { type: 'error', message: 'Execucao indisponivel para esta trilha.' });
          return;
        }

        if (!code || code.trim().length < 3) {
          safeSend(ws, { type: 'error', message: 'Codigo obrigatorio.' });
          return;
        }

        const language = getLanguageName(level.language_id);
        if (!language) {
          safeSend(ws, { type: 'error', message: 'Linguagem nao configurada.' });
          return;
        }

        stopCurrent();
        currentSessionId = sessionId;
        if (currentSessionId) {
          sessionInputs.clearInput(currentSessionId);
        }

        let runner = null;
        try {
          runner = await prepareInteractiveRunner(language, code, {
            timeoutMs: config.terminalTimeoutMs,
            memoryMb: config.runMemoryMb
          });
        } catch (err) {
          safeSend(ws, { type: 'error', message: 'Falha ao preparar execucao.' });
          return;
        }

        if (runner.compileError) {
          safeSend(ws, {
            type: 'compile_error',
            stdout: runner.compileError.stdout,
            stderr: runner.compileError.stderr
          });
          return;
        }

        current = runner;
        current.child.stdout.setEncoding('utf8');
        current.child.stderr.setEncoding('utf8');

        current.child.stdout.on('data', (chunk) => {
          safeSend(ws, { type: 'stdout', data: chunk });
        });
        current.child.stderr.on('data', (chunk) => {
          safeSend(ws, { type: 'stderr', data: chunk });
        });

        current.child.on('close', (code, signal) => {
          clearTimer();
          safeSend(ws, { type: 'exit', code, signal });
          if (current) {
            current.cleanup();
            current = null;
          }
        });

        current.child.on('error', () => {
          clearTimer();
          safeSend(ws, { type: 'error', message: 'Falha ao executar o processo.' });
          if (current) {
            current.cleanup();
            current = null;
          }
        });

        timeoutTimer = setTimeout(() => {
          if (current) {
            current.kill();
            safeSend(ws, { type: 'timeout' });
          }
        }, config.terminalTimeoutMs);

        safeSend(ws, { type: 'ready' });
        return;
      }

      if (message.type === 'input') {
        if (!current || !current.child || !current.child.stdin.writable) return;
        const data = typeof message.data === 'string' ? message.data : '';
        if (data.length > 4096) {
          safeSend(ws, { type: 'error', message: 'Entrada muito longa.' });
          return;
        }
        const sessionId = typeof message.sessionId === 'string' ? message.sessionId : currentSessionId;
        if (sessionId) {
          sessionInputs.appendInput(sessionId, data);
        }
        current.child.stdin.write(data);
        return;
      }

      if (message.type === 'stop') {
        stopCurrent('stopped');
        return;
      }

      if (message.type === 'ping') {
        safeSend(ws, { type: 'pong' });
      }
    });

    ws.on('close', () => {
      stopCurrent();
    });
  });
}

module.exports = { setupTerminalServer };
