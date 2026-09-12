// 守「專案設定只有一份」：值住在 settings.json，PROJECT-SETTINGS.md 是產物。
//
// 為什麼：每一支機器都要讀專案設定。值若只寫在那份 Markdown 裡，機器得去解讀表格；
// 兩邊各存一份就會漂——案例簿裡「同一條規矩寫在六個地方各漏一項」是有代價的實例。
//
// 守得到的：
//   ①PROJECT-SETTINGS.md 與重新產生的結果逐字元相同（手改就紅）；
//   ②每個會被輸出的欄位都合契約（單行、非空、無空字元），並且編成字面文字；
//   ③機器啟用狀態只能填約定的那三種；
//   ④啟用表裡每一支機器標的規矩條號都真的存在（機器與規矩兩份不可以各指各的）。
//
// ⚠️ 守不到的：欄位填的值對不對（填了「未設定」以外的字不代表那台機器真的裝好）、
//    「已啟用」是不是真的啟用（那要靠人去驗，驗過才把日期填上）、
//    以及機器索引 MACHINES.md 與這張啟用表有沒有漏對——那兩份的表是不同軸（一份按規矩條號、
//    一份按機器），我試過拿名字互比，結果是拿標籤定義表去比機器名，屬於誤判，已撤掉。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build, read, outFile, STATES } = require('../tools/build-settings.js');
const { read: readRules } = require('../tools/build-rules.js');

test('PROJECT-SETTINGS.md 與 settings.json 產生的結果逐字元相同（設定說明是產物、不要手改）', () => {
  assert.equal(
    fs.readFileSync(outFile, 'utf8'),
    build(read()),
    'PROJECT-SETTINGS.md 跟 settings.json 對不上：那份說明是產物，要改請改 settings.json，再跑 node tools/build-settings.js',
  );
});

test('啟用狀態只能填約定的那三種', () => {
  for (const machine of read().machines) {
    assert.ok(
      STATES.includes(machine.state),
      `機器「${machine.name}」的狀態是「${machine.state}」，不在 ${STATES.join('／')} 裡`,
    );
  }
});

test('啟用表裡每一支機器標的規矩條號都存在', () => {
  const ids = [];
  for (const section of readRules().sections) {
    for (const rule of section.rules) ids.push(`${section.letter}${rule.n}`);
  }
  for (const machine of read().machines) {
    const cited = machine.rules.split('、').map((x) => x.trim()).filter(Boolean);
    assert.ok(cited.length > 0, `機器「${machine.name}」沒有標任何規矩條號`);
    for (const id of cited) {
      assert.ok(ids.includes(id), `機器「${machine.name}」標了不存在的條號 ${id}`);
    }
  }
});
