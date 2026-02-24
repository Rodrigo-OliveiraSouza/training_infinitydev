function normalizeOutput(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const normalized = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').map((line) => line.replace(/[ \t]+$/g, ''));
  let joined = lines.join('\n');
  joined = joined.replace(/\n+$/g, '');
  return joined;
}

function truncateOutput(text, maxKb) {
  const maxBytes = maxKb * 1024;
  const buffer = Buffer.from(text || '', 'utf8');
  if (buffer.length <= maxBytes) {
    return text || '';
  }
  return buffer.subarray(0, maxBytes).toString('utf8') + '\n[output truncated]';
}

module.exports = { normalizeOutput, truncateOutput };

