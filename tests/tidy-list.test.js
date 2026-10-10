// 守整理清單（tools/tidy-list.js；擁有者 2026-10-08 裁排進待辦、10/10 Fable 代裁另開一支）：列出可以收的分支、工作樹、
// 暫存資料夾裡的舊審查樹、stash；只列不刪。
//
// 守得到的：
//   ①參數不對（不認得、少值、天數不是非負整數）、不在 git 倉庫裡、主幹沒填又沒給 --main、主幹找不到＝退 2；工作樹讀不了狀態＝不列（③）；
//     主幹先找 origin/<名字>、再找本機同名分支；
//   ②分支：尖端在主幹歷史裡的列「已在主幹歷史裡」、上游已不在遠端的列「上游…已不在」；上游還在、沒有上游的新分支、目前所在的分支、
//     主幹本身都不列；檢出在某棵工作樹的照列並寫出那棵；
//   ③工作樹：檢出②的分支而且乾淨、分離狀態停在主幹歷史裡而且乾淨、資料夾已經不在＝列；有未提交改動（含沒追蹤的檔）、上鎖、
//     分離狀態停在主幹以外、主目錄本身＝不列；
//   ④暫存資料夾：名字帶審查字眼、或前後是分隔符號的 PR 編號與輪次、超過天數的資料夾＝列；mkdtemp 亂數尾巴碰巧長得像
//     （「-PR9PKV」「-pr1xld」）、不像的名字、沒超過天數（剛好等於也不算）、不是資料夾（檔案、捷徑）、登記在這個倉庫的工作樹＝不列；
//     兩個暫存資料夾其實是同一個只算一次、不存在的跳過；
//     裝著樹的資料夾：這個倉庫登記的工作樹（乾淨、上鎖、有改動都一樣）、別的倉庫或獨立倉庫有改動、上鎖、讀不了狀態的＝不列，乾淨沒上鎖的照列；
//     登記過的樹 .git 被移走或資料夾讀不了＝照樣不列（只比登記的路徑）；別的資料夾裡有讀不了的子資料夾＝判斷不了、保守不列；
//   ⑤stash 每一筆列出來、附日期與說明；②③④⑤每一題跑預設與 --list 兩次，前後所有參照、stash、工作樹登記、每棵工作樹的工作檔內容
//     （含沒提交的改動與沒追蹤的檔）、暫存資料夾第一層的名字與修改時間、底下每個檔的內容都不變（只列不刪）；
//   ⑥b查祖先出錯＝退 2；同名標籤不影響分支名與排除（②）；
//   ⑥c上一層資料夾進不去（0o000、0o444）：有沒提交內容的工作樹兩類都不列、記進判斷不了、第一行與 --list 都印出來；
//   ⑥d（#73 r3 之後按 F10 換的做法，直接量性質）：工具每一次讀檔案系統的呼叫逐一換成 EACCES，三類清單都不能多出東西，
//     變短時判斷不了那一欄一定有東西（射程：經過工具那一層讀檔案系統的呼叫；git 子行程另由退出碼判）；
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
const crypto = require('node:crypto');
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

/** 一個資料夾底下每個檔的相對路徑與內容雜湊（.git 資料夾不進去、.git 檔照算；讀不了的記「讀不了」）。 */
function contents(dir) {
  const out = [];
  const walk = (d, rel) => {
    let kids;
    try { kids = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { out.push(`${rel || '.'}：讀不了 ${e.code}`); return; }
    for (const k of kids.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, k.name);
      const r = rel ? `${rel}/${k.name}` : k.name;
      if (k.isSymbolicLink()) out.push(`${r} → ${fs.readlinkSync(p)}`);
      else if (k.isDirectory()) { if (k.name !== '.git') walk(p, r); }
      else { try { out.push(`${r}=${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`); } catch (e) { out.push(`${r}：讀不了 ${e.code}`); } }
    }
  };
  walk(dir, '');
  return out;
}

/**
 * 只列不刪的對照（#73 r1 R4、r2 R2）：所有參照、stash、工作樹登記、每棵還在的工作樹的工作檔內容（含沒提交的改動與沒追蹤的檔）、
 * 給的暫存資料夾第一層每一項的名字與修改時間、以及底下每個檔的內容。跑工具前後各拍一次、要一樣。
 */
function snapshot(r, tmpDirs = []) {
  const stash = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'refs/stash'], { cwd: r.dir, env: gitEnv(), encoding: 'utf8' }).stdout.trim();
  const tmp = tmpDirs.map((d) => (fs.existsSync(d) ? fs.readdirSync(d).sort().map((n) => `${n}@${fs.lstatSync(path.join(d, n)).mtimeMs}`) : []));
  const list = r.g('worktree', 'list', '--porcelain');
  const trees = list.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length)).filter((d) => fs.existsSync(d));
  return {
    refs: r.g('for-each-ref', '--format=%(refname) %(objectname)'),
    stash,
    stashList: r.g('stash', 'list', '--format=%H %gs'),
    worktrees: list,
    files: trees.map((d) => [d, contents(d)]),
    tmp,
    tmpFiles: tmpDirs.map((d) => (fs.existsSync(d) ? contents(d) : [])),
  };
}

/** 跑一次預設、一次 --list，前後的 snapshot 都要一樣；回 --list 那一次的結果。 */
function runKeeping(r, opts, tmpDirs = []) {
  const before = snapshot(r, tmpDirs);
  const plain = run(opts);
  assert.deepEqual(snapshot(r, tmpDirs), before, '預設那一次跑完東西不能變（只列不刪）');
  const listed = run({ ...opts, argv: [...opts.argv, '--list'] });
  assert.deepEqual(snapshot(r, tmpDirs), before, '--list 那一次跑完東西不能變（只列不刪）');
  assert.equal(plain.code, listed.code);
  return listed;
}

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
    // 同名標籤（#73 r1 R3）：git 的 :short 會把分支印成 heads/main，主幹與目前分支的排除就失效、檢出在哪棵也找不到
    for (const tag of ['main', 'here', 'merged-in-tree', 'gone']) r.g('tag', tag, first);
    const res = runKeeping(r, { settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(res.code, 0, res.lines.join('\n'));
    assert.deepEqual(names(res.branches), ['gone', 'merged', 'merged-in-tree'], '有同名標籤，名字照樣是分支名、主幹與目前分支照樣不列');
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
    // 讀不了狀態（.git 指到不存在的地方）＝可能有人在用，不列（#73 r1 R2 附帶：狀態的退出碼檢查要有題守）
    r.g('worktree', 'add', '-q', '--detach', at('wt-broken'), first);
    fs.writeFileSync(path.join(at('wt-broken'), '.git'), `gitdir: ${path.join(r.base, 'no-such-gitdir')}\n`);
    const res = runKeeping(r, { settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(res.code, 0, res.lines.join('\n'));
    // 沒提交的內容逐字還在（#73 r2 R2：只比參照與登記，工作檔被還原也照綠）
    assert.equal(fs.readFileSync(path.join(at('wt-dirty'), 'a.txt'), 'utf8'), 'changed\n', '追蹤檔沒提交的改動還在');
    assert.equal(fs.readFileSync(path.join(at('wt-untracked'), 'new.txt'), 'utf8'), 'new\n', '沒追蹤的檔還在');
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
    fs.mkdirSync(path.join(r.base, 'link-target'));
    fs.symlinkSync(path.join(r.base, 'link-target'), path.join(tmpA, 'review-link'));
    fs.lutimesSync(path.join(tmpA, 'review-link'), old, old);   // 捷徑自己的時間也設舊：不靠時間、要靠「不是資料夾」才不列
    fs.mkdirSync(path.join(tmpA, 'review-fresh'));
    fs.utimesSync(path.join(tmpA, 'review-fresh'), (NOW - DAY) / 1000, (NOW - DAY) / 1000);   // 剛好一天＝不算超過
    r.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-registered'), 'HEAD');
    fs.utimesSync(path.join(tmpA, 'review-registered'), old, old);
    // 裝著樹的容器（#73 r1 R1；送審產生器的布局 review-…/tree、review-…/mutation）：
    //   這個倉庫登記的（乾淨、上鎖、有改動都一樣歸②）→ 不列；別的倉庫的樹或獨立倉庫：有改動、上鎖、讀不了 → 不列；乾淨沒上鎖 → 照列
    const nest = (n) => { fs.mkdirSync(path.join(tmpA, n)); return path.join(tmpA, n, 'tree'); };
    r.g('worktree', 'add', '-q', '--detach', nest('review-own-clean'), 'HEAD');
    r.g('worktree', 'add', '-q', '--detach', nest('review-own-locked'), 'HEAD');
    r.g('worktree', 'lock', path.join(tmpA, 'review-own-locked', 'tree'));
    r.g('worktree', 'add', '-q', '--detach', nest('review-own-dirty'), 'HEAD');
    fs.writeFileSync(path.join(tmpA, 'review-own-dirty', 'tree', 'only-here.txt'), '沒提交的唯一內容\n');
    const other = repo();
    try {
      other.g('worktree', 'add', '-q', '--detach', nest('review-other-dirty'), 'HEAD');
      fs.writeFileSync(path.join(tmpA, 'review-other-dirty', 'tree', 'a.txt'), 'changed\n');
      other.g('worktree', 'add', '-q', '--detach', nest('review-other-locked'), 'HEAD');
      other.g('worktree', 'lock', path.join(tmpA, 'review-other-locked', 'tree'));
      other.g('worktree', 'add', '-q', '--detach', nest('review-other-clean'), 'HEAD');
      fs.mkdirSync(path.join(tmpA, 'review-standalone-dirty'));
      sh(path.join(tmpA, 'review-standalone-dirty'), 'init', '-q');
      fs.writeFileSync(path.join(tmpA, 'review-standalone-dirty', 'new.txt'), 'x\n');
      fs.mkdirSync(path.join(tmpA, 'review-broken'));
      fs.writeFileSync(path.join(tmpA, 'review-broken', '.git'), `gitdir: ${path.join(r.base, 'no-such-gitdir')}\n`);
      for (const n of ['review-own-clean', 'review-own-locked', 'review-own-dirty', 'review-other-dirty', 'review-other-locked', 'review-other-clean', 'review-standalone-dirty', 'review-broken']) fs.utimesSync(path.join(tmpA, n), old, old);
      // 看狀態不寫別人的索引：工作檔內容不變、只換修改時間，一般的 git status 會順手重寫索引；這裡要用不搶鎖的讀法、索引一個位元組都不動
      const cleanTree = path.join(tmpA, 'review-other-clean', 'tree');
      const later = (NOW + DAY) / 1000;
      fs.utimesSync(path.join(cleanTree, 'a.txt'), later, later);
      const indexFile = sh(cleanTree, 'rev-parse', '--path-format=absolute', '--git-path', 'index');
      const indexBefore = fs.statSync(indexFile).mtimeMs + ':' + fs.readFileSync(indexFile).toString('base64');
      fs.utimesSync(path.join(tmpA, 'review-other-clean'), old, old);
      const nested = runKeeping(r, { settings: SETTINGS, cwd: r.dir, now: NOW, argv: ['--tmp', tmpA] }, [tmpA]);
      assert.equal(fs.statSync(indexFile).mtimeMs + ':' + fs.readFileSync(indexFile).toString('base64'), indexBefore, '別的倉庫那棵樹的索引沒被寫');
      const got = nested.tmp.map((x) => path.basename(x.dir));
      for (const n of ['review-own-clean', 'review-own-locked', 'review-own-dirty', 'review-other-dirty', 'review-other-locked', 'review-standalone-dirty', 'review-broken', 'review-registered']) assert.ok(!got.includes(n), `${n} 不該列：${got.join('、')}`);
      assert.ok(got.includes('review-other-clean'), '別的倉庫乾淨、沒上鎖的樹照列');
      // 確定有人在用（上鎖、有改動、這個倉庫登記的）跟判斷不了是兩回事：前者不進「判斷不了」那一欄
      const unsureNames = nested.unsure.map((x) => path.basename(x.dir));
      for (const n of ['review-own-clean', 'review-own-locked', 'review-own-dirty', 'review-other-dirty', 'review-other-locked', 'review-standalone-dirty']) assert.ok(!unsureNames.includes(n), `${n} 是確定在用、不是判斷不了：${unsureNames.join('、')}`);
      assert.ok(unsureNames.includes('review-broken'), '.git 指到不存在處的那一棵讀不了狀態＝判斷不了');
      assert.ok(fs.existsSync(path.join(tmpA, 'review-own-dirty', 'tree', 'only-here.txt')), '沒提交的內容還在');
      for (const n of ['review-own-clean', 'review-own-locked', 'review-own-dirty', 'review-other-dirty', 'review-other-locked', 'review-other-clean', 'review-standalone-dirty', 'review-broken']) fs.rmSync(path.join(tmpA, n), { recursive: true, force: true });
      r.g('worktree', 'prune'); other.g('worktree', 'prune');
    } finally { other.cleanup(); }
    // 登記過的樹 .git 被移走、或資料夾讀不了（#73 r2 R1）：登記與鎖都還在，照樣不列——只比登記的路徑，不靠 .git 讀不讀得到；
    // 別的資料夾裡有讀不了的子資料夾＝判斷不了，保守不列
    const locked = [];
    try {
      r.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-direct'), 'HEAD');
      r.g('worktree', 'lock', path.join(tmpA, 'review-direct'));
      fs.writeFileSync(path.join(tmpA, 'review-direct', 'only.txt'), 'UNIQUE_DIRECT\n');
      fs.renameSync(path.join(tmpA, 'review-direct', '.git'), path.join(r.base, 'moved-dot-git'));
      fs.mkdirSync(path.join(tmpA, 'review-container'));
      r.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-container', 'tree'), 'HEAD');
      fs.rmSync(path.join(tmpA, 'review-container', 'tree', '.git'));
      fs.mkdirSync(path.join(tmpA, 'review-noread'));
      r.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-noread', 'tree'), 'HEAD');
      fs.chmodSync(path.join(tmpA, 'review-noread', 'tree'), 0o000); locked.push(path.join(tmpA, 'review-noread', 'tree'));
      // 兩種讀不了分開布置：只能進不能列（0o111：看得到 .git 不存在、列不出裡面有什麼）／能列不能進（0o444：列得出名字、
      // 判斷不了裡面那一層有沒有 .git）——各自只有一條判法接得住
      fs.mkdirSync(path.join(tmpA, 'review-unreadable-inside', 'sub'), { recursive: true });
      fs.chmodSync(path.join(tmpA, 'review-unreadable-inside', 'sub'), 0o111); locked.push(path.join(tmpA, 'review-unreadable-inside', 'sub'));
      fs.mkdirSync(path.join(tmpA, 'review-unsearchable-inside', 'sub', 'inner'), { recursive: true });
      fs.chmodSync(path.join(tmpA, 'review-unsearchable-inside', 'sub'), 0o444); locked.push(path.join(tmpA, 'review-unsearchable-inside', 'sub'));
      for (const n of ['review-direct', 'review-container', 'review-noread', 'review-unreadable-inside', 'review-unsearchable-inside']) fs.utimesSync(path.join(tmpA, n), old, old);
      const hidden = runKeeping(r, { settings: SETTINGS, cwd: r.dir, now: NOW, argv: ['--tmp', tmpA] }, [tmpA]);
      assert.equal(hidden.code, 0, hidden.lines.join('\n'));
      const got = hidden.tmp.map((x) => path.basename(x.dir));
      for (const n of ['review-direct', 'review-container', 'review-noread', 'review-unreadable-inside', 'review-unsearchable-inside']) assert.ok(!got.includes(n), `${n} 不該列：${got.join('、')}`);
      assert.match(r.g('worktree', 'list', '--porcelain'), /locked/u, '鎖還在');
      assert.equal(fs.readFileSync(path.join(tmpA, 'review-direct', 'only.txt'), 'utf8'), 'UNIQUE_DIRECT\n', '沒提交的內容逐字還在');
    } finally {
      for (const p of locked) fs.chmodSync(p, 0o755);
      for (const n of ['review-direct', 'review-container', 'review-noread', 'review-unreadable-inside', 'review-unsearchable-inside']) fs.rmSync(path.join(tmpA, n), { recursive: true, force: true });
      fs.rmSync(path.join(r.base, 'moved-dot-git'), { force: true });
      r.g('worktree', 'unlock', path.join(tmpA, 'review-direct'));
      r.g('worktree', 'prune');
    }
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
    const listed = runKeeping(r, { settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(r.g('stash', 'list', '--format=%gs').split('\n').filter(Boolean).length, 1, 'stash 那一筆還在');
    assert.ok(listed.lines.some((l) => /^ {2}・stash stash@\{0\}（\d{4}-\d{2}-\d{2}）：.*暫放/u.test(l)), listed.lines.join('\n'));
    assert.ok(listed.lines.some((l) => l.includes('node tools/check-progress-summary.js') && l.includes('node tools/backlog-touch.js')), '另外兩類指路');
  } finally { r.cleanup(); }
});

test('⑥b查祖先出錯（提交物件不見了）＝退 2、說是 git 出錯，不當成「沒合併」（#73 r1 R2）', () => {
  const r = repo();
  const empty = path.join(r.base, 'empty-tmp');
  fs.mkdirSync(empty);
  try {
    r.g('switch', '-q', '-c', 'candidate');
    const sha = r.commit('c.txt', 'c\n', 'candidate only');
    r.g('switch', '-q', 'main');
    fs.rmSync(path.join(r.dir, '.git', 'objects', sha.slice(0, 2), sha.slice(2)));
    const res = run({ settings: SETTINGS, cwd: r.dir, argv: ['--tmp', empty] });
    assert.equal(res.code, 2, res.lines.join('\n'));
    assert.match(res.lines[0], /^整理清單｜列不了：git merge-base --is-ancestor /u);
  } finally { r.cleanup(); }
});

test('⑥c上一層資料夾進不去：有沒提交內容的工作樹不當成「已經不在」，兩類都不列、記進判斷不了（#73 r3 R1）', () => {
  const r = repo();
  const tmpA = path.join(r.base, 'tmpA');
  fs.mkdirSync(tmpA);
  const parent = path.join(tmpA, 'review-parent');
  fs.mkdirSync(parent);
  try {
    r.g('worktree', 'add', '-q', '--detach', path.join(parent, 'tree'), 'HEAD~1');
    fs.writeFileSync(path.join(parent, 'tree', 'a.txt'), 'UNIQUE_UNCOMMITTED_R3\n');
    const old = (NOW - 3 * DAY) / 1000;
    for (const mode of [0o000, 0o444]) {
      fs.utimesSync(parent, old, old);
      fs.chmodSync(parent, mode);
      let res;
      try { res = run({ settings: SETTINGS, cwd: r.dir, now: NOW, argv: ['--tmp', tmpA, '--list'] }); } finally { fs.chmodSync(parent, 0o755); }
      assert.equal(res.code, 0, res.lines.join('\n'));
      assert.deepEqual(res.worktrees, [], `上一層 ${mode.toString(8)}：工作樹那一類不該列`);
      assert.deepEqual(res.tmp, [], `上一層 ${mode.toString(8)}：暫存那一類不該列`);
      assert.ok(res.unsure.length > 0, `上一層 ${mode.toString(8)}：要記進判斷不了`);
      assert.match(res.lines[0], /；判斷不了、沒列 \d+$/u, '第一行要說有幾個判斷不了');
      assert.ok(res.lines.some((l) => l.startsWith('  ・判斷不了、沒列 ')), '--list 要印出是哪些');
    }
    assert.equal(fs.readFileSync(path.join(parent, 'tree', 'a.txt'), 'utf8'), 'UNIQUE_UNCOMMITTED_R3\n', '沒提交的內容逐字還在');
  } finally { fs.chmodSync(parent, 0o755); r.cleanup(); }
});

test('⑥d讀不到只會讓清單變短（F10 換的做法）：工具每一次讀檔案系統的呼叫逐一換成 EACCES，三類清單都不能多出東西，少了的話判斷不了那一欄一定有東西', () => {
  const r = repo();
  const other = repo();
  const tmpA = path.join(r.base, 'tmpA');
  fs.mkdirSync(tmpA);
  try {
    const first = r.g('rev-parse', 'HEAD~1');
    // 布置：每一類都有會列的與不會列的
    r.g('branch', 'merged', first);
    r.g('worktree', 'add', '-q', path.join(r.base, 'wt-merged'), 'merged');
    r.g('worktree', 'add', '-q', '--detach', path.join(r.base, 'wt-old'), first);
    r.g('worktree', 'add', '-q', '--detach', path.join(r.base, 'wt-dirty'), first);
    fs.writeFileSync(path.join(r.base, 'wt-dirty', 'a.txt'), 'dirty\n');
    r.g('worktree', 'add', '-q', '--detach', path.join(r.base, 'wt-gone'), first);
    fs.rmSync(path.join(r.base, 'wt-gone'), { recursive: true, force: true });
    const old = (NOW - 3 * DAY) / 1000;
    fs.mkdirSync(path.join(tmpA, 'review-plain'));
    fs.mkdirSync(path.join(tmpA, 'review-own'));
    r.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-own', 'tree'), 'HEAD');
    fs.mkdirSync(path.join(tmpA, 'review-other'));
    other.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-other', 'tree'), 'HEAD');
    other.g('worktree', 'add', '-q', '--detach', path.join(r.base, 'other-locked'), 'HEAD');
    fs.mkdirSync(path.join(tmpA, 'review-other-locked'));
    other.g('worktree', 'add', '-q', '--detach', path.join(tmpA, 'review-other-locked', 'tree'), 'HEAD');
    other.g('worktree', 'lock', path.join(tmpA, 'review-other-locked', 'tree'));
    for (const n of ['review-plain', 'review-own', 'review-other', 'review-other-locked']) fs.utimesSync(path.join(tmpA, n), old, old);
    const opts = { settings: SETTINGS, cwd: r.dir, now: NOW, argv: ['--tmp', tmpA] };
    // 基準：記下每一次呼叫（方法＋第一個參數）
    const calls = [];
    const recording = Object.fromEntries(['realpathSync', 'lstatSync', 'readdirSync', 'readFileSync'].map((m) => [m, (...a) => { calls.push([m, String(a[0])]); return fs[m](...a); }]));
    const base = run({ ...opts, fsIo: recording });
    assert.equal(base.code, 0, base.lines.join('\n'));
    const key = (res) => ({ b: names(res.branches), w: names(res.worktrees, 'dir'), t: names(res.tmp, 'dir') });
    const want = key(base);
    assert.deepEqual(want.w, [path.join(r.base, 'wt-gone'), path.join(r.base, 'wt-merged'), path.join(r.base, 'wt-old'), path.join(tmpA, 'review-own', 'tree')].sort(), '基準的工作樹清單（review-own/tree 停在主幹上、乾淨，歸工作樹那一類）');
    assert.deepEqual(want.t.map((d) => path.basename(d)), ['review-other', 'review-plain'], '基準的暫存清單');
    const unique = [...new Map(calls.map((c) => [c.join('\0'), c])).values()];
    assert.ok(unique.length >= 10, `只記到 ${unique.length} 種呼叫——布置沒走到該走的地方`);
    let shrunk = 0;
    for (const [method, arg] of unique) {
      const failing = Object.fromEntries(['realpathSync', 'lstatSync', 'readdirSync', 'readFileSync'].map((m) => [m, (...a) => {
        if (m === method && String(a[0]) === arg) throw Object.assign(new Error(`EACCES: ${m} ${arg}`), { code: 'EACCES' });
        return fs[m](...a);
      }]));
      const res = run({ ...opts, fsIo: failing });
      const got = key(res);
      const label = `${method}(${arg}) 讀不到`;
      assert.equal(res.code, 0, `${label}：${res.lines.join('\n')}`);
      for (const k of ['b', 'w', 't']) for (const x of got[k]) assert.ok(want[k].includes(x), `${label}：多列了 ${x}（讀不到被當成確定的結論）`);
      const fewer = ['b', 'w', 't'].some((k) => got[k].length < want[k].length);
      if (fewer) { shrunk++; assert.ok(res.unsure.length > 0, `${label}：清單變短了，判斷不了那一欄卻是空的（靜默）`); }
    }
    assert.ok(shrunk > 0, '沒有任何一次讀不到讓清單變短——注入沒打到判斷用的那幾次讀取');
  } finally {
    other.cleanup(); r.cleanup();
  }
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
