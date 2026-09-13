// 守「專案設定只有一份」：值住在 settings.json，PROJECT-SETTINGS.md 是產物。
//
// 為什麼：每一支機器都要讀專案設定。值若只寫在那份 Markdown 裡，機器得去解讀表格；
// 兩邊各存一份就會漂——案例簿裡「同一條規矩寫在六個地方各漏一項」是有代價的實例。
//
// 守得到的：
//   ①PROJECT-SETTINGS.md 與重新產生的結果逐字元相同（手改就紅）；
//   ②每個會被輸出的欄位都合契約（單行、非空、無空字元），並且編成字面文字；
//   ③機器啟用狀態只能填約定的那三種；
//   ④啟用表裡每一支機器標的規矩條號都真的存在（機器與規矩兩份不可以各指各的）；
//   ⑤**標籤與登記不可以互相矛盾**：本文標「靠自覺」的條號，不可以同時有一支「已啟用」的機器登記在它名下。
//     2026-09-13 稽核抓到三條（A1、A5、K1）：本文說沒有機器、登記表說已啟用。收法是兩邊各退一步——
//     合併指令不讀合併預授權，所以它只登記 H1；設定產生器守的是「值只有一份」，所以改登記 K1；
//     而 K1 確實有機器守（三份產物逐字元比對），所以標籤照實改掉，不再寫「靠自覺」。
//   ⑥本文與機器索引指名的每一份範本都要真的在，而且帶著它自己的固定小標；
//   ⑦每一支工具都要有同名的考題檔。2026-09-13 稽核抓到：整支考題檔改名或刪掉，全卷照樣退 0——
//     沒有任何東西在數考題。這一題就是那個金絲雀。
//
// ⚠️ 守不到的：欄位填的值對不對（填了「未設定」以外的字不代表那台機器真的裝好）、
//    「已啟用」是不是真的啟用（那要靠人去驗，驗過才把日期填上）、
//    以及機器索引 MACHINES.md 與這張啟用表有沒有漏對——那兩份的表是不同軸（一份按規矩條號、
//    一份按機器），我試過拿名字互比，結果是拿標籤定義表去比機器名，屬於誤判，已撤掉。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

test('本文標「靠自覺」的條號，不可以同時有一支「已啟用」的機器登記在它名下', () => {
  const tags = new Map();
  for (const section of readRules().sections) {
    for (const rule of section.rules) tags.set(`${section.letter}${rule.n}`, rule.tag);
  }
  for (const machine of read().machines) {
    if (machine.state !== '已啟用') continue;
    for (const id of machine.rules.split('、').map((x) => x.trim()).filter(Boolean)) {
      assert.notEqual(
        tags.get(id),
        '靠自覺',
        `機器「${machine.name}」登記成已啟用、標的是 ${id}，但本文說 ${id} 靠自覺——兩份說法必須擇一改正，不可以並存`,
      );
    }
  }
});

test('本文與機器索引指名的每一份範本都在，而且帶著自己的固定小標', () => {
  const root = path.join(__dirname, '..');
  const machines = fs.readFileSync(path.join(root, 'MACHINES.md'), 'utf8');
  const cited = [...machines.matchAll(/`(templates\/[a-z0-9-]+\.(?:md|json))`/gu)].map((m) => m[1]);
  assert.ok(cited.length >= 5, `機器索引只指到 ${cited.length} 份範本：那張表的形狀變了`);
  const onDisk = fs.readdirSync(path.join(root, 'templates')).filter((f) => /\.(md|json)$/u.test(f)).map((f) => `templates/${f}`);
  for (const file of new Set(cited)) {
    assert.ok(onDisk.includes(file), `機器索引指到 ${file}，但檔案不在`);
  }
  for (const file of onDisk) {
    assert.ok(cited.includes(file), `${file} 在倉庫裡，但機器索引那張表沒指到它——沒人指的範本會靜靜爛掉`);
  }
  // 固定小標是規矩 E1、G3 指名的字串：範本要真的吐得出來，改名就紅
  const must = [['templates/pr-body.md', '### 複審後掃'], ['templates/scan-record.md', '掃描時序']];
  for (const [file, heading] of must) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(text.includes(heading), `${file} 裡找不到固定小標「${heading}」`);
  }
});

test('每一支工具都有同名的考題檔（考題檔被刪掉或改名要有人發現）', () => {
  const root = path.join(__dirname, '..');
  const toolsDir = path.join(root, 'tools');
  const gatesDir = path.join(toolsDir, 'gates');
  const tools = fs.readdirSync(toolsDir).filter((f) => f.endsWith('.js')).sort();
  // 閘住在 tools/gates/，一樣要有同名考題（新增一道閘就一定被數到）
  const gates = fs.existsSync(gatesDir) ? fs.readdirSync(gatesDir).filter((f) => f.endsWith('.js')).sort() : [];
  const tests = new Set(fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')));
  assert.ok(tools.length >= 5, `tools/ 只剩 ${tools.length} 支：這一題自己的前提變了`);
  // 產生器三支共用同一份資料契約，考題另立一支；其餘一支工具對一支考題
  const shared = {
    'build-rules.js': 'rules-length.test.js',
    'build-casebook-index.js': 'casebook.test.js',
    'build-settings.js': 'settings.test.js',
    'settings-data.js': 'settings.test.js',   // 只有一個讀取函式，跟設定產生器同一支考題
  };
  for (const tool of tools) {
    const expected = shared[tool] || tool.replace(/\.js$/u, '.test.js');
    assert.ok(tests.has(expected), `工具 ${tool} 找不到對應的考題檔 ${expected}——被刪掉或改名了嗎`);
  }
  for (const gate of gates) {
    const expected = gate.replace(/\.js$/u, '.test.js');
    assert.ok(tests.has(expected), `閘 gates/${gate} 找不到對應的考題檔 ${expected}——被刪掉或改名了嗎`);
  }
  assert.ok(tests.has('data-contract.test.js'), '資料契約的負向考題不見了');
});
