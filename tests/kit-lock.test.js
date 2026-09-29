// 守共用檔清單（規矩 E7：登記的清單由考題比對、K1：套件是共用檔唯一的正本）：使用專案改到套件的檔、卻沒在清單記例外＝紅。
//
// 為什麼：原專案 #641 在專案就地改了 9 個共用檔、PR 與留言沒有一處提到套件，34 小時後靠人比對才發現；擁有者 2026-09-29 裁
//   「預設套件先改、專案先改只當記錄過的例外，記錄要機器比對」。清單住使用專案（kit-lock.json），這一題在使用專案的雲端三關跑，
//   不用讀得到套件（套件是私有倉庫、使用專案的雲端讀不到）。
// 守得到的：清單每一筆的權限＋blob 跟工作樹一致；多出來、少掉、改內容、改權限各自紅並指名路徑；例外對上才綠、例外過期也紅；
//   清單壞掉或形狀不對＝退 2、不猜；--write 印出跟上一份差在哪、哪幾個進指紋、清掉哪些例外；帶不帶只看設定的登記，
//   登記跟清單在不在對不上就紅（跟案例簿那一列同一種開關）。
// ⚠️ 守不到的：同一支 PR 連清單、工具、這一題一起改（絆線不是鎖）；版本碼是不是真的出自套件、套件有沒有新的（要讀得到套件）；
//   被 .gitignore 忽略的檔（下面有一題照實驗它看不到）；共用路徑以外的檔；settings.json；分不出方向（專案多改 vs 套件有新的）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('../tools/git-env.js');
const lock = require('../tools/kit-lock.js');
const { read: readSettings } = require('../tools/settings-data.js');

const ROOT = path.join(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'kit-lock.js');
const DECLARED = lock.declaration(readSettings().machines, fs.existsSync(path.join(ROOT, lock.LOCK_FILE)));
const V = '0123456789abcdef0123456789abcdef01234567';
let ranTree = 0;

/** 一個小專案：共用路徑各放一個檔、外加專案自己的檔；家目錄指到暫存區（規矩 E4：git 一律拿清過的環境）。 */
function makeRepo(t) {
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-lock-')));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const root = path.join(scratch, 'proj');
  fs.mkdirSync(root);
  const env = { ...gitEnv(), HOME: scratch, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}：${r.stderr}`);
    return r.stdout;
  };
  git('init', '-q');
  const files = {
    'tools/a.js': "'use strict';\n",
    'tools/forbidden-tools.js': '// 假的攔截器（只拿檔名來對指紋清單）\n',
    'tests/b.test.js': '// b\n',
    'templates/c.md': '# c\n',
    'rules.json': '{}\n',
    'RULES.md': '# r\n',
    'MACHINES.md': '# m\n',
    'GLOSSARY.md': '# g\n',
    'docs/money-guard-two-pattern-tables.md': '# d\n',
    'settings.json': '{"x":1}\n',
    'lib/own.js': '// 專案自己的\n',
  };
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  const write = (rel, body) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), body); };
  const lockJson = () => JSON.parse(fs.readFileSync(path.join(root, lock.LOCK_FILE), 'utf8'));
  const saveLock = (obj) => fs.writeFileSync(path.join(root, lock.LOCK_FILE), `${JSON.stringify(obj, null, 2)}\n`);
  const except = (list) => { const j = lockJson(); j.exceptions = list; saveLock(j); };
  const cli = (...args) => spawnSync(process.execPath, [TOOL, '--root', root, ...args], { cwd: os.tmpdir(), env, encoding: 'utf8' });
  return { root, scratch, env, git, write, lockJson, saveLock, except, cli };
}
const writeLock = (root, extra = {}) => lock.write(root, { version: V, repo: 'acct/kit', date: '2026-09-29', ...extra });
const ex = (p, extra = {}) => ({ path: p, why: '先在專案修', who: '實作者', since: '2026-09-29', ...extra });

test('--write：清單記下共用檔的權限、blob、路徑，跟 git ls-tree 逐字相同；專案自己的檔不進清單', (t) => {
  const r = makeRepo(t);
  fs.chmodSync(path.join(r.root, 'tools', 'a.js'), 0o755);
  r.git('add', '-A'); r.git('commit', '-q', '-m', 'exec');
  const { lock: written, lines } = writeLock(r.root);
  assert.equal(lines[0], '第一次寫清單：9 個共用檔');
  const tree = r.git('ls-tree', '-r', 'HEAD', '--', ...lock.SHARED_PATHS).trim().split('\n').map((l) => {
    const [meta, p] = l.split('\t'); const [mode, , blob] = meta.split(' '); return { mode, blob, path: p };
  }).sort((a, b) => (a.path < b.path ? -1 : 1));
  assert.deepEqual(written.entries, tree, '清單要等於 git 自己算的 ls-tree（權限＋blob＋路徑）');
  assert.ok(written.entries.some((e) => e.path === 'tools/a.js' && e.mode === '100755'), '可執行位元要記到');
  assert.ok(!written.entries.some((e) => /^(settings\.json|lib\/)/u.test(e.path)), '專案自己的檔不在清單');
  assert.deepEqual(r.lockJson(), { repo: 'acct/kit', version: V, syncedAt: '2026-09-29', entries: tree, exceptions: [] });
  assert.ok(fs.readFileSync(path.join(r.root, lock.LOCK_FILE), 'utf8').endsWith('}\n'), '結尾一個換行');
  assert.equal(lock.check(r.root).ok, true, '剛寫完的清單對自己一定是綠的');
});

test('--check：改內容、多一個檔、少一個檔、改權限各自紅並指名路徑；記了例外才綠；被忽略的檔看不到（照實）', (t) => {
  const r = makeRepo(t);
  writeLock(r.root);
  const red = (why, kind, p) => {
    const c = lock.check(r.root);
    assert.equal(c.ok, false, why);
    assert.equal(c.problems.length, 1, `${why}：${c.problems.join(' / ')}`);
    assert.match(c.problems[0], new RegExp(`^${p.replace(/[.]/gu, '\\.')}：${kind}`, 'u'), why);
  };
  const green = (why) => { const c = lock.check(r.root); assert.equal(c.ok, true, `${why}：${c.problems.join(' / ')}`); };
  // 改內容（沒 commit 也算：比的是工作樹）
  r.write('tools/a.js', '// changed\n');
  red('改了共用檔沒記例外', '內容不同', 'tools/a.js');
  r.except([ex('tools/a.js')]);
  green('記了例外就綠');
  r.except([]);
  r.git('checkout', '--', 'tools/a.js');
  green('還原就綠');
  // 多一個檔（未追蹤也算）
  r.write('tools/extra.js', '// 專案偷放的\n');
  red('共用資料夾多放一個檔', '多出來', 'tools/extra.js');
  r.except([ex('tools/extra.js')]);
  green('多出來的檔記了例外也綠');
  fs.rmSync(path.join(r.root, 'tools', 'extra.js'));
  r.except([]);
  // 少一個檔
  fs.rmSync(path.join(r.root, 'templates', 'c.md'));
  red('刪掉共用檔', '少掉', 'templates/c.md');
  r.git('checkout', '--', 'templates/c.md');
  // 改權限
  fs.chmodSync(path.join(r.root, 'RULES.md'), 0o755);
  red('只改可執行位元', '權限不同', 'RULES.md');
  fs.chmodSync(path.join(r.root, 'RULES.md'), 0o644);
  green('權限改回來就綠');
  // 被忽略的檔：看不到，照實驗
  r.write('.gitignore', '*.log\n');
  r.write('tools/x.log', 'ignored\n');
  green('被 .gitignore 忽略的檔這一題看不到（守不到的，寫在檔頭）');
  // 專案自己的檔怎麼改都不關清單的事
  r.write('lib/own.js', '// 改專案自己的\n');
  r.write('settings.json', '{"x":2}\n');
  green('共用路徑以外的檔不比');
});

test('--check：例外過期（檔已經跟清單一樣）＝紅；例外指到共用路徑以外、少欄位、沒排序＝清單形狀不對、退 2 不猜', (t) => {
  const r = makeRepo(t);
  writeLock(r.root);
  r.except([ex('tools/a.js')]);
  const c = lock.check(r.root);
  assert.equal(c.ok, false);
  assert.match(c.problems[0], /^tools\/a\.js：例外過期/u);
  for (const [why, list] of [
    ['例外指到共用路徑以外', [ex('lib/own.js')]],
    ['例外少 who', [{ path: 'tools/a.js', why: 'x', since: '2026-09-29' }]],
    ['例外多一欄', [ex('tools/a.js', { note: 'x' })]],
    ['例外 why 空白', [ex('tools/a.js', { why: '  ' })]],
    ['例外 since 不是日期', [ex('tools/a.js', { since: '昨天' })]],
    ['例外沒排序', [ex('tools/a.js'), ex('RULES.md')]],
    ['例外重複', [ex('tools/a.js'), ex('tools/a.js')]],
  ]) {
    r.except(list);
    assert.throws(() => lock.check(r.root), lock.LockError, why);
  }
});

test('清單本身壞掉：不是 JSON、少欄位、版本碼不合、blob 不合、路徑帶 ..、沒排序、不在＝退 2 不猜；壞的每一種都真的紅過', (t) => {
  const r = makeRepo(t);
  writeLock(r.root);
  const good = r.lockJson();
  assert.doesNotThrow(() => lock.validateLock(JSON.parse(JSON.stringify(good))), '對照組：好的清單要過');
  const mutate = (why, f) => { const j = JSON.parse(JSON.stringify(good)); f(j); assert.throws(() => lock.validateLock(j), lock.LockError, why); };
  mutate('少 exceptions 欄', (j) => { delete j.exceptions; });
  mutate('多一欄', (j) => { j.note = 'x'; });
  mutate('版本碼不是十六進位', (j) => { j.version = 'main'; });
  mutate('版本碼太短', (j) => { j.version = 'abc'; });
  mutate('repo 不是帳號/倉庫名', (j) => { j.repo = 'kit'; });
  mutate('日期形狀', (j) => { j.syncedAt = '2026/09/29'; });
  mutate('blob 不是 40 位', (j) => { j.entries[0].blob = 'abc'; });
  mutate('權限不是三種之一', (j) => { j.entries[0].mode = '100600'; });
  mutate('路徑帶 ..', (j) => { j.entries[0].path = 'tools/../lib/own.js'; });
  mutate('路徑不在共用範圍', (j) => { j.entries[0].path = 'lib/own.js'; });
  mutate('entries 沒排序', (j) => { j.entries.reverse(); });
  mutate('entries 重複', (j) => { j.entries.push({ ...j.entries[0] }); });
  mutate('entries 少欄位', (j) => { delete j.entries[0].mode; });
  fs.writeFileSync(path.join(r.root, lock.LOCK_FILE), '{not json');
  assert.throws(() => lock.check(r.root), lock.LockError, '不是 JSON');
  fs.rmSync(path.join(r.root, lock.LOCK_FILE));
  assert.throws(() => lock.check(r.root), lock.LockError, '清單不在');
  assert.throws(() => lock.write(r.root, { version: 'zz', repo: 'a/b' }), lock.LockError, '--write 版本碼不合');
  assert.throws(() => lock.write(r.root, { version: V }), lock.LockError, '第一次寫沒給 repo');
});

test('--write 第二次：印出跟上一份差在哪、哪幾個進錢的攔截器指紋、清掉哪些例外；repo 沿用上一份', (t) => {
  const r = makeRepo(t);
  writeLock(r.root);
  r.write('tools/forbidden-tools.js', '// 新版攔截器\n');
  r.write('tools/a.js', '// 新版 a\n');
  r.write('templates/new.md', '# 套件新加的範本\n');
  r.except([ex('tools/a.js')]);
  const { lines, lock: written } = lock.write(r.root, { version: 'fedcba9876543210fedcba9876543210fedcba98', date: '2026-10-01' });
  assert.equal(written.repo, 'acct/kit', 'repo 沿用上一份');
  assert.deepEqual(written.exceptions, [], '例外清掉');
  assert.equal(lines[0], '跟上一份清單（0123456789abcdef0123456789abcdef01234567，2026-09-29）比：3 個檔不一樣');
  assert.deepEqual(lines.slice(1, 4), ['  ・templates/new.md：多出來', '  ・tools/a.js：內容不同', '  ・tools/forbidden-tools.js：內容不同']);
  assert.match(lines[4], /^⚠️ 這次動到進錢的攔截器指紋的檔：tools\/forbidden-tools\.js——/u, '只有指紋清單上的那一個被點名，a.js 不算');
  assert.match(lines[5], /^清掉 1 筆例外（tools\/a\.js）/u);
  assert.equal(lines[6], `寫好 ${lock.LOCK_FILE}：套件 acct/kit fedcba9876543210fedcba9876543210fedcba98（2026-10-01），10 筆`);
  assert.equal(lock.check(r.root).ok, true);
  // 對照：這一次沒碰指紋檔＝說沒動到
  r.write('RULES.md', '# r2\n');
  const again = lock.write(r.root, { version: V, date: '2026-10-02' });
  assert.ok(again.lines.some((l) => l.startsWith('這次沒動到進指紋的共用檔')), again.lines.join('\n'));
  assert.deepEqual(lock.FINGERPRINT_SHARED, ['tools/forbidden-tools.js', 'tools/package.json', 'tools/settings-data.js'], '指紋清單＝guard-copy 的 COPY_FILES 扣掉 settings.json');
});

test('指令入口：--check 綠退 0、紅退 1、清單壞掉退 2；--write 沒給版本退 2 並印用法；看不懂的參數退 2', (t) => {
  const r = makeRepo(t);
  writeLock(r.root);
  let p = r.cli('--check');
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert.match(p.stdout, /^共用檔清單｜套件 acct\/kit 0123456789abcdef0123456789abcdef01234567（2026-09-29）：9 筆；工作樹跟清單不一樣的 0 個、例外 0 筆\n全部相同。\n$/u);
  r.write('tools/a.js', '// changed\n');
  p = r.cli('--check');
  assert.equal(p.status, 1, p.stdout);
  assert.match(p.stdout, /tools\/a\.js：內容不同，清單裡沒有這一筆例外/u);
  r.except([ex('tools/a.js')]);
  p = r.cli('--check');
  assert.equal(p.status, 0, p.stdout);
  assert.match(p.stdout, /不一樣的 1 個、例外 1 筆\n不一樣的每一個都有例外對上。\n$/u);
  fs.writeFileSync(path.join(r.root, lock.LOCK_FILE), '[]');
  p = r.cli('--check');
  assert.equal(p.status, 2, p.stdout);
  assert.match(p.stdout, /形狀不對/u);
  p = r.cli('--write');
  assert.equal(p.status, 2, p.stdout);
  assert.match(p.stdout, /--version 要給套件的版本碼/u);
  p = r.cli('--frobnicate');
  assert.equal(p.status, 2);
  assert.match(p.stdout, /看不懂的參數：--frobnicate\n用法：/u);
  p = r.cli('--check', '--write');
  assert.equal(p.status, 2);
  p = spawnSync(process.execPath, [TOOL, '--root', path.join(r.scratch, 'not-a-repo'), '--check'], { cwd: os.tmpdir(), env: r.env, encoding: 'utf8' });
  assert.equal(p.status, 2, '不是倉庫也不是有清單的目錄＝退 2');
});

test('帶不帶只看設定的登記，而且登記要跟清單在不在一致（三種狀態各兩種情形）', () => {
  const row = (state) => [{ name: lock.MACHINE, state }];
  assert.deepEqual(lock.declaration(row('已啟用'), true), { run: true, problem: null, reason: null }, '登記帶、清單在：照跑');
  assert.match(lock.declaration(row('已啟用'), false).problem, /卻不在.*--write/u, '登記帶、清單不在：紅，訊息教怎麼建');
  const notYet = lock.declaration(row('已安裝未啟用'), false);
  assert.deepEqual([notYet.run, notYet.problem], [false, null], '還沒建清單：跳過');
  assert.match(notYet.reason, /還沒建清單/u, '跳過要寫出原因');
  assert.match(lock.declaration(row('已安裝未啟用'), true).problem, /改成已啟用/u, '清單在了卻沒啟用：紅');
  const upstream = lock.declaration(row('未移植'), false);
  assert.deepEqual([upstream.run, upstream.problem], [false, null], '套件倉庫自己：跳過');
  assert.match(upstream.reason, /上游/u);
  assert.match(lock.declaration(row('未移植'), true).problem, /上游/u, '登記未移植、清單卻在：紅');
  assert.match(lock.declaration(row('已就位'), false).problem, /只能登記/u, '登記成別的狀態：紅');
  assert.match(lock.declaration([], false).problem, /剛好一列/u, '這一列不見了：紅');
  assert.match(lock.declaration([...row('未移植'), ...row('未移植')], false).problem, /剛好一列/u, '重複：紅');
});

test('這棵樹登記帶清單時，工作樹要跟清單對得上（改了套件的檔沒記例外＝紅）', { skip: DECLARED.run ? false : DECLARED.reason }, () => {
  ranTree += 1;
  const c = lock.check(ROOT);
  assert.ok(c.ok, c.problems.join('\n'));
});

// ⚠️ 這一題要留在檔案最後：它核對登記跟清單在不在一致、而且該跑的那一題真的跑了
test('登記跟清單在不在一致；該跑的真的跑了', () => {
  assert.equal(DECLARED.problem, null, DECLARED.problem || '');
  assert.equal(ranTree, DECLARED.run ? 1 : 0, `登記說${DECLARED.run ? '要跑' : '不跑'}對清單那一題，實際跑了 ${ranTree} 題：跳過的接線接錯了`);
});
