// 守三關執行器（規矩 E2、E3）與兩份呼叫它的範本。
//
// 守得到的：①三關沒登記＝退 2；登記裡混一條「未設定」、空的或形狀錯＝退 2、一條都不跑（r1 Medium⑪）；
//   ②依序跑、第一關紅就停＝退 1；③起不來＝退 2；④全綠＝退 0；
//   ⑤跑之前是裸倉庫＝退 2、跑完變裸倉庫＝退 1（真的用臨時倉庫驗）；⑥子行程看不到 GIT_ 那一族；
//   ⑦推送前鉤子與雲端範本都呼叫這一支、不抄三關；
//   ⑧版本控制認的工作樹根目錄不是這裡（樹被指到別處、或在子目錄跑）：跑之前＝退 2、跑完才歪＝退 1（搬家驗屋 09-13）；
//   ⑨三關跑的過程中倉庫的共用設定或這棵樹自己的設定被改了＝1（就算從這棵樹看生效值健康；原專案 08-09 的形狀）；只讀＝0；
//     有提交卻索引檔不見＝2、跑完才不見＝1；沒登記下面兩項時的正面控制：空索引、擴充關＋共用 core.bare=true＋連結樹
//     （這個夾具的主目錄其實打不開，登記了就擋，見⑩）、真的裸儲存庫＋連結樹（含 r3 的三種擴充寫法）都＝0（搬家前準備）；
//   ⑩登記了 checks.mainWorktree＝「一般工作樹」：從連結樹看健康、主目錄卻被判成裸倉庫或打不開＝跑之前 2、跑完才壞 1，
//     訊息裡的還原指令從別的目錄照貼跑得動（路徑含空白、單引號、全形括號與中文）；沒登記照舊放行；帶著髒 GIT_DIR 照樣擋；
//     合法布局（每棵樹都覆寫、從主目錄跑、store.git、--separate-git-dir、core.worktree 合法搬家）登記了也＝0；
//     照實的代價：proj/.git 是裸儲存庫＋連結樹，登記了＝2；
//   ⑪登記了 checks.indexAnchors：錨點不在這棵樹的索引裡（整份清空、少一筆、路徑位元組被改）＝跑之前 2、跑完才不見 1，
//     還原照貼跑得動；問錨點那一次 git 失敗＝不放行（不當成都在）；沒登記照舊放行；稀疏索引、取消追蹤或改名非錨點、暫存修改錨點
//     登記了也＝0；暫存刪除全部、已提交改名錨點照登記擋；
//   ⑫兩個登記寫錯＝2、一關都不跑、訊息指出哪一格；沒寫或寫「未設定」＝沒登記、全綠那一行照實說沒驗；三關後樹壞了、設定也變了＝兩段都印。
// ⚠️ 守不到的：三關命令本身對不對；鉤子有沒有被啟用（每個複本要自己設）；雲端有沒有設成必過檢查；
//   兩個登記本身守不到的形狀（tools/run-checks.js 的 mainProblem、anchorProblem 註解與 MACHINES.md 的 E2、E3 那一列）。
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
const okTree = () => ({ state: 'ok' });

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

test('⑧樹被指到別處＝不放行：跑之前就歪＝2；跑完才歪＝1；不在根目錄跑＝2（搬家驗屋 09-13）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-checks-wt-'));
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'run-checks-else-'));
  try {
    const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: gitEnv() });
    git('init', '-q');
    const settings = { checks: { commands: [[process.execPath, '-e', 'process.exit(0)']] } };
    assert.equal(runChecks({ settings, cwd: dir }).code, 0, '對照組：正常的樹全綠');
    fs.mkdirSync(path.join(dir, 'sub'));
    const sub = runChecks({ settings, cwd: path.join(dir, 'sub') });
    assert.equal(sub.code, 2, '在子目錄跑＝根目錄不是這裡');
    assert.match(sub.lines.join('\n'), /根目錄不是這裡/u);
    const pointer = { checks: { commands: [['git', 'config', 'core.worktree', elsewhere]] } };
    const moved = runChecks({ settings: pointer, cwd: dir });
    assert.equal(moved.code, 1, '一關把樹指到別處：跑完要抓到');
    assert.match(moved.lines.join('\n'), /被指到別處了/u);
    assert.equal(runChecks({ settings, cwd: dir }).code, 2, '現在跑之前就是歪的');
    git('config', '--unset', 'core.worktree');
    assert.equal(runChecks({ settings, cwd: dir }).code, 0, '還原後照常');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
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
  // 鉤子沒有執行權＝git 靜靜略過它（搬家前準備）：版本控制裡要記成可執行，搬進專案時才帶得過去
  const mode = spawnSync('git', ['ls-files', '-s', 'templates/pre-push'], { cwd: ROOT, encoding: 'utf8', env: gitEnv() }).stdout.split(/\s+/u)[0];
  assert.equal(mode, '100755', `推送前鉤子範本在版本控制裡的模式是 ${mode}，要是 100755`);
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

test('⑨三關跑的過程中改了倉庫設定＝1（就算從這棵樹看還健康）；索引檔不見＝2、跑完才不見＝1；沒登記時這幾種形狀都＝0（搬家前準備）', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'run-checks-shared-'));
  try {
    const main = path.join(scratch, 'main');
    const linked = path.join(scratch, 'linked');
    fs.mkdirSync(main);
    const env = { ...gitEnv(), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
    const g = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8', env }); assert.equal(r.status, 0, `git ${a.join(' ')}：${r.stderr}`); return r.stdout.trim(); };
    const sharedCfg = path.join(main, '.git', 'config');
    g(main, 'init', '-q'); fs.writeFileSync(path.join(main, 'a.txt'), 'x\n'); g(main, 'add', '.'); g(main, 'commit', '-q', '-m', 'base');
    g(main, 'config', 'extensions.worktreeConfig', 'true');
    g(main, 'worktree', 'add', '-q', '--detach', linked);
    g(linked, 'config', '--worktree', 'core.bare', 'false');
    const settings = { checks: { commands: [[process.execPath, '-e', 'process.exit(0)']] } };
    assert.equal(runChecks({ settings, cwd: linked }).code, 0, '對照組：健康的連結工作樹全綠');

    // 原專案 08-09 的形狀：跑的過程中有一題把 bare = true 寫進共用設定；這棵樹自己的設定蓋住了，從這裡看生效值照樣健康
    const breaker = { checks: { commands: [['git', 'config', '--file', sharedCfg, 'core.bare', 'true']] } };
    const broke = runChecks({ settings: breaker, cwd: linked });
    assert.equal(g(linked, 'rev-parse', '--is-bare-repository'), 'false', '前提：從這棵樹看生效值被蓋住了（只看生效值會判健康）');
    assert.equal(broke.code, 1, broke.lines.join('\n'));
    assert.match(broke.lines.join('\n'), /倉庫的共用設定或這棵樹自己的設定被改了/u);
    g(main, 'config', '--file', sharedCfg, 'core.bare', 'false');
    // 這棵樹自己的設定被改也算
    const perTree = runChecks({ settings: { checks: { commands: [['git', 'config', '--worktree', 'kit.touched', 'yes']] } }, cwd: linked });
    assert.equal(perTree.code, 1, perTree.lines.join('\n'));
    g(linked, 'config', '--worktree', '--unset', 'kit.touched');
    // 對照組：只讀設定不算改
    assert.equal(runChecks({ settings: { checks: { commands: [['git', 'config', '--get', 'core.bare']] } }, cwd: linked }).code, 0, '只讀設定＝照常');

    // 索引不見：git ls-files 不報錯、只回空清單
    const indexFile = g(main, 'rev-parse', '--path-format=absolute', '--git-path', 'index');
    fs.rmSync(indexFile);
    assert.equal(spawnSync('git', ['ls-files'], { cwd: main, encoding: 'utf8', env }).stdout, '', '前提：索引不見時 ls-files 靜靜回空');
    const noIndex = runChecks({ settings, cwd: main });
    assert.equal(noIndex.code, 2);
    assert.match(noIndex.lines.join('\n'), /索引檔卻不見了或 git 讀不了/u);
    g(main, 'read-tree', 'HEAD');
    const indexGone = runChecks({ settings: { checks: { commands: [[process.execPath, '-e', 'require("fs").unlinkSync(process.argv[1])', indexFile]] } }, cwd: main });
    assert.equal(indexGone.code, 1, '跑完才不見＝1');
    g(main, 'read-tree', 'HEAD');
    assert.equal(runChecks({ settings, cwd: main }).code, 0, '重建索引後照常');

    // 正面控制：暫存刪除全部檔案＝索引合法地是空的（r2 B2）
    g(main, 'rm', '-r', '-q', '.');
    assert.ok(fs.existsSync(indexFile), '前提：索引檔還在');
    assert.equal(runChecks({ settings, cwd: main }).code, 0, '空索引是合法狀態，不是索引壞了');
    g(main, 'reset', '-q', '--hard', 'HEAD');

    // 沒登記主目錄布局時的正面控制（r2 B1 用過的形狀；這一版不自己解讀設定檔，照 Git 對這棵樹的判斷）。
    // ⚠️ 這個夾具不是裸儲存庫：主目錄是有檔案的一般 checkout，寫了共用 core.bare=true 之後它其實打不開（下面兩句前提量給你看）；
    //   登記了 checks.mainWorktree 就擋（見⑩）。「真的裸儲存庫＋連結樹＝0」由後面 store.git 那幾句撐著。
    g(main, 'config', 'extensions.worktreeConfig', 'false');
    g(main, 'config', '--file', sharedCfg, 'core.bare', 'true');
    const statusOf = (cwd) => spawnSync('git', ['--no-optional-locks', 'status', '--porcelain'], { cwd, encoding: 'utf8', env }).status;
    assert.notEqual(statusOf(main), 0, '前提：主目錄打不開');
    assert.equal(statusOf(linked), 0, '前提：連結工作樹照常');
    assert.equal(runChecks({ settings, cwd: linked }).code, 0, '沒登記主目錄布局：擴充關＋共用 core.bare=true＋連結工作樹＝照舊放行（這個夾具的主目錄其實打不開；登記了就擋，見⑩）');
    g(main, 'config', '--file', sharedCfg, 'core.bare', 'false');
    const bareRepo = path.join(scratch, 'store.git');
    const bareLinked = path.join(scratch, 'bare-linked');
    g(scratch, 'clone', '-q', '--bare', main, bareRepo);
    g(bareRepo, 'worktree', 'add', '-q', '--detach', bareLinked);
    assert.equal(runChecks({ settings, cwd: bareLinked }).code, 0, '裸儲存庫＋連結工作樹＝正常');
    const storeCfg = path.join(bareRepo, 'config');
    const original = fs.readFileSync(storeCfg, 'utf8');
    const incTrue = path.join(bareRepo, 'defaults.inc');
    fs.writeFileSync(incTrue, '[extensions]\n\tworktreeConfig = true\n');
    for (const [why, text] of [
      ['include 預設開、共用檔明確關', `${original}[include]\n\tpath = ${incTrue}\n[extensions]\n\tworktreeConfig = false\n`],
      ['同一檔先開後關', `${original}[extensions]\n\tworktreeConfig = true\n[extensions]\n\tworktreeConfig = false\n`],
      ['只有 include 裡寫開', `${original}[include]\n\tpath = ${incTrue}\n`],
    ]) {
      fs.writeFileSync(storeCfg, text);
      assert.equal(runChecks({ settings, cwd: bareLinked }).code, 0, `${why}：裸儲存庫形狀＝正常`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

// ---- ⑩⑪⑫共用的小工具 ----
const OK_CMD = [process.execPath, '-e', 'process.exit(0)'];
const withKeys = (extra, commands = [OK_CMD]) => ({ checks: { commands, ...extra } });
const MAIN_REG = { mainWorktree: '一般工作樹' };
/** 路徑故意含空白、單引號、全形括號與中文：訊息裡的還原指令要照貼跑得動（使用專案的真主目錄就長這種樣子）。 */
const ODD_PREFIX = "run-checks 主目錄（it's）-";

function gitKit() {
  const env = { ...gitEnv(), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
  const raw = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8', env });
  const g = (cwd, ...a) => { const r = raw(cwd, ...a); assert.equal(r.status, 0, `git ${a.join(' ')}：${r.stderr}`); return r.stdout.trim(); };
  const status = (cwd) => raw(cwd, '--no-optional-locks', 'status', '--porcelain').status;
  return { raw, g, status };
}

/** 主目錄（有提交、有檔案的一般 checkout）＋一棵連結工作樹。 */
function makePair(g, root, name, { ext }) {
  const main = path.join(root, name, 'main');
  const wt = path.join(root, name, 'wt');
  fs.mkdirSync(main, { recursive: true });
  g(main, 'init', '-q');
  fs.writeFileSync(path.join(main, 'a.txt'), 'x\n');
  g(main, 'add', '.');
  g(main, 'commit', '-q', '-m', 'base');
  if (ext) g(main, 'config', 'extensions.worktreeConfig', 'true');
  g(main, 'worktree', 'add', '-q', '--detach', wt);
  return { main, wt, cfg: path.join(main, '.git', 'config') };
}

/** 訊息裡以 git 開頭的行（還原或自查指令）。 */
const commandLines = (res) => res.lines.filter((l) => l.startsWith('git '));
/** 主目錄被判成裸倉庫時的還原那一行（自查那一行長得不一樣）。 */
const RESTORE_BARE = /^git config --file '.+' --replace-all core\.bare false$/u;

/**
 * 照貼跑：在別的目錄用 sh -c 跑訊息裡每一行指令，每一行都要退 0；回每一行的標準輸出。
 * 指令那一行在引號外不可以有 ASCII 以外的字（後面接了中文，照貼就壞）。
 */
function paste(res, cwd) {
  return commandLines(res).map((c) => {
    assert.doesNotMatch(c.replace(/'[^']*'|\\./gu, ''), /[^ -~]/u, `指令那一行後面不可以接字：${c}`);   // 拿掉單引號段與 \' 之後
    const r = spawnSync('sh', ['-c', c], { cwd, encoding: 'utf8', env: gitEnv() });
    assert.equal(r.status, 0, `照貼 ${c}：${r.stderr}`);
    return r.stdout;
  });
}

test('⑩主目錄布局（登記了 checks.mainWorktree 才驗）：主目錄被判成裸倉庫或打不開＝跑之前 2、跑完才壞 1、還原照貼跑得動；沒登記照舊放行；合法布局登記了也＝0', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ODD_PREFIX));
  const away = fs.mkdtempSync(path.join(os.tmpdir(), 'run-checks-away-'));   // 照貼指令的「別的目錄」（不在任何倉庫裡）
  try {
    const { g, status } = gitKit();
    const loose = withKeys({});
    const reg = withKeys(MAIN_REG);
    const setShared = (p, ...a) => g(root, 'config', '--file', p.cfg, ...a);   // 站在倉庫外面改：主目錄打不開時也改得動

    // 1. 形狀 (1)：擴充開、連結樹自己覆寫 false、共用 core.bare 寫成 Git 認得的各種 true
    const p1 = makePair(g, root, 'one', { ext: true });
    g(p1.wt, 'config', '--worktree', 'core.bare', 'false');
    assert.equal(runChecks({ settings: reg, cwd: p1.wt }).code, 0, '對照組：還沒寫壞時登記了＝0');
    for (const v of ['true', 'yes', 'on', '1']) {
      setShared(p1, 'core.bare', v);
      assert.equal(g(p1.wt, 'rev-parse', '--is-bare-repository'), 'false', `前提（${v}）：從連結樹看生效值健康`);
      assert.notEqual(status(p1.main), 0, `前提（${v}）：主目錄真的打不開`);
      const quiet = runChecks({ settings: loose, cwd: p1.wt });
      assert.equal(quiet.code, 0, `沒登記（${v}）＝照舊放行`);
      assert.match(quiet.lines.join('\n'), /沒登記、所以沒驗：主目錄是不是一般工作樹/u);
      const r = runChecks({ settings: reg, cwd: p1.wt });
      assert.equal(r.code, 2, `登記了（${v}）：${r.lines.join('\n')}`);
      assert.match(r.lines[0], /被 Git 判成裸倉庫了/u);
      assert.ok(commandLines(r).every((l) => RESTORE_BARE.test(l)), `給的是還原、不是自查（${v}）：${r.lines.join('\n')}`);
      assert.equal(paste(r, away).length, 1, `剛好一行還原（${v}）：${r.lines.join('\n')}`);
      assert.equal(status(p1.main), 0, `照貼還原之後主目錄打得開（${v}）`);
      assert.equal(runChecks({ settings: reg, cwd: p1.wt }).code, 0, `還原之後再跑＝0（${v}）`);
    }

    // 2. 形狀 (2)：擴充關、共用 core.bare=true
    const p2 = makePair(g, root, 'two', { ext: false });
    setShared(p2, 'core.bare', 'true');
    assert.notEqual(status(p2.main), 0, '前提：主目錄打不開');
    assert.equal(status(p2.wt), 0, '前提：連結樹照常');
    assert.equal(runChecks({ settings: loose, cwd: p2.wt }).code, 0, '沒登記＝照舊放行');
    const r2 = runChecks({ settings: reg, cwd: p2.wt });
    assert.equal(r2.code, 2, r2.lines.join('\n'));
    assert.ok(commandLines(r2).every((l) => RESTORE_BARE.test(l)), `給的是還原、不是自查：${r2.lines.join('\n')}`);
    assert.equal(paste(r2, away).length, 1, r2.lines.join('\n'));
    assert.equal(status(p2.main), 0, '照貼還原之後主目錄打得開');
    assert.equal(runChecks({ settings: reg, cwd: p2.wt }).code, 0, '還原之後再跑＝0');
    // 共用檔與 include 引進的檔各寫一筆 true：兩筆各給一行還原，改到 include 那個檔之前先提醒它可能被別的倉庫共用
    const incTrue = path.join(root, 'bare-true.inc');
    fs.writeFileSync(incTrue, '[core]\n\tbare = true\n');
    setShared(p2, 'core.bare', 'true');
    setShared(p2, 'include.path', incTrue);
    const r2i = runChecks({ settings: reg, cwd: p2.wt });
    assert.equal(r2i.code, 2, r2i.lines.join('\n'));
    const tip = r2i.lines.findIndex((l) => /不是這個倉庫自己的設定檔/u.test(l));
    assert.ok(tip !== -1 && tip < r2i.lines.findIndex((l) => l.startsWith('git ')), `include 那一檔的提醒要在還原指令之前：${r2i.lines.join('\n')}`);
    assert.equal(paste(r2i, away).length, 2, r2i.lines.join('\n'));
    assert.equal(status(p2.main), 0, '兩行都照貼之後主目錄打得開');
    setShared(p2, '--unset', 'include.path');

    // 3. 擴充關、共用 core.worktree 指到不存在的地方：主目錄打不開、連結樹照常。這一種只給自查、不給還原
    for (const [why, target] of [['上層也不存在', `/nowhere-${process.pid}/zz`], ['只有最後一層不存在', path.join(root, 'missing')]]) {
      setShared(p2, 'core.worktree', target);
      assert.notEqual(status(p2.main), 0, `前提（${why}）：主目錄打不開`);
      assert.equal(status(p2.wt), 0, `前提（${why}）：連結樹照常`);
      assert.equal(runChecks({ settings: loose, cwd: p2.wt }).code, 0, `沒登記（${why}）＝照舊放行`);
      const r = runChecks({ settings: reg, cwd: p2.wt });
      assert.equal(r.code, 2, `${why}：${r.lines.join('\n')}`);
      assert.match(r.lines[0], /git 打不開/u);
      const [seen] = paste(r, away);
      assert.ok(seen.includes(target), `自查那一行照貼跑得動、看得到成因（${why}）：${seen}`);
      setShared(p2, '--unset', 'core.worktree');
    }

    // 共用 core.bare=true、後面 include 一檔寫 false、連結樹自己覆寫 false：生效值說不裸，主目錄照樣打不開
    const p9 = makePair(g, root, 'nine', { ext: true });
    g(p9.wt, 'config', '--worktree', 'core.bare', 'false');
    const inc = path.join(root, 'bare-false.inc');
    fs.writeFileSync(inc, '[core]\n\tbare = false\n');
    setShared(p9, 'core.bare', 'true');
    setShared(p9, 'include.path', inc);
    assert.equal(g(p9.main, 'rev-parse', '--is-bare-repository'), 'false', '前提：在主目錄問生效值，Git 說不裸');
    assert.notEqual(status(p9.main), 0, '前提：主目錄照樣打不開');
    assert.equal(runChecks({ settings: loose, cwd: p9.wt }).code, 0, '沒登記＝照舊放行');
    const r9 = runChecks({ settings: reg, cwd: p9.wt });
    assert.equal(r9.code, 2, r9.lines.join('\n'));
    assert.match(r9.lines[0], /git 打不開/u);

    // 4. 三關中途只寫主目錄自己的 config.worktree：指紋只看共用檔與這棵樹自己的，看不到它
    const mainOwn = path.join(p1.main, '.git', 'config.worktree');
    const breaker = (extra) => withKeys(extra, [['git', 'config', '--file', mainOwn, 'core.bare', 'true']]);
    assert.equal(runChecks({ settings: breaker({}), cwd: p1.wt }).code, 0, '沒登記＝照舊放行');
    assert.notEqual(status(p1.main), 0, '對照組：主目錄真的被弄壞了，指紋沒看到');
    fs.rmSync(mainOwn);
    assert.equal(status(p1.main), 0, '前提：拿掉之後主目錄好了');
    const r4 = runChecks({ settings: breaker(MAIN_REG), cwd: p1.wt });
    assert.equal(r4.code, 1, r4.lines.join('\n'));
    assert.match(r4.lines.join('\n'), /三關跑完之後，主目錄/u);
    assert.equal(paste(r4, away).length, 1, r4.lines.join('\n'));
    assert.equal(status(p1.main), 0, '照貼還原之後主目錄打得開');
    fs.rmSync(mainOwn);

    // 5. 行程帶著 GIT_DIR（指向另一個健康倉庫）：問主目錄的子行程也要清掉它，不然問到的是那個健康倉庫
    const healthy = makePair(g, root, 'healthy', { ext: true });
    setShared(p1, 'core.bare', 'true');
    const prev = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(healthy.main, '.git');
    let dirty;
    try { dirty = runChecks({ settings: reg, cwd: p1.wt }); } finally { if (prev === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = prev; }
    assert.equal(dirty.code, 2, `帶著髒 GIT_DIR 也要擋：${dirty.lines.join('\n')}`);
    setShared(p1, 'core.bare', 'false');

    // 6. 合法布局，登記了也＝0
    assert.equal(runChecks({ settings: reg, cwd: healthy.main }).code, 0, '從主目錄本身跑＝0');
    const every = makePair(g, root, 'every', { ext: true });
    g(every.main, 'config', '--worktree', 'core.bare', 'false');
    g(every.wt, 'config', '--worktree', 'core.bare', 'false');
    setShared(every, 'core.bare', 'true');
    assert.equal(status(every.main), 0, '前提：每棵樹都覆寫了，主目錄打得開');
    assert.equal(runChecks({ settings: reg, cwd: every.wt }).code, 0, '共用 true、每棵樹（含主目錄）都覆寫 false＝0');
    const store = path.join(root, 'store.git');
    g(root, 'clone', '-q', '--bare', healthy.main, store);
    g(store, 'worktree', 'add', '-q', '--detach', path.join(root, 'store-wt'));
    assert.equal(runChecks({ settings: reg, cwd: path.join(root, 'store-wt') }).code, 0, '真的裸儲存庫（store.git）＋連結樹＝0');
    g(root, 'clone', '-q', '--separate-git-dir', path.join(root, 'gitstore'), healthy.main, path.join(root, 'sep'));
    g(path.join(root, 'sep'), 'worktree', 'add', '-q', '--detach', path.join(root, 'sep-wt'));
    assert.equal(runChecks({ settings: reg, cwd: path.join(root, 'sep-wt') }).code, 0, '--separate-git-dir＋連結樹＝0');
    const moved = makePair(g, root, 'moved', { ext: false });
    const elsewhere = path.join(root, 'elsewhere');
    fs.mkdirSync(elsewhere);
    fs.renameSync(path.join(moved.main, 'a.txt'), path.join(elsewhere, 'a.txt'));
    setShared(moved, 'core.worktree', elsewhere);
    assert.equal(fs.realpathSync(g(moved.main, 'rev-parse', '--show-toplevel')), fs.realpathSync(elsewhere), '前提：Git 說主目錄的工作樹根搬到了別處');
    assert.equal(runChecks({ settings: reg, cwd: moved.wt }).code, 0, 'core.worktree 把主目錄合法搬到存在的別處＝0');

    // 7. 照實的代價：proj/.git 是裸儲存庫＋連結樹，從 Git 看跟形狀 (2) 一模一樣——登記了就擋
    const proj = path.join(root, 'proj');
    g(root, 'clone', '-q', '--bare', healthy.main, path.join(proj, '.git'));
    g(path.join(proj, '.git'), 'worktree', 'add', '-q', '--detach', path.join(proj, 'wt'));
    assert.equal(runChecks({ settings: loose, cwd: path.join(proj, 'wt') }).code, 0, '沒登記＝0');
    const rp = runChecks({ settings: reg, cwd: path.join(proj, 'wt') });
    assert.equal(rp.code, 2, '登記了「一般工作樹」的專案，這種布局的複本會被擋（MACHINES.md 的 E2、E3 那一列）');
    const warn = rp.lines.findIndex((l) => /本來就是裸儲存庫的話不要照做/u.test(l));
    const fix = rp.lines.findIndex((l) => l.startsWith('git '));
    assert.ok(warn !== -1 && fix !== -1 && warn < fix, `「不適用這台」那句要在還原指令之前：${rp.lines.join('\n')}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(away, { recursive: true, force: true });
  }
});

test('⑪索引錨點（登記了 checks.indexAnchors 才驗）：錨點不在這棵樹的索引裡＝跑之前 2、跑完才不見 1、還原照貼跑得動；沒登記照舊放行；合法形狀登記了也＝0', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ODD_PREFIX));
  const away = fs.mkdtempSync(path.join(os.tmpdir(), 'run-checks-away-'));
  try {
    const { raw, g } = gitKit();
    const repo = path.join(root, 'repo');
    const ANCHORS = ['anchor.txt', 'deep/x/anchor2.txt', ':odd'];
    for (const f of [...ANCHORS, 'other.txt', 'dir2/y.txt']) {
      fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
      fs.writeFileSync(path.join(repo, f), `${f}\n`);
    }
    g(repo, 'init', '-q');
    g(repo, 'add', '.');
    g(repo, 'commit', '-q', '-m', 'base');
    const loose = withKeys({});
    const reg = withKeys({ indexAnchors: ANCHORS });
    const check = (settings = reg) => runChecks({ settings, cwd: repo });
    const indexFile = g(repo, 'rev-parse', '--path-format=absolute', '--git-path', 'index');

    // 1. 健康＝0（含 : 開頭的錨點）
    const fine = check();
    assert.equal(fine.code, 0, fine.lines.join('\n'));
    assert.doesNotMatch(fine.lines.join('\n'), /索引錨點（checks\.indexAnchors）/u, '登記了就不再說沒驗');
    // 問錨點的那一次 git 失敗（PATH 最前面放一支假 git，只讓帶 --literal-pathspecs 的那一次退 128）：不可以當成都在
    const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
    const fakeBin = path.join(root, 'fake-bin');
    fs.mkdirSync(fakeBin);
    fs.writeFileSync(path.join(fakeBin, 'git'), `#!/bin/sh\ncase " $* " in *" --literal-pathspecs "*) echo "fatal: injected" >&2; exit 128;; esac\nexec '${realGit}' "$@"\n`, { mode: 0o755 });
    const prevPath = process.env.PATH;
    process.env.PATH = `${fakeBin}${path.delimiter}${prevPath}`;
    let blind;
    let blindLoose;
    try { blind = check(); blindLoose = check(loose); } finally { process.env.PATH = prevPath; }
    assert.equal(blindLoose.code, 0, `對照組：假 git 只擋問錨點那一次，其餘照常：${blindLoose.lines.join('\n')}`);
    assert.equal(blind.code, 2, `問不到錨點＝不放行：${blind.lines.join('\n')}`);
    assert.match(blind.lines[0], /git 讀不了/u);

    // 2. 整份清空（兩種寫法）
    for (const args of [['read-tree', '--empty'], ['rm', '-r', '-q', '--cached', '.']]) {
      const why = args.join(' ');
      g(repo, ...args);
      assert.equal(raw(repo, 'ls-files').stdout, '', `前提（${why}）：ls-files 靜靜回空`);
      assert.ok(fs.existsSync(indexFile), `前提（${why}）：索引檔還在`);
      assert.equal(check(loose).code, 0, `沒登記（${why}）＝照舊放行`);
      const r = check();
      assert.equal(r.code, 2, `${why}：${r.lines.join('\n')}`);
      assert.match(r.lines[0], /登記的全部不見/u);
      assert.equal(paste(r, away).length, 1, r.lines.join('\n'));
      assert.equal(check().code, 0, `照貼還原之後＝0（${why}）`);
    }

    // 3. 只拿掉一筆
    g(repo, 'rm', '-q', '--cached', 'anchor.txt');
    const r12 = check();
    assert.equal(r12.code, 2, r12.lines.join('\n'));
    assert.match(r12.lines[0], /：anchor\.txt。$/u, `只列少掉的那一個：${r12.lines[0]}`);
    assert.equal(paste(r12, away).length, 1);
    assert.equal(check().code, 0, '照貼還原之後＝0');

    // 4. 索引裡那一筆的路徑被改了一個位元組（檢查碼沒重算）
    const buf = fs.readFileSync(indexFile);
    const at = buf.indexOf('anchor.txt');
    assert.ok(at > 0, '前提：索引裡找得到那一筆');
    buf.write('anchos.txt', at);
    fs.writeFileSync(indexFile, buf);
    const listed = raw(repo, 'ls-files');
    assert.equal(listed.status, 0, '前提：ls-files 照常');
    assert.match(listed.stdout, /^anchos\.txt$/mu, '前提：列出來的是被改過的名字');
    const r13 = check();
    assert.equal(r13.code, 2, r13.lines.join('\n'));
    assert.equal(paste(r13, away).length, 1);
    assert.equal(check().code, 0, '照貼還原之後＝0');

    // 5. 三關中途清空（兩種寫法）
    for (const cmd of [['git', 'read-tree', '--empty'], ['git', 'rm', '-r', '-q', '--cached', '.']]) {
      assert.equal(check(withKeys({}, [cmd])).code, 0, `沒登記（${cmd.join(' ')}）＝照舊放行`);
      g(repo, 'read-tree', 'HEAD');
      const r = check(withKeys({ indexAnchors: ANCHORS }, [cmd]));
      assert.equal(r.code, 1, r.lines.join('\n'));
      assert.match(r.lines.join('\n'), /三關跑完之後，這棵樹的索引/u);
      assert.equal(paste(r, away).length, 1);
      assert.equal(check().code, 0, '照貼還原之後＝0');
    }

    // 6. 合法、登記了也＝0
    g(repo, 'rm', '-q', '--cached', 'other.txt');
    assert.equal(check().code, 0, '取消追蹤非錨點＝0');
    g(repo, 'reset', '-q');
    g(repo, 'mv', 'other.txt', 'other2.txt');
    assert.equal(check().code, 0, '改名非錨點＝0');
    g(repo, 'mv', 'other2.txt', 'other.txt');
    fs.appendFileSync(path.join(repo, 'anchor.txt'), 'more\n');
    g(repo, 'add', 'anchor.txt');
    assert.equal(check().code, 0, '暫存修改錨點＝0');
    g(repo, 'reset', '-q', '--hard');
    g(repo, 'sparse-checkout', 'init', '--cone', '--sparse-index');
    g(repo, 'sparse-checkout', 'set', 'dir2');
    assert.ok(!fs.existsSync(path.join(repo, 'deep')), '前提：錨點所在的目錄不在磁碟上');
    assert.match(raw(repo, 'ls-files', '--sparse').stdout, /^deep\/$/mu, '前提：索引裡 deep 收成一筆稀疏目錄');
    assert.equal(check().code, 0, '稀疏 cone＋稀疏索引＝0');
    g(repo, 'sparse-checkout', 'disable');

    // 7. 照登記擋的（專案自己選的）
    g(repo, 'rm', '-r', '-q', '.');
    assert.equal(check(loose).code, 0, '沒登記：暫存刪除全部＝0（⑨的正面控制照舊）');
    assert.equal(check().code, 2, '登記了：暫存刪除全部（含錨點）＝2');
    g(repo, 'reset', '-q', '--hard', 'HEAD');
    g(repo, 'mv', 'anchor.txt', 'renamed.txt');
    g(repo, 'commit', '-q', '-m', 'rename');
    const stale = check();
    assert.equal(stale.code, 2, stale.lines.join('\n'));
    assert.match(stale.lines.join('\n'), /最新提交裡也沒有：anchor\.txt。登記跟專案對不上/u);
    assert.equal(commandLines(stale).length, 0, '登記跟專案對不上時不給 git 指令（重建索引也不會好）');
    assert.equal(check(withKeys({ indexAnchors: ['renamed.txt', 'deep/x/anchor2.txt', ':odd'] })).code, 0, '登記跟著改＝0');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(away, { recursive: true, force: true });
  }
});

test('⑫兩個登記寫錯＝2、一關都不跑、訊息指出哪一格；沒寫或寫「未設定」＝沒登記、全綠那一行照實說沒驗；登記了三關前後都照登記驗；三關後兩種壞法都印', () => {
  const calls = [];
  const seen = [];
  const run = (argv) => { calls.push(argv); return { status: 0 }; };
  const tree = (_run, _cwd, opts) => { seen.push(opts); return { state: 'ok' }; };
  const go = (extra) => { calls.length = 0; seen.length = 0; return runChecks({ settings: withKeys(extra), run, tree, fingerprint: () => 'same' }); };
  const ch = (n) => String.fromCharCode(n);
  const oneLine = (s) => !Array.from(s).some((c) => { const n = c.codePointAt(0); return n < 0x20 || n === 0x7f || n === 0x85 || n === 0x2028 || n === 0x2029; });
  const anchorsBad = [
    [[], 0], ['a', 0], [null, 0], [[1], 1], [['未設定', 'a'], 1], [['ok.txt', './a'], 2],
    [['a/'], 1], [['/a'], 1], [['..'], 1], [['.'], 1], [['../a'], 1], [['a//b'], 1], [['a/./b'], 1], [['a/../b'], 1], [[''], 1],
    [[`a${ch(10)}b`], 1], [[`a${ch(0x2028)}b`], 1], [[`a${ch(0)}b`], 1], [[`a${ch(0x7f)}b`], 1], [[`a${ch(9)}b`], 1], [[`a${ch(0x85)}b`], 1],
  ];
  for (const [value, at] of anchorsBad) {
    const r = go({ indexAnchors: value });
    const what = JSON.stringify(value);
    assert.equal(r.code, 2, what);
    assert.equal(calls.length + seen.length, 0, `寫錯就一關都不跑、也不去驗樹：${what}`);
    assert.equal(r.lines.length, 1, what);
    assert.match(r.lines[0], /^專案設定 checks\.indexAnchors /u, `訊息要指出是錨點那一格寫錯（不是被「找不到」擋下）：${what}`);
    if (at) assert.match(r.lines[0], new RegExp(`第 ${at} 筆`, 'u'), what);
    assert.ok(oneLine(r.lines[0]), `訊息維持一行：${what}`);
  }
  for (const value of ['裸', '', 1, true, null, `一般工作樹${ch(0x2028)}`]) {
    const r = go({ mainWorktree: value });
    const what = JSON.stringify(value);
    assert.equal(r.code, 2, what);
    assert.equal(calls.length + seen.length, 0, what);
    assert.match(r.lines[0], /^專案設定 checks\.mainWorktree /u, what);
    assert.ok(oneLine(r.lines[0]), `訊息維持一行：${what}`);
  }
  // 沒登記：沒寫、或寫「未設定」
  for (const extra of [{}, { mainWorktree: '未設定', indexAnchors: ['未設定'] }]) {
    const r = go(extra);
    assert.equal(r.code, 0, JSON.stringify(extra));
    assert.deepEqual(seen, [{ mainNormal: false, anchors: null }, { mainNormal: false, anchors: null }], JSON.stringify(extra));
    assert.equal(r.lines.at(-1), '三關全綠（1 關）。沒登記、所以沒驗：主目錄是不是一般工作樹（checks.mainWorktree）、索引錨點（checks.indexAnchors）。');
  }
  const both = go({ mainWorktree: '一般工作樹', indexAnchors: [':odd', 'a/b.txt'] });
  assert.equal(both.code, 0);
  const want = { mainNormal: true, anchors: [':odd', 'a/b.txt'] };
  assert.deepEqual(seen, [want, want], '三關前後兩次都照登記驗');
  assert.equal(both.lines.at(-1), '三關全綠（1 關）。');
  assert.match(go({ mainWorktree: '一般工作樹' }).lines.at(-1), /。沒登記、所以沒驗：索引錨點（checks\.indexAnchors）。$/u);
  assert.match(go({ indexAnchors: ['a'] }).lines.at(-1), /。沒登記、所以沒驗：主目錄是不是一般工作樹（checks\.mainWorktree）。$/u);

  // 三關後樹壞了、設定也變了：兩段都印（原本樹壞了就先回、設定那一段看不到）
  let n = 0;
  let print = 0;
  const flip = () => ({ state: n++ === 0 ? 'ok' : 'wrong-tree' });
  const r = runChecks({ settings: withKeys({}), run, tree: flip, fingerprint: () => `v${print++}` });
  assert.equal(r.code, 1);
  assert.match(r.lines.join('\n'), /被指到別處了/u);
  assert.match(r.lines.join('\n'), /設定被改了/u);
});
