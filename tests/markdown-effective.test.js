// 守「哪一段文字算生效」那一支（r2 Medium③）。三個消費端（待裁清單、協作欄位閘、範本小標）都用它。
// 守得到的：HTML 註解、程式碼圍欄（含長度規則）、引用區塊（含懶續行）裡的字不算生效；沒關閉的圍欄一路到底。
// ⚠️ 守不到的：縮排式程式碼區塊、HTML 區塊、清單裡的巢狀容器（方向是多留，各消費端另要求固定形狀）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { effectiveLines, effectiveText } = require('../tools/markdown-effective.js');

test('HTML 註解、圍欄、引用（含懶續行）裡的字不算生效；空行結束引用', () => {
  const md = ['a', '<!-- 註解裡 -->', '```', '圍欄裡', '```', '> 引用', '懶續行也是引用', '', '空行之後回到最外層', '~~~md', '波浪號圍欄', '~~~', 'b'].join('\n');
  assert.deepEqual(effectiveLines(md).filter(Boolean), ['a', '空行之後回到最外層', 'b']);
});

test('圍欄的關閉行要同一種符號、長度不短於開頭：三個反引號關不掉四個反引號開的', () => {
  const md = ['````md', '範例', '```', '### 小標', '````', '外面'].join('\n');
  assert.deepEqual(effectiveLines(md).filter(Boolean), ['外面'], '小標在四反引號的圍欄裡，三個反引號那行不是關閉');
  assert.deepEqual(effectiveLines('```\n~~~\n裡面\n```\n外').filter(Boolean), ['外'], '波浪號關不掉反引號');
  assert.deepEqual(effectiveLines('```\n沒關閉\n到底').filter(Boolean), [], '沒關閉就一路到底');
  assert.deepEqual(effectiveLines('```\n裡\n``` 後面有字\n仍在裡\n```\n外').filter(Boolean), ['外'], '關閉行後面不准有字');
});

test('跨行的 HTML 註解也剝掉；effectiveText 就是接起來', () => {
  assert.equal(effectiveText('前\n<!--\n藏\n-->\n後'), '前\n\n後');
});
