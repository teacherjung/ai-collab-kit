// 設定污染反證（搬家前準備）：專案填了真設定之後，整份考卷在「每一欄都填了」的設定底下跑，不可以碰到外面。
//
// 為什麼：套件搬進專案後，這份考卷會跟著專案的推送前檢查、雲端、跨變更臨時樹一起跑，而工具的預設參數讀的是
// 根目錄那份設定。哪一題（或它叫的工具）漏了自己帶設定，就會照真設定去問平台、跑三關、在禁區埋假機密、按合併鍵
// ——2026-09-13 端到端實際發生過（在真家目錄埋假機密約十次）。目前靠「在空白設定的複本裡跑指令入口」
// （tests/helpers/kit-copy.js）與審查守著，沒有機器保證；這一題就是那個機器。
//
// 做法：在暫存目錄搭一份套件複本，設定**每一欄都填成假的**——對外的指令（平台動作、合併指令、三關、隔離前綴）
// 換成只記錄、退 97 的錄音機，禁區與家目錄換成暫存目錄，PATH 最前面放一個只記錄的假 gh——整份考卷跑一遍。
// 要：全綠、錄音機零次、禁區與家目錄零新檔。對照組：同一份假設定直接跑一支工具，錄音機要真的記到（證明設定填得夠滿、
// 錄音機真的在錄）。
// 為什麼不在真樹上跑：真設定的禁區可能是絕對路徑（例如 /private/tmp），換家目錄護不到；而且那正是要防的事。
//
// ⚠️ 巢狀：複本裡的這一題與「誘餌倉庫」那題（也會整份考卷重跑）看到 KIT_NESTED_SUITE=1 就標成跳過，
//    免得無限巢狀；跳過在報告裡是 skipped，不是靜靜通過。
// ⚠️ 守不到的：考題沒走到的分支；考題自己寫死、既不讀設定也不叫 gh 的外部呼叫；cases/ 不在複本裡時案例簿那幾題的結果。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('../tools/git-env.js');
const { OPERATIONS } = require('../tools/platform.js');
const { unfilled } = require('./helpers/kit-copy.js');

const ROOT = path.join(__dirname, '..');
const NESTED = process.env.KIT_NESTED_SUITE === '1';
/** 工具與考題從根目錄讀的那幾份（README「搬進一個專案」第 1 步同一份清單）。 */
const ROOT_FILES = ['settings.json', 'rules.json', 'RULES.md', 'MACHINES.md', 'PROJECT-SETTINGS.md'];
const ROOT_DIRS = ['tools', 'tests', 'templates', 'cases'];

/** 只記錄、退 97 的錄音機（一條 argv）。 */
const recorder = (log, tag) => [process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(log)}, ${JSON.stringify(tag)} + ' ' + process.argv.slice(1).join(' ') + '\\n'); process.exit(97)`];

/** 從空白設定出發，每一欄填成假的（形狀不變，settings.test ⑨ 盯著形狀）。 */
function fakeFilled({ log, box, zones }) {
  const s = unfilled();
  s.participants = s.participants.map((p, i) => ({ ...p, id: ['Boss', 'Alpha', 'Beta'][i] || `Extra${i}`, account: i === 0 ? 'boss-acct' : 'ai-acct' }));
  s.sources = [{ tool: '假的 CLI', string: 'CLI' }];
  for (const loc of s.locations) loc.where = '假的位置';
  s.mainBranch = 'main';
  s.mergeAuthorization = '假的授權';
  s.scanner = { tool: '假的掃描器', assignedBy: 'Alpha', tieBreak: '無', fallback: '無', isolation: { provider: '專案自建', wrap: [...recorder(log, 'isolation'), '{box}'], boxRoot: box, forbidden: zones } };
  s.platform = {
    name: 'Fake', project: 'fake/repo', clearEnv: ['GH_REPO'],
    operations: Object.fromEntries(Object.entries(OPERATIONS).map(([name, op]) => [name, [...recorder(log, `op:${name}`), ...op.params.map((p) => `{${p}}`)]])),
  };
  s.forbidden = { name: '錢', servers: ['broker-x'], allowlist: ['get_watchlist'], deny: ['mcp__o__x'], verbs: ['create', 'place'], nouns: ['order'], readPrefixes: ['get'], patterns: [] };
  s.acceptance = { tiers: [{ id: '重', action: '重啟' }, { id: '輕', action: '看一眼' }], families: [{ pattern: '^lib/', tier: '重' }, { pattern: '^docs/', tier: '輕' }], unknownTier: '重' };
  s.checks = { prepareWorktree: ['無'], commands: [recorder(log, 'check')] };
  s.gates = s.gates.map((g) => ({ ...g, state: '已啟用' }));
  s.mergeCommand = { command: process.execPath, args: [...recorder(log, 'merge').slice(1), '{change}', '--match-head-commit', '{sha}', '--body', 'Reviewed-By: {reviewer}\nMerged-By: {merger}'] };
  s.machines = s.machines.map((m) => (m.state === '未移植' ? m : { ...m, state: '已啟用', verified: '2026-09-15' }));
  return s;
}

test('整份考卷在「每一欄都填了假值」的設定底下跑：全綠，而且錄音機、禁區、家目錄都沒被碰到', { skip: NESTED ? '巢狀整卷裡不再巢狀' : false }, () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-filled-'));
  try {
    const copy = path.join(scratch, 'kit');
    const home = path.join(scratch, 'home');
    const bin = path.join(scratch, 'bin');
    const box = path.join(scratch, 'box');
    const zones = [path.join(scratch, 'zone-a'), path.join(scratch, 'zone-b')];
    const log = path.join(scratch, 'outside-calls.log');
    for (const d of [copy, home, bin, box, ...zones]) fs.mkdirSync(d, { recursive: true });
    for (const d of ROOT_DIRS) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(copy, d), { recursive: true });
    for (const f of ROOT_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(copy, f));
    const settings = fakeFilled({ log, box, zones });
    fs.writeFileSync(path.join(copy, 'settings.json'), `${JSON.stringify(settings, null, 1)}\n`);
    for (const { file, patterns } of settings.ignoreLists) fs.writeFileSync(path.join(copy, file), `${patterns.join('\n')}\n`);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\necho "gh $*" >> ${JSON.stringify(log)}\nexit 97\n`, { mode: 0o755 });

    const env = { ...gitEnv(), HOME: home, PATH: `${bin}${path.delimiter}${process.env.PATH}`, KIT_NESTED_SUITE: '1' };
    delete env.NODE_TEST_CONTEXT;   // 不拿掉的話子行程的 node --test 不管紅不紅都退 0
    const sh = (args) => spawnSync(args[0], args.slice(1), { cwd: copy, env, encoding: 'utf8' });
    const build = sh([process.execPath, 'tools/build-settings.js']);
    assert.equal(build.status, 0, `前提：假設定產得出設定說明（${build.stderr}）`);
    for (const step of [['git', 'init', '-q'], ['git', 'add', '-A']]) assert.equal(sh(step).status, 0, `前提：複本要是版本控制目錄（git ${step[1]}）`);

    const r = sh([process.execPath, '--test']);
    const failing = r.stdout.split('\n').filter((l) => /^✖|^not ok/u.test(l)).slice(0, 12).join('\n');
    assert.equal(r.status, 0, `填了假設定的整份考卷不是全綠：\n${failing}`);
    const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim() : '';
    assert.equal(calls, '', `有考題照設定去叫了外面（平台、合併、三關、隔離或 gh）：\n${calls.split('\n').slice(0, 8).join('\n')}`);
    for (const z of zones) assert.deepEqual(fs.readdirSync(z), [], `禁區 ${path.basename(z)} 被寫了東西`);
    assert.deepEqual(fs.readdirSync(home), [], '家目錄被寫了東西');

    // 對照組：同一份假設定直接跑一支會問平台的工具，錄音機要真的記到——不然上面的「零次」證明不了什麼
    const probe = sh([process.execPath, 'tools/pending-rulings.js']);
    assert.equal(probe.status, 2, `對照組：平台動作被錄音機退 97，工具要判問不到（${probe.stdout}）`);
    assert.match(fs.readFileSync(log, 'utf8'), /^op:allComments /mu, '對照組：錄音機要記到那一次平台動作');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
