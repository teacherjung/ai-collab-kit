#!/usr/bin/env node
// 平台介面：閘要問平台的每一個問題，都只透過這一支。
//
// 為什麼需要它（2026-09-13 量出來的）：原專案那七支閘全部直接呼叫 GitHub 的指令列工具，
// 合計三千多行、裡面散著讀變更、列變更、讀留言、讀檢查場次那些呼叫。照搬等於把套件釘死在一個平台上，
// 而這個套件的整個賣點是搬得動。但實際量過，它們只用到平台的**九個動作**——所以不是搬三千行，
// 是定九個問題。
//
// ## 分工：套件定問題，專案定怎麼問
//
// 套件定的是「問什麼」與「答案長什麼樣」（下面的 OPERATIONS）。每個專案在 settings.json 的
// platform.operations 底下，替每個問題填一條指令；那條指令要把答案印成**這裡規定的那個形狀的 JSON**。
// 翻譯是專案的事，套件不碰任何平台的語彙。
//
// ⚠️ 這樣切的代價，照實說：翻譯寫錯是專案自己的責任，套件驗不到「答案是不是真的」——
//    它只驗**形狀**（欄位齊不齊、型別對不對、單行非空）。形狀對但內容造假，這裡擋不住。
//    這跟原專案那些閘的處境一樣：它們也只能相信平台回的東西。
//
// ## 一律 fail-closed
//
// 沒登記那個動作、指令跑不起來、被訊號殺掉、退出碼非零、印出來的不是 JSON、形狀不合——
// 全部當「查不到」丟例外，讓呼叫的閘退 2。**絕不回一個空陣列假裝問過了**：
// 空陣列會讓「沒有未撤銷的阻擋」「沒有別支疊在上面」這種判斷靜靜變成通過（規矩 E5）。
'use strict';
const { spawnSync } = require('node:child_process');
const { read: readSettings } = require('./settings-data.js');

const UNSET = '未設定';
// 會讓一個欄位跑出它該待的位置的字元。⚠️ 這一組必須跟資料契約那一份**完全一樣**；
// 這裡沒有直接引用，是為了不讓平台層去相依案例簿的產生器。
// tests/platform.test.js 有一題拿兩邊逐字元對帳，漂了就紅。
const LINE_BREAK = new RegExp('[\\n\\r\\u0085\\u2028\\u2029\\v\\f]', 'u');

/** 欄位型別：套件只認這幾種，形狀表就只靠它們描述。 */
const LINE = 'line';        // 單行非空字串
const TEXT = 'text';        // 可以多行、可以空（變更說明、留言內文）
const BOOL = 'bool';
const MAYBE = 'maybe-line'; // 單行字串或 null（例如還沒有結論的檢查）

/**
 * 套件會問平台的每一個問題。
 * kind：object＝答案是一個物件；list＝答案是一個陣列；action＝不要答案，只看有沒有做成。
 * params：指令樣板裡可以用的替換記號。
 */
const OPERATIONS = {
  change: {
    kind: 'object',
    params: ['change'],
    what: '讀一支變更的基本資料',
    shape: { id: LINE, title: LINE, body: TEXT, baseBranch: LINE, headBranch: LINE, headSha: LINE, state: LINE, isDraft: BOOL, author: LINE },
  },
  openChanges: {
    kind: 'list',
    params: [],
    what: '列出目前開著的每一支變更',
    shape: { id: LINE, baseBranch: LINE, headBranch: LINE, headSha: LINE, isDraft: BOOL, author: LINE },
  },
  comments: {
    kind: 'list',
    params: ['change'],
    what: '讀一支變更底下的留言（結論、裁示、撤回都靠它）',
    shape: { id: LINE, author: LINE, body: TEXT, createdAt: LINE },
  },
  changedFiles: {
    kind: 'list',
    params: ['change'],
    what: '讀一支變更動了哪些檔',
    shape: { path: LINE, status: LINE },
  },
  checks: {
    kind: 'list',
    params: ['sha'],
    what: '讀某一顆版本上跑過的檢查場次',
    shape: { name: LINE, status: LINE, conclusion: MAYBE },
  },
  requiredChecks: {
    kind: 'list',
    params: ['branch'],
    what: '讀主幹設了哪些必過檢查（名單的正本在平台上，不另抄一份會漂的）',
    shape: { name: LINE },
  },
  branchSha: {
    kind: 'object',
    params: ['branch'],
    what: '讀一個分支現在指到哪一顆',
    shape: { sha: LINE },
  },
  markReady: { kind: 'action', params: ['change'], what: '把一支變更從草稿轉成正式' },
  merge: { kind: 'action', params: ['change'], what: '按下合併鍵' },
};

/** 預設執行器。起不來或被訊號殺掉都回 status null——呼叫端一律當查不到。 */
function runCommand(command, args) {
  const r = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.error) return { status: null, stdout: '', stderr: String(r.error.message) };
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

class PlatformError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlatformError';
  }
}

function checkField(value, type, where) {
  if (type === BOOL) {
    if (typeof value !== 'boolean') throw new PlatformError(`${where} 不是是非值（拿到 ${JSON.stringify(value)}）`);
    return;
  }
  if (type === MAYBE && value === null) return;
  if (typeof value !== 'string') throw new PlatformError(`${where} 不是字串（拿到 ${JSON.stringify(value)}）`);
  if (type === TEXT) return;
  if (value.trim() === '') throw new PlatformError(`${where} 是空的`);
  if (LINE_BREAK.test(value)) throw new PlatformError(`${where} 裡有換行：這一格應該是單行的`);
}

/** 驗一個答案的形狀。多出來的欄位一律拒收——多一個欄位通常代表翻譯對錯了問題。 */
function checkShape(value, shape, where) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PlatformError(`${where} 不是一個物件`);
  }
  for (const [field, type] of Object.entries(shape)) {
    if (!(field in value)) throw new PlatformError(`${where} 少了「${field}」這一格`);
    checkField(value[field], type, `${where} 的「${field}」`);
  }
  const extra = Object.keys(value).filter((k) => !(k in shape));
  if (extra.length) throw new PlatformError(`${where} 多了沒約定的欄位：${extra.join('、')}`);
}

/** 把指令樣板裡的記號換掉。用不到的參數、沒填的參數都當錯，不默默跑一條半成品的指令。 */
function fill(parts, params, args, opName) {
  const allowed = new Set(params);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new PlatformError(`動作「${opName}」不吃參數 ${key}`);
  }
  for (const key of params) {
    const v = args[key];
    if (typeof v !== 'string' || v.trim() === '') throw new PlatformError(`動作「${opName}」少了參數 ${key}`);
  }
  const used = new Set();
  const out = parts.map((part) => {
    let s = String(part);
    for (const key of params) {
      const token = `{${key}}`;
      if (s.includes(token)) { used.add(key); s = s.split(token).join(args[key]); }
    }
    return s;
  });
  const missing = params.filter((k) => !used.has(k));
  if (missing.length) {
    throw new PlatformError(`動作「${opName}」登記的指令沒有用到 ${missing.map((k) => `{${k}}`).join('、')}：那條指令問的不是我要問的那一支`);
  }
  return out;
}

/**
 * 問平台一個問題。查不到一律丟 PlatformError（呼叫的閘要讓它變成退 2）。
 * @param {string} opName OPERATIONS 裡的名字
 * @param {object} args 參數（change／sha／branch）
 */
function ask(opName, args = {}, { settings = readSettings(), run = runCommand } = {}) {
  const op = OPERATIONS[opName];
  if (!op) throw new PlatformError(`沒有「${opName}」這個動作`);
  const platform = settings.platform || {};
  const registered = (platform.operations || {})[opName];
  if (!Array.isArray(registered) || registered.length === 0 || registered[0] === UNSET) {
    throw new PlatformError(`專案設定裡沒有登記「${opName}」（${op.what}）：問不到就不放行，不假裝問過了。`);
  }
  const argv = fill(registered, op.params, args, opName);
  const { status, stdout, stderr } = run(argv[0], argv.slice(1));
  if (status === null) throw new PlatformError(`動作「${opName}」的指令起不來或被殺掉：${String(stderr).trim().slice(0, 120)}`);
  if (status !== 0) throw new PlatformError(`動作「${opName}」的指令退了 ${status}：${String(stderr).trim().slice(0, 120)}`);
  if (op.kind === 'action') return null;

  let parsed;
  try { parsed = JSON.parse(stdout); }
  catch { throw new PlatformError(`動作「${opName}」印出來的不是 JSON：翻譯那一段沒寫對，問不到就不放行`); }

  if (op.kind === 'list') {
    if (!Array.isArray(parsed)) throw new PlatformError(`動作「${opName}」的答案不是一個陣列`);
    parsed.forEach((item, i) => checkShape(item, op.shape, `「${opName}」第 ${i + 1} 筆`));
    return parsed;
  }
  checkShape(parsed, op.shape, `「${opName}」的答案`);
  return parsed;
}

/** 這個專案把九個動作填齊了沒。閘開跑前先問這個，缺哪個一次講完。 */
function missingOperations(settings = readSettings()) {
  const registered = (settings.platform || {}).operations || {};
  return Object.keys(OPERATIONS).filter((name) => {
    const v = registered[name];
    return !Array.isArray(v) || v.length === 0 || v[0] === UNSET;
  });
}

if (require.main === module) {
  const missing = missingOperations();
  const total = Object.keys(OPERATIONS).length;
  const lines = [`平台介面共 ${total} 個動作，這個專案還沒登記 ${missing.length} 個。`];
  for (const [name, op] of Object.entries(OPERATIONS)) {
    lines.push(`${missing.includes(name) ? '✗ 未登記' : '✓ 已登記'}｜${name}｜${op.what}`);
  }
  if (missing.length) lines.push('沒登記的動作被問到時一律丟錯、不放行——不會回一個空答案假裝問過了。');
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(missing.length ? 2 : 0);
}

module.exports = { ask, missingOperations, runCommand, checkShape, OPERATIONS, PlatformError, LINE_BREAK, UNSET };
