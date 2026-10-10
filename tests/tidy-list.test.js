// 守整理清單（tools/tidy-list.js；擁有者 2026-10-08 裁排進待辦、10/10 Fable 代裁另開一支）：列出可以收的分支、工作樹、
// 暫存資料夾裡的舊審查樹、stash；只列不刪。
//
// 守得到的：
//   ①參數不對（不認得、少值、天數不是非負整數）、不在 git 倉庫裡、主幹沒填又沒給 --main、主幹找不到＝退 2；
//     主幹先找 origin/<名字>、再找本機同名分支；
//   ②分支：尖端在主幹歷史裡的列「已在主幹歷史裡」、上游已不在遠端的列「上游…已不在」；上游還在、沒有上游的新分支、目前所在的分支、
//     主幹本身都不列；檢出在某棵工作樹的照列並寫出那棵；
//   ③工作樹：檢出②的分支而且乾淨、分離狀態停在主幹歷史裡而且乾淨、資料夾已經不在＝列；有未提交改動（含沒追蹤的檔）、上鎖、
//     分離狀態停在主幹以外、主目錄本身＝不列；
//   ④暫存資料夾：名字帶審查字眼、或前後是分隔符號的 PR 編號與輪次、超過天數的資料夾＝列；mkdtemp 亂數尾巴碰巧長得像
//     （「-PR9PKV」「-pr1xld」）、不像的名字、沒超過天數（剛好等於也不算）、不是資料夾（檔案、捷徑）、登記在這個倉庫的工作樹＝不列；
//     兩個暫存資料夾其實是同一個只算一次、不存在的跳過；
//   ⑤stash 每一筆列出來、附日期與說明；
//   ⑥輸出：預設只印各類幾個（有東西才提示加 --list）、--list 才印整份；
//   ⑦git 那一族環境變數指向別的倉庫，照樣看這一個（E4）；⑧空白設定的複本裡跑指令入口＝退 2。
// ⚠️ 守不到的：壓成一顆的合併只能從「上游已不在」推、推錯也列；工作樹有沒有人開著編輯器；暫存資料夾裡更深的檔改了、
//   第一層的時間沒跟著變；名字不像審查樹的舊資料夾（考題留下的）本來就不列。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('../tools/git-env.js');
const { run, parseArgs, TMP_NAME, DAYS } = require('../tools/tidy-list.js');
const { runInCopy } = require('./helpers/kit-copy.js');

const SETTINGS = { mainBranch: 'main' };
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

function sh(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, env: gitEnv(), encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}：${r.stderr}`);
  return r.stdout.trim();
}

/** 一個有遠端（本機的空倉庫）的倉庫；主幹 main 兩顆提交、推上去。 */
function repo() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tidy-list-')));
  const dir = path.join(base, 'main');
  const remote = path.join(base, 'remote.git');
  sh(base, 'init', '-q', '--bare', '-b', 'main', remote);
  fs.mkdirSync(dir);
  const g = (...args) => sh(dir, ...args);
  g('init', '-q', '-b', 'main');
  g('config', 'maintenance.auto', 'false');
  g('remote', 'add', 'origin', remote);
  const commit = (file, text, msg) => { fs.writeFileSync(path.join(dir, file), text); g('add', '-A'); g('commit', '-q', '-m', msg); return g('rev-parse', 'HEAD'); };
  commit('a.txt', 'a\n', 'one');
  commit('a.txt', 'b\n', 'two');
  g('push', '-q', '-u', 'origin', 'main');
  return { base, dir, remote, g, commit, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

const names = (xs, key = 'name') => xs.map((x) => x[key]).sort();

test('①參數、不在倉庫裡、主幹沒填或找不到＝退 2；主幹先找 origin/<名字> 再找本機', () => {
  for (const argv of [['--oops'], ['--days'], ['--days', '1.5'], ['--days', '-1'], ['--main']]) {
    const res = run({ settings: SETTINGS, cwd: os.tmpdir(), argv });
    assert.equal(res.code, 2, argv.join(' '));
    assert.match(res.lines[0], /列不了/u);
  }
  assert.deepEqual(parseArgs(['--days', '0', '--tmp', 'a', '--tmp', 'b', '--list', '--main', 'trunk']), { main: 'trunk', days: 0, tmp: ['a', 'b'], list: true });
  assert.equal(parseArgs([]).days, DAYS);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tidy-list-outside-'));
  const r = repo();
  try {
    assert.match(run({ settings: SETTINGS, cwd: outside, argv: ['--tmp', outside] }).lines[0], /不在 git 倉庫/u);
    for (const settings of [{}, { mainBranch: '未設定' }]) {
      const res = run({ settings, cwd: r.dir, argv: ['--tmp', outside] });
      assert.equal(res.code, 2);
      assert.match(res.lines[0], /主幹分支名沒填/u);
    }
    const missing = run({ settings: SETTINGS, cwd: r.dir, argv: ['--main', 'nope', '--tmp', outside] });
    assert.equal(missing.code, 2);
    assert.match(missing.lines[0], /找不到主幹（試過 origin\/nope、nope）/u);
    assert.equal(run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', outside] }).main, 'origin/main');
    r.g('branch', 'trunk');   // 只有本機、沒有 origin/trunk
    assert.equal(run({ settings: SETTINGS, cwd: r.dir, argv: ['--main', 'trunk', '--tmp', outside] }).main, 'trunk');
    // 主幹設定填了、--main 也給了：照 --main
    assert.equal(run({ settings: { mainBranch: 'nope' }, cwd: r.dir, argv: ['--main', 'main', '--tmp', outside] }).code, 0);
  } finally {
    r.cleanup(); fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('②分支：已在主幹歷史裡、上游已不在＝列；上游還在、沒上游、目前所在、主幹本身＝不列；檢出在工作樹的寫出那棵', () => {
  const r = repo();
  const empty = path.join(r.base, 'empty-tmp');
  fs.mkdirSync(empty);
  try {
    const first = r.g('rev-parse', 'HEAD~1');
    r.g('branch', 'merged', first);
    r.g('branch', 'merged-in-tree', first);
    // 上游已不在：推上去、設上游、再從遠端刪掉、抓的時候修剪
    r.g('switch', '-q', '-c', 'gone');
    r.commit('g.txt', 'g\n', 'gone work');
    r.g('push', '-q', '-u', 'origin', 'gone');
    r.g('push', '-q', 'origin', '--delete', 'gone');
    r.g('fetch', '-q', '--prune');
    // 上游還在
    r.g('switch', '-q', '-c', 'alive', 'main');
    r.commit('l.txt', 'l\n', 'alive work');
    r.g('push', '-q', '-u', 'origin', 'alive');
    // 沒有上游的新分支
    r.g('switch', '-q', '-c', 'local', 'main');
    r.commit('n.txt', 'n\n', 'local work');
    // 目前所在：已在主幹歷史裡也不列
    r.g('switch', '-q', '-c', 'here', first);
    const tree = path.join(r.base, 'tree-merged');
    r.g('worktree', 'add', '-q', tree, 'merged-in-tree');
    const res = run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(res.code, 0, res.lines.join('\n'));
    assert.deepEqual(names(res.branches), ['gone', 'merged', 'merged-in-tree']);
    const why = Object.fromEntries(res.branches.map((b) => [b.name, b.why]));
    assert.match(why.merged, /^尖端已在主幹歷史裡$/u);
    assert.match(why.gone, /^上游 origin\/gone 已不在遠端/u);
    assert.match(why['merged-in-tree'], new RegExp(`檢出在工作樹 ${tree.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
  } finally { r.cleanup(); }
});

test('③工作樹：檢出②的分支或分離在主幹歷史裡、而且乾淨，或資料夾不在＝列；有改動、上鎖、分離在主幹外、主目錄＝不列', () => {
  const r = repo();
  const empty = path.join(r.base, 'empty-tmp');
  fs.mkdirSync(empty);
  try {
    const first = r.g('rev-parse', 'HEAD~1');
    for (const b of ['m-clean', 'm-dirty', 'm-untracked', 'm-locked']) r.g('branch', b, first);
    r.g('switch', '-q', '-c', 'side');
    const sideTip = r.commit('s.txt', 's\n', 'side work');
    r.g('switch', '-q', 'main');
    const at = (n) => path.join(r.base, n);
    r.g('worktree', 'add', '-q', at('wt-clean'), 'm-clean');
    r.g('worktree', 'add', '-q', at('wt-dirty'), 'm-dirty');
    fs.writeFileSync(path.join(at('wt-dirty'), 'a.txt'), 'changed\n');
    r.g('worktree', 'add', '-q', at('wt-untracked'), 'm-untracked');
    fs.writeFileSync(path.join(at('wt-untracked'), 'new.txt'), 'new\n');
    r.g('worktree', 'add', '-q', at('wt-locked'), 'm-locked');
    r.g('worktree', 'lock', at('wt-locked'));
    r.g('worktree', 'add', '-q', '--detach', at('wt-detached-old'), first);
    r.g('worktree', 'add', '-q', '--detach', at('wt-detached-side'), sideTip);
    r.g('worktree', 'add', '-q', '--detach', at('wt-gone'), first);
    fs.rmSync(at('wt-gone'), { recursive: true, force: true });
    const res = run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(res.code, 0, res.lines.join('\n'));
    assert.deepEqual(names(res.worktrees, 'dir'), [at('wt-clean'), at('wt-detached-old'), at('wt-gone')].sort());
    const why = Object.fromEntries(res.worktrees.map((w) => [path.basename(w.dir), w.why]));
    assert.match(why['wt-clean'], /^檢出的分支 m-clean 在①裡、乾淨$/u);
    assert.match(why['wt-detached-old'], new RegExp(`^分離狀態停在主幹歷史裡的 ${first.slice(0, 8)}、乾淨`, 'u'));
    assert.match(why['wt-gone'], /^資料夾已經不在/u);
    // 在別棵工作樹裡跑：主目錄先切到分離狀態、停在主幹歷史裡而且乾淨（不跳過就會被列）——照樣不列；跑的那一棵（目前所在的分支不在①）也不列
    r.g('switch', '-q', '--detach', first);
    const fromTree = run({ settings: SETTINGS, cwd: at('wt-clean'), argv: ['--tmp', empty] });
    assert.ok(!fromTree.worktrees.some((w) => w.dir === r.dir), '主目錄不列');
    assert.ok(!fromTree.branches.some((b) => b.name === 'm-clean'), '目前所在的分支不列');
  } finally { r.cleanup(); }
});

test('④暫存資料夾：名字像審查樹而且超過天數的資料夾才列；亂數尾巴、剛好等於、檔案與捷徑、登記的工作樹不列', () => {
  const r = repo();
  const tmpA = path.join(r.base, 'tmpA');
  fs.mkdirSync(tmpA);
  try {
    const old = (NOW - 2 * DAY) / 1000;
    const listed = ['claude-review-pr1-abc', 'pr12-r3-evidence', 'codex-kit19-r2-vhZB0u', 'codex-pr28-r1.DESbrE', 'Scan-Box', 'r1pr23', 'kit24-mutants'];
    const notListed = ['autopsy-PR9PKV', 'autopsy-pr1xld', 'claude-501', 'cashflow-copy-profile', 'audit-r123-x'];
    for (const n of [...listed, ...notListed]) { fs.mkdirSync(path.join(tmpA, n)); fs.utimesSync(path.join(tmpA, n), old, old); }
    fs.writeFileSync(path.join(tmpA, 'review-file'), 'x');
    fs.utimesSync(path.join(tmpA, 'review-file'), old, old);
    fs.symlinkSync(path.join(tmpA, 'claude-501'), path.join(tmpA, 'review-link'));
    fs.mkdirSync(path.join(tmpA, 'review-fresh'));
    fs.utimesSync(path.join(tmpA, 'review-fresh'), (NOW - DAY) / 1000, (NOW - DAY) / 1000);   // 剛好一天＝不算超過
    r.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-registered'), 'HEAD');
    fs.utimesSync(path.join(tmpA, 'review-registered'), old, old);
    const res = run({ settings: SETTINGS, cwd: r.dir, now: NOW, argv: ['--tmp', tmpA, '--tmp', path.join(tmpA, '.', ''), '--tmp', path.join(r.base, 'no-such-dir')] });
    assert.equal(res.code, 0, res.lines.join('\n'));
    assert.deepEqual(res.tmp.map((t) => path.basename(t.dir)).sort(), [...listed].sort(), '同一個資料夾給兩次只算一次');
    assert.ok(res.tmp.every((t) => t.why === '2 天沒改'), res.tmp.map((t) => t.why).join('、'));
    // 天數 0：剛好一天的也列（超過 0 天）；天數 3：兩天的都不列
    assert.ok(run({ settings: SETTINGS, cwd: r.dir, now: NOW, argv: ['--tmp', tmpA, '--days', '0'] }).tmp.some((t) => t.dir.endsWith('review-fresh')));
    assert.equal(run({ settings: SETTINGS, cwd: r.dir, now: NOW, argv: ['--tmp', tmpA, '--days', '3'] }).tmp.length, 0);
    // 名字判法單獨看
    for (const n of listed) assert.ok(TMP_NAME.test(n), n);
    for (const n of notListed) assert.ok(!TMP_NAME.test(n), n);
  } finally { r.cleanup(); }
});

test('⑤⑥stash 列出日期與說明；預設只印幾個，--list 才印整份；什麼都沒有就不提示', () => {
  const r = repo();
  const empty = path.join(r.base, 'empty-tmp');
  fs.mkdirSync(empty);
  try {
    const clean = run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(clean.code, 0);
    assert.match(clean.lines[0], /^整理清單｜主幹 origin\/main｜只列不刪：已合併或上游已刪的分支 0、沒人用的工作樹 0、暫存資料夾的舊審查樹 0（超過 1 天沒改）、stash 0$/u);
    assert.ok(!clean.lines.some((l) => l.includes('--list')), '什麼都沒有就不提示加 --list');
    fs.writeFileSync(path.join(r.dir, 'a.txt'), 'stashed\n');
    r.g('stash', 'push', '-q', '-m', '暫放 先收起來');
    const counted = run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(counted.stashes.length, 1);
    assert.match(counted.stashes[0].date, /^\d{4}-\d{2}-\d{2}$/u);
    assert.match(counted.stashes[0].subject, /暫放 先收起來$/u);
    assert.ok(counted.lines.includes('整份清單：加 --list。'));
    assert.ok(!counted.lines.some((l) => l.startsWith('  ・')), '預設不印整份');
    const listed = run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty, '--list'] });
    assert.ok(listed.lines.some((l) => /^ {2}・stash stash@\{0\}（\d{4}-\d{2}-\d{2}）：.*暫放/u.test(l)), listed.lines.join('\n'));
    assert.ok(listed.lines.some((l) => l.includes('node tools/check-progress-summary.js') && l.includes('node tools/backlog-touch.js')), '另外兩類指路');
  } finally { r.cleanup(); }
});

test('⑦git 那一族環境變數指向別的倉庫，照樣看這一個（E4）', () => {
  const r = repo();
  const decoy = repo();
  const empty = path.join(r.base, 'empty-tmp');
  fs.mkdirSync(empty);
  const saved = process.env.GIT_DIR;
  try {
    r.g('branch', 'merged', 'HEAD~1');
    process.env.GIT_DIR = path.join(decoy.dir, '.git');
    const res = run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(res.code, 0, res.lines.join('\n'));
    assert.deepEqual(names(res.branches), ['merged'], '看的是這一個倉庫，不是誘餌');
  } finally {
    if (saved === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = saved;
    r.cleanup(); decoy.cleanup();
  }
});

test('⑧真的跑一遍指令（空白設定的複本，不讀本倉庫那份）：退 2', () => {
  const res = runInCopy('tools/tidy-list.js', ['--tmp', os.tmpdir()]);
  assert.equal(res.status, 2, res.stdout + res.stderr);
  assert.match(res.stdout, /列不了/u);
  assert.equal(runInCopy('tools/tidy-list.js', ['--oops']).status, 2);
});
