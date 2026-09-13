// 守禁區攔截器（規矩 B1）。原專案的禁區＝錢：連建單、試用都不行；規矩書擋不住誤觸，攔截擋得住。
//
// 守得到的：
//   ①輸入拿不到工具名、工具名不合法＝拒絕；②禁區清單沒設＝拒絕（裝了卻沒填比沒裝更危險）；
//   ③動禁區的連接器採白名單制；④逐字拒絕清單；⑤家族網（動詞名詞、名詞動詞、額外樣式），
//     唯讀前綴跳過；駝峰、點、連字號都正規化；連接器前綴不同、工具名相同一起擋；
//   ⑥兩家 AI 的接線範本都呼叫同一支判斷（不抄判斷＝不會漂）；指令入口：壞輸入也拒絕、放行不印。
// ⚠️ 守不到的：只認工具名不看參數；詞表沒列到的動詞或名詞擋不住；沒啟用的那一方等於沒有。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { decide, normalize, cli } = require('../tools/forbidden-tools.js');

const TOOL = path.join(__dirname, '..', 'tools', 'forbidden-tools.js');
const FORBIDDEN = {
  name: '錢', servers: ['broker-x'], allowlist: ['get_account_balances', 'get_watchlist', 'create_alert'],
  // ⚠️ 逐字清單要放一個**家族網抓不到**的名字，不然拿掉逐字清單也照樣被擋、那道檢查等於沒考（突變驗過）
  deny: ['mcp__other__place_order_now', 'mcp__other__harmless_looking_tool'],
  verbs: ['create', 'place', 'submit', 'cancel', 'buy', 'sell', 'transfer'],
  nouns: ['order', 'trade', 'position', 'stock', 'fund'],
  readPrefixes: ['get', 'list', 'search', 'view'],
  patterns: ['(^|_)(withdraw|deposit)(_|$)'],
};

test('①輸入不合法＝拒絕；②清單沒設＝拒絕', () => {
  assert.equal(decide(undefined, FORBIDDEN).deny, true);
  assert.equal(decide(42, FORBIDDEN).deny, true);
  assert.equal(decide('bad name with space', FORBIDDEN).deny, true);
  assert.equal(decide('x'.repeat(201), FORBIDDEN).deny, true);
  for (const bad of [{}, { name: '未設定' }, undefined]) {
    const d = decide('mcp__anything__get_something', bad);
    assert.equal(d.deny, true, JSON.stringify(bad));
    assert.match(d.why, /還沒填/u);
  }
});

test('③動禁區的連接器採白名單制：唯讀名單上的放行、其餘拒絕', () => {
  assert.equal(decide('mcp__broker-x__get_account_balances', FORBIDDEN).deny, false);
  assert.equal(decide('mcp__broker-x__create_alert', FORBIDDEN).deny, false, '名單上明列的准用');
  assert.equal(decide('mcp__broker-x__create_order_instruction', FORBIDDEN).deny, true);
  assert.equal(decide('mcp__broker-x__whats_new_today', FORBIDDEN).deny, true, '不在名單上就拒絕，不管名字多無害');
  assert.equal(decide('mcp__broker-x__get_account_balances__extra', FORBIDDEN).deny, true, '多一段就不是名單上那一個');
});

test('④逐字拒絕清單；⑤家族網與唯讀前綴；駝峰、點、連字號正規化', () => {
  assert.equal(decide('mcp__other__place_order_now', FORBIDDEN).deny, true, '逐字在清單上');
  assert.equal(decide('mcp__other__harmless_looking_tool', FORBIDDEN).deny, true, '逐字在清單上，家族網抓不到它——只有逐字清單擋得住');
  assert.equal(decide('mcp__other__harmless_looking_tool_v2', FORBIDDEN).deny, false, '逐字就是逐字，不做前綴比對');
  // ⚠️ 唯讀前綴只認**開頭**：中段或尾段出現 get 不可以替前面的動詞名詞脫罪（突變驗過：不錨定開頭的話這一個會被放行）
  assert.equal(decide('mcp__any__create_order_get_confirmation', FORBIDDEN).deny, true, '唯讀字在後面不算唯讀');
  for (const t of ['mcp__any__create_order', 'mcp__any__order_create', 'mcp__any__placeOrder', 'mcp__any__submit-trade', 'mcp__any__sell.stock', 'mcp__any__cancel_open_position', 'mcp__any__transfer_funds', 'mcp__any__withdraw_cash']) {
    assert.equal(decide(t, FORBIDDEN).deny, true, `${t} 應該被擋`);
  }
  for (const t of ['mcp__any__get_order', 'mcp__any__list_positions', 'mcp__any__search_stocks', 'mcp__any__view_trade_history', 'mcp__any__summarize_report', 'mcp__any__create_note']) {
    assert.equal(decide(t, FORBIDDEN).deny, false, `${t} 不該被擋`);
  }
  assert.equal(normalize('placeOrderNow'), 'place_order_now');
  assert.equal(normalize('HTTPOrder'), 'http_order');
  assert.equal(normalize('a.b-c'), 'a_b_c');
});

test('⑤連接器前綴不同、工具名相同也一起擋（尾段逐一試）', () => {
  assert.equal(decide('mcp__vendor__sub__create_order', FORBIDDEN).deny, true);
  assert.equal(decide('mcp__vendor__get__create_order', FORBIDDEN).deny, true, '中段的唯讀字不可以替尾段脫罪');
});

test('⑥兩家 AI 的接線範本都呼叫同一支判斷，範本裡不抄判斷', () => {
  for (const f of ['hook-claude.json', 'hook-codex.json']) {
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'templates', f), 'utf8'));
    const cmds = doc.hooks.PreToolUse.flatMap((h) => h.hooks.map((x) => x.command));
    assert.deepEqual(cmds, ['node tools/forbidden-tools.js'], `${f} 要呼叫同一支`);
    assert.ok(!JSON.stringify(doc).includes('python3'), `${f} 不可以自己抄一份判斷`);
  }
});

test('指令入口：壞輸入也拒絕；放行不印任何東西；輸出是鉤子認得的形狀', () => {
  const settings = { forbidden: FORBIDDEN };
  const denied = cli(JSON.stringify({ tool_name: 'mcp__any__create_order' }), settings);
  const parsed = JSON.parse(denied.output);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /錢的絕對邊界/u);
  assert.equal(cli(JSON.stringify({ tool_name: 'mcp__any__get_order' }), settings).output, '', '放行不印');
  assert.equal(JSON.parse(cli('not json', settings).output).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(JSON.parse(cli(JSON.stringify({}), settings).output).hookSpecificOutput.permissionDecision, 'deny');
  // 真的跑一遍：本倉庫的禁區清單未設＝一律拒絕
  const r = spawnSync(process.execPath, [TOOL], { input: JSON.stringify({ tool_name: 'mcp__any__get_order' }), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /還沒填/u);
});
