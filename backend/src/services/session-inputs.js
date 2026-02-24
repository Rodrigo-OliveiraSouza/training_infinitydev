const sessionInputs = new Map();

function appendInput(sessionId, chunk) {
  if (!sessionId || !chunk) return;
  const existing = sessionInputs.get(sessionId) || '';
  sessionInputs.set(sessionId, existing + chunk);
}

function getInput(sessionId) {
  if (!sessionId) return '';
  return sessionInputs.get(sessionId) || '';
}

function clearInput(sessionId) {
  if (!sessionId) return;
  sessionInputs.delete(sessionId);
}

function consumeInput(sessionId) {
  const value = getInput(sessionId);
  clearInput(sessionId);
  return value;
}

module.exports = {
  appendInput,
  getInput,
  clearInput,
  consumeInput
};
