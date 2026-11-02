#!/usr/bin/env node
// 開工與送審前體檢總表（規矩 D1、F6、K5、D4、F11、G1）：把開工前與送審前散在多支的唯讀檢查與 4 個 AI 座位體檢收成一鍵執行；只列不擋。
//
// 為什麼：開工前要跑 pending-rulings、backlog-touch、downstream-lag，送審前還要再跑 backlog-touch、stale-text、risk-tier，
// 多家 AI 協作時還要確認本機各家 CLI 執行檔（與 Grok 盒外憑證檔）在不在。散成 5〜6 條指令時容易漏跑其中一條；
// 收成單一入口，不傳變更編號跑開工前項目、傳變更編號一併跑送審前項目，各支原本的獨立工具與判斷邏輯維持原樣不重複實作。
//
// 誠實劃界（規矩 K3）：
//   ①這支只是唯讀總表，不是合併閘；個別項目（待裁、待辦、下游落後、舊文字、風險分級）的守不到範圍見各支工具檔頭；
//   ②AI 座位體檢預設只看設定裡登記的啟動指令執行檔在不在（以及走 --grok-exec 時盒外 ~/.grok/auth.json 是否為一般檔案），
//     絕不讀取或印出憑證內容，也不發網路請求驗權杖有沒有過期；加上 --probe [<座位識別值>] 時才會在暫存區開極小審查樹實跑點火並驗 prepareVerdict 收件。
//
// 退出碼：0＝所有執行的項目都順利算完（含「0 筆命中」、C1 黃燈提醒、座位缺執行檔或點火未過的提醒）／2＝參數不對，或任一子工具算不出來（如設定未填、平台問不到、基準版本找不到、--probe 指定了不存在的座位）。⚠️ 不是閘。
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gitEnv } = require('./git-env.js');
const { ask } = require('./platform.js');
const { read: readSettings } = require('./settings-data.js');
const { run: runPending } = require('./pending-rulings.js');
const { run: runBacklog } = require('./backlog-touch.js');
const { run: runDownstream } = require('./downstream-lag.js');
const { run: runStale } = require('./stale-text.js');
const { run: runRisk, gitIn } = require('./risk-tier.js');
const { substitute, prepareVerdict, prepareScan } = require('./review-launch.js');
const { rolesOf } = require('./gates/check-collab-fields.js');

const UNSET = '未設定';
const USAGE = '用法：node tools/preflight.js [<變更編號>] [--base <基準版本>] [--skip-downstream] [--skip-seats] [--probe [<座位識別值>]]';

function filled(v) {
  return typeof v === 'string' && v.trim() !== '' && v.trim() !== UNSET;
}

/** 解析指令列參數。不認得的旗標或多餘位置參數回 { error }。 */
function parseArgs(argv = []) {
  const out = { change: undefined, base: undefined, skipDownstream: false, skipSeats: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--base') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { error: `--base 後面要接基準版本。${USAGE}` };
      out.base = v;
      i += 1;
    } else if (a === '--skip-downstream') {
      out.skipDownstream = true;
    } else if (a === '--skip-seats') {
      out.skipSeats = true;
    } else if (a === '--probe') {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && !/^\d+$/u.test(next)) {
        out.probe = next;
        i += 1;
      } else {
        out.probe = '*';
      }
    } else if (a.startsWith('--probe=')) {
      const v = a.slice('--probe='.length).trim();
      if (!v) return { error: `--probe= 後面要接座位識別值。${USAGE}` };
      out.probe = v;
    } else if (a.startsWith('--')) {
      return { error: `不認得的參數：${a}。${USAGE}` };
    } else if (out.change === undefined) {
      out.change = a;
    } else {
      return { error: `多給了一個參數：${a}。${USAGE}` };
    }
  }
  if (out.probe && out.skipSeats) {
    return { error: `--probe 與 --skip-seats 不能同時使用。${USAGE}` };
  }
  return out;
}

/**
 * 檢查目前開啟中的變更支數（規矩 C1：每個專案各工作線全體最多兩支進行中、草稿也算）。
 * 只列不擋：達 2 支或以上時印黃燈提醒；問不到平台時退 2。
 */
function checkOpenChanges({ settings = readSettings(), platform = { ask } } = {}) {
  let changes;
  try {
    changes = platform.ask('openChanges', {}, { settings });
  } catch (e) {
    return {
      code: 2,
      lines: [`進行中變更（C1）：問不到平台開啟中變更清單（${(e && e.message) || '不明'}）——算不出來。`],
      openChanges: null,
    };
  }
  if (!Array.isArray(changes)) {
    return {
      code: 2,
      lines: ['進行中變更（C1）：平台回傳的開啟中變更清單格式不對——算不出來。'],
      openChanges: null,
    };
  }
  const fmt = (c) => `#${c.id}${c.isDraft ? '（草稿）' : ''}`;
  if (changes.length >= 2) {
    return {
      code: 0,
      lines: [
        `進行中變更（C1）：⚠️ 目前已開啟 ${changes.length} 支（${changes.map(fmt).join('、')}），已達或超過 C1「每個專案各工作線全體最多兩支、草稿也算」上限（只列不擋）`,
      ],
      openChanges: changes,
    };
  }
  const desc = changes.length === 0 ? '0 支' : `1 支（${fmt(changes[0])}）`;
  return {
    code: 0,
    lines: [`進行中變更（C1）：目前開啟 ${desc}（未達 2 支上限；只列不擋）`],
    openChanges: changes,
  };
}

/** 組合執行檔搜尋目錄清單：維持既有 env.PATH 優先順序，常見本機安裝路徑僅作後備。 */
function buildSearchDirs({ env = process.env, homedir = os.homedir() } = {}) {
  const home = homedir || '';
  const extra = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    home ? path.join(home, '.local', 'bin') : '',
    home ? path.join(home, '.grok', 'bin') : '',
  ].filter(Boolean);
  return [...new Set([...String((env && env.PATH) || '').split(path.delimiter).filter(Boolean), ...extra])];
}

/** 在環境 PATH 與常見本機安裝路徑裡找可執行檔（純檔案系統檢查，不起子行程）；若已帶路徑則只驗該路徑本身。 */
function defaultWhich(bin, { env = process.env, homedir = os.homedir(), fsImpl = fs } = {}) {
  if (!bin || typeof bin !== 'string') return null;
  if (bin.includes('/') || bin.includes(path.sep)) {
    try {
      const st = fsImpl.statSync(bin);
      if (!st.isFile()) return null;
      fsImpl.accessSync(bin, fsImpl.constants.X_OK);
      return bin;
    } catch {
      return null;
    }
  }
  const dirs = buildSearchDirs({ env, homedir });
  for (const d of dirs) {
    const candidate = path.join(d, bin);
    try {
      const st = fsImpl.statSync(candidate);
      if (!st.isFile()) continue;
      fsImpl.accessSync(candidate, fsImpl.constants.X_OK);
      return candidate;
    } catch {
      /* 繼續找下一個目錄 */
    }
  }
  return null;
}

/** 從 command 樣板擷取要檢查的 CLI 執行檔（保留明確路徑），以及是否走 --grok-exec 沙盒通道。 */
function extractCommandSpec(command) {
  const text = String(command || '').trim();
  if (!text || text === UNSET) return { bin: null, usesGrokExec: false };
  if (/(?:^|[\s/\\])review-launch\.js(?:\s+[^\n]*?)?\s+--grok-exec(?=\s|$)/u.test(text)) {
    return { bin: 'grok', usesGrokExec: true };
  }
  const segments = text.split(/\s*(?:&&|;)\s*/u).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const tokens = seg.split(/\s+/u).filter(Boolean);
    let idx = 0;
    while (idx < tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(tokens[idx]) || tokens[idx] === 'env')) {
      idx += 1;
    }
    if (idx >= tokens.length) continue;
    const first = tokens[idx].replace(/^['"]|['"]$/gu, '');
    const base = path.basename(first);
    if (base === 'cd' || base === 'export') continue;
    if (!first || first.startsWith('-') || first.startsWith('{')) return { bin: null, usesGrokExec: false };
    return { bin: first, usesGrokExec: false };
  }
  return { bin: null, usesGrokExec: false };
}

/** 收集設定裡登記的 reviewers 與 scanner 座位清單。 */
function collectSeats(settings = {}) {
  const seats = new Map();
  for (const r of Array.isArray(settings.reviewers) ? settings.reviewers : []) {
    if (!r || !filled(r.participant)) continue;
    seats.set(r.participant, {
      participant: r.participant,
      roles: ['複審候選'],
      source: filled(r.source) ? r.source : '未填來源',
      model: filled(r.strongest) ? r.strongest : '未填模型',
      effort: filled(r.maxEffort) ? r.maxEffort : '未填推理',
      commands: [r.command],
      probeCommand: r.command,
      probeMode: 'review',
    });
  }
  const sc = settings.scanner || {};
  if (sc && sc.tool !== '無' && filled(sc.participant)) {
    const existing = seats.get(sc.participant);
    if (existing) {
      existing.roles.push('掃描者');
      existing.commands.push(sc.command);
    } else {
      seats.set(sc.participant, {
        participant: sc.participant,
        roles: ['掃描者'],
        source: filled(sc.source) ? sc.source : '未填來源',
        model: filled(sc.strongest) ? sc.strongest : '未填模型',
        effort: filled(sc.maxEffort) ? sc.maxEffort : '未填推理',
        commands: [sc.command],
        probeCommand: sc.command,
        probeMode: 'scan',
      });
    }
  }
  return seats;
}

/**
 * 檢查設定裡登記的 AI 座位（複審者名單 + 掃描者）在本機的 CLI 執行檔與必要盒外憑證檔狀態。
 * 唯讀、只列不擋（退出碼永遠 0），絕不讀取或輸出憑證檔內容。
 */
function checkSeats(settings = {}, {
  which,
  env = process.env,
  homedir = os.homedir(),
  authFile = path.join(homedir || os.homedir(), '.grok', 'auth.json'),
  grokBin = path.basename(path.dirname(authFile)) === '.grok'
    ? path.join(path.dirname(authFile), 'bin', 'grok')
    : path.join(homedir || os.homedir(), '.grok', 'bin', 'grok'),
  fsImpl = fs,
} = {}) {
  const resolveBin = typeof which === 'function' ? which : (b) => defaultWhich(b, { env, homedir, fsImpl });
  const div = settings.defaultDivision || {};
  const impl = filled(div.implementer) ? div.implementer : '未設定';
  const rev = filled(div.reviewer) ? div.reviewer : '未設定';
  const sc = settings.scanner || {};
  const scanName = sc.tool === '無' ? '無' : (filled(sc.participant) ? sc.participant : '未設定');

  const seats = collectSeats(settings);

  const lines = [
    `AI 座位體檢｜分工設定：實作＝${impl}、複審＝${rev}、掃描＝${scanName}｜已登記 CLI 座位 ${seats.size} 個（只列不擋）`,
  ];
  if (!seats.size) {
    lines.push('  （專案設定尚未登記任何 reviewers 或 scanner 座位）');
    return { code: 0, lines, seats: [] };
  }

  const results = [];
  for (const seat of seats.values()) {
    const specs = seat.commands.map((c) => extractCommandSpec(c));
    const usesGrokExec = specs.some((s) => s.usesGrokExec);
    if (!specs.length || specs.some((s) => !s.bin)) {
      lines.push(`  ・${seat.participant}（${seat.source}｜${seat.model}／${seat.effort}）：⚠️ 啟動指令未填或無法解析執行檔`);
      results.push({ participant: seat.participant, bin: null, binPath: null, usesGrokExec, authReady: null, ok: false });
      continue;
    }
    const checkTargets = [];
    const seenTargetKeys = new Set();
    for (const s of specs) {
      const key = s.usesGrokExec ? `grokExec:${grokBin}` : `std:${s.bin}`;
      if (seenTargetKeys.has(key)) continue;
      seenTargetKeys.add(key);
      checkTargets.push({
        label: s.usesGrokExec ? grokBin : s.bin,
        displayBin: s.bin,
        path: s.usesGrokExec ? defaultWhich(grokBin, { env, homedir, fsImpl }) : resolveBin(s.bin),
      });
    }
    const missingBins = checkTargets.filter((r) => !r.path).map((r) => r.label);
    const allBinsOk = missingBins.length === 0;
    const bin = allBinsOk ? [...new Set(checkTargets.map((r) => r.displayBin))].join('、') : missingBins.join('、');
    const binPath = allBinsOk ? [...new Set(checkTargets.map((r) => r.path))].join('、') : null;
    let authReady = null;
    let authNote = '';
    if (usesGrokExec) {
      try {
        const st = fsImpl.lstatSync(authFile);
        authReady = st.isFile() && !st.isSymbolicLink();
      } catch {
        authReady = false;
      }
      authNote = authReady
        ? '；Grok 盒外憑證檔就緒（僅驗一般檔案存在，不讀內容）'
        : `；⚠️ 找不到 Grok 盒外憑證一般檔案（${authFile}）`;
    }
    const ok = Boolean(binPath) && (authReady === null || authReady === true);
    const binNote = binPath
      ? `執行檔 ${bin} 就緒（${binPath}）`
      : `⚠️ 找不到執行檔 ${bin}（輪到此座位時請先確認安裝與 PATH）`;
    lines.push(`  ・${seat.participant}（${seat.source}｜${seat.model}／${seat.effort}）：${binNote}${authNote}`);
    results.push({ participant: seat.participant, bin, binPath: binPath || null, usesGrokExec, authReady, ok });
  }
  return { code: 0, lines, seats: results };
}

/**
 * 將點火失敗濃縮為固定分類診斷摘要（白名單制，不直接回顯 CLI 原始 result／stdout／stderr，杜絕短權杖、email 或路徑外洩）。
 */
function summarizeProbeFailure(runRes, rawOut, verdictErr) {
  if (runRes && runRes.error) {
    if (runRes.error.code === 'ETIMEDOUT') return '執行逾時';
    if (runRes.error.code === 'ECANCELLED') return '執行已取消';
    const safeCode = typeof runRes.error.code === 'string' && /^[A-Z0-9_]{2,24}$/u.test(runRes.error.code)
      ? `（${runRes.error.code}）`
      : '';
    return `子行程啟動失敗${safeCode}`;
  }
  const trimmedOut = String(rawOut || '').trim();
  const combined = `${String((runRes && runRes.stderr) || '')}\n${String((runRes && runRes.stdout) || '')}\n${trimmedOut}`;
  if (/OAuth.*expired|token.*expired|Failed to authenticate|authentication_error|UNAUTHENTICATED|invalid_grant/iu.test(combined)) {
    return '認證失敗（OAuth 或權杖已過期，請重新登入該 CLI）';
  }
  if (/prepayment credits are depleted|credits.*depleted|insufficient_quota|\b402\b/iu.test(combined)) {
    return 'API 額度或預付餘額不足（HTTP 402／請檢查帳戶額度與帳單設定）';
  }
  if (/RESOURCE_EXHAUSTED|rate.?limit|quota.*exceeded|\b429\b/iu.test(combined)) {
    return 'API 速率或配額達上限（HTTP 429／RESOURCE_EXHAUSTED）';
  }
  if (/ModelNotFoundError|model.*not found|does not exist/iu.test(combined)) {
    return '找不到指定模型（ModelNotFoundError）';
  }
  if (/not trusted|folder.*trust|--skip-trust/iu.test(combined)) {
    return '工作資料夾未獲 CLI 信任（請確認 --skip-trust 或信任設定）';
  }
  if (/掃描模式缺少合法的 scan\.json/u.test(combined)) {
    return '掃描模式缺少合法的 scan.json';
  }
  if (/沙盒隔離預檢未通過/u.test(combined)) {
    return 'Grok 沙盒隔離預檢未通過';
  }
  if (/憑證準備失敗/u.test(combined)) {
    return 'Grok 盒外憑證準備失敗';
  }
  if (/內容安全檢查未通過|dlp_[a-z_]+/iu.test(combined)) {
    return 'Grok 內容安全檢查未通過';
  }
  if (verdictErr && typeof verdictErr.message === 'string') {
    const msg = verdictErr.message;
    if (/是空的/u.test(msg)) return 'CLI 未產生結論輸出（輸出檔為空）';
    if (/不是合規標頭/u.test(msg)) return '輸出第一行不是合規標頭（🤖／🔍 格式不符或含前言雜訊）';
    if (/角色是|不是本支/u.test(msg)) return '輸出標頭角色與座位識別值不符';
    if (/來源是|不是設定登記的/u.test(msg)) return '輸出標頭來源與設定登記字串不符';
    if (/審的是|掃的是|對不上/u.test(msg)) return '輸出標頭版本短碼與點火樹 HEAD 不符';
    if (/缺少固定小標|本輪實際用的設定|清單逐項結果|驗了什麼|發現/u.test(msg)) return '複審輸出缺少固定小標';
    return '輸出未通過收件格式核驗';
  }
  if (!trimmedOut && (!runRes || runRes.status === 0)) {
    return '未產生有效結論輸出';
  }
  return 'CLI 執行失敗（已遮蔽原始輸出，請於本機單獨執行該 CLI 檢查登入與連線狀態）';
}

const PROBE_GROUP_RUNNER_SCRIPT = `
'use strict';
const { spawn, spawnSync } = require('node:child_process');
const cmd = process.argv[1];
const timeoutMs = Number(process.argv[2]) || 60000;
const initialPpid = process.ppid;
const child = spawn('/bin/sh', ['-c', cmd], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const pid = child.pid;
const trackedPids = new Set(pid && pid > 1 ? [pid] : []);
const trackedPgids = new Set(pid && pid > 1 ? [pid] : []);
let stdout = '';
let stderr = '';
let closed = false;
let timedOut = false;
let cancelledSignal = null;
let finishing = false;
let exitStatus = null;
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (d) => { stdout += d; });
child.stderr.on('data', (d) => { stderr += d; });
function scanProcessTree() {
  if (!pid || pid <= 1) return;
  try {
    const r = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid='], { encoding: 'utf8', timeout: 500 });
    if (r.status !== 0 || !r.stdout) return;
    const rows = [];
    for (const line of r.stdout.split(/\\r?\\n/u)) {
      const m = line.trim().match(/^(\\d+)\\s+(\\d+)\\s+(\\d+)$/u);
      if (!m) continue;
      const p = Number(m[1]);
      const pp = Number(m[2]);
      const pg = Number(m[3]);
      if (p > 1 && p !== process.pid && p !== initialPpid) rows.push({ p, pp, pg });
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const { p, pp, pg } of rows) {
        if (trackedPids.has(pp) || (pg > 1 && trackedPgids.has(pg))) {
          if (!trackedPids.has(p)) {
            trackedPids.add(p);
            changed = true;
          }
          if (pg > 1 && pg !== initialPpid && !trackedPgids.has(pg)) {
            trackedPgids.add(pg);
            changed = true;
          }
        }
      }
    }
  } catch { /* ignore */ }
}
function anyAlive() {
  for (const pg of trackedPgids) {
    if (pg > 1) {
      try { process.kill(-pg, 0); return true; } catch { /* ignore */ }
    }
  }
  for (const p of trackedPids) {
    if (p > 1) {
      try { process.kill(p, 0); return true; } catch { /* ignore */ }
    }
  }
  return false;
}
function signalAll(sig) {
  for (const pg of trackedPgids) {
    if (pg > 1) {
      try { process.kill(-pg, sig); } catch { /* ignore */ }
    }
  }
  for (const p of trackedPids) {
    if (p > 1) {
      try { process.kill(p, sig); } catch { /* ignore */ }
    }
  }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function finish(status) {
  if (finishing) return;
  finishing = true;
  clearTimeout(timer);
  clearInterval(treeWatch);
  scanProcessTree();
  if (anyAlive()) {
    signalAll('SIGTERM');
    const forceAt = Date.now() + 180;
    const deadline = Date.now() + 2500;
    let forced = false;
    while (anyAlive() && Date.now() < deadline) {
      scanProcessTree();
      if (!forced && Date.now() >= forceAt) {
        forced = true;
        signalAll('SIGKILL');
      } else if (forced) {
        signalAll('SIGKILL');
      }
      await delay(20);
    }
    if (anyAlive()) {
      scanProcessTree();
      signalAll('SIGKILL');
    }
  }
  const pipeDeadline = Date.now() + 1000;
  while (!closed && Date.now() < pipeDeadline) await delay(20);
  process.removeListener('SIGINT', onCancel);
  process.removeListener('SIGTERM', onCancel);
  child.stdout.destroy();
  child.stderr.destroy();
  process.stdout.write(JSON.stringify({
    status: timedOut || cancelledSignal ? null : status,
    stdout,
    stderr,
    timedOut,
    cancelledSignal,
  }));
}
function onCancel(sig) {
  cancelledSignal = typeof sig === 'string' ? sig : 'SIGTERM';
  void finish(null);
}
process.on('SIGINT', onCancel);
process.on('SIGTERM', onCancel);
const treeWatch = setInterval(() => {
  scanProcessTree();
  if (process.ppid <= 1 || process.ppid !== initialPpid) {
    onCancel('SIGTERM');
  }
}, 25);
const timer = setTimeout(() => {
  timedOut = true;
  void finish(null);
}, Math.max(1, timeoutMs));
child.once('error', (err) => {
  stderr += String(err && err.message ? err.message : err);
  void finish(null);
});
child.once('exit', (code) => {
  exitStatus = code;
  if (closed) void finish(exitStatus);
});
child.once('close', (code) => {
  closed = true;
  void finish(exitStatus !== null ? exitStatus : code);
});
`;

/**
 * 以獨立程序群組執行點火命令，期限到或收到取消訊號時先送 SIGTERM、必要時送 SIGKILL 終止整組與巢狀後代並等待管線關閉後才回傳，
 * 避免 /bin/sh 逾時或外層取消後底下的 CLI 仍在背景執行或寫檔。
 */
function runProbeCommandSync(cmd, { cwd, env, timeoutMs, spawnSyncImpl = spawnSync } = {}) {
  if (spawnSyncImpl !== spawnSync) {
    return spawnSyncImpl('/bin/sh', ['-c', cmd], {
      cwd,
      env,
      encoding: 'utf8',
      timeout: timeoutMs,
    });
  }
  let caughtSignal = null;
  const onSignal = (sig) => {
    caughtSignal = sig;
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  let res;
  try {
    res = spawnSync(process.execPath, ['-e', PROBE_GROUP_RUNNER_SCRIPT, cmd, String(timeoutMs)], {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
  if (res.error) return res;
  try {
    const parsed = JSON.parse(String(res.stdout || '').trim());
    const cancelSig = caughtSignal || parsed.cancelledSignal || null;
    if (cancelSig) {
      if (process.exitCode === undefined) {
        process.exitCode = cancelSig === 'SIGINT' ? 130 : 143;
      }
      const err = new Error('ECANCELLED');
      err.code = 'ECANCELLED';
      return { status: null, stdout: parsed.stdout || '', stderr: parsed.stderr || '', error: err, cancelled: true };
    }
    if (parsed.timedOut) {
      const err = new Error('ETIMEDOUT');
      err.code = 'ETIMEDOUT';
      return { status: null, stdout: parsed.stdout || '', stderr: parsed.stderr || '', error: err };
    }
    return { status: parsed.status, stdout: parsed.stdout || '', stderr: parsed.stderr || '', error: null };
  } catch {
    if (caughtSignal) {
      if (process.exitCode === undefined) {
        process.exitCode = caughtSignal === 'SIGINT' ? 130 : 143;
      }
      const err = new Error('ECANCELLED');
      err.code = 'ECANCELLED';
      return { status: null, stdout: res.stdout || '', stderr: res.stderr || '', error: err, cancelled: true };
    }
    return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', error: null };
  }
}

/**
 * 對已登記的 AI 座位執行十秒極小點火試跑（--probe [<座位識別值>]）。
 * 在系統暫存區建立極小隔離 Git 樹與標準通過提示，實跑啟動樣板並交由 prepareVerdict／prepareScan 驗收件格式。
 */
function probeSeats(settings = {}, {
  seatFilter = '*',
  cwd = process.cwd(),
  timeoutMs = 60000,
  which,
  env = process.env,
  homedir = os.homedir(),
  authFile = path.join(homedir || os.homedir(), '.grok', 'auth.json'),
  grokBin,
  fsImpl = fs,
  spawnSyncImpl = spawnSync,
} = {}) {
  const staticCheck = checkSeats(settings, { which, env, homedir, authFile, grokBin, fsImpl });
  const seatMap = collectSeats(settings);
  const allEntries = [...seatMap.values()];
  if (!allEntries.length) {
    return { code: 0, lines: ['AI 座位點火試跑：尚未登記任何座位'], probes: [] };
  }
  const filterNorm = String(seatFilter || '*').trim().toLowerCase();
  const targets = filterNorm === '*'
    ? allEntries
    : allEntries.filter((s) => s.participant.toLowerCase() === filterNorm);
  if (!targets.length) {
    return {
      code: 2,
      lines: [
        `AI 座位點火試跑：找不到已登記的座位「${seatFilter}」（已登記：${allEntries.map((s) => s.participant).join('、')}）。`,
      ],
      probes: [],
    };
  }

  const { usable } = rolesOf(settings);
  const usableRoles = usable.length ? usable : allEntries.map((s) => s.participant);
  const staticByParticipant = new Map(staticCheck.seats.map((s) => [s.participant, s]));
  const lines = [
    `AI 座位點火試跑（--probe｜目標：${filterNorm === '*' ? `全部 ${targets.length} 個座位` : targets[0].participant}｜只列不擋）：`,
  ];
  const probes = [];

  for (const seat of targets) {
    const st = staticByParticipant.get(seat.participant);
    if (!st || !st.ok) {
      const reason = '執行檔或盒外憑證檔未就緒，略過點火';
      lines.push(`  ・${seat.participant}（${seat.source}｜${seat.model}／${seat.effort}）：🔴 ${reason}`);
      probes.push({ participant: seat.participant, ok: false, status: null, reason });
      continue;
    }

    const rawTemplate = String(seat.probeCommand || '');
    const isScanProbe = seat.probeMode === 'scan' || /--mode\s+scan\b/u.test(rawTemplate);
    const probeRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `ack-probe-${seat.participant.toLowerCase()}-`)));
    const reviewTree = path.join(probeRoot, 'tree');
    const mutationCopy = path.join(probeRoot, 'mutation');
    const promptFile = path.join(probeRoot, 'prompt.md');
    const outFile = path.join(probeRoot, 'output.log');
    const t0 = Date.now();
    let shouldBreak = false;
    try {
      const resolvedDirs = st.binPath
        ? st.binPath.split('、').map((p) => path.dirname(p)).filter(Boolean)
        : [];
      const searchDirs = [...new Set([...resolvedDirs, ...buildSearchDirs({ env, homedir })])];
      const probeEnv = gitEnv({
        ...env,
        PATH: searchDirs.join(path.delimiter),
      });
      const clearEnvList = Array.isArray(settings?.platform?.clearEnv)
        ? settings.platform.clearEnv
        : [];
      for (const k of clearEnvList) delete probeEnv[k];
      delete probeEnv.CLAUDECODE;

      fs.mkdirSync(reviewTree, { recursive: true });
      const runGitStep = (args, stepCwd = reviewTree) => spawnSync('git', args, {
        cwd: stepCwd,
        env: probeEnv,
        encoding: 'utf8',
      });
      const gitStepsOk = [
        runGitStep(['init', '-q', '-b', 'main']),
        runGitStep(['config', 'user.name', 'probe']),
        runGitStep(['config', 'user.email', 'probe@localhost']),
      ].every((r) => r && !r.error && !r.signal && r.status === 0);
      let headSha = '';
      let treeReady = false;
      if (gitStepsOk) {
        fs.writeFileSync(path.join(reviewTree, 'README.md'), 'probe\n');
        const addRes = runGitStep(['add', 'README.md']);
        const commitRes = addRes && !addRes.error && !addRes.signal && addRes.status === 0
          ? runGitStep(['commit', '--no-gpg-sign', '-q', '-m', 'probe'])
          : null;
        const revRes = commitRes && !commitRes.error && !commitRes.signal && commitRes.status === 0
          ? runGitStep(['rev-parse', '--verify', 'HEAD'])
          : null;
        const candidateSha = revRes && !revRes.error && !revRes.signal && revRes.status === 0
          ? String(revRes.stdout || '').trim()
          : '';
        if (/^[0-9a-f]{40}$/u.test(candidateSha) && fs.existsSync(path.join(reviewTree, '.git'))) {
          const cloneRes = runGitStep(['clone', '--quiet', reviewTree, mutationCopy], probeRoot);
          const mutRev = cloneRes && !cloneRes.error && !cloneRes.signal && cloneRes.status === 0
            ? runGitStep(['rev-parse', '--verify', 'HEAD'], mutationCopy)
            : null;
          const mutSha = mutRev && !mutRev.error && !mutRev.signal && mutRev.status === 0
            ? String(mutRev.stdout || '').trim()
            : '';
          if (mutSha === candidateSha && fs.existsSync(path.join(mutationCopy, '.git'))) {
            headSha = candidateSha;
            treeReady = true;
          }
        }
      }
      if (!treeReady) {
        const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
        const reason = '建立隔離點火 Git 樹失敗（請確認本機 git 可正常執行 init／commit／clone）';
        lines.push(`  ・${seat.participant}（${seat.source}｜${seat.model}／${seat.effort}）：🔴 點火失敗（${elapsedSec}s｜${reason}）`);
        probes.push({ participant: seat.participant, ok: false, status: null, reason });
        continue;
      }
      const headShort = headSha.slice(0, 7);

      const metaPayload = JSON.stringify({ base: headSha, head: headSha, root: reviewTree });
      fs.writeFileSync(path.join(probeRoot, 'launch.json'), metaPayload);
      fs.writeFileSync(path.join(probeRoot, 'scan.json'), metaPayload);

      const promptBody = isScanProbe
        ? [
            '這是座位接線十秒點火試跑（不要呼叫任何工具或讀取檔案，直接原樣輸出以下 4 行即可）：',
            `🔍 ${seat.participant}｜來源：${seat.source}｜掃 \`${headShort}\``,
            '',
            '- 零發現',
            '未貼',
            '',
          ].join('\n')
        : [
            '這是座位接線十秒點火試跑（不要呼叫任何工具或讀取檔案，直接原樣輸出以下 8 行即可）：',
            `🤖 ${seat.participant}｜來源：${seat.source}｜審 \`${headShort}\`｜r1｜結論：通過`,
            '',
            '### 本輪實際用的設定',
            '- 點火試跑',
            '',
            '### 清單逐項結果',
            '- 零發現',
            '未貼',
            '',
          ].join('\n');
      fs.writeFileSync(promptFile, promptBody);

      const { text: cmd } = substitute(rawTemplate, {
        model: seat.model,
        effort: seat.effort,
        reviewTree,
        scanTree: reviewTree,
        mutationCopy,
        promptFile,
        outFile,
        change: '1',
        project: (settings.platform && filled(settings.platform.project)) ? settings.platform.project : 'probe/repo',
      }, `${seat.participant} 點火指令`);

      const runRes = runProbeCommandSync(cmd, {
        cwd,
        env: probeEnv,
        timeoutMs,
        spawnSyncImpl,
      });
      if (runRes && runRes.cancelled) shouldBreak = true;
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
      const rawOut = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
      let verdictErr = null;
      let verdictOk = false;
      const verifierName = isScanProbe ? 'prepareScan' : 'prepareVerdict';
      if (!runRes.error && runRes.status === 0 && rawOut.trim()) {
        try {
          if (isScanProbe) {
            prepareScan(rawOut, {
              scanner: seat.participant,
              source: seat.source,
              head: headSha,
              usable: usableRoles,
              forceGrok: String(seat.source).includes('Grok'),
            });
          } else {
            prepareVerdict(rawOut, {
              reviewer: seat.participant,
              source: seat.source,
              round: 1,
              head: headSha,
              usable: usableRoles,
            });
          }
          verdictOk = true;
        } catch (err) {
          verdictErr = err;
        }
      }

      if (verdictOk) {
        lines.push(`  ・${seat.participant}（${seat.source}｜${seat.model}／${seat.effort}）：🟢 點火通過（${elapsedSec}s｜輸出通過 ${verifierName} 收件核驗）`);
        probes.push({ participant: seat.participant, ok: true, status: 0, reason: null });
      } else {
        const reason = summarizeProbeFailure(runRes, rawOut, verdictErr);
        const codeLabel = runRes && typeof runRes.status === 'number' ? `退 ${runRes.status}` : '未完成';
        lines.push(`  ・${seat.participant}（${seat.source}｜${seat.model}／${seat.effort}）：🔴 點火失敗（${elapsedSec}s｜${codeLabel}｜${reason}）`);
        probes.push({ participant: seat.participant, ok: false, status: runRes ? runRes.status : null, reason });
      }
    } catch (e) {
      const reason = summarizeProbeFailure(null, '', e);
      lines.push(`  ・${seat.participant}（${seat.source}｜${seat.model}／${seat.effort}）：🔴 點火失敗（${reason}）`);
      probes.push({ participant: seat.participant, ok: false, status: null, reason });
    } finally {
      try { fs.rmSync(probeRoot, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    if (shouldBreak) break;
  }

  return { code: 0, lines, probes };
}

/**
 * 執行開工／送審前體檢總表。
 * 不帶變更編號＝開工前模式（待裁、待辦、下游落後、AI 座位）；帶變更編號＝送審前模式（加跑舊文字掃描與合併前風險分級）。
 */
function run(argv = [], {
  settings = readSettings(),
  platform = { ask },
  cwd = process.cwd(),
  which,
  authFile,
  fsImpl,
  spawnSyncImpl,
  runners = {},
} = {}) {
  const parsed = parseArgs(argv);
  if (parsed.error) return { code: 2, lines: [parsed.error] };

  const openChangesConfigured = Boolean(
    runners.openChanges
    || (!runners.pendingRulings
      && settings
      && settings.platform
      && settings.platform.operations
      && Array.isArray(settings.platform.operations.openChanges)
      && settings.platform.operations.openChanges.length > 0
      && settings.platform.operations.openChanges.every(filled)),
  );

  const baseArgv = parsed.base ? ['--base', parsed.base] : [];
  const tasks = [
    {
      id: 'pending-rulings',
      title: '待裁清單（D1）',
      exec: () => {
        const pendingRes = (runners.pendingRulings || runPending)({ settings, platform });
        if (!openChangesConfigured) return pendingRes;
        const openRes = (runners.openChanges || checkOpenChanges)({ settings, platform });
        if (!pendingRes || typeof pendingRes.code !== 'number' || !Array.isArray(pendingRes.lines)) return pendingRes;
        if (!openRes || typeof openRes.code !== 'number' || !Array.isArray(openRes.lines)) return openRes;
        return {
          code: pendingRes.code !== 0 || openRes.code !== 0 ? 2 : 0,
          lines: [...openRes.lines, ...pendingRes.lines],
        };
      },
    },
    {
      id: 'backlog-touch',
      title: '開工印待辦（F6）',
      exec: () => (runners.backlogTouch || runBacklog)({ settings, cwd, argv: baseArgv }),
    },
  ];

  if (!parsed.skipDownstream) {
    tasks.push({
      id: 'downstream-lag',
      title: '下游落後（開工手動跑）',
      exec: () => (runners.downstreamLag || runDownstream)({ settings, platform, root: cwd }),
    });
  }

  if (parsed.change !== undefined) {
    tasks.push(
      {
        id: 'stale-text',
        title: '舊文字掃描（K5）',
        exec: () => (runners.staleText || runStale)(baseArgv, { settings, cwd }),
      },
      {
        id: 'risk-tier',
        title: `合併前風險分級（D4｜變更 ${parsed.change}）`,
        exec: () => (runners.riskTier || runRisk)(parsed.change, { settings, platform, git: gitIn(cwd) }),
      },
    );
  }

  if (!parsed.skipSeats) {
    tasks.push({
      id: 'seats',
      title: '參與 AI 座位體檢（F11、G1）',
      exec: () => {
        const baseRes = (runners.seats || checkSeats)(settings, { which, authFile, fsImpl });
        if (!parsed.probe) return baseRes;
        const probeRes = (runners.probeSeats || probeSeats)(settings, {
          seatFilter: parsed.probe,
          cwd,
          which,
          authFile,
          fsImpl,
          spawnSyncImpl,
        });
        return {
          code: baseRes.code !== 0 || probeRes.code !== 0 ? 2 : 0,
          lines: [...baseRes.lines, ...probeRes.lines],
          seats: baseRes.seats,
          probes: probeRes.probes,
        };
      },
    });
  }

  const modeLabel = parsed.change !== undefined ? `送審前模式（變更 ${parsed.change}）` : '開工前模式';
  const lines = [`開工／送審前體檢總表｜${modeLabel}｜共 ${tasks.length} 項（唯讀、只列不擋）`];
  let overallCode = 0;
  const sections = [];

  for (let i = 0; i < tasks.length; i += 1) {
    const t = tasks[i];
    lines.push('', `=== [${i + 1}/${tasks.length}] ${t.title} ===`);
    let res;
    try {
      res = t.exec();
    } catch (e) {
      res = { code: 2, lines: [`${t.title}：未預期錯誤（${(e && e.message) || '不明'}）——算不出來。`] };
    }
    if (!res || typeof res.code !== 'number' || !Array.isArray(res.lines)) {
      res = { code: 2, lines: [`${t.title}：回傳格式不對——算不出來。`] };
    }
    if (res.code !== 0) overallCode = 2;
    lines.push(...res.lines);
    sections.push({ id: t.id, code: res.code, lines: res.lines });
  }

  return { code: overallCode, lines, sections };
}

if (require.main === module) {
  let result;
  try {
    result = run(process.argv.slice(2));
  } catch (e) {
    result = { code: 2, lines: [`體檢總表：沒預期到的錯誤（${(e && e.code) || (e && e.message) || '不明'}）——算不出來。`] };
  }
  process.exitCode = result.code;
  process.stdout.on('error', () => { process.exitCode = 2; });
  process.stdout.write(`${result.lines.join('\n')}\n`);
}

module.exports = { run, parseArgs, checkOpenChanges, checkSeats, probeSeats, summarizeProbeFailure, extractCommandSpec, defaultWhich, USAGE };
