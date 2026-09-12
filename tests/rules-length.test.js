// 守「本文一頁」這條：RULES.md 的**規矩正文**去掉空白後不得超過 3,000 字。
//
// 裁示者 2026-09-12 先定「一頁，約三千字」，同日再裁：**只數規矩本身**——
// 節標題、開頭那句指路、條號（A1、B2…）、句尾的執行者標籤都不算，
// 因為那些是標示，不是規矩；讓標示去吃規矩的配額，會逼人把規矩壓到變形
// （已實際發生過一次：為了省幾個字砍掉一條規矩的適用範圍，意思就變了）。
//
// 算的是「字元數」：中文一字一個、英文一個字母一個；不算空白與換行。
//
// ⚠️ 這一題連四輪被獨立審查者繞過去，每一次都是同一個病根：
//    **我先挑出「長得對的行」再檢查，長得不對的就被默默跳過。**
//    被打穿的順序是：換成星號 → 換成有序清單 → 把條號縮排 → 條號後改用 Tab 或
//    不換行空白 → 在行首加上引言記號把條號推到第七個字以後。前四次我都用
//    「再補一種寫法」去堵，每一次都撐不到下一輪；第五次改用「量條號的位置」，
//    結果門檻本身又成了新的列舉。
//
//    **所以這一版改判結構，不判長相**：這份檔案的形狀就是「標題 ＋ 規矩」。
//    第一個小節標題以後，每一行不是小節標題就必須是合規的規矩行，沒有第三種；
//    另外，條號不管出現在哪一行，那一行都必須是合規的規矩行。
//    引言記號、原始 HTML、任何項目符號、任何空白都不必再列舉——它們全都不是
//    「小節標題」也不是「合規規矩行」，一律紅。
//    ⚠️ 代價要照實說，而且不要說大：真正的限制只有兩個——**小節裡不收散文**、
//    **規矩行的寫法固定**。合規規矩行的句子裡提到別條的條號**不會紅**
//    （上一版的註解寫成「會紅」，獨立審查者實測推翻）。
//
// 一共守六件，少一件它就會變成永遠綠的空包彈：
//   ①規矩正文的字數上限；
//   ②第一個小節標題以後，只准小節標題與合規的規矩行；
//   ③帶條號的行一律要是合規的規矩行（含標題與第一個小節標題以前那段）；
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
const RULE_LINE = /^- ([A-Z]\d+) (.+)$/u;
// 條號本身（出現在哪一行都算數）。
// ⚠️ 前後不可以貼著別的拉丁字母，否則像 UTF8 這種字會被誤判成條號、變成看得見的假紅。
const RULE_ID = /(?<![A-Za-z])[A-Z]\d+(?![A-Za-z])/u;
// 小節標題。⚠️ 井號最多六個——七個以上在 Markdown 裡根本不是標題、會畫成普通段落，
//    放它過去等於開一個「不計字的普通段落」後門（獨立審查者實測過）。
const SECTION_HEADING = /^#{2,6} \S/u;
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
  let inSections = false;
  for (const line of text.split('\n')) {
    const m = RULE_LINE.exec(line);
    if (!m) {
      // ⚠️ 這一關要在「是不是標題」之前判：不然把條號藏進標題就繞過去了。
      assert.ok(
        !RULE_ID.test(line),
        `這一行帶了條號、卻不是行首「- 條號 內容」的寫法，字數就不會算到它：${line.slice(0, 40)}`,
      );
      if (SECTION_HEADING.test(line)) {
        inSections = true;
        continue;
      }
      assert.ok(
        !inSections || line.trim() === '',
        `小節裡出現了既不是小節標題、也不是規矩的一行；這份檔案只放標題與規矩：${line.slice(0, 40)}`,
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
