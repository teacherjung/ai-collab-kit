// 守測試鈕（規矩 B1 的驗收工具；裁示者 2026-09-15 裁「8a」）。攔截器沒裝好、沒信任、或載入就崩的時候，
// 畫面跟「它好好地在擋」一模一樣；唯一的證明是叫一個照清單該擋的工具、看到那一組的拒絕理由。
// 而會動到禁區的真工具一律絕不可以叫來試，所以清單上永久放一個無害的名字，本體＝tools/canary-server.js。
//
// 守得到的：
//   ①它真的掛得起來、只有一個工具、叫了回 pong；跑完工作目錄零新增、標準錯誤是空的；通知不回話；
//     **客戶端拿來決定要不要收這支伺服器的那幾格**也逐格釘住（每一則回覆的 jsonrpc、能力宣告裡的 tools、
//     工具的輸入格式、標準輸入關掉就自己結束）——這幾格壞掉的症狀是「工具從清單上消失」，
//     而這一批最要命的誤判就是把「叫不到」當成「被擋」（預審 2026-09-16）。
//   ②協定版本兩條路各有考題：對方說的是日期形狀就照著回（送 2024-11-05 要回 2024-11-05）、
//     不是就回自己的預設（考題不拿預設值當輸入，免得回聲跟常數分不出來）；ping 方法回空結果。
//   ③裝機說明（四份會跟著搬進專案的檔）裡**每一個**測試鈕名字都跟它真的跑起來自己報的名字一字不差，
//     連兩處登記鍵（Claude 的 .mcp.json 鍵、Codex 的 config.toml 段名）也對；一份檔裡改錯其中一處就紅。
//   ④在一份代表性的禁區清單裡，這個名字**只有逐字拒絕清單擋得住**：不在清單上就放行（對照組），
//     加進清單才拒絕、理由含「在拒絕清單上」。這是⓪要求「挑一個只有這份清單擋的名字」的機器證明。
//   ⑤本體的位元組跟釘的一樣（改一個字元都要重算雜湊）＋原始碼裡沒有出現那幾個取得能力的字串
//     （掃法逐項用真的會那樣寫的程式碼當正對照，證明每一個樣式都拼對了）。
//   ⑥壞掉的一行只丟那一行、不讓整支崩；不認得的方法回錯誤、不認得的工具回 isError；
//     半行還沒收完不會先回話（切成兩段送也組得回來）。
// ⚠️ 守不到的：
//   ⑤的**字串掃描是絆線不是證明**——不寫出那幾個字串一樣做得到（換個寫法就繞開了，預審實測過一種）；
//     真正關門的是位元組釘，而它擋的是「改了沒人發現」的漂移，擋不住有辦法連釘一起改的人（那歸審查）。
//     兩樣都不證明 node 自己做了什麼。
//   ④用的是考題自己的代表性清單，**不是**某個專案的真清單（真清單由那個專案自己的考題釘）。
//   ⑥的切半測試靠一個很短的等待，機器很忙時那一次可能兩段一起到＝沒真的考到切半（前半段的斷言仍成立）。
//   登記在兩家 AI 的設定裡這件事沒有機器看著（設定檔被改、被換成別的程式，靠人核對）。
//   從沒在真的 AI session 裡掛上去驗過——那是搬家第 3 步、要在裁示者自己的機器上做。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');
const { decide } = require('../tools/forbidden-tools.js');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'tools', 'canary-server.js');
/** 完整工具名的唯一字面值：兩家 AI 都叫成 mcp__<伺服器名>__<工具名>。③會拿它跟真的跑出來的名字對。 */
const FULL_NAME = 'mcp__guard_canary__ping';
/** 會跟著搬進專案的四份說明，裡面的名字要跟真的一樣（README 不跟著搬，所以不在這裡釘）。 */
const DOCS = ['templates/canary-install.md', 'tools/guard-copy.js', 'templates/hook-codex-global.json', 'MACHINES.md'];
/** 伺服器的位元組釘（改了本體就要重算；重算的人要負責看過改了什麼）：
 *  node -e "console.log(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('tools/canary-server.js')).digest('hex'))" */
const SERVER_BYTES_SHA256 = '14fd337ed86f758a947e6a157aef1b7f9b5cb778d2cbd5c9e99be5a3b44979d4';

const hello = (protocolVersion) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'kit-test', version: '1' } } });
const HELLO = hello('2025-06-18');
const LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list' };

/**
 * 在一個空的暫存目錄裡真的把它跑起來，餵幾行進去，回它印出來的每一行。
 * 環境刻意給空的：這一支不看環境變數，給空的還能跑＝它不靠任何一個。
 * 有時限：標準輸入關掉還不結束的話要**轉紅**，不可以讓整份考卷卡住（預審 2026-09-16）。
 */
function talk(messages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-canary-'));
  const input = `${messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('\n')}\n`;
  const r = spawnSync(process.execPath, [SERVER], { cwd: dir, input, encoding: 'utf8', env: {}, timeout: 10_000, killSignal: 'SIGKILL' });
  const left = fs.readdirSync(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.signal, null, '標準輸入關掉之後沒有自己結束（被時限殺掉）');
  return { code: r.status, stderr: r.stderr, left, lines: r.stdout.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) };
}

test('①掛得起來、只有一個工具、叫了回 pong；交握那幾格都對；跑完什麼都沒留下', () => {
  const r = talk([HELLO, { jsonrpc: '2.0', method: 'notifications/initialized' }, LIST,
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ping', arguments: {} } }]);
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
  assert.deepEqual(r.left, [], '跑完工作目錄多出了東西');
  assert.equal(r.lines.length, 3, '通知不該回話');
  const [init, list, call] = r.lines;
  // 客戶端拿來決定要不要收這支伺服器的那幾格：任一格壞掉＝工具從清單上消失＝驗收會誤判
  for (const line of r.lines) assert.equal(line.jsonrpc, '2.0', '每一則回覆都要自報 JSON-RPC 2.0');
  assert.equal(typeof init.result.capabilities.tools, 'object', '能力宣告裡要有 tools，否則客戶端不會去問工具清單');
  assert.equal(init.result.serverInfo.name, 'guard_canary');
  assert.equal(list.result.tools.length, 1);
  assert.equal(list.result.tools[0].name, 'ping');
  assert.equal(list.result.tools[0].inputSchema.type, 'object', '工具的輸入格式要是物件，否則客戶端收不下這個工具');
  assert.deepEqual(call.result.content, [{ type: 'text', text: 'pong' }]);
  assert.ok(!call.result.isError);
});

test('②協定版本：日期形狀照著回、不是日期就回預設；ping 回空結果', () => {
  // 刻意不用預設值當輸入：輸入跟期望值同一個數字的話，「照著回」與「不管你說什麼都回預設」分不出來
  const echoed = talk([hello('2024-11-05')]).lines[0];
  assert.equal(echoed.result.protocolVersion, '2024-11-05', '對方說的是合法日期形狀就要照著回');
  const fallback = talk([hello('latest')]).lines[0];
  assert.equal(fallback.result.protocolVersion, '2025-06-18', '不是日期形狀就要回自己的預設');
  const pong = talk([HELLO, { jsonrpc: '2.0', id: 7, method: 'ping' }]).lines[1];
  assert.deepEqual(pong.result, {}, 'ping 要回空結果（客戶端拿它確認連線還活著）');
});

test('③裝機說明裡每一個測試鈕名字，都是它真的跑起來報的名字', () => {
  const [init, list] = talk([HELLO, LIST]).lines;
  const server = init.result.serverInfo.name;
  const live = `mcp__${server}__${list.result.tools[0].name}`;
  assert.equal(live, FULL_NAME);
  // 一份檔裡只要有一處對就過＝改錯其中一處抓不到（預審 2026-09-16）：改成「每一個都要對」
  const looksLikeOurs = /mcp__[A-Za-z0-9_.-]*canary[A-Za-z0-9_.-]*/gu;
  for (const rel of DOCS) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const names = text.match(looksLikeOurs) || [];
    assert.ok(names.length, `${rel} 裡找不到測試鈕的名字`);
    for (const n of names) assert.equal(n, live, `${rel} 裡有一處寫成 ${n}`);
  }
  // 決定工具名的其實是兩處登記鍵（Claude 的 .mcp.json 鍵、Codex 的 config.toml 段名），也要對
  const install = fs.readFileSync(path.join(ROOT, 'templates', 'canary-install.md'), 'utf8');
  assert.ok(install.includes(`"${server}": {`), `.mcp.json 的登記鍵不是 ${server}`);
  assert.ok(install.includes(`[mcp_servers.${server}]`), `config.toml 的段名不是 ${server}`);
});

/** 代表性的禁區清單（考題自己的，不是任何專案的真清單）：動詞名詞、唯讀前綴、額外樣式都填得像真的。 */
const MONEY = {
  name: '錢',
  servers: ['broker-x'],
  allowlist: ['get_account_balances', 'get_watchlist'],
  deny: ['mcp__broker-x__place_order'],
  verbs: ['create', 'place', 'submit', 'cancel', 'buy', 'sell', 'transfer', 'open', 'close', 'update', 'delete'],
  nouns: ['order', 'trade', 'position', 'stock', 'share', 'security', 'securities', 'fund', 'asset'],
  readPrefixes: ['get', 'list', 'search', 'fetch', 'read', 'query', 'view'],
  patterns: ['(^|_)(transfer|withdraw(al)?|deposit|payment|wire)s?(_|$)'],
};

test('④這個名字只有逐字拒絕清單擋得住（不在清單上＝放行的對照組）', () => {
  const without = decide(FULL_NAME, MONEY);
  assert.equal(without.deny, false, `名字不在清單上卻被別的規則擋住了：${without.why}`);
  const withIt = decide(FULL_NAME, { ...MONEY, deny: [...MONEY.deny, FULL_NAME] });
  assert.equal(withIt.deny, true);
  assert.match(withIt.why, /在拒絕清單上/u);
  // 這份夾具不是全放行：同一份清單擋得住家族網裡的（不靠逐字清單那一條）
  assert.equal(decide('mcp__other__submit_order', MONEY).deny, true);
});

/**
 * 「什麼都不做」掃得到的部分：每一項都是在原始碼裡找一段字。
 * 正對照＝真的會那樣寫的一行程式碼，用來證明每一個樣式都拼對了（拼錯的樣式會靜靜失效）。
 */
const NO_SUCH_POWER = [
  ['require(', "const fs = require('node:fs');"],
  ['import ', "import fs from 'node:fs';"],
  ['import(', "await import('node:fs');"],
  ['process.env', 'const home = process.env.HOME;'],
  ['eval(', "eval('1 + 1');"],
  ['new Function', "new Function('return 1')();"],
  ['fetch(', "await fetch('https://example.com');"],
  ['XMLHttpRequest', 'new XMLHttpRequest();'],
  ['process.binding', "process.binding('fs');"],
];

test('⑤本體的位元組跟釘的一樣；原始碼裡沒有那幾個取得能力的字串（每個樣式各有正對照）', () => {
  const bytes = fs.readFileSync(SERVER);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), SERVER_BYTES_SHA256,
    '測試鈕的本體變了：這是每個 session 一啟動就會被執行的一支程式，改了要重算這顆釘，重算的人要負責看過改了什麼');
  const source = bytes.toString('utf8');
  for (const [pattern, realCode] of NO_SUCH_POWER) {
    assert.ok(realCode.includes(pattern), `正對照：樣式「${pattern}」連真的會那樣寫的程式碼都掃不到＝樣式拼錯了`);
    assert.ok(!source.includes(pattern), `測試鈕的原始碼裡出現了「${pattern}」`);
  }
});

test('⑥壞掉的一行只丟那一行；不認得的方法回錯誤、不認得的工具回 isError', () => {
  const r = talk(['{這一行不是 JSON', HELLO,
    { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'something_else' } },
    { jsonrpc: '2.0', id: 10, method: 'no/such/method' }, LIST]);
  assert.equal(r.code, 0);
  assert.equal(r.lines.length, 4, '壞掉的那一行不該有回覆，其餘四則都要有');
  const byId = new Map(r.lines.map((l) => [l.id, l]));
  assert.equal(byId.get(1).result.serverInfo.name, 'guard_canary');
  assert.equal(byId.get(9).result.isError, true);
  assert.equal(byId.get(10).error.code, -32601);
  assert.equal(byId.get(2).result.tools.length, 1);
});

test('⑥半行還沒收完不會先回話，切成兩段送也組得回來', async () => {
  const p = spawn(process.execPath, [SERVER], { cwd: os.tmpdir(), env: {} });
  let out = '';
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (c) => { out += c; });
  const text = `${JSON.stringify(HELLO)}\n`;
  const cut = Math.floor(text.length / 2);
  p.stdin.write(text.slice(0, cut));
  await new Promise((done) => { setTimeout(done, 100); });
  assert.equal(out, '', '半行就先回話了');
  p.stdin.end(text.slice(cut));
  const ended = await new Promise((done) => {
    const timer = setTimeout(() => done(false), 10_000);
    p.on('close', () => { clearTimeout(timer); done(true); });
  });
  if (!ended) { p.kill('SIGKILL'); assert.fail('標準輸入關掉之後沒有自己結束'); }
  const lines = out.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].result.serverInfo.name, 'guard_canary');
});
