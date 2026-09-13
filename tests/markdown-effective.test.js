// 守「哪一段文字算生效」那一支（r2 Medium③、r4 Medium②）。四個消費端（待裁清單、協作欄位閘、結論聯集閘、範本小標）都用它。
// 守得到的：程式碼圍欄（含長度規則、開頭行後面的字整行屬於圍欄）、引用區塊（含懶續行）裡的字不算生效；沒關閉的圍欄一路到底；
//   HTML 註解不解讀、只偵測：圍欄外、行內程式碼外的「<!--」回行號；行內程式碼只在整段每行都配得完時才扣掉。
// ⚠️ 守不到的：縮排式程式碼區塊、HTML 區塊、清單裡縮排四格以上的圍欄、引用裡的圍欄、表格儲存格、行內 HTML 標籤裡的反引號
//   （兩個方向都可能錯，所以各消費端另要求固定形狀）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { effectiveLines, effectiveText, htmlCommentLine } = require('../tools/markdown-effective.js');

test('圍欄、引用（含懶續行）裡的字不算生效；空行結束引用', () => {
  const md = ['a', '```', '圍欄裡', '```', '> 引用', '懶續行也是引用', '', '空行之後回到最外層', '~~~md', '波浪號圍欄', '~~~', 'b'].join('\n');
  assert.deepEqual(effectiveLines(md).filter(Boolean), ['a', '空行之後回到最外層', 'b']);
  assert.equal(effectiveText('前\n```\n中\n```\n後'), '前\n後', 'effectiveText 就是接起來');
});

test('圍欄的關閉行要同一種符號、長度不短於開頭：三個反引號關不掉四個反引號開的', () => {
  const md = ['````md', '範例', '```', '### 小標', '````', '外面'].join('\n');
  assert.deepEqual(effectiveLines(md).filter(Boolean), ['外面'], '小標在四反引號的圍欄裡，三個反引號那行不是關閉');
  assert.deepEqual(effectiveLines('```\n~~~\n裡面\n```\n外').filter(Boolean), ['外'], '波浪號關不掉反引號');
  assert.deepEqual(effectiveLines('```\n沒關閉\n到底').filter(Boolean), [], '沒關閉就一路到底');
  assert.deepEqual(effectiveLines('```\n裡\n``` 後面有字\n仍在裡\n```\n外').filter(Boolean), ['外'], '關閉行後面不准有字');
});

test('r4 反例：圍欄開頭行後面的「<!--」屬於圍欄，不可以改寫外層結構（兩種符號、兩個方向）', () => {
  for (const f of ['```', '~~~']) {
    const hideExample = [`${f}md <!--`, 'code', f, `${f}md`, '-->', '欄位', f].join('\n');
    assert.deepEqual(effectiveLines(hideExample).filter(Boolean), [], `${f}：第二段圍欄裡的「欄位」是範例，不可以被搬成生效文字`);
    assert.equal(htmlCommentLine(hideExample), 0, `${f}：圍欄開頭行與圍欄裡的註解記號都不算註解`);
    const swallow = [`${f}md <!--`, 'code', f, '🤖 壞標頭'].join('\n');
    assert.deepEqual(effectiveLines(swallow), ['🤖 壞標頭'], `${f}：圍欄關掉之後看得見的那一行不可以被吞掉`);
  }
});

test('HTML 註解不解讀：生效文字照原文保留，偵測回第一個註解開頭的行號', () => {
  assert.deepEqual(effectiveLines('a\n<!-- 藏 -->\nb'), ['a', '<!-- 藏 -->', 'b'], '不剝＝不猜');
  assert.equal(htmlCommentLine('a\n<!-- 藏 -->\nb'), 2);
  assert.equal(htmlCommentLine('a\n\n前 <!-- 中 --> 後'), 3, '行內的也算');
  assert.equal(htmlCommentLine('<!--\n欄位\n沒關閉'), 1, '沒關閉的也算');
  assert.equal(htmlCommentLine('只有收尾 -->\n'), 0, '只有「-->」不是註解（畫面上看得見）');
  assert.equal(htmlCommentLine('a\n```\n<!-- 範例 -->\n```\nb'), 0, '圍欄裡的是程式碼');
  assert.equal(htmlCommentLine(['```md', '<!--', '```', '-->', '```', '欄位', '```'].join('\n')), 0, 'r3 交錯反例：記號全在圍欄裡');
  assert.equal(htmlCommentLine(''), 0);
  assert.equal(htmlCommentLine(null), 0);
});

test('行內程式碼裡提到「<!--」是正常寫法，不算註解；配不完的段落整段照原文找（寧可多報）', () => {
  assert.equal(htmlCommentLine('註解開頭 `<!--` 沒關，後面 `-->` 也是記號'), 0, '單反引號');
  assert.equal(htmlCommentLine('雙反引號 ``a ` <!-- b`` 也是'), 0, '反引號串要等長才配對');
  assert.equal(htmlCommentLine('`a` <!-- 在外面 --> `b`'), 1, '行內程式碼之間的註解仍算');
  // 跨行配對：前一行多一個反引號，平台會把它跟下一行配成一對，註解就露在外面
  assert.equal(htmlCommentLine('a ` 多一個\n`<!-- x -->` b'), 2, '同一段有配不完的反引號＝不扣行內程式碼');
  assert.equal(htmlCommentLine('a ` 多一個\n\n`<!-- x -->` b'), 0, '空行隔開就是另一段，各自配');
  assert.equal(htmlCommentLine('\\`<!-- x -->`'), 1, '緊貼反斜線的反引號不當開頭＝整段照原文找');
});
