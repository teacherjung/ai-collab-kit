// 考題專用：Claude 側釘指紋那幾題（tests/guard-copy-claude.test.js、tests/claude-pin.test.js）共用的布置——
// 暫存的來源專案、假的家目錄、照鉤子的起法跑一次那一行指令。
//
// ⚠️ HOME 紀律：釘指紋那一行與 tools/guard-copy.js 的 --claude／--retire 都從 HOME 算複本的位置。
//   這裡每一個會起子行程的零件都**一定要**明講家目錄（home: null＝刻意不設 HOME）；漏給＝當場丟錯，
//   不是沿用這支考卷自己的 HOME——沿用的話就會去讀寫真的 ~/.local/share/ai-collab-kit。
//   直接呼叫函式（buildClaude、retire）時一樣每次都帶 home。
//   第二張網＝tests/filled-settings.test.js：巢狀那一輪把 HOME 換成空的暫存目錄並盯著它零寫入；只罩得到巢狀那一輪。
// （tests/guard-copy.test.js 有一組同名的零件，刻意沒有抽過來共用：那一支是「Codex 全域層的行為沒有變」的證據，這一批不動它。）
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('../../tools/git-env.js');

const KIT = path.join(__dirname, '..', '..');
// 全是假名（連接器、工具名都是編的）
const FAKE = {
  name: '測試禁區', servers: ['fakebroker'], allowlist: ['get_quote'], deny: ['mcp__other__harmless_named_thing'],
  verbs: ['create', 'place'], nouns: ['widget'], readPrefixes: ['get'], patterns: [],
};
/** 同一份清單改弱：原本照清單該擋的 DENIED，照這一份不擋。 */
const LOOSE = { ...FAKE, servers: ['nothing_here'], verbs: ['nothing_here'] };
const DENIED = 'mcp__fakebroker__place_widget';
const ALLOWED = 'mcp__other__get_widget';
const MISMATCH = /指紋對不上/u;
const STARTUP = /起不來/u;

const base = gitEnv();
delete base.NODE_TEST_CONTEXT;
delete base.HOME;
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...base, HOME: cwd, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' } });

const homeEnv = (home) => {
  if (home === undefined) throw new Error('考題漏給 home：每一次起子行程都要明講家目錄（null＝刻意不設 HOME）');
  return home === null ? {} : { HOME: home };
};

/** 暫存的來源專案：套件的 tools/ 與 templates/＋考題給的設定，提交成一個版本。 */
function sourceRepo(scratch, { forbidden = FAKE, edit, mainBranch = 'main', merged = true } = {}) {
  const src = fs.mkdtempSync(path.join(scratch, 'src-'));
  fs.cpSync(path.join(KIT, 'tools'), path.join(src, 'tools'), { recursive: true });
  fs.cpSync(path.join(KIT, 'templates'), path.join(src, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(src, 'settings.json'), JSON.stringify({ participants: [], mainBranch, forbidden, gates: [] }, null, 2));
  if (edit) edit(src);
  assert.equal(git(src, 'init', '-q').status, 0);
  assert.equal(git(src, 'add', '-A').status, 0);
  const c = git(src, 'commit', '-qm', 'src');
  assert.equal(c.status, 0, c.stderr);
  // 當成已經合併：本機的 origin/<主幹> 追蹤參照指到這一顆（不連網）
  if (merged) assert.equal(git(src, 'update-ref', `refs/remotes/origin/${mainBranch}`, 'HEAD').status, 0);
  return src;
}

/** 改檔用：sourceRepo 的 edit 參數。 */
const editFile = (rel, fn) => ({ edit: (dir) => fs.writeFileSync(path.join(dir, rel), fn(fs.readFileSync(path.join(dir, rel), 'utf8'))) });

/** 一個空的假家目錄。 */
const fakeHome = (scratch) => fs.mkdtempSync(path.join(scratch, 'home-'));

/** 照鉤子的起法跑一次。回 spawnSync 結果。 */
const hook = (command, { home, tool = ALLOWED, flag = '-c', cwd = os.tmpdir(), env = {} } = {}) =>
  spawnSync('/bin/sh', [flag, command], { cwd, env: { ...base, ...homeEnv(home), ...env }, input: JSON.stringify({ tool_name: tool }), encoding: 'utf8' });

/** 跑某一份來源專案自己的 tools/guard-copy.js 指令入口（暫存區放行只給考題用）。 */
const tool = (root, args, { home, env = {} } = {}) =>
  spawnSync(process.execPath, [path.join(root, 'tools', 'guard-copy.js'), ...args], { cwd: os.tmpdir(), encoding: 'utf8', env: { ...base, KIT_GUARD_COPY_ALLOW_TEMP: '1', ...homeEnv(home), ...env } });

/** Claude 側那一行的拒絕：退 0、標準輸出**整段**是拒絕形狀。 */
const denies = (r, why) => {
  assert.equal(r.status, 0, `${why}：退出碼 ${r.status}（${r.stderr}）`);
  let decision = null;
  try { decision = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch { /* 不是拒絕形狀：下面那一句會講 */ }
  assert.equal(decision, 'deny', `${why}：標準輸出不是拒絕形狀（「${r.stdout.slice(0, 120)}」）`);
};
const allows = (r, why) => assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', ''], why);
const blocks = (r, re, why) => {
  assert.equal(r.status, 2, `${why}：退出碼 ${r.status}（${r.stderr}）`);
  assert.equal(r.stdout, '', why);
  assert.match(r.stderr, re, why);
};

function walk(dir) {
  const out = [dir];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name)));
    else out.push(path.join(dir, e.name));
  }
  return out;
}

function withScratch(fn) {
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-guard-claude-')));
  try { return fn(scratch); } finally {
    for (const p of walk(scratch)) { try { if (!fs.lstatSync(p).isSymbolicLink()) fs.chmodSync(p, 0o755); } catch { /* 已經不在 */ } }
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** 一棵目錄現在的樣子（每一筆的路徑、大小、修改時間）：前後各拍一次，用來證明「什麼都沒寫」。 */
const snapshot = (dir) => walk(dir).map((p) => { const st = fs.lstatSync(p); return `${path.relative(dir, p)}|${st.isDirectory() ? 'd' : st.size}|${st.mtimeMs}`; }).sort();

module.exports = { KIT, FAKE, LOOSE, DENIED, ALLOWED, MISMATCH, STARTUP, base, git, sourceRepo, editFile, fakeHome, hook, tool, denies, allows, blocks, walk, withScratch, snapshot };
