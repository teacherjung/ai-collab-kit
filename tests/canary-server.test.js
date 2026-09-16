// 守測試鈕（規矩 B1 的驗收工具；裁示者 2026-09-15 裁「8a」）。攔截器沒裝好、沒信任、或載入就崩的時候，
// 畫面跟「它好好地在擋」一模一樣；唯一的證明是叫一個照清單該擋的工具、看到那一組的拒絕理由。
// 而會動到禁區的真工具一律絕不可以叫來試，所以清單上永久放一個無害的名字，本體＝tools/canary-server.js。
//
// 守得到的：
//   ①它真的掛得起來、只有一個工具、叫了回 pong；跑完工作目錄零新增、標準錯誤是空的；通知不回話。
//     **客戶端拿來決定要不要收這支伺服器的那幾格逐字比整個物件**（交握回覆、工具的輸入格式），
//     每一則回覆的信封（JSON-RPC 版本、id）則在 talk() 裡對每一題的每一則都檢查——
//     這幾格壞掉的症狀是「工具從清單上消失」，而這一批最要命的誤判就是把「叫不到」當成「被擋」。
//   ②協定版本：對方說的在「對過的版本」表裡就照著回、不在就回自己的預設（未知的未來版本也回預設，
//     不回聲＝不宣稱支援任何版本）；ping 方法回空結果。
//   ③裝機說明（四份會跟著搬進專案的檔）裡出現正確全名的**次數**跟釘的一樣，兩處登記鍵也對：
//     任何一處被改掉（含只改一個字母的拼錯）都會讓次數對不上（不去猜錯字長什麼樣＝不列舉）。
//   ④在一份代表性的禁區清單裡，這個名字**只有逐字拒絕清單擋得住**：不在清單上就放行（對照組），
//     加進清單才拒絕、理由含「在拒絕清單上」。這是⓪要求「挑一個只有這份清單擋的名字」的機器證明。
//   ⑤本體的位元組跟釘的一樣（改一個字元都要重算雜湊）＋原始碼裡沒有出現那幾個取得能力的字串
//     （掃法逐項用真的會那樣寫的程式碼當正對照，證明每一個樣式都拼對了）。
//   ⑥壞掉的一行只丟那一行、不讓整支崩；不認得的方法回錯誤、不認得的工具回 isError；
//     半行還沒收完不會先回話（切成兩段送也組得回來）。
//   ⑦**照安裝說明裡那一段登記真的起一次**：從專案根目錄起、從專案的子目錄起，都要交握成功；
//     負對照＝相對路徑的寫法從子目錄起不來（伺服器的工作目錄與平台給的專案目錄變數都跟著
//     「從哪裡開 Claude」走，2026-09-16 實測；Codex r1 B1）。
// ⚠️ 守不到的：
//   ⑤的**字串掃描是絆線不是證明**——不寫出那幾個字串一樣做得到（換個寫法就繞開了，預審實測過一種）；
//     真正關門的是位元組釘，而它擋的是「改了沒人發現」的漂移，擋不住有辦法連釘一起改的人（那歸審查）。
//     兩樣都不證明 node 自己做了什麼。
//   ④用的是考題自己的代表性清單，**不是**某個專案的真清單（真清單由那個專案自己的考題釘）。
//   ⑥的切半測試靠一個很短的等待，機器很忙時那一次可能兩段一起到＝沒真的考到切半（前半段的斷言仍成立）。
//   ⑦用 /bin/sh 與 git 起（Windows 不支援），而且是自己起子行程、**不是真的 Claude／Codex session**：
//     信任、工具有沒有真的出現在那一邊的清單上，這裡驗不到。
//   對方掛著不把輸出讀走時，回覆會排在記憶體裡（沒有背壓處理，Codex r1 T1）——要刻意不讀才碰得到。
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
const { gitEnv } = require('../tools/git-env.js');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'tools', 'canary-server.js');
const INSTALL_DOC = path.join(ROOT, 'templates', 'canary-install.md');
/** 完整工具名的唯一字面值：兩家 AI 都叫成 mcp__<伺服器名>__<工具名>。③會拿它跟真的跑出來的名字對。 */
const FULL_NAME = 'mcp__guard_canary__ping';
/**
 * 會跟著搬進專案的四份說明，每一份**出現正確全名幾次**（README 不跟著搬，所以不在這裡釘）。
 * 數量釘：任何一處被改動（拼錯、刪掉）都會讓數量對不上；加一處新的也要有意識地改這裡（Codex r1 B2）。
 */
const DOCS = [['templates/canary-install.md', 2], ['tools/guard-copy.js', 2], ['templates/hook-codex-global.json', 1], ['MACHINES.md', 2]];
/** 伺服器的位元組釘（改了本體就要重算；重算的人要負責看過改了什麼）：
 *  node -e "console.log(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('tools/canary-server.js')).digest('hex'))" */
const SERVER_BYTES_SHA256 = '6d614f2c59b4d558ab9b8475d96a7b932ed92fd19d9bba79119ee0f60d9de92b';

const hello = (protocolVersion) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'kit-test', version: '1' } } });
const HELLO = hello('2025-06-18');
const LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list' };
const feed = (messages) => `${messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('\n')}\n`;

/** 每一則回覆的信封：不是 JSON-RPC 2.0、結果與錯誤同時有或都沒有，客戶端就不收。 */
function parseLines(stdout) {
  const lines = stdout.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  for (const line of lines) {
    assert.equal(line.jsonrpc, '2.0', '每一則回覆都要自報 JSON-RPC 2.0');
    assert.ok(('result' in line) !== ('error' in line), '一則回覆只能有結果或錯誤其中一個');
  }
  return lines;
}

/**
 * 回覆的 id 要跟問題**一一對上**（順序、型別、值都是）：只檢查「有這一格」不夠——
 * 回錯 id 的伺服器，真的客戶端會把回覆丟掉、交握逾時、工具掛不上（Codex r2 B3 實測）。
 * 沒有 id 的是通知，本來就不該有回覆，所以不列入。
 */
function matchIds(messages, lines) {
  const asked = messages.filter((m) => m && typeof m === 'object' && m.id !== undefined).map((m) => m.id);
  assert.deepEqual(lines.map((l) => l.id), asked, '回覆的 id 沒有跟問題一一對上（順序、型別、值）');
}

/**
 * 在一個空的暫存目錄裡真的把它跑起來，餵幾行進去，回它印出來的每一行。
 * 環境刻意給空的：這一支不看環境變數，給空的還能跑＝它不靠任何一個。
 * 有時限：標準輸入關掉還不結束的話要**轉紅**，不可以讓整份考卷卡住。
 */
function talk(messages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-canary-'));
  const r = spawnSync(process.execPath, [SERVER], { cwd: dir, input: feed(messages), encoding: 'utf8', env: {}, timeout: 10_000, killSignal: 'SIGKILL' });
  const left = fs.readdirSync(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.signal, null, '標準輸入關掉之後沒有自己結束（被時限殺掉）');
  const lines = parseLines(r.stdout);
  matchIds(messages, lines);
  return { code: r.status, stderr: r.stderr, left, lines };
}

test('①掛得起來、只有一個工具、叫了回 pong；交握回覆逐字相符；跑完什麼都沒留下', () => {
  const r = talk([HELLO, { jsonrpc: '2.0', method: 'notifications/initialized' }, LIST,
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ping', arguments: {} } }]);
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
  assert.deepEqual(r.left, [], '跑完工作目錄多出了東西');
  assert.equal(r.lines.length, 3, '通知不該回話');
  const [init, list, call] = r.lines;
  // 逐字比整個物件：只挑幾格斷言的話，能力宣告換成 null、輸入格式的內容換成陣列都照樣綠，
  // 而真的客戶端會因此拒收整支伺服器或這個工具（Codex r1 B3 實測）
  assert.deepEqual(init.result, {
    protocolVersion: '2025-06-18',
    capabilities: { tools: {} },
    serverInfo: { name: 'guard_canary', version: '1.0.0' },
  });
  assert.equal(list.result.tools.length, 1);
  assert.equal(list.result.tools[0].name, 'ping');
  assert.deepEqual(list.result.tools[0].inputSchema, { type: 'object', properties: {}, additionalProperties: false });
  assert.equal(typeof list.result.tools[0].description, 'string');
  assert.ok(list.result.tools[0].description.trim().length > 0);
  assert.deepEqual(call.result.content, [{ type: 'text', text: 'pong' }]);
  assert.ok(!call.result.isError);
});

test('②協定版本：對過的照著回、沒對過的回預設；ping 回空結果', () => {
  // 刻意不用預設值當輸入：輸入跟期望值同一個數字的話，「照著回」與「不管你說什麼都回預設」分不出來
  for (const v of ['2025-06-18', '2025-03-26', '2024-11-05']) {
    assert.equal(talk([hello(v)]).lines[0].result.protocolVersion, v, `對過的版本 ${v} 要照著回（表上少一個就紅）`);
  }
  assert.equal(talk([hello('2099-01-01')]).lines[0].result.protocolVersion, '2025-06-18', '沒對過的版本要回自己的預設，不可以照單全收');
  assert.equal(talk([hello('latest')]).lines[0].result.protocolVersion, '2025-06-18', '不是版本形狀也要回自己的預設');
  const pong = talk([HELLO, { jsonrpc: '2.0', id: 7, method: 'ping' }]).lines[1];
  assert.deepEqual(pong.result, {}, 'ping 要回空結果（客戶端拿它確認連線還活著）');
});

test('②的另一半：回覆的 id 原樣回（0 與字串都是；通知沒有 id 就不回）', () => {
  // 官方客戶端的第一則 initialize 常常就是 id=0：把 0 當成「沒填」的寫法會讓交握整個逾時
  const r = talk([{ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 'abc', method: 'tools/list' }]);
  assert.deepEqual(r.lines.map((l) => l.id), [0, 'abc']);
  assert.equal(r.lines[0].result.serverInfo.name, 'guard_canary');
  assert.equal(r.lines[1].result.tools.length, 1);
});

test('③裝機說明裡正確全名出現的次數跟釘的一樣；兩處登記鍵也是它自己報的名字', () => {
  const [init, list] = talk([HELLO, LIST]).lines;
  const server = init.result.serverInfo.name;
  const live = `mcp__${server}__${list.result.tools[0].name}`;
  assert.equal(live, FULL_NAME);
  for (const [rel, expected] of DOCS) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // 數的是**完整的工具名**（前後都要是名字以外的字元）：數子字串的話，尾端多一個字母
    //（…__pingg）或前面多一個字母都還是數得到正確的那一段＝拼錯了仍然全綠（Codex r2 B2 實測）
    const tokens = [...text.matchAll(/(?<![A-Za-z0-9_.-])mcp__[A-Za-z0-9_.-]+/gu)].map((m) => m[0]);
    const hits = tokens.filter((t) => t === live).length;
    assert.equal(hits, expected, `${rel} 裡完整正確的全名出現 ${hits} 次，釘的是 ${expected} 次（有一處被改掉、刪掉，或新增了一處沒登記）`);
  }
  // 決定工具名的其實是兩處登記鍵（Claude 的 .mcp.json 鍵、Codex 的 config.toml 段名），也要對
  const install = fs.readFileSync(INSTALL_DOC, 'utf8');
  assert.equal(install.split(`"${server}": {`).length - 1, 1, `.mcp.json 的登記鍵不是剛好一處 ${server}`);
  assert.equal(install.split(`[mcp_servers.${server}]`).length - 1, 1, `config.toml 的段名不是剛好一處 ${server}`);
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
  try {
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (c) => { out += c; });
    const text = feed([HELLO]);
    const cut = Math.floor(text.length / 2);
    p.stdin.write(text.slice(0, cut));
    await new Promise((done) => { setTimeout(done, 100); });
    assert.equal(out, '', '半行就先回話了');
    p.stdin.end(text.slice(cut));
    const ended = await new Promise((done) => {
      const timer = setTimeout(() => done(false), 10_000);
      p.on('close', () => { clearTimeout(timer); done(true); });
    });
    assert.ok(ended, '標準輸入關掉之後沒有自己結束');
    const lines = parseLines(out);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].result.serverInfo.name, 'guard_canary');
  } finally {
    // 上面任何一條斷言拋出時，子行程還開著：一定要收掉，不然整份考卷會等它（Codex r1 T3）
    p.stdin.destroy();
    p.kill('SIGKILL');
  }
});

/** 起動用的環境：保留 PATH（要找得到 sh、git、node），清掉 GIT_ 那一族（規矩 E4）。 */
const launchEnv = (() => { const e = gitEnv(); delete e.NODE_TEST_CONTEXT; return e; })();

/** 暫存的專案：版本控制的根目錄底下有 tools/canary-server.js，另有一層子目錄。 */
function setUpRepo(dir) {
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.copyFileSync(SERVER, path.join(dir, 'tools', 'canary-server.js'));
  fs.copyFileSync(path.join(ROOT, 'tools', 'package.json'), path.join(dir, 'tools', 'package.json'));
  fs.mkdirSync(path.join(dir, 'sub', 'deeper'), { recursive: true });
  // 有時限：git 起不來或卡住時要轉紅，不可以讓整份考卷等它（Codex r2 T4）
  const init = spawnSync('git', ['init', '-q'], { cwd: dir, env: launchEnv, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL' });
  assert.equal(init.status, 0, `暫存專案的版本控制起不來：${init.stderr || init.error}`);
}

const shake = (command, args, cwd) => spawnSync(command, args, { cwd, input: feed([HELLO]), encoding: 'utf8', env: launchEnv, timeout: 10_000, killSignal: 'SIGKILL' });

test('⑦照安裝說明那一段登記真的起一次：根目錄與子目錄都掛得起來（相對路徑＝負對照）', () => {
  const block = fs.readFileSync(INSTALL_DOC, 'utf8').match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(block, '安裝說明裡找不到那一段 JSON 登記');
  const entry = JSON.parse(block[1]).mcpServers.guard_canary;
  // 目錄先建好再進 finally：布置到一半失敗時也要收乾淨（Codex r2 T4）
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-canary-proj-')));
  try {
    setUpRepo(dir);
    for (const cwd of [dir, path.join(dir, 'sub', 'deeper')]) {
      const r = shake(entry.command, entry.args, cwd);
      assert.equal(r.signal, null, `從 ${cwd} 起：沒有自己結束`);
      const lines = parseLines(r.stdout);
      assert.equal(lines.length, 1, `從 ${cwd} 起：沒有交握回覆（${r.stderr.slice(0, 200)}）`);
      assert.equal(lines[0].result.serverInfo.name, 'guard_canary', `從 ${cwd} 起：交握回的不是這支伺服器`);
    }
    // 負對照：相對路徑的寫法從子目錄起不來——證明這一題分得出差別（不是不管填什麼都會過）
    const bad = shake(process.execPath, ['tools/canary-server.js'], path.join(dir, 'sub', 'deeper'));
    assert.notEqual(bad.status, 0, '負對照：相對路徑從子目錄起竟然成功了＝這一題量錯了東西');
    assert.equal(bad.stdout.trim(), '', '負對照：起不來卻印了東西');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
