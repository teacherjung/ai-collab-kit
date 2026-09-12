// 守「本文一頁」這條：RULES.md 的**規矩正文**去掉空白後不得超過 3,000 字。
//
// 裁示者 2026-09-12 先定「一頁，約三千字」，同日再裁：**只數規矩本身**——
// 節標題、開頭那句指路、條號（甲1、乙2…）、句尾的執行者標籤都不算，
// 因為那些是標示，不是規矩；讓標示去吃規矩的配額，會逼人把規矩壓到變形
// （已實際發生過一次：為了省幾個字砍掉一條規矩的適用範圍，意思就變了）。
//
// 算的是「字元數」：中文一字一個、英文一個字母一個；不算空白與換行。
//
// ⚠️ 這一題連三輪被獨立審查者證明可以繞過去，三次都是同一個病根：
//    **我用「挑出長得對的行」來收集，長得不對的就被默默跳過**——換個項目符號、換成
//    有序清單、把條號縮排兩格、條號後面改用 Tab 或不換行空白，那一條就整行不算，
//    正文五千多字照樣綠。前兩次我都用「再補一種寫法」去堵，兩次都撐不到下一輪。
//    這一版不再列舉寫法：**條號只要落在行首前幾個字內，就算它想當一條規矩，
//    格式不合就直接紅**。標籤同理，從「包含已定義的名字」收成「要以它開頭」，
//    堵掉「假考題」「其實是靠自覺」這種混進來的假名字。
//
// 一共守六件，少一件它就會變成永遠綠的空包彈：
//   ①規矩正文的字數上限；
//   ②每一個清單項目都要是合規的規矩行（不分項目符號的種類、不分有沒有縮排）；
//   ③任何「像規矩」的行（條號落在行首前幾個字內，不管前面墊了什麼）也一樣，不合格就紅；
//   ④每條都要有句尾標籤，而且不可以是空的；
//   ⑤標籤要**以一個已定義的執行者名字開頭**；
//   ⑥那份定義的正本在 MACHINES.md，這裡跟它對帳，兩邊不可以各寫各的。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LIMIT = 3000;
// 下限只是「這檔還是一份規矩清單」的地板，不是實際條數（實際條數會變，寫死會漂）。
const MIN_RULES = 20;
const root = path.join(__dirname, '..');
const rulesFile = path.join(root, 'RULES.md');
const machinesFile = path.join(root, 'MACHINES.md');

// 合規的規矩行：行首就是「- 條號 內容」，沒有縮排、沒有別種項目符號。
const RULE_LINE = /^- ([甲乙丙丁戊己庚辛壬癸子]\d+) (.+)$/u;
// 任何一種項目符號（含有序清單的各種寫法），含縮排。
const ANY_LIST_ITEM = /^\s*(?:[-*+•]|[（(]?\d+[.)、）])\s/u;
// 條號本身。
const RULE_ID = /[甲乙丙丁戊己庚辛壬癸子]\d+/u;
// 條號出現在「開頭附近」＝這一行是想當一條規矩。
// ⚠️ 這裡刻意**不列舉**項目符號的種類：列舉永遠補不完（已經被有序清單、縮排、
//    Tab、不換行空白各打穿一次）。改成量位置——不管前面墊了什麼符號或哪一種空白，
//    條號只要落在前幾個字內就算「想當規矩」，寫法不合就紅。
//    本文的規矩不互相用條號指涉（子3 也要求指題用關鍵字不用序數），所以句中引用
//    不會誤判；真要在句中提到某一條，那一條的條號也不會落在開頭這幾個字裡。
const RULE_ID_NEAR_START = 6;
// 句尾標籤：全形括號，裡面至少一個字（空括號不算標籤）。
const TAG_AT_END = /（([^（）]+)）$/u;
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

/** 逐行挑出規矩；「像規矩卻寫得不合格」的行一律報錯，不准默默跳過。 */
function ruleBodies(text, labels) {
  const bodies = [];
  for (const line of text.split('\n')) {
    const m = RULE_LINE.exec(line);
    if (!m) {
      const hit = RULE_ID.exec(line.replace(/^\s+/u, ''));
      const looksLikeRule = ANY_LIST_ITEM.test(line) || (hit !== null && hit.index <= RULE_ID_NEAR_START);
      assert.ok(
        !looksLikeRule,
        `這一行看起來是規矩、卻不是行首「- 條號 內容」的寫法，字數就不會算到它：${line.slice(0, 40)}`,
      );
      continue;
    }
    const body = m[2];
    const tag = TAG_AT_END.exec(body);
    assert.ok(tag, `${m[1]} 少了句尾的執行者標籤，或標籤是空的：${body.slice(-24)}`);
    assert.ok(
      labels.some((l) => tag[1].startsWith(l)),
      `${m[1]} 的標籤「${tag[1]}」沒有以已定義的執行者名字開頭（${labels.join('／')}）`,
    );
    bodies.push(body.replace(TAG_AT_END, ''));
  }
  assert.ok(
    bodies.length >= MIN_RULES,
    `RULES.md 只找到 ${bodies.length} 條規矩（至少要 ${MIN_RULES} 條）：格式整份變了的話字數會算成零、這題就變成永遠綠的空包彈`,
  );
  return bodies;
}

test('規矩正文不超過 3,000 字（標題、條號、句尾標籤不算）', () => {
  const labels = definedLabels();
  const bodies = ruleBodies(fs.readFileSync(rulesFile, 'utf8'), labels);
  const count = bodies.reduce((n, b) => n + Array.from(b.replace(/\s+/g, '')).length, 0);
  assert.ok(
    count <= LIMIT,
    `規矩正文現在 ${count} 字（${bodies.length} 條），上限 ${LIMIT}：加一條要先砍一條`,
  );
});
