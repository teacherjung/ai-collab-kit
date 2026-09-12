// 守「本文一頁」這條：RULES.md 的**規矩正文**去掉空白後不得超過 3,000 字。
//
// 裁示者 2026-09-12 先定「一頁，約三千字」，同日再裁：**只數規矩本身**——
// 節標題、開頭那句指路、條號（甲1、乙2…）、句尾的執行者標籤都不算，
// 因為那些是標示，不是規矩；讓標示去吃規矩的配額，會逼人把規矩壓到變形
// （已實際發生過一次：為了省幾個字砍掉一條規矩的適用範圍，意思就變了）。
//
// 算的是「字元數」：中文一字一個、英文一個字母一個；不算空白與換行。
//
// ⚠️ 三件事一起守，少一件這題就是空包彈：
//   ①規矩正文的字數上限；
//   ②每條都要有句尾標籤——少了標籤，那一條的句尾內容就會被當成標籤扣掉、字數少算；
//   ③檔案裡真的有規矩——格式一改，規矩行變成零，字數也會是零而靜靜通過。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LIMIT = 3000;
// 下限只是「這檔還是一份規矩清單」的地板，不是實際條數（實際條數會變，寫死會漂）。
const MIN_RULES = 20;
const file = path.join(__dirname, '..', 'RULES.md');

const RULE_LINE = /^- ([甲乙丙丁戊己庚辛壬癸子]\d+) (.+)$/u;
const TAG_AT_END = /（[^（）]*）$/u;

function ruleBodies(text) {
  const lines = text.split('\n').filter((l) => l.startsWith('- '));
  assert.ok(
    lines.length >= MIN_RULES,
    `RULES.md 只找到 ${lines.length} 行規矩（至少要 ${MIN_RULES} 行）：格式變了的話字數會算成零、這題就變成永遠綠的空包彈`,
  );
  return lines.map((line) => {
    const m = RULE_LINE.exec(line);
    assert.ok(m, `這一行不是「- 條號 內容」的寫法，字數算不了：${line.slice(0, 40)}`);
    const body = m[2];
    assert.ok(
      TAG_AT_END.test(body),
      `${m[1]} 少了句尾的執行者標籤（機器哪一種，或「靠自覺」）：${body.slice(-20)}`,
    );
    return body.replace(TAG_AT_END, '');
  });
}

test('規矩正文不超過 3,000 字（標題、條號、句尾標籤不算）', () => {
  const text = fs.readFileSync(file, 'utf8');
  const bodies = ruleBodies(text);
  const count = bodies.reduce((n, b) => n + Array.from(b.replace(/\s+/g, '')).length, 0);
  assert.ok(
    count <= LIMIT,
    `規矩正文現在 ${count} 字（${bodies.length} 條），上限 ${LIMIT}：加一條要先砍一條`,
  );
});
