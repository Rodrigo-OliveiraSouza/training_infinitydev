const { migrate, getDb } = require('../src/db');

const DECIMAL_TEST_FIXES = new Map([
  [
    65,
    [
      { input: '1000\n', expected: '^2000(\\.0+)?$', match: 'regex' },
      { input: '1200\n', expected: '^2400(\\.0+)?$', match: 'regex' }
    ]
  ],
  [
    66,
    [
      { input: '5\n8\n', expected: '^40(\\.0+)?$', match: 'regex' },
      { input: '7\n3\n', expected: '^21(\\.0+)?$', match: 'regex' }
    ]
  ],
  [
    69,
    [
      { input: '100\n', expected: '^90(\\.0+)?$', match: 'regex' },
      { input: '250\n', expected: '^225(\\.0+)?$', match: 'regex' }
    ]
  ],
  [
    70,
    [
      { input: '10\n5\n2\n', expected: '^17(\\.0+)?$', match: 'regex' },
      { input: '1\n2\n3\n', expected: '^6(\\.0+)?$', match: 'regex' }
    ]
  ]
]);

function normalizeJavaExample(exampleMd) {
  if (typeof exampleMd !== 'string' || !exampleMd.includes('```java')) {
    return exampleMd;
  }

  const hasLeadingNewline = exampleMd.startsWith('\n');
  const fixed = exampleMd.replace(/```java\s*([\s\S]*?)```/g, (_full, code) => {
    let normalized = code;
    normalized = normalized.replace(/\\n/g, '\n');
    normalized = normalized.replace(/\\t/g, '\t');
    normalized = normalized.replace(
      'System.out.println(texto.equals(reverso) "SIM" : "NAO");',
      'System.out.println(texto.equals(reverso) ? "SIM" : "NAO");'
    );
    normalized = normalized.replace(
      'System.out.println(n % 2 == 0 "PAR" : "IMPAR");',
      'System.out.println(n % 2 == 0 ? "PAR" : "IMPAR");'
    );
    normalized = normalized.replace(
      [
        'for (int i = 0; i < n; i++) {',
        '      if (i == idx) continue;',
        '      if (i > 0 && (i != idx || idx == 0)) System.out.print(" ");',
        '      System.out.print(arr[i]);',
        '    }'
      ].join('\n'),
      [
        'boolean first = true;',
        '    for (int i = 0; i < n; i++) {',
        '      if (i == idx) continue;',
        '      if (!first) System.out.print(" ");',
        '      System.out.print(arr[i]);',
        '      first = false;',
        '    }'
      ].join('\n')
    );
    return `\`\`\`java\n${normalized.trim()}\n\`\`\``;
  });

  return hasLeadingNewline && !fixed.startsWith('\n') ? `\n${fixed}` : fixed;
}

function normalizeChallengeTests(challenge) {
  if (!challenge || !Array.isArray(challenge.tests)) {
    return { challenge, changed: false };
  }

  let changed = false;
  const nextTests = challenge.tests.map((test) => {
    const next = { ...test };
    if (typeof next.input === 'string' && next.input.includes('\\n')) {
      next.input = next.input.replace(/\\n/g, '\n');
      changed = true;
    }
    if (
      typeof next.expected === 'string' &&
      next.expected.includes('\\n') &&
      (next.match || 'exact') === 'exact'
    ) {
      next.expected = next.expected.replace(/\\n/g, '\n');
      changed = true;
    }
    return next;
  });

  if (!changed) {
    return { challenge, changed: false };
  }

  return { challenge: { ...challenge, tests: nextTests }, changed: true };
}

async function run() {
  await migrate();
  const db = getDb();
  const javaLanguage = db.prepare("SELECT id FROM languages WHERE name = 'Java'").get();

  if (!javaLanguage) {
    console.log('Java language not found');
    return;
  }

  const levels = db
    .prepare(
      `SELECT id, title, example_md, challenge_json
       FROM levels
       WHERE language_id = ?
       ORDER BY order_index`
    )
    .all(javaLanguage.id);

  let updatedExamples = 0;
  let updatedTests = 0;

  for (const level of levels) {
    const nextExample = normalizeJavaExample(level.example_md || '');
    let challenge = JSON.parse(level.challenge_json || '{}');
    let challengeChanged = false;

    if (DECIMAL_TEST_FIXES.has(level.id)) {
      challenge.tests = DECIMAL_TEST_FIXES.get(level.id);
      challengeChanged = true;
    }

    const normalized = normalizeChallengeTests(challenge);
    challenge = normalized.challenge;
    if (normalized.changed) {
      challengeChanged = true;
    }

    const nextChallengeJson = JSON.stringify(challenge);
    const exampleChanged = nextExample !== level.example_md;

    if (!exampleChanged && !challengeChanged) {
      continue;
    }

    db.prepare(
      `UPDATE levels
       SET example_md = ?, challenge_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextExample, nextChallengeJson, level.id);

    if (exampleChanged) {
      updatedExamples += 1;
    }
    if (challengeChanged) {
      updatedTests += 1;
    }
  }

  console.log(`Updated Java examples: ${updatedExamples}`);
  console.log(`Updated Java challenge tests: ${updatedTests}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
