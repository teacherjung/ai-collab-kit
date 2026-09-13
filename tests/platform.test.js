// 守平台介面（規矩 E5、H1）。
//
// 為什麼有這一層：原專案七支閘直接呼叫某一個平台的指令列工具，合計三千多行。實際量過，
// 它們只用到平台的九個動作。所以套件定九個問題與答案形狀，各專案自己填一條指令去問。
//
// 守得到的：
//   ①沒登記的動作被問到＝丟錯，**絕不回空答案**——空陣列會讓「沒有未撤銷的阻擋」「沒有別支疊在上面」
//     這種判斷靜靜變成通過（規矩 E5）；
//   ②指令起不來、被訊號殺掉、退出碼非零、印出來不是 JSON＝丟錯；
//   ③答案形狀不合就丟錯：少欄位、型別不對、單行欄位裡有換行或空白字串、**多出沒約定的欄位**；
//   ④指令樣板沒用到它該用的參數＝丟錯（那條指令問的不是我要問的那一支）；參數沒給、給了不吃的也丟錯；
//   ⑤動作清單只有一份正本：設定產生器照它排版，登記了清單外的動作就紅。
//
// ⚠️ 守不到的：**答案是不是真的**。這一層只驗形狀；翻譯寫錯、平台騙人，都擋不住——
//    原專案那些閘同樣只能相信平台回的東西。也不驗那條指令有沒有副作用。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ask, missingOperations, runCommand, OPERATIONS, PlatformError, LINE_BREAK, UNSET } = require('../tools/platform.js');
const { read: readSettings } = require('../tools/settings-data.js');
const { build: buildSettings } = require('../tools/build-settings.js');

const NUL = '\u0000';

/** 一份把九個動作都登記好的設定；每個動作回一筆合格的答案。 */
const GOOD = {
  change: { id: '7', title: '標題', body: '說明\n可以多行', baseBranch: 'main', headBranch: 'topic', headSha: 'abc123', state: 'OPEN', isDraft: false, isCrossRepo: false, author: 'someone' },
  openChanges: [{ id: '7', baseBranch: 'main', headBranch: 'topic', headSha: 'abc123', isDraft: false, author: 'someone' }],
  comments: [{ id: 'c1', author: 'someone', body: '通過', createdAt: '2026-09-13T00:00:00Z' }],
  changedFiles: [{ path: 'a.js', status: 'modified' }],
  checks: [{ name: '三關', status: 'completed', conclusion: 'success' }],
  requiredChecks: [{ name: '三關' }],
  branchSha: { sha: 'abc123' },
};

/** 把一個答案包成「印出 JSON 的指令」。 */
const emit = (value) => ['node', '-e', 'process.stdout.write(process.argv[1])', JSON.stringify(value)];

function settingsWith(operations, name = '測試平台') {
  return { platform: { name, operations } };
}
function allRegistered(overrides = {}) {
  const ops = {};
  for (const [name, op] of Object.entries(OPERATIONS)) {
    if (op.kind === 'action') ops[name] = ['node', '-e', 'void 0', '{change}'];
    else ops[name] = [...emit(GOOD[name]), ...op.params.map((p) => `{${p}}`)];
  }
  return settingsWith({ ...ops, ...overrides });
}
const ARGS = { change: '7', sha: 'abc123', branch: 'main' };
const argsFor = (name) => Object.fromEntries(OPERATIONS[name].params.map((p) => [p, ARGS[p]]));

test('九個動作都問得到，而且答案就是登記的指令印出來的東西', () => {
  const settings = allRegistered();
  for (const [name, op] of Object.entries(OPERATIONS)) {
    const got = ask(name, argsFor(name), { settings });
    if (op.kind === 'action') assert.equal(got, null, `${name} 是動作，不該有答案`);
    else assert.deepEqual(got, GOOD[name], `${name} 的答案對不上`);
  }
});

test('沒登記的動作＝丟錯，絕不回一個空答案', () => {
  for (const bad of [undefined, [], [UNSET], '未設定', null]) {
    const settings = allRegistered({ comments: bad });
    assert.throws(() => ask('comments', { change: '7' }, { settings }), PlatformError, JSON.stringify(bad));
  }
  // ⚠️ 這一題的重點：不是「有沒有丟錯」，是**不可以回空陣列**。
  // 回空陣列的話，「沒有未撤銷的阻擋」會變成真，閘就靜靜放行。
  let returned = 'no-return';
  try { returned = ask('comments', { change: '7' }, { settings: settingsWith({}) }); } catch { /* 預期 */ }
  assert.equal(returned, 'no-return', '沒登記的時候絕對不可以有回傳值');
});

test('本倉庫現在一個動作都沒登記，missingOperations 要照實說九個', () => {
  assert.deepEqual(missingOperations(readSettings()), Object.keys(OPERATIONS));
  assert.equal(missingOperations(allRegistered()).length, 0);
});

test('指令起不來、被殺掉、退非零、印的不是 JSON：全部丟錯', () => {
  const cases = [
    ['起不來', ['/no/such/platform-binary']],
    ['被訊號殺掉', ['node', '-e', 'process.kill(process.pid,"SIGKILL")']],
    // ⚠️ 這一格要印出**合格的 JSON** 再退非零，不然是「不是 JSON」那道先擋下來，
    //    退出碼那道檢查就沒被考到（突變驗過：原本寫成什麼都不印，拿掉退出碼檢查仍然全綠）。
    ['退非零但印出合格的答案', ['node', '-e', 'process.stdout.write("[]"); process.exit(3)']],
    ['印的不是 JSON', ['node', '-e', 'process.stdout.write("not json")']],
    ['印的是 JSON 但不是陣列', ['node', '-e', 'process.stdout.write("{}")']],
  ];
  for (const [name, cmd] of cases) {
    const settings = allRegistered({ comments: [...cmd, '{change}'] });
    assert.throws(() => ask('comments', { change: '7' }, { settings }), PlatformError, name);
  }
});

test('答案形狀不合就丟錯：少欄位、型別不對、單行欄位有換行、空字串、多出沒約定的欄位', () => {
  const bad = [
    ['少欄位', [{ id: 'c1', author: 'a', body: 'b' }]],
    ['型別不對（是非值給了字串）', [{ ...GOOD.openChanges[0], isDraft: 'false' }]],
    ['單行欄位有換行', [{ ...GOOD.comments[0], author: '前\n後' }]],
    ['單行欄位是空的', [{ ...GOOD.comments[0], id: '   ' }]],
    ['多出沒約定的欄位', [{ ...GOOD.comments[0], extra: '多的' }]],
    ['整筆不是物件', ['字串']],
    ['整筆是 null', [null]],
  ];
  for (const [name, value] of bad) {
    const op = name.includes('是非值') ? 'openChanges' : 'comments';
    const settings = allRegistered({ [op]: [...emit(value), ...OPERATIONS[op].params.map((p) => `{${p}}`)] });
    assert.throws(() => ask(op, argsFor(op), { settings }), PlatformError, name);
  }
});

test('可以多行的欄位真的允許多行與空字串（不要把說明欄誤殺）', () => {
  const value = [{ ...GOOD.comments[0], body: '' }, { ...GOOD.comments[0], body: '一\n二\n三' }];
  const settings = allRegistered({ comments: [...emit(value), '{change}'] });
  assert.deepEqual(ask('comments', { change: '7' }, { settings }), value);
});

test('還沒有結論的檢查場次：conclusion 可以是 null，但不可以是別的型別', () => {
  const pending = [{ name: '三關', status: 'in_progress', conclusion: null }];
  assert.deepEqual(ask('checks', { sha: 'abc' }, { settings: allRegistered({ checks: [...emit(pending), '{sha}'] }) }), pending);
  const wrong = [{ name: '三關', status: 'in_progress', conclusion: 7 }];
  assert.throws(() => ask('checks', { sha: 'abc' }, { settings: allRegistered({ checks: [...emit(wrong), '{sha}'] }) }), PlatformError);
});

test('指令樣板沒用到它該用的參數＝丟錯（那條指令問的不是我要問的那一支）', () => {
  const settings = allRegistered({ comments: emit(GOOD.comments) });   // 少了 {change}
  assert.throws(() => ask('comments', { change: '7' }, { settings }), /沒有用到/u);
});

test('參數沒給、給了不吃的參數、動作名字不存在：都丟錯', () => {
  const settings = allRegistered();
  assert.throws(() => ask('comments', {}, { settings }), /少了參數/u);
  assert.throws(() => ask('comments', { change: '' }, { settings }), /少了參數/u);
  assert.throws(() => ask('comments', { change: '7', sha: 'x' }, { settings }), /不吃參數/u);
  assert.throws(() => ask('沒這個動作', {}, { settings }), PlatformError);
});

test('參數真的被換進指令裡（不是換了個地方寫死）', () => {
  const seen = [];
  const settings = allRegistered();
  ask('comments', { change: '12345' }, { settings, run: (cmd, args) => { seen.push([cmd, ...args]); return { status: 0, stdout: '[]', stderr: '' }; } });
  assert.ok(seen[0].includes('12345'), `指令裡應該出現變更編號：${JSON.stringify(seen[0])}`);
  assert.ok(!seen[0].some((x) => x.includes('{change}')), '記號要被換掉');
});

test('預設執行器：起不來回 status null，不是 0', () => {
  assert.equal(runCommand('/no/such/platform-binary', []).status, null);
  assert.equal(runCommand(process.execPath, ['-e', 'process.exit(5)']).status, 5);
});

test('動作清單只有一份正本：設定產生器照它排版，登記了清單外的動作就紅', () => {
  const data = readSettings();
  const printed = buildSettings(data);
  for (const [name, op] of Object.entries(OPERATIONS)) {
    assert.ok(printed.includes(name), `設定說明裡找不到動作 ${name}`);
  }
  const withUnknown = JSON.parse(JSON.stringify(data));
  withUnknown.platform.operations.somethingElse = ['x'];
  assert.throws(() => buildSettings(withUnknown), /沒有定義的動作/u);
});

test('換行那一組跟資料契約那一份逐字元相同（兩邊不可以各自漂）', () => {
  // 平台層刻意不 require 案例簿的產生器，所以這一題替兩邊對帳。
  const { checkPlain } = require('../tools/build-casebook-index.js');
  const breakers = ['\n', '\r', '\u0085', '\u2028', '\u2029', '\v', '\f'];
  for (const ch of breakers) {
    assert.ok(LINE_BREAK.test(`前${ch}後`), `平台層漏了 ${JSON.stringify(ch)}`);
    assert.throws(() => checkPlain(`前${ch}後`, '對帳'), undefined, `資料契約漏了 ${JSON.stringify(ch)}`);
  }
  for (const ch of ['a', '中', ' ', NUL]) {
    assert.equal(LINE_BREAK.test(`前${ch}後`), false, `${JSON.stringify(ch)} 不該被算成換行`);
  }
});
