// 守「本文一頁」這條：規矩正文去掉空白後不得超過 3,000 字。
//
// 裁示者 2026-09-12 先定「一頁，約三千字」，同日再裁：**只數規矩本身**——
// 節標題、開頭那句指路、條號、句尾的執行者標籤都不算，因為那些是標示、不是規矩。
//
// ⚠️ 這一題前七版都在自己判斷「RULES.md 的哪幾行算規矩」，等於用土法重做 Markdown
//    的呈現規則，**連七輪被獨立審查者用不同寫法繞過去**：換星號、換有序清單、縮排、
//    Tab、不換行空白、引言記號、七個井號、CR 換行。每一次我都補一種寫法，每一次都
//    撐不到下一輪。實作者在自問表裡寫下停損線：再有一種新的漏算，就不再補寫法、改成
//    「規矩存成資料、本文由它產生」。第七輪的 CR 換行觸發了它。
//
// **所以現在沒有「哪幾行算規矩」這個問題**：規矩住在 rules.json，一則一筆；
// RULES.md 是產物。這一題只要守四件，全部量得到、不必猜任何呈現規則：
//   ①字數：直接加總資料裡每一條的正文；
//   ②每條都有非空的執行者標籤，而且以一個**已定義**的名字開頭；
//   ③那份定義的正本在 MACHINES.md，這裡跟它對帳，兩邊不可以各寫各的；
//   ④**RULES.md 必須與產生結果逐字元相同**——手改本文就紅，所以繞不過①②③。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, read, dataFile, outFile } = require('../tools/build-rules.js');

const LIMIT = 3000;
// 下限只是「這份資料還是一份規矩清單」的地板，不是實際條數（實際條數會變，寫死會漂）。
const MIN_RULES = 20;
const machinesFile = path.join(__dirname, '..', 'MACHINES.md');
// MACHINES.md 裡那張定義表的開頭，用來定位（標籤的正本只有那一份）。
const LABEL_TABLE_ANCHOR = '句尾的執行者標籤，定義在這裡、只在這裡';

/** 從 MACHINES.md 抽出已定義的執行者名字；抽不到就讓這題紅，不要默默放行。 */
function definedLabels() {
  const text = fs.readFileSync(machinesFile, 'utf8');
  const at = text.indexOf(LABEL_TABLE_ANCHOR);
  assert.ok(at >= 0, `MACHINES.md 找不到執行者標籤定義表的開頭（「${LABEL_TABLE_ANCHOR}」）：抽不到名單就不能判標籤合不合法`);
  const labels = [];
  for (const line of text.slice(at).split('\n')) {
    if (!line.startsWith('|')) {
      if (labels.length) break;
      continue;
    }
    const first = line.split('|')[1].trim();
    if (!first || first.startsWith('---') || first === '標籤') continue;
    labels.push(first);
  }
  assert.ok(labels.length >= 2, `MACHINES.md 的執行者標籤表只抽到 ${labels.length} 個名字：表的形狀變了`);
  return labels;
}

/** 把資料攤平成一條一筆，順便擋掉編號跳號與重複。 */
function allRules(data) {
  assert.ok(Array.isArray(data.sections) && data.sections.length > 0, 'rules.json 沒有任何小節');
  const seen = new Set();
  const rules = [];
  for (const section of data.sections) {
    assert.ok(/^[A-Z]$/u.test(section.letter), `小節代號「${section.letter}」不是單一個大寫英文字母`);
    assert.ok(Array.isArray(section.rules), `小節 ${section.letter} 沒有規矩清單`);
    section.rules.forEach((rule, i) => {
      const id = `${section.letter}${rule.n}`;
      assert.equal(rule.n, i + 1, `${id} 的編號跳號了：同一節裡要從 1 開始連號`);
      assert.ok(!seen.has(id), `條號 ${id} 重複了`);
      seen.add(id);
      assert.ok(typeof rule.text === 'string' && rule.text.trim() !== '', `${id} 沒有正文`);
      assert.ok(typeof rule.tag === 'string' && rule.tag.trim() !== '', `${id} 沒有執行者標籤`);
      rules.push({ id, text: rule.text, tag: rule.tag });
    });
  }
  assert.ok(
    rules.length >= MIN_RULES,
    `rules.json 只找到 ${rules.length} 條規矩（至少要 ${MIN_RULES} 條）：資料整份變形的話字數會算成零、這題就變成永遠綠的空包彈`,
  );
  return rules;
}

test('規矩正文不超過 3,000 字（標題、條號、句尾標籤不算）', () => {
  const rules = allRules(read());
  const count = rules.reduce((n, r) => n + Array.from(r.text.replace(/\s+/g, '')).length, 0);
  assert.ok(
    count <= LIMIT,
    `規矩正文現在 ${count} 字（${rules.length} 條），上限 ${LIMIT}：加一條要先砍一條`,
  );
});

test('每條規矩的執行者標籤都以一個已定義的名字開頭', () => {
  const labels = definedLabels();
  for (const rule of allRules(read())) {
    assert.ok(
      labels.some((l) => rule.tag.startsWith(l)),
      `${rule.id} 的標籤「${rule.tag}」沒有以已定義的執行者名字開頭（${labels.join('／')}）`,
    );
  }
});

test('RULES.md 與 rules.json 產生的結果逐字元相同（本文是產物、不要手改）', () => {
  const onDisk = fs.readFileSync(outFile, 'utf8');
  assert.equal(
    onDisk,
    build(read()),
    `RULES.md 跟 ${path.basename(dataFile)} 對不上：本文是產物，要改規矩請改資料再跑 node tools/build-rules.js`,
  );
});
