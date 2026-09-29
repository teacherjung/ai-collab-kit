// 共用檔清單（釘住套件版本）：使用專案根目錄一份 kit-lock.json，記下同步時取的是套件哪一版、每個共用檔的權限＋blob＋路徑，
// 以及「專案自己先改了套件的檔」的例外（哪個檔、為什麼、誰負責搬回套件、從哪天起）。
//
// 為什麼（擁有者 2026-09-29 裁）：套件的檔預設在套件改、再同步回專案；專案先改只當記錄過的例外。原專案 #641 在專案就地改了
// 9 個共用檔，PR 說明與 32 則留言沒有一處提到套件，34 小時後靠人比對才發現——沒有任何機器在看「專案有沒有改到套件的檔」；
// 同步到哪一版原本只記在散文裡（PROJECT.md 一行），機器讀不到。
//
// 守到哪裡（tests/kit-lock.test.js 釘）：清單裡每一筆跟工作樹上那個檔比權限＋blob；多出來的檔、少掉的檔、改了內容或權限的檔，
//   每一個都要有一筆例外對上（路徑一字不差）；例外指的檔已經跟清單一樣＝例外過期，也紅；清單不在、壞掉或形狀不對＝紅（不猜）。
//   --write 印出這次同步跟上一份清單差在哪、其中哪幾個進錢的攔截器指紋（那幾個檔＝擁有者要換複本、重按信任）。
// ⚠️ 擋不住的：同一支 PR 連清單、這支工具或考題一起改（絆線不是鎖；改動留在 diff 裡給複審者看）；
//   版本碼是不是真的出自套件、套件那邊有沒有新的（要讀得到套件才驗得到；使用專案的雲端讀不到私有的套件）；
//   被 .gitignore 忽略的檔；SHARED_PATHS 以外的檔（例如從範本抄出來的 .github/workflows）；settings.json（專案自己的值，不在清單）；
//   分不出「專案多改了」還是「套件有新的沒跟上」——兩種都只是「跟清單不一樣」。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('./git-env.js');
const { COPY_FILES } = require('./guard-copy.js');

const ROOT = path.join(__dirname, '..');
const LOCK_FILE = 'kit-lock.json';
/** 機器表那一列的名字（settings.json 的 machines；考題拿它決定帶不帶）。 */
const MACHINE = '共用檔清單（釘住套件版本；專案改到套件的檔要記例外）';
/** 共用檔＝README「搬進一個專案」第 1 步要取的路徑；正本在這裡，README 指過來。 */
const SHARED_PATHS = ['tools', 'tests', 'templates', 'rules.json', 'RULES.md', 'MACHINES.md', 'GLOSSARY.md', 'docs/money-guard-two-pattern-tables.md'];
/** 進錢的攔截器指紋的共用檔＝guard-copy.js 的 COPY_FILES 扣掉 settings.json（那份是專案自己的值、不在清單）。 */
const FINGERPRINT_SHARED = COPY_FILES.filter((p) => underShared(p));
const HEX40 = /^[0-9a-f]{40}$/u;
const VERSION = /^[0-9a-f]{7,40}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const REPO = /^[^\s/]+\/[^\s/]+$/u;
const MODES = new Set(['100644', '100755', '120000']);
const LINE_BREAK = /[\n\r\u0085\u2028\u2029\v\f]/u;
const USAGE = `用法：node tools/kit-lock.js --check
      node tools/kit-lock.js --write --version <套件版本碼> [--repo <帳號/倉庫名>] [--date YYYY-MM-DD]
（--root <目錄>：考題用，指定哪一棵樹；預設是這支工具所在的那棵樹）`;

/** 清單本身的問題（不在、壞掉、形狀不對、git 起不來）：一律不猜、退 2。 */
class LockError extends Error {}

function underShared(rel) {
  return SHARED_PATHS.some((s) => rel === s || rel.startsWith(`${s}/`));
}

function git(root, args, input) {
  const r = spawnSync('git', args, { cwd: root, env: gitEnv(), encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new LockError(`git 起不來：${r.error.message}`);
  if (r.status !== 0) throw new LockError(`git ${args[0]} 退 ${r.status}：${(r.stderr || '').trim() || '（沒有訊息）'}`);
  return r.stdout;
}

/** 共用路徑底下工作樹上的每一個檔：已追蹤＋未追蹤但沒被忽略（被忽略的看不到）；排序、去重。 */
function sharedFiles(root) {
  const present = SHARED_PATHS.filter((p) => fs.existsSync(path.join(root, p)));
  if (!present.length) return [];
  const out = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...present]);
  return [...new Set(out.split('\0').filter(Boolean))].sort();
}

/** 工作樹現況：每個共用檔的 {mode, blob, path}；索引裡有、工作樹上沒有的檔不進來（compare 會列成少掉）。 */
function entries(root = ROOT) {
  const rels = sharedFiles(root);
  const stats = rels.map((rel) => { try { return fs.lstatSync(path.join(root, rel)); } catch { return null; } });
  const regular = rels.filter((rel, i) => stats[i] && stats[i].isFile());
  const hashes = regular.length ? git(root, ['hash-object', '--stdin-paths'], `${regular.join('\n')}\n`).trim().split('\n') : [];
  if (hashes.length !== regular.length) throw new LockError(`git hash-object 回了 ${hashes.length} 個雜湊、要 ${regular.length} 個`);
  const blobOf = new Map(regular.map((rel, i) => [rel, hashes[i]]));
  const out = [];
  rels.forEach((rel, i) => {
    const st = stats[i];
    if (!st || st.isDirectory()) return;
    if (st.isSymbolicLink()) {
      out.push({ mode: '120000', blob: git(root, ['hash-object', '--stdin'], fs.readlinkSync(path.join(root, rel))).trim(), path: rel });
      return;
    }
    if (!st.isFile()) throw new LockError(`${rel} 不是一般檔案也不是連結：清單不收`);
    out.push({ mode: (st.mode & 0o111) ? '100755' : '100644', blob: blobOf.get(rel), path: rel });
  });
  return out;
}

function plain(value, what) {
  if (typeof value !== 'string' || value.trim() === '') throw new LockError(`${LOCK_FILE} 形狀不對：${what} 要是非空字串`);
  if (LINE_BREAK.test(value) || value !== value.trim()) throw new LockError(`${LOCK_FILE} 形狀不對：${what} 不可以有換行或前後空白`);
  return value;
}

function pathField(value, what) {
  plain(value, what);
  if (value.startsWith('/') || value.split('/').some((seg) => seg === '' || seg === '.' || seg === '..') || value.includes('\u0000')) {
    throw new LockError(`${LOCK_FILE} 形狀不對：${what}「${value}」不是正常的相對路徑`);
  }
  if (!underShared(value)) throw new LockError(`${LOCK_FILE} 形狀不對：${what}「${value}」不在共用路徑底下（${SHARED_PATHS.join('、')}）`);
  return value;
}

function exactKeys(obj, keys, what) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new LockError(`${LOCK_FILE} 形狀不對：${what} 要是物件`);
  const have = Object.keys(obj).sort().join(',');
  const want = [...keys].sort().join(',');
  if (have !== want) throw new LockError(`${LOCK_FILE} 形狀不對：${what} 的欄位要剛好是 ${keys.join('、')}（現在：${have || '（空）'}）`);
}

function sortedUnique(paths, what) {
  for (let i = 1; i < paths.length; i += 1) {
    if (!(paths[i - 1] < paths[i])) throw new LockError(`${LOCK_FILE} 形狀不對：${what} 要照路徑排序、不重複（「${paths[i - 1]}」之後是「${paths[i]}」）`);
  }
}

/** 清單的形狀，逐欄驗；驗不過就丟 LockError（不猜、不補）。 */
function validateLock(lock) {
  exactKeys(lock, ['repo', 'version', 'syncedAt', 'entries', 'exceptions'], '清單');
  if (!REPO.test(plain(lock.repo, 'repo'))) throw new LockError(`${LOCK_FILE} 形狀不對：repo 要是「帳號/倉庫名」`);
  if (!VERSION.test(plain(lock.version, 'version'))) throw new LockError(`${LOCK_FILE} 形狀不對：version 要是 7〜40 位小寫十六進位的套件版本碼`);
  if (!DATE.test(plain(lock.syncedAt, 'syncedAt'))) throw new LockError(`${LOCK_FILE} 形狀不對：syncedAt 要是 YYYY-MM-DD`);
  if (!Array.isArray(lock.entries)) throw new LockError(`${LOCK_FILE} 形狀不對：entries 要是陣列`);
  if (!Array.isArray(lock.exceptions)) throw new LockError(`${LOCK_FILE} 形狀不對：exceptions 要是陣列`);
  lock.entries.forEach((e, i) => {
    exactKeys(e, ['mode', 'blob', 'path'], `entries[${i}]`);
    if (!MODES.has(e.mode)) throw new LockError(`${LOCK_FILE} 形狀不對：entries[${i}].mode「${e.mode}」不是 100644、100755 或 120000`);
    if (typeof e.blob !== 'string' || !HEX40.test(e.blob)) throw new LockError(`${LOCK_FILE} 形狀不對：entries[${i}].blob 要是 40 位小寫十六進位`);
    pathField(e.path, `entries[${i}].path`);
  });
  sortedUnique(lock.entries.map((e) => e.path), 'entries');
  lock.exceptions.forEach((x, i) => {
    exactKeys(x, ['path', 'why', 'who', 'since'], `exceptions[${i}]`);
    pathField(x.path, `exceptions[${i}].path`);
    plain(x.why, `exceptions[${i}].why`);
    plain(x.who, `exceptions[${i}].who`);
    if (!DATE.test(plain(x.since, `exceptions[${i}].since`))) throw new LockError(`${LOCK_FILE} 形狀不對：exceptions[${i}].since 要是 YYYY-MM-DD`);
  });
  sortedUnique(lock.exceptions.map((x) => x.path), 'exceptions');
  return lock;
}

function readLock(root = ROOT) {
  const file = path.join(root, LOCK_FILE);
  if (!fs.existsSync(file)) throw new LockError(`沒有 ${LOCK_FILE}：這棵樹沒帶共用檔清單（套件倉庫自己是上游；使用專案同步後跑 --write 建）`);
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new LockError(`${LOCK_FILE} 讀不成 JSON：${e.message}`); }
  return validateLock(parsed);
}

/** 工作樹現況對清單：少掉、內容不同、權限不同、多出來；照路徑排序。 */
function compare(current, locked) {
  const cur = new Map(current.map((e) => [e.path, e]));
  const old = new Map(locked.map((e) => [e.path, e]));
  const diffs = [];
  for (const [p, e] of old) {
    const c = cur.get(p);
    if (!c) diffs.push({ path: p, kind: '少掉' });
    else if (c.blob !== e.blob) diffs.push({ path: p, kind: '內容不同' });
    else if (c.mode !== e.mode) diffs.push({ path: p, kind: '權限不同' });
  }
  for (const p of cur.keys()) if (!old.has(p)) diffs.push({ path: p, kind: '多出來' });
  return diffs.sort((a, b) => (a.path < b.path ? -1 : 1));
}

function check(root = ROOT) {
  const lock = readLock(root);
  const diffs = compare(entries(root), lock.entries);
  const excepted = new Set(lock.exceptions.map((x) => x.path));
  const differing = new Set(diffs.map((d) => d.path));
  const problems = [];
  for (const d of diffs) {
    if (!excepted.has(d.path)) {
      problems.push(`${d.path}：${d.kind}，清單裡沒有這一筆例外——套件的檔預設在套件改再同步；真的要在這裡先改，把它記進 ${LOCK_FILE} 的 exceptions（path、why、who、since），之後搬回套件`);
    }
  }
  for (const x of lock.exceptions) {
    if (!differing.has(x.path)) problems.push(`${x.path}：例外過期——這個檔已經跟清單一樣（搬回套件同步過了？），把這一筆例外拿掉`);
  }
  return { ok: problems.length === 0, problems, repo: lock.repo, version: lock.version, syncedAt: lock.syncedAt, count: lock.entries.length, diffs, exceptions: lock.exceptions };
}

/** 同步完跑：以工作樹現況重寫清單、清掉例外，並印出跟上一份差在哪、哪幾個進指紋。 */
function write(root = ROOT, { version, repo, date } = {}) {
  if (typeof version !== 'string' || !VERSION.test(version)) throw new LockError('--version 要給套件的版本碼（7〜40 位小寫十六進位）');
  const file = path.join(root, LOCK_FILE);
  const previous = fs.existsSync(file) ? readLock(root) : null;
  const repoName = repo || (previous && previous.repo);
  if (typeof repoName !== 'string' || !REPO.test(repoName)) throw new LockError('第一次寫清單要給 --repo <帳號/倉庫名>');
  const syncedAt = date || new Date().toISOString().slice(0, 10);
  if (!DATE.test(syncedAt)) throw new LockError('--date 要是 YYYY-MM-DD');
  const current = entries(root);
  if (!current.length) throw new LockError('共用路徑底下一個檔都沒有：先照 README「搬進一個專案」第 1 步取檔，再寫清單');
  const lines = [];
  if (previous) {
    const diffs = compare(current, previous.entries);
    lines.push(`跟上一份清單（${previous.version}，${previous.syncedAt}）比：${diffs.length} 個檔不一樣`);
    for (const d of diffs) lines.push(`  ・${d.path}：${d.kind}`);
    const fp = diffs.filter((d) => FINGERPRINT_SHARED.includes(d.path)).map((d) => d.path);
    if (fp.length) lines.push(`⚠️ 這次動到進錢的攔截器指紋的檔：${fp.join('、')}——照 README「搬進一個專案」第 3 步④：同一支PR重印釘指紋那一行，合併後每台機器補複本、重按信任`);
    else lines.push('這次沒動到進指紋的共用檔（settings.json 的 forbidden 那一塊不在清單裡；同步時若照範本改了它，指紋一樣會動——自己看 diff）');
    if (previous.exceptions.length) lines.push(`清掉 ${previous.exceptions.length} 筆例外（${previous.exceptions.map((x) => x.path).join('、')}）：同步後這些檔＝套件版本；那些改動若還沒搬回套件，這一次就被蓋掉了，看 git diff 確認`);
  } else {
    lines.push(`第一次寫清單：${current.length} 個共用檔`);
  }
  const lock = validateLock({ repo: repoName, version, syncedAt, entries: current, exceptions: [] });
  fs.writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
  lines.push(`寫好 ${LOCK_FILE}：套件 ${repoName} ${version}（${syncedAt}），${current.length} 筆`);
  return { lock, lines };
}

/** 帶不帶只看設定的登記；清單在不在只拿來對帳（跟案例簿那一列同一種開關）。 */
function declaration(machines, lockPresent) {
  const rows = Array.isArray(machines) ? machines.filter((m) => m && m.name === MACHINE) : [];
  if (rows.length !== 1) return { run: true, problem: `機器表裡「${MACHINE}」要剛好一列（現在 ${rows.length} 列）`, reason: null };
  const { state } = rows[0];
  if (state === '已啟用') {
    return lockPresent ? { run: true, problem: null, reason: null }
      : { run: true, problem: `「${MACHINE}」登記已啟用，${LOCK_FILE} 卻不在：同步後跑 node tools/kit-lock.js --write --version <套件版本碼> --repo <帳號/倉庫名> 建清單；不帶清單就把這一列改回已安裝未啟用`, reason: null };
  }
  if (state === '已安裝未啟用') {
    return lockPresent ? { run: true, problem: `「${MACHINE}」登記已安裝未啟用，${LOCK_FILE} 卻在：清單建好了就把這一列改成已啟用（改完跑 node tools/build-settings.js）`, reason: null }
      : { run: false, problem: null, reason: `settings.json 把「${MACHINE}」登記成已安裝未啟用（還沒建清單），${LOCK_FILE} 也確實不在` };
  }
  if (state === '未移植') {
    return lockPresent ? { run: true, problem: `「${MACHINE}」登記未移植，${LOCK_FILE} 卻在：套件倉庫自己是上游、不帶清單；使用專案要帶就改登記已啟用`, reason: null }
      : { run: false, problem: null, reason: `settings.json 把「${MACHINE}」登記成未移植（套件倉庫自己是上游，沒有清單），${LOCK_FILE} 也確實不在` };
  }
  return { run: true, problem: `「${MACHINE}」只能登記已啟用、已安裝未啟用或未移植，現在是「${state}」`, reason: null };
}

function parseArgs(argv) {
  const out = { mode: null, version: null, repo: null, date: null, root: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => { i += 1; if (i >= argv.length) throw new LockError(`${a} 後面要接值`); return argv[i]; };
    if (a === '--check' || a === '--write') { if (out.mode) throw new LockError('--check 與 --write 只能給一個'); out.mode = a.slice(2); }
    else if (a === '--version') out.version = next();
    else if (a === '--repo') out.repo = next();
    else if (a === '--date') out.date = next();
    else if (a === '--root') out.root = next();
    else throw new LockError(`看不懂的參數：${a}`);
  }
  if (!out.mode) throw new LockError('要給 --check 或 --write');
  return out;
}

function main(argv = process.argv.slice(2)) {
  let a;
  try { a = parseArgs(argv); } catch (e) { return { code: 2, lines: [e.message, USAGE] }; }
  const root = a.root ? path.resolve(a.root) : ROOT;
  try {
    if (a.mode === 'write') return { code: 0, lines: write(root, a).lines };
    const r = check(root);
    const lines = [`共用檔清單｜套件 ${r.repo} ${r.version}（${r.syncedAt}）：${r.count} 筆；工作樹跟清單不一樣的 ${r.diffs.length} 個、例外 ${r.exceptions.length} 筆`];
    if (r.ok) { lines.push(r.diffs.length ? '不一樣的每一個都有例外對上。' : '全部相同。'); return { code: 0, lines }; }
    for (const p of r.problems) lines.push(`  ・${p}`);
    return { code: 1, lines };
  } catch (e) {
    if (e instanceof LockError) return { code: 2, lines: [e.message] };
    throw e;
  }
}

if (require.main === module) {
  const r = main();
  process.stdout.write(`${r.lines.join('\n')}\n`);
  process.exit(r.code);
}

module.exports = { LOCK_FILE, MACHINE, SHARED_PATHS, FINGERPRINT_SHARED, LockError, entries, readLock, validateLock, compare, check, write, declaration, parseArgs, main };
