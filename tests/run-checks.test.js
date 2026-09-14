// 守三關執行器（規矩 E2、E3）與兩份呼叫它的範本。
//
// 守得到的：①三關沒登記＝退 2；登記裡混一條「未設定」、空的或形狀錯＝退 2、一條都不跑（r1 Medium⑪）；
//   ②依序跑、第一關紅就停＝退 1；③起不來＝退 2；④全綠＝退 0；
//   ⑤跑之前是裸倉庫＝退 2、跑完變裸倉庫＝退 1（真的用臨時倉庫驗）；⑥子行程看不到 GIT_ 那一族；
//   ⑦推送前鉤子與雲端範本都呼叫這一支、不抄三關。
// ⚠️ 守不到的：三關命令本身對不對；鉤子有沒有被啟用（每個複本要自己設）；雲端有沒有設成必過檢查。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runChecks, runCommand } = require('../tools/run-checks.js');
const { gitEnv } = require('../tools/git-env.js');

const ROOT = path.join(__dirname, '..');
const okTree = () => 'ok';

test('①沒登記＝2；②第一關紅就停＝1；③起不來＝2；④全綠＝0', () => {
  const calls = [];
  const run = (argv) => { calls.push(argv.join(' ')); return argv[0] === 'red' ? { status: 3 } : argv[0] === 'gone' ? { status: null, error: 'ENOENT' } : { status: 0 }; };
  assert.equal(runChecks({ settings: { checks: { commands: [['未設定']] } }, run, tree: okTree }).code, 2);
  assert.equal(runChecks({ settings: {}, run, tree: okTree }).code, 2);
  const r = runChecks({ settings: { checks: { commands: [['a'], ['red'], ['c']] } }, run, tree: okTree });
  assert.equal(r.code, 1);
  assert.deepEqual(calls, ['a', 'red'], '紅了就停，第三關不跑');
  assert.equal(runChecks({ settings: { checks: { commands: [['gone']] } }, run, tree: okTree }).code, 2);
  assert.equal(runChecks({ settings: { checks: { commands: [['a'], ['c']] } }, run, tree: okTree }).code, 0);
  // 混一條壞的：整個退 2，而且一條都不跑（原本會靜靜濾掉、印「全綠（1 關）」）
  for (const mixed of [[['a'], ['未設定']], [['a'], []], [['a'], 'b'], [['a'], ['']], [['a'], [1]]]) {
    calls.length = 0;
    const r = runChecks({ settings: { checks: { commands: mixed } }, run, tree: okTree });
    assert.equal(r.code, 2, JSON.stringify(mixed));
    assert.equal(calls.length, 0, '有一關沒接好就一條都不跑');
    assert.match(r.lines.join('\n'), /還沒接好/u);
  }
});

test('⑤裸倉庫絆線：跑之前壞＝2；跑完變壞＝1（真的用臨時倉庫）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-checks-'));
  try {
    const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: gitEnv() });   // 規矩 E4：鉤子帶著 GIT_DIR 跑考題時，不清就寫進真倉庫
    git('init', '-q');
    const settings = { checks: { commands: [[process.execPath, '-e', 'process.exit(0)']] } };
    assert.equal(runChecks({ settings, cwd: dir }).code, 0, '正常的工作樹全綠');
    // 一關把倉庫弄成裸倉庫：跑完要抓到
    const breaker = { checks: { commands: [['git', 'config', 'core.bare', 'true']] } };
    const broke = runChecks({ settings: breaker, cwd: dir });
    assert.equal(broke.code, 1);
    assert.match(broke.lines.join('\n'), /跑完之後這棵樹不是工作樹了/u);
    // 現在跑之前就是壞的
    assert.equal(runChecks({ settings, cwd: dir }).code, 2);
    git('config', 'core.bare', 'false');
    assert.equal(runChecks({ settings, cwd: dir }).code, 0);
    assert.equal(runChecks({ settings, cwd: os.tmpdir() }).code, 2, '不在倉庫裡');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('⑥子行程看不到 GIT_ 那一族', () => {
  const prev = process.env.GIT_DIR; process.env.GIT_DIR = '/no/such';
  try {
    const marker = path.join(os.tmpdir(), `run-checks-env-${process.pid}.txt`);
    runCommand([process.execPath, '-e', `require('fs').writeFileSync(process.argv[1], String('GIT_DIR' in process.env))`, marker], os.tmpdir());
    assert.equal(fs.readFileSync(marker, 'utf8'), 'false');
    fs.rmSync(marker, { force: true });
  } finally { if (prev === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = prev; }
});

test('⑦鉤子與雲端範本都呼叫這一支、不抄三關；鉤子先清 GIT_；欄位閘範本訂閱 edited 且不接 || true', () => {
  const hook = fs.readFileSync(path.join(ROOT, 'templates', 'pre-push'), 'utf8');
  assert.match(hook, /node tools\/run-checks\.js/u);
  assert.match(hook, /unset "\$_gitvar"/u, '鉤子第一件事是清 GIT_');
  assert.doesNotMatch(hook, /npm (run|test)/u, '鉤子不抄三關');
  // 只看生效的行：範本的註解本來就會提到「不可以接 || true」，不剝註解會誤紅
  const effective = (text) => text.split('\n').filter((l) => !/^\s*#/u.test(l)).join('\n');
  const ci = effective(fs.readFileSync(path.join(ROOT, 'templates', 'ci-github.yml'), 'utf8'));
  assert.match(ci, /node tools\/run-checks\.js/u);
  assert.doesNotMatch(ci, /npm run (typecheck|lint)|npm test/u, '雲端不抄三關');
  assert.doesNotMatch(ci, /continue-on-error/u);
  const cf = effective(fs.readFileSync(path.join(ROOT, 'templates', 'collab-fields-github.yml'), 'utf8'));
  assert.match(cf, /types: \[.*edited.*\]/u, '改說明也要重跑');
  assert.match(cf, /tools\/gates\/check-collab-fields\.js/u);
  assert.doesNotMatch(cf, /\|\| true|continue-on-error/u, '不可以有永遠放行的接法');
});
