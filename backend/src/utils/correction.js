const { normalizeOutput } = require('./normalize');
const { similarity } = require('./similarity');

function compareExact(actual, expected) {
  const a = normalizeOutput(actual);
  const e = normalizeOutput(expected);
  return { passed: a === e, actual: a, expected: e };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeInput(value) {
  if (!value) return '';
  return value.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

function getInputLines(input) {
  const normalized = normalizeInput(input);
  if (!normalized) return [];
  return normalized.split('\n');
}

function resolveExpectedRegex(expectedRegex, input) {
  if (!expectedRegex) return expectedRegex;
  const normalized = normalizeInput(input);
  let resolved = expectedRegex.replace(/\{\{input\}\}/g, escapeRegExp(normalized));
  const lines = getInputLines(input);
  resolved = resolved.replace(/\{\{input_line(\d+)\}\}/g, (match, indexRaw) => {
    const index = Number(indexRaw) - 1;
    const value = lines[index] || '';
    return escapeRegExp(value);
  });
  return resolved;
}

function numberPattern(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) {
    return `${rounded}(?:[\\.,]0+)?`;
  }
  const text = value.toString();
  const parts = text.split('.');
  const intPart = parts[0];
  const fracPart = parts[1] || '0';
  return `${intPart}[\\.,]${fracPart}(?:0+)?`;
}

function wrapNumberPattern(pattern) {
  if (!pattern) return null;
  return `(?:^|[^\\d+\\-.,])(?:${pattern})(?=$|[^\\d.,])`;
}

function computedNumberRegex(value) {
  const pattern = numberPattern(value);
  return wrapNumberPattern(pattern);
}

function resolveComputedRegex(rule, input) {
  const lines = getInputLines(input);
  if (rule === 'int_plus') {
    const base = parseInt(lines[0] || '', 10);
    if (Number.isNaN(base)) return null;
    const expected = base + 1;
    return computedNumberRegex(expected);
  }
  if (rule === 'int_plus_2') {
    const base = parseInt(lines[0] || '', 10);
    if (Number.isNaN(base)) return null;
    const expected = base + 2;
    return computedNumberRegex(expected);
  }
  if (rule === 'int_double') {
    const base = parseInt(lines[0] || '', 10);
    if (Number.isNaN(base)) return null;
    const expected = base * 2;
    return computedNumberRegex(expected);
  }
  if (rule === 'float_half') {
    const raw = (lines[0] || '').replace(',', '.');
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return null;
    const half = value / 2;
    return computedNumberRegex(half);
  }
  if (rule === 'float_square') {
    const raw = (lines[0] || '').replace(',', '.');
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return null;
    const squared = value * value;
    return computedNumberRegex(squared);
  }
  if (rule === 'echo_line') {
    if (!lines[0]) return null;
    return `^.*${escapeRegExp(lines[0])}.*$`;
  }
  return null;
}

function compareRegex(actual, expectedRegex) {
  const a = normalizeOutput(actual);
  if (!expectedRegex) {
    return { passed: false, actual: a, expectedRegex };
  }
  try {
    const re = new RegExp(expectedRegex, 'm');
    return { passed: re.test(a), actual: a, expectedRegex };
  } catch (err) {
    return { passed: false, actual: a, expectedRegex };
  }
}

function compareSimilarity(actual, expected, threshold) {
  const a = normalizeOutput(actual);
  const e = normalizeOutput(expected);
  const score = similarity(a, e);
  return { passed: score >= threshold, score, actual: a, expected: e };
}

function evaluateOutput(strategy, actual, input) {
  if (strategy.type === 'regex') {
    const expectedRegex = resolveExpectedRegex(strategy.expectedRegex, input);
    return compareRegex(actual, expectedRegex);
  }
  if (strategy.type === 'computed') {
    const expectedRegex = resolveComputedRegex(strategy.rule, input);
    if (!expectedRegex) {
      return { passed: false, actual: normalizeOutput(actual), expectedRegex: null };
    }
    return compareRegex(actual, expectedRegex);
  }
  if (strategy.type === 'similarity') {
    return compareSimilarity(actual, strategy.expected, strategy.similarityThreshold || 0.9);
  }
  return compareExact(actual, strategy.expected);
}

function evaluateTestOutput(test, actual, input) {
  if (test.match === 'regex') {
    const expectedRegex = resolveExpectedRegex(test.expected, input);
    return compareRegex(actual, expectedRegex);
  }
  if (test.match === 'similarity') {
    return compareSimilarity(actual, test.expected, test.similarityThreshold || 0.9);
  }
  return compareExact(actual, test.expected);
}

module.exports = { evaluateOutput, evaluateTestOutput };

