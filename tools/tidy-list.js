#!/usr/bin/env node
// 整理清單：開工或收工時手動跑，列出可以收的東西——已合併或上游已刪的本機分支、沒人用的工作樹、暫存資料夾裡的舊審查樹、
// 舊的暫存（stash）。只列不刪：刪任何東西都是列給擁有者看、他點頭之後另外動手。不排程、不接進三關。
//
// 為什麼：擁有者 2026-10-08 裁「好，整理清單排進待辦」（他問理財清完已合併分支後「之後是不是會做一個園丁專門幫我們整理這些？」），
// 條件「下一次又要臨時派人清分支或工作樹時就做」；2026-10-10 他叫人收掉一棵已結案的工作樹，同一天量到暫存資料夾底下
// 還有一百多個舊的審查樹沒人收——條件到了（擁有者 10/10 授權 Fable 代裁，裁「另開一支做」）。
//
// 只負責四類；另外兩類只指路、不重做（規矩 K1）：進度摘要裡過期的條目＝tools/check-progress-summary.js（已結束滿 30 天、
// 沒動的線都由它列）；待辦裡條件已到的＝tools/backlog-touch.js（開工印待辦）。
//
// 判法（都只讀、不改任何東西；看樹的狀態用 git --no-optional-locks，不搶鎖、不寫索引）：
//   ①分支：本機分支裡，尖端已經在主幹歷史裡的（快轉或一般合併），或追蹤的上游分支已經不在遠端的（壓成一顆合併、合併後刪了遠端分支
//     的常見情形）；目前所在的分支與主幹本身不列。「上游已不在」只代表遠端刪了，不代表一定合併過——清單照實寫是哪一種。
//     檢出在某棵工作樹的照列、並寫出是哪一棵（那棵有人在用就先別動分支）。
//   ②工作樹：登記在這個倉庫的工作樹（主目錄本身、上鎖的不列），符合任一條就列：資料夾已經不在（可以 prune 的登記）、
//     檢出的是①會列的分支、或停在主幹歷史裡某一顆的分離狀態而且沒有未提交的改動。有未提交改動、或讀不了狀態的不列（可能有人在用）。
//     常設工作樹（D2）平常就停在分離狀態、也會被列——收之前先對進度摘要裡那棵樹是誰的。
//   ③暫存資料夾：--tmp 給的資料夾（預設系統暫存區與 /tmp）第一層、名字像審查或掃描用的樹（TMP_NAME：帶 review、scan、mutat、
//     mutant、evidence、survivor、probe、fixture 其中一個字，或前後是分隔符號的 PR 編號 pr<數字>、輪次 r<一兩位數>〔可以直接接 PR 編號〕），而且最後修改超過 --days 天
//     （預設 1 天＝24 小時）的資料夾。它本身是或底下有登記在這個倉庫的工作樹（歸②判；只比登記的路徑，.git 讀不讀得到都一樣）、
//     往下兩層裡別的倉庫的樹上鎖、讀不了狀態、有沒提交的改動、或有資料夾讀不了（判斷不了就保守不列），整個資料夾不列
//     （送審產生器的布局是 review-…/tree、review-…/mutation，容器本身不是樹）。
//   ④stash：每一筆都列、附建立的日期；stash 整個倉庫共用，誰的都在這裡。
// 主幹：--main 給的（先找 origin/<名字>、再找本機同名分支），沒給就用專案設定的主幹分支名（origin/<主幹>，再找本機）。
// 輸出：預設只印各類幾個；--list 才印整份清單。
// ⚠️ 守不到的：分支「真的合併過」只看得到快轉或一般合併、看不到壓成一顆的合併（那種只能用「上游已不在」推，推錯的會列成可以收）；
//   工作樹「有沒有人在用」只看有沒有未提交的改動，開著的編輯器、正在跑的工具看不到；暫存資料夾只看名字與第一層的修改時間
//   （裡面更深的檔改了，第一層的時間不一定跟著變），不看內容，名字不像審查樹的舊資料夾（例如考題留下的）不列；裡面的樹只往下找兩層、
//   捷徑不跟，更深的樹或沒有 .git 的複本有沒有人在用看不到；
//   別的倉庫的工作樹（登記在別的倉庫）不列——在那個倉庫裡跑才列得到。
// 退出碼：0＝列完了（有沒有東西都是 0）／2＝列不了（不在 git 倉庫裡、主幹找不到、主幹沒填又沒給 --main、參數不對、git 出錯）。
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('./git-env.js');
const { read: readSettings } = require('./settings-data.js');

const DAYS = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
// 審查樹的名字：帶這幾個字之一（不分大小寫）；或帶 PR 編號、輪次，而且前後是分隔符號（只認小寫：mkdtemp 的六碼亂數尾巴常有
// 「-PR9PKV」「-pr1xld」這種，前後不是分隔符號就不算）。
const TMP_WORD = /review|scan|mutat|mutant|evidence|survivor|probe|fixture/iu;
const TMP_TAG = /(?:^|[-_.])(?:pr\d+|r\d{1,2}(?:pr\d+)?)(?:[-_.]|$)/u;
const TMP_NAME = { test: (n) => TMP_WORD.test(n) || TMP_TAG.test(n) };
const UNSET = '未設定';
const USAGE = '用法：node tools/tidy-list.js [--main <主幹>] [--days <天數>] [--tmp <資料夾>]… [--list]';

class TidyError extends Error {}

function git(cwd, args, { allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new TidyError(`git 起不來：${r.error.message}`);
  if (r.status !== 0 && !allowFail) throw new TidyError(`git ${args.join(' ')} 退 ${r.status === null ? '（被殺掉）' : r.status}：${(r.stderr || '').trim() || '（沒有訊息）'}`);
  return r;
}

function parseArgs(argv) {
  const opts = { main: null, days: DAYS, tmp: [], list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new TidyError(`${a} 後面要接值。${USAGE}`); return argv[++i]; };
    if (a === '--main') opts.main = next();
    else if (a === '--days') { const v = next(); if (!/^\d+$/u.test(v)) throw new TidyError(`--days 要是非負整數（收到「${v}」）`); opts.days = Number(v); }
    else if (a === '--tmp') opts.tmp.push(next());
    else if (a === '--list') opts.list = true;
    else throw new TidyError(`不認得的參數：${a}。${USAGE}`);
  }
  return opts;
}

/** 主幹：先 origin/<名字>、再本機 <名字>。回 { ref：完整的參照名（拿來算），label：印給人看的 }。 */
function mainRef(cwd, name) {
  const tries = [[`refs/remotes/origin/${name}`, `origin/${name}`], [`refs/heads/${name}`, name]];
  for (const [ref, label] of tries) if (git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true }).status === 0) return { ref, label, name };
  throw new TidyError(`找不到主幹（試過 ${tries.map((x) => x[1]).join('、')}）`);
}

/** a 在不在 b 的歷史裡：0＝在、1＝不在；其他退出碼（物件壞了、查不到）＝git 出錯、退 2，不當成「不在」（#73 r1 R2）。 */
function isAncestor(cwd, a, b) {
  const r = git(cwd, ['merge-base', '--is-ancestor', a, b], { allowFail: true });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  throw new TidyError(`git merge-base --is-ancestor ${a} ${b} 退 ${r.status === null ? '（被殺掉）' : r.status}：${(r.stderr || '').trim() || '（沒有訊息）'}`);
}

/** 參照的短名：只拿掉固定前綴（refs/heads/、refs/remotes/）。不用 git 的 :short——有同名標籤時它會回 heads/main 這種（#73 r1 R3）。 */
const shortRef = (ref) => ref.replace(/^refs\/(?:heads|remotes)\//u, '');

/** 一棵樹的狀態（不搶鎖、不寫索引）：回 { ok：讀得到，dirty：有沒提交的改動（含沒追蹤的檔） }。 */
function treeStatus(dir) {
  let r;
  try { r = git(dir, ['--no-optional-locks', 'status', '--porcelain', '--untracked-files=normal'], { allowFail: true }); } catch (e) {
    if (e instanceof TidyError) return { ok: false, dirty: false };   // 進不去那個資料夾（權限）＝讀不了狀態，照「可能有人在用」不列，不讓整支停
    throw e;
  }
  return { ok: r.status === 0, dirty: r.status === 0 && r.stdout.trim() !== '' };
}

/** 工作樹登記：每棵一筆 { dir, real, branch, head, detached, locked, prunable }。 */
function worktreeEntries(cwd) {
  const blocks = git(cwd, ['worktree', 'list', '--porcelain', '-z']).stdout.split('\0\0').filter((b) => b.replace(/\0/gu, '').trim());
  return blocks.map((block) => {
    const f = {};
    for (const l of block.split('\0').filter(Boolean)) { const i = l.indexOf(' '); if (i < 0) f[l] = true; else f[l.slice(0, i)] = l.slice(i + 1); }
    let real = null;
    try { real = fs.realpathSync(f.worktree); } catch { /* 不在 */ }
    return {
      dir: f.worktree, real,
      branch: typeof f.branch === 'string' ? f.branch.replace(/^refs\/heads\//u, '') : null,
      head: typeof f.HEAD === 'string' ? f.HEAD : null,
      detached: Boolean(f.detached), locked: f.locked !== undefined, prunable: f.prunable !== undefined,
    };
  }).filter((w) => w.dir);
}

/** ①分支：尖端在主幹歷史裡、或上游已不在。 */
function staleBranches(cwd, main, trees) {
  const current = git(cwd, ['branch', '--show-current']).stdout.trim();
  const out = [];
  const rows = git(cwd, ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(upstream)%00%(upstream:track)', 'refs/heads/']).stdout.split('\n').filter(Boolean);
  for (const row of rows) {
    const [ref, sha, upstreamRef, track] = row.split('\0');
    const name = shortRef(ref);
    const upstream = upstreamRef ? shortRef(upstreamRef) : '';
    if (name === current || name === main.name) continue;
    let why = null;
    if (isAncestor(cwd, sha, main.ref)) why = '尖端已在主幹歷史裡';
    else if (upstream && track === '[gone]') why = `上游 ${upstream} 已不在遠端（遠端刪了；是不是壓成一顆合併過，要對 PR 確認）`;
    if (!why) continue;
    const at = trees.find((w) => w.branch === name);
    out.push({ name, why: at ? `${why}；檢出在工作樹 ${at.dir}` : why });
  }
  return out;
}

/** ②工作樹：資料夾不在、檢出①的分支、或分離狀態停在主幹歷史裡而且乾淨。 */
function staleWorktrees(cwd, main, branches, trees) {
  const common = path.resolve(cwd, git(cwd, ['rev-parse', '--git-common-dir']).stdout.trim());
  let mainDir = null;
  try { mainDir = fs.realpathSync(path.dirname(common)); } catch { /* 主目錄不在：每棵都照下面判 */ }
  const listed = new Set(branches.map((b) => b.name));
  const out = [];
  for (const w of trees) {
    if (w.real && w.real === mainDir) continue;
    if (w.locked) continue;
    if (!w.real) { out.push({ dir: w.dir, why: '資料夾已經不在（可以 prune 的登記）' }); continue; }
    const s = treeStatus(w.real);
    if (!s.ok || s.dirty) continue;   // 有未提交改動、或讀不了＝可能有人在用，不列
    if (w.branch && listed.has(w.branch)) out.push({ dir: w.dir, why: `檢出的分支 ${w.branch} 在①裡、乾淨` });
    else if (w.detached && w.head && isAncestor(cwd, w.head, main.ref)) out.push({ dir: w.dir, why: `分離狀態停在主幹歷史裡的 ${w.head.slice(0, 8)}、乾淨（常設工作樹也長這樣，收之前先對是誰的）` });
  }
  return out;
}

/**
 * 暫存資料夾的候選能不能當成「可以收」（#73 r1 R1、r2 R1）。不能的理由回字串，可以回 null：
 *   ①它本身就是、或底下（任何深度）有這個倉庫登記的工作樹＝歸②判，整個不列。只比登記的路徑，不看 .git 讀不讀得到
 *     （.git 被移走或讀不了時，登記與鎖都還在）。
 *   ②它自己與往下 TREE_DEPTH 層裡，別的倉庫或獨立倉庫的樹：上鎖、讀不了狀態、有沒提交的改動＝不列；找到一棵樹就不往它裡面走、捷徑不跟。
 *   ③走的時候有資料夾讀不了、或 .git 判斷不了（不是「不存在」的錯）＝判斷不了，保守不列。
 * 送審產生器的布局是 review-…/tree、review-…/mutation，容器本身不是樹，所以只比完全相同的路徑不夠。
 */
const TREE_DEPTH = 2;
function protectedInside(dir, own) {
  const forms = new Set([path.resolve(dir)]);
  try { forms.add(fs.realpathSync(dir)); } catch { /* 留原路徑 */ }
  for (const o of own) for (const f of forms) if (o === f || o.startsWith(f + path.sep)) return `本身是、或底下有登記在這個倉庫的工作樹（${o}，歸工作樹那一類判）`;
  const queue = [[dir, 0]];
  while (queue.length) {
    const [d, depth] = queue.shift();
    let dotGit = null;
    try { dotGit = fs.lstatSync(path.join(d, '.git')); } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') return `判斷不了 ${d} 是不是樹（${e.code}）`;
    }
    if (dotGit) {
      if (dotGit.isFile()) {
        let gitdir = null;
        try { const m = /^gitdir:\s*(.+?)\s*$/mu.exec(fs.readFileSync(path.join(d, '.git'), 'utf8')); if (m) gitdir = path.resolve(d, m[1]); } catch { return `判斷不了 ${d} 是不是上鎖的樹（.git 讀不了）`; }
        if (gitdir && fs.existsSync(path.join(gitdir, 'locked'))) return `裡面有上鎖的樹（${d}）`;
      }
      const s = treeStatus(d);
      if (!s.ok) return `裡面有讀不了狀態的樹（${d}）`;
      if (s.dirty) return `裡面有沒提交改動的樹（${d}）`;
      continue;
    }
    if (depth >= TREE_DEPTH) continue;
    let kids;
    try { kids = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return `判斷不了 ${d} 裡面有什麼（${e.code}）`; }
    for (const k of kids) if (k.isDirectory() && !k.isSymbolicLink()) queue.push([path.join(d, k.name), depth + 1]);
  }
  return null;
}

/** ③暫存資料夾：名字像審查或掃描用的樹、超過 days 天沒改；裡面有不能收的樹的不列（protectedInside）。 */
function staleTmp(dirs, days, now, own) {
  const out = [];
  const seen = new Set();
  for (const d of dirs) {
    let root;
    try { root = fs.realpathSync(d); } catch { continue; }
    if (seen.has(root)) continue;
    seen.add(root);
    let names = [];
    try { names = fs.readdirSync(root); } catch { continue; }
    for (const n of names.sort()) {
      if (!TMP_NAME.test(n)) continue;
      const p = path.join(root, n);
      let st;
      try { st = fs.lstatSync(p); } catch { continue; }
      if (!st.isDirectory()) continue;
      const age = now - st.mtimeMs;
      if (age <= days * DAY_MS) continue;
      if (protectedInside(p, own)) continue;
      out.push({ dir: p, why: `${Math.floor(age / DAY_MS)} 天沒改` });
    }
  }
  return out;
}

/** ④stash：每一筆、附日期（%cs；不能加 --date，那會讓 %gd 也印成 stash@{日期}、編號就不見了）。 */
function stashes(cwd) {
  return git(cwd, ['stash', 'list', '-z', '--format=%gd%x09%cs%x09%gs']).stdout.split('\0').filter(Boolean)
    .map((l) => { const [ref, date, ...rest] = l.split('\t'); return { ref, date, subject: rest.join('\t') }; });
}

function run({ settings = readSettings(), cwd = process.cwd(), argv = [], now = Date.now(), tmpDefaults = [os.tmpdir(), '/tmp'] } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { return { code: 2, lines: [`整理清單｜列不了：${e.message}`] }; }
  try {
    const inside = git(cwd, ['rev-parse', '--is-inside-work-tree'], { allowFail: true });
    if (inside.status !== 0 || inside.stdout.trim() !== 'true') throw new TidyError('這裡不在 git 倉庫的工作樹裡');
    let name = opts.main;
    if (!name) {
      if (!settings.mainBranch || settings.mainBranch === UNSET) throw new TidyError('專案設定的主幹分支名沒填，也沒給 --main');
      name = settings.mainBranch;
    }
    const main = mainRef(cwd, name);
    const trees = worktreeEntries(cwd);
    const branches = staleBranches(cwd, main, trees);
    const worktrees = staleWorktrees(cwd, main, branches, trees);
    const own = new Set();
    for (const w of trees) { own.add(path.resolve(w.dir)); if (w.real) own.add(w.real); }
    const tmpDirs = opts.tmp.length ? opts.tmp : tmpDefaults;
    const tmp = staleTmp(tmpDirs, opts.days, now, own);
    const st = stashes(cwd);
    const lines = [`整理清單｜主幹 ${main.label}｜只列不刪：已合併或上游已刪的分支 ${branches.length}、沒人用的工作樹 ${worktrees.length}、暫存資料夾的舊審查樹 ${tmp.length}（超過 ${opts.days} 天沒改）、stash ${st.length}`];
    if (opts.list) {
      for (const b of branches) lines.push(`  ・分支 ${b.name}：${b.why}`);
      for (const w of worktrees) lines.push(`  ・工作樹 ${w.dir}：${w.why}`);
      for (const t of tmp) lines.push(`  ・暫存 ${t.dir}：${t.why}`);
      for (const s of st) lines.push(`  ・stash ${s.ref}（${s.date}）：${s.subject}`);
    } else if (branches.length + worktrees.length + tmp.length + st.length) {
      lines.push('整份清單：加 --list。');
    }
    lines.push('另外兩類不在這裡（不重做）：進度摘要的過期條目＝node tools/check-progress-summary.js；待辦條件已到的＝node tools/backlog-touch.js。');
    lines.push('要刪任何一樣，先列給擁有者看、他點頭再另外動手；這支不刪、不排程。');
    return { code: 0, lines, main: main.label, branches, worktrees, tmp, stashes: st };
  } catch (e) {
    if (e instanceof TidyError) return { code: 2, lines: [`整理清單｜列不了：${e.message}`] };
    throw e;
  }
}

if (require.main === module) {
  const r = run({ argv: process.argv.slice(2) });
  process.stdout.write(`${r.lines.join('\n')}\n`);
  process.exit(r.code);
}

module.exports = { run, parseArgs, worktreeEntries, staleBranches, staleWorktrees, staleTmp, stashes, mainRef, TMP_NAME, DAYS };
