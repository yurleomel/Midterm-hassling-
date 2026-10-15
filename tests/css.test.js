// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// A merge can drop the line that opens a comment: the comment text then swallows the next rule, silently
test('css/style.css: every comment is opened and closed, and braces balance', () => {
  const s = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  let inComment = false, depth = 0, line = 1;
  const stray = [];
  for (let i = 0; i < s.length; i++) {
    if (!inComment && s.startsWith('/*', i)) { inComment = true; i++; continue; }
    if (inComment && s.startsWith('*/', i)) { inComment = false; i++; continue; }
    if (!inComment && s.startsWith('*/', i)) stray.push(line);
    if (!inComment && s[i] === '{') depth++;
    if (!inComment && s[i] === '}') depth--;
    assert.ok(depth >= 0, `closing brace without an opening one at line ${line}`);
    if (s[i] === '\n') line++;
  }
  assert.deepEqual(stray, [], 'comment closers without an opener');
  assert.equal(inComment, false, 'a comment is never closed');
  assert.equal(depth, 0, 'unbalanced braces');
});
