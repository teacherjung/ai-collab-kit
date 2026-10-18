#!/usr/bin/env node
// 套件倉庫自己的 Grok 複審後掃發射入口（2026-10-19 起：本倉庫自管 scanner 設定與 kit-only/grok-sandbox.sb）。
//
// 為什麼住 kit-only/：
//   1. 理財 #707 停用了理財自己的 scanner 設定（strongest／provider 設為未設定／無），
//      套件不能再靠 provider="借用" 讀理財的 settings.json，也不能改理財設定偷渡恢復。
//   2. 套件改在自己的 settings.json 登記 scanner（strongest="grok-4.7"、maxEffort="xhigh"、provider="專案自建"、
//      wrap 指向 {projectRoot}/kit-only/grok-sandbox.sb），讓步驟 1（試探）、2（埋）、4（比對）、5（收）直接在本倉庫跑。
//   3. 步驟 3（起掃描者）由這支入口在盒外把 GROK_SCAN_RUNNER 綁定 <理財工作樹>/scripts/grok-scan.js：
//      先核對 runner 同層的 grok-sandbox.sb 與本倉庫 kit-only/grok-sandbox.sb 的 SHA-256 完全一致
//      （確保步驟 1 試探的沙箱與步驟 3 實際掃描的沙箱是同一份），再呼叫 runScan(args, { settingsFile })
//      讓模型與推理從本倉庫 settings.json 讀，其餘 ScanDeps（含 liveRoot）一律維持正式預設值。
//   4. 錯誤訊息一律不回顯本機路徑（避免抄進 PR 說明時外流帳號與資料夾名）。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const KIT_ROOT = path.join(__dirname, '..');
const USAGE = '用法：GROK_SCAN_RUNNER=<理財工作樹>/scripts/grok-scan.js node kit-only/grok-scan.js --base <sha> --head <sha> --prompt <指示檔> [--out <輸出檔>] [--repo <要掃的倉庫，預設本倉庫>]';
const FLAGS = new Set(['--base', '--head', '--prompt', '--out', '--repo']);
const SHA_RE = /^[0-9a-f]{7,40}$/u;

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function isRegularFileNoFollow(filePath) {
  try {
    const st = fs.lstatSync(filePath);
    return st.isFile() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * 解析並嚴格檢查指令列參數（不收未知旗標、重複旗標、--flag=value 或缺值）。
 */
function parseScanArgs(argv, { cwd = process.cwd(), kitRoot = KIT_ROOT } = {}) {
  if (!Array.isArray(argv)) return { ok: false, message: `⛔ ${USAGE}` };
  const seen = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (typeof flag !== 'string' || !FLAGS.has(flag)) return { ok: false, message: `⛔ ${USAGE}` };
    if (seen.has(flag)) return { ok: false, message: `⛔ 旗標重複（${flag}）：${USAGE}` };
    if (typeof val !== 'string' || val === '' || val.startsWith('-')) return { ok: false, message: `⛔ 旗標 ${flag} 缺少有效值：${USAGE}` };
    seen.set(flag, val);
  }
  const base = seen.get('--base');
  const head = seen.get('--head');
  const promptFile = seen.get('--prompt');
  const outFile = seen.get('--out');
  const repoArg = seen.get('--repo');
  if (!base || !head || !promptFile) return { ok: false, message: `⛔ ${USAGE}` };
  if (!SHA_RE.test(base) || !SHA_RE.test(head)) {
    return { ok: false, message: '⛔ base／head 必須是寫死的 SHA（7〜40 碼小寫十六進位）' };
  }
  const repo = repoArg !== undefined ? path.resolve(cwd, repoArg) : kitRoot;
  return {
    ok: true,
    args: {
      base,
      head,
      promptFile: path.resolve(cwd, promptFile),
      ...(outFile !== undefined ? { outFile: path.resolve(cwd, outFile) } : {}),
      repo,
    },
  };
}

/**
 * 核對盒外綁定的 GROK_SCAN_RUNNER 與同層 grok-sandbox.sb 雜湊。錯誤訊息不印本機路徑。
 */
function resolveRunner({ env = process.env, kitRoot = KIT_ROOT } = {}) {
  const runnerEnv = env && env.GROK_SCAN_RUNNER;
  if (typeof runnerEnv !== 'string' || !runnerEnv.trim() || !path.isAbsolute(runnerEnv)) {
    return { ok: false, message: '⛔ 請先在盒外把 GROK_SCAN_RUNNER 綁定 <理財工作樹>/scripts/grok-scan.js 的絕對路徑' };
  }
  const kitProfile = path.join(kitRoot, 'kit-only', 'grok-sandbox.sb');
  const settingsFile = path.join(kitRoot, 'settings.json');
  if (!isRegularFileNoFollow(kitProfile) || !isRegularFileNoFollow(settingsFile)) {
    return { ok: false, message: '⛔ 本倉庫缺少 kit-only/grok-sandbox.sb 或 settings.json（或不是一般檔案）——不掃' };
  }
  if (!isRegularFileNoFollow(runnerEnv)) {
    return { ok: false, message: '⛔ GROK_SCAN_RUNNER 指到的檔案不存在或不是一般檔案（不收捷徑）——不掃' };
  }
  let runnerReal;
  try {
    runnerReal = fs.realpathSync(runnerEnv);
  } catch (e) {
    return { ok: false, message: `⛔ GROK_SCAN_RUNNER 真實位置解析失敗（${(e && e.code) || '讀取失敗'}）——不掃` };
  }
  if (path.basename(runnerReal) !== 'grok-scan.js' || !isRegularFileNoFollow(runnerReal)) {
    return { ok: false, message: '⛔ GROK_SCAN_RUNNER 必須指向檔名為 grok-scan.js 的一般檔案——不掃' };
  }
  const runnerProfile = path.join(path.dirname(runnerReal), 'grok-sandbox.sb');
  if (!isRegularFileNoFollow(runnerProfile)) {
    return { ok: false, message: '⛔ GROK_SCAN_RUNNER 同層缺少一般檔案 grok-sandbox.sb——不掃' };
  }
  let kitProfileSha;
  let runnerProfileSha;
  try {
    kitProfileSha = sha256(fs.readFileSync(kitProfile));
    runnerProfileSha = sha256(fs.readFileSync(runnerProfile));
  } catch (e) {
    return { ok: false, message: `⛔ 沙箱設定檔讀取失敗（${(e && e.code) || '讀取失敗'}）——不掃` };
  }
  if (kitProfileSha !== runnerProfileSha) {
    return {
      ok: false,
      message: `⛔ 沙箱設定檔雜湊不一致：kit-only/grok-sandbox.sb（${kitProfileSha.slice(0, 12)}…）≠ runner 同層 grok-sandbox.sb（${runnerProfileSha.slice(0, 12)}…）——試探與掃描必須用同一份沙箱設定檔，不掃`,
    };
  }
  return { ok: true, runnerReal, settingsFile, kitProfileSha };
}

/**
 * 執行套件倉庫的 Grok 複審後掃。只把 settingsFile 注入 ScanDeps，不覆寫 liveRoot 等正式預設值。
 */
async function runKitScan(argv = process.argv.slice(2), { env = process.env, cwd = process.cwd(), kitRoot = KIT_ROOT, loadRunner } = {}) {
  const parsed = parseScanArgs(argv, { cwd, kitRoot });
  if (!parsed.ok) return { code: 2, message: parsed.message };
  const resolved = resolveRunner({ env, kitRoot });
  if (!resolved.ok) return { code: 2, message: resolved.message };
  let mod;
  try {
    mod = loadRunner ? await loadRunner(resolved.runnerReal) : await import(pathToFileURL(resolved.runnerReal).href);
  } catch (e) {
    return { code: 2, message: `⛔ 載入 GROK_SCAN_RUNNER 失敗（${(e && e.code) || '載入錯誤'}）——不掃` };
  }
  const runScan = mod && (typeof mod.runScan === 'function' ? mod.runScan : (mod.default && typeof mod.default.runScan === 'function' ? mod.default.runScan : null));
  if (!runScan) {
    return { code: 2, message: '⛔ GROK_SCAN_RUNNER 沒有匯出 runScan 函式——不掃' };
  }
  try {
    const res = await runScan(parsed.args, { settingsFile: resolved.settingsFile });
    if (!res || typeof res !== 'object' || (res.code !== 0 && res.code !== 1 && res.code !== 2)) {
      return { code: 2, message: '⛔ 掃描 runner 回傳格式不合法；本場結果無效' };
    }
    return { code: res.code };
  } catch {
    return { code: 2, message: '⛔ 掃描未完成；本場結果無效，請確認本場資源後重跑' };
  }
}

if (require.main === module) {
  runKitScan().then(({ code, message }) => {
    if (message) process.stderr.write(`${message}\n`);
    process.exit(code);
  }).catch(() => {
    process.stderr.write('⛔ 掃描未完成；本場結果無效，請確認本場資源後重跑\n');
    process.exit(2);
  });
}

module.exports = { USAGE, parseScanArgs, resolveRunner, runKitScan };
