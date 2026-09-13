// 守合併指令（規矩 A5、H1；裁示者 2026-09-12 裁「丙′」）。
//
// 守得到的：
//   ①沒有任何一道閘登記成「已啟用」＝不放行（fail-closed）——一支什麼都沒檢查就按合併鍵的
//     指令比沒有這支指令更危險；
//   ②主幹分支名還沒填＝不放行；
//   ③閘照登記的順序跑，**任一道非零就停在那裡**，後面的閘不跑、合併鍵不按；
//   ④全綠才執行合併；合併指令沒登記＝停下來，不自己猜平台怎麼合；
//   ⑤合併指令回非零＝照實說「先查那支變更的狀態再決定，不要重跑」；
//   ⑥**預設執行器**：閘起不來（找不到指令）或被訊號殺掉＝退出碼 2，不是 0——「跑不起來」不等於
//     「檢查過了」。這一格 2026-09-13 稽核前零覆蓋（八題全部注入假執行器），端到端重現過：
//     把不存在的指令登記成已啟用的閘，只要 runCommand 回 0，合併鍵就真的被按下去；
//   ⑦按完合併鍵印的結論，量詞只蓋到這一趟真的跑過的那幾道閘。
//
// ⚠️ 守不到的，照實說：它擋不住「不用這支指令、直接按平台的合併鍵」——要擋那個只有平台級的
//    分支保護。也不驗那幾道閘自己對不對（那是各道閘自己的考題）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeRun, runCommand, UNSET, ENABLED } = require('../tools/merge.js');

function settingsWith(gates, extra = {}) {
  return {
    mainBranch: 'main',
    gates,
    mergeCommand: { command: 'platform', args: ['merge', '{change}'] },
    ...extra,
  };
}

const gate = (name, state = ENABLED) => ({ name, command: 'node', args: [`gates/${name}.js`], state });

/** 記下跑過哪些指令的假執行器；codes 決定第幾次回什麼退出碼。 */
function fakeRunner(codes) {
  const calls = [];
  return {
    calls,
    run(command, args) {
      calls.push([command, ...args].join(' '));
      const code = codes.shift();
      return { code: code === undefined ? 0 : code, output: code ? '假裝壞掉了' : '' };
    },
  };
}

test('沒有任何一道閘啟用就不放行', () => {
  const { run, calls } = fakeRunner([]);
  const result = mergeRun('7', { settings: settingsWith([gate('甲', '未移植')]), run });
  assert.equal(result.code, 2, '零道啟用的閘應該是不放行');
  assert.equal(calls.length, 0, '不放行的時候不該跑任何東西');
  assert.match(result.lines.join('\n'), /沒有任何一道閘/u);
});

test('主幹分支名還沒填就不放行', () => {
  const { run } = fakeRunner([]);
  const result = mergeRun('7', { settings: settingsWith([gate('甲')], { mainBranch: UNSET }), run });
  assert.equal(result.code, 2);
  assert.match(result.lines.join('\n'), /主幹分支名/u);
});

test('沒給變更編號就不放行', () => {
  const { run } = fakeRunner([]);
  assert.equal(mergeRun(undefined, { settings: settingsWith([gate('甲')]), run }).code, 2);
});

test('閘照順序跑，第一道紅就停，後面的閘與合併鍵都不動', () => {
  const { run, calls } = fakeRunner([0, 1]);
  const result = mergeRun('7', { settings: settingsWith([gate('甲'), gate('乙'), gate('丙')]), run });
  assert.equal(result.code, 1);
  assert.deepEqual(calls, ['node gates/甲.js 7', 'node gates/乙.js 7'], '應該停在第二道，第三道與合併都不跑');
  assert.match(result.lines.join('\n'), /擋下來了/u);
});

test('每一道都綠才按合併鍵', () => {
  const { run, calls } = fakeRunner([0, 0]);
  const result = mergeRun('7', { settings: settingsWith([gate('甲'), gate('乙')]), run });
  assert.equal(result.code, 0);
  assert.deepEqual(calls, ['node gates/甲.js 7', 'node gates/乙.js 7', 'platform merge 7']);
});

test('預設執行器：閘起不來＝退出碼 2，不是 0（跑不起來不等於檢查過了）', () => {
  const missing = runCommand('/no/such/gate-binary-for-test', ['x']);
  assert.equal(missing.code, 2, '找不到指令要回 2');
  assert.notEqual(missing.code, 0);
  const killed = runCommand(process.execPath, ['-e', 'process.kill(process.pid, "SIGKILL")']);
  assert.equal(killed.code, 2, '被訊號殺掉要回 2');
  assert.equal(runCommand(process.execPath, ['-e', 'process.exit(3)']).code, 3, '真的退出碼要照傳');
  assert.equal(runCommand(process.execPath, ['-e', 'process.exit(0)']).code, 0);
});

test('端到端：用真的預設執行器跑一道不存在的閘，不放行也不按合併鍵', () => {
  const settings = settingsWith([{ name: '不存在的閘', command: '/no/such/gate-binary-for-test', args: [], state: ENABLED }]);
  const result = mergeRun('7', { settings });   // 不注入 run＝走真的 runCommand
  assert.equal(result.code, 1, '起不來的閘要擋下來');
  assert.match(result.lines.join('\n'), /擋下來了/u);
  assert.doesNotMatch(result.lines.join('\n'), /合併已執行/u);
});

test('按完合併鍵的結論，量詞只蓋這一趟真的跑過的閘', () => {
  const { run } = fakeRunner([0, 0]);
  const result = mergeRun('7', { settings: settingsWith([gate('甲'), gate('乙', '未移植'), gate('丙', '已安裝未啟用')]), run });
  assert.equal(result.code, 0);
  const text = result.lines.join('\n');
  assert.doesNotMatch(text, /每一道閘都綠/u, '不可以用蓋到全體的量詞');
  assert.match(text, /這一趟要跑的 1 道閘都綠/u);
  assert.match(text, /另有 2 道登記了但沒啟用/u);
});

test('沒登記啟用的閘不會被跑，但會被列出來提醒', () => {
  const { run, calls } = fakeRunner([0]);
  const result = mergeRun('7', { settings: settingsWith([gate('甲'), gate('乙', '已安裝未啟用')]), run });
  assert.equal(result.code, 0);
  assert.deepEqual(calls, ['node gates/甲.js 7', 'platform merge 7']);
  assert.match(result.lines.join('\n'), /還沒啟用、這一趟不會跑：乙/u);
});

test('合併指令沒登記就停下來，不自己猜平台怎麼合', () => {
  const { run, calls } = fakeRunner([0]);
  const result = mergeRun('7', {
    settings: settingsWith([gate('甲')], { mergeCommand: { command: UNSET, args: [] } }),
    run,
  });
  assert.equal(result.code, 2);
  assert.deepEqual(calls, ['node gates/甲.js 7'], '閘照跑，但不執行合併');
});

test('合併指令回非零時照實說「先查狀態、不要重跑」', () => {
  const { run } = fakeRunner([0, 1]);
  const result = mergeRun('7', { settings: settingsWith([gate('甲')]), run });
  assert.equal(result.code, 1);
  assert.match(result.lines.join('\n'), /先去查那支變更現在的狀態再決定，不要重跑/u);
});
