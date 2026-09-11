// 守「本文一頁」這條：RULES.md 去掉空白後不得超過 3,000 字（William 2026-09-12 裁「一頁，約三千字」）。
// 算的是「字元數」：中文一字一個、英文一個字母一個。不算空白與換行。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LIMIT = 3000;
const file = path.join(__dirname, '..', 'RULES.md');

test('本文不超過 3,000 字', () => {
  const text = fs.readFileSync(file, 'utf8');
  const count = Array.from(text.replace(/\s+/g, '')).length;
  assert.ok(count <= LIMIT, `RULES.md 現在 ${count} 字，上限 ${LIMIT}：加一條要先砍一條`);
});
