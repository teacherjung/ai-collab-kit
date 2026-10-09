#!/usr/bin/env node
// 本週成果產生器（規矩 J5）：最近七天合併進主幹的 PR，照日期列成共用進度摘要「本週成果」那一節的形狀；
// 不帶 --write 只印到標準輸出，帶 --file <摘要> --write 才把那一節換掉（只換那一節，前後的節一個字不動）。
//
// 為什麼：擁有者 2026-10-07 裁「三件都做」的第二件——「本週成果」原本靠人手抄，三條線各寫各的、格式會漂、
// 做完的事也會漏（另一個工作階段曾把自己那一則蓋回舊格式；進度摘要檢查抓得到形狀、抓不到漏寫）。
// 合併紀錄本來就在平台上，機器照它產生，人只負責各線那一則的現況；沒有 PR 的成果寫在各線的「做了什麼」。
//
// 守得到的：
//   ①只算合併進主幹（--main，預設 main）、merged_at 在最近 --days 天（預設 7）之內的 PR；關掉沒合併的不算；
//   ②日期用台北時間歸日（摘要裡的時間都是台北）；
//   ③形狀跟 tools/check-progress-summary.js 認的一樣：「- 月/日」加「  - 專案：標題——已合併（#N）」；日期新的在前，
//     同一天照 --repos 登記的順序分專案、同專案照合併時間；標題裡的換行與多餘空白收掉；
//   ④驗收留痕：那支 PR 的留言裡有第一行是「## ✅ 驗收（YYYY-MM-DD）」的（templates/ruling-record.md 的形狀），加「；月/日 已驗收」；--no-acceptance 不問；
//   ⑤--write 只換那一節（從「## 本週成果」那一行到下一個「## 」之前），分隔線留著；找不到那一節、或出現兩次＝退 2、檔案不動；
//   ⑥問平台固定問 github.com、先清掉選主機／選倉庫／指向別倉庫的環境變數；分頁：一頁滿 100 筆且最舊的還在窗內才翻下一頁。
// ⚠️ 守不到的：沒有 PR 的成果（手寫的，放各線那一則）；標題寫得對不對；台北以外的時區；驗收留痕的內容真不真；
//   gh 沒裝或沒登入＝退 2（不猜）；--write 之後要不要提交那份摘要（倉庫外的檔，由更新摘要的人提交）。
// 退出碼：0＝做好了／2＝做不了（參數不對、gh 退非零或回的不是 JSON、檔讀不到、那一節找不到或重複）。⚠️ 不是閘。
'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('./git-env.js');
const { parseInstant } = require('./time-point.js');

const DAYS = 7;
const TZ = 'Asia/Taipei';
const HEADING = '## 本週成果';
const HOST = 'github.com';
const PAGE = 100;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
// 驗收留痕的第一行（照 templates/ruling-record.md）：括號裡是他驗收的那一天
const ACCEPT_FIRST_LINE = /^## ✅ 驗收（(\d{4})-(\d{2})-(\d{2})）/u;

/** 跟進度摘要檢查同一套：清版本控制的環境變數，再清 gh 選主機、選倉庫的。 */
function ghEnv(env = process.env) {
  const out = gitEnv(env);
  for (const key of ['GH_HOST', 'GH_REPO', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN']) delete out[key];
  return out;
}

function runGh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', env: ghEnv(), maxBuffer: 32 * 1024 * 1024 });
  if (r.error) return { status: 127, stdout: '', stderr: String(r.error.message) };
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

class ToolError extends Error {}

/** 問平台一個 JSON 陣列；退非零、不是 JSON、不是陣列＝ToolError（退 2，不猜）。 */
function askArray(runner, apiPath) {
  const r = runner(['api', '--hostname', HOST, apiPath]);
  if (r.status !== 0) throw new ToolError(`問平台失敗（gh 退 ${r.status}）：${apiPath}${r.stderr ? `\n${r.stderr.trim()}` : ''}`);
  let data;
  try { data = JSON.parse(r.stdout); } catch { throw new ToolError(`平台回的不是 JSON：${apiPath}`); }
  if (!Array.isArray(data)) throw new ToolError(`平台回的不是清單：${apiPath}`);
  return data;
}

/** 台北時間的「月/日」。 */
function dayOf(ms, tz = TZ) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('month')}/${get('day')}`;
}

/**
 * 平台回的 PR 清單（closed、照 updated 新到舊）→ 合併進主幹、merged_at 在 [now − days, now] 之內的那幾支。
 * 回 { number, title, mergedMs }；merged_at 讀不出時間＝不算。
 */
function mergedWithin(list, { nowMs, days = DAYS, mainBranch = 'main' }) {
  const since = nowMs - days * 86400000;
  const out = [];
  for (const p of list) {
    if (!p || typeof p !== 'object' || typeof p.merged_at !== 'string') continue;
    if (!p.base || p.base.ref !== mainBranch) continue;
    const ms = parseInstant(p.merged_at);
    if (ms === null || ms < since || ms > nowMs) continue;
    out.push({ number: Number(p.number), title: String(p.title || ''), mergedMs: ms });
  }
  return out;
}

/** 留言裡最後一則第一行合驗收留痕形狀的，回它括號裡的「月/日」；沒有＝null。 */
function acceptedDate(comments) {
  let found = null;
  for (const c of comments) {
    const first = String(c && c.body || '').replace(/^﻿/u, '').split(/\r?\n/u)[0];
    const m = ACCEPT_FIRST_LINE.exec(first);
    if (m) found = `${m[2]}/${m[3]}`;
  }
  return found;
}

const tidy = (title) => title.replace(/\s+/gu, ' ').trim();

/** items＝{ alias, number, title, mergedMs, accepted }；order＝--repos 登記的順序。回那一節的行。 */
function render(items, { order = [] } = {}) {
  if (!items.length) return [`- （最近 ${DAYS} 天沒有合併進主幹的 PR）`];
  const rank = (alias) => { const i = order.indexOf(alias); return i < 0 ? order.length : i; };
  const byDay = new Map();
  for (const it of items) {
    const day = dayOf(it.mergedMs);
    if (!byDay.has(day)) byDay.set(day, { newest: it.mergedMs, items: [] });
    const d = byDay.get(day);
    d.newest = Math.max(d.newest, it.mergedMs);
    d.items.push(it);
  }
  const days = [...byDay.entries()].sort((a, b) => b[1].newest - a[1].newest);
  const lines = [];
  for (const [day, d] of days) {
    lines.push(`- ${day}`);
    d.items.sort((a, b) => rank(a.alias) - rank(b.alias) || a.mergedMs - b.mergedMs);
    for (const it of d.items) {
      const mark = it.accepted ? `；${it.accepted} 已驗收` : '';
      lines.push(`  - ${it.alias}：${tidy(it.title)}——已合併（#${it.number}${mark}）`);
    }
  }
  return lines;
}

/**
 * 只換「## 本週成果」那一節：從標題行的下一行到下一個「## 」之前；分隔線（---）留著。
 * 找不到、或那一節出現兩次＝null（不寫）。換行先統一成 LF。
 */
function replaceSection(text, bodyLines) {
  const lines = String(text).replace(/\r\n?/gu, '\n').split('\n');
  const heads = lines.map((l, i) => (l.startsWith(HEADING) ? i : -1)).filter((i) => i >= 0);
  if (heads.length !== 1) return null;
  const h = heads[0];
  let n = h + 1;
  while (n < lines.length && !lines[n].startsWith('## ')) n += 1;
  const old = lines.slice(h + 1, n);
  const keepRule = old.some((l) => /^-{3,}\s*$/u.test(l));
  const fresh = ['', ...bodyLines, '', ...(keepRule ? ['---', ''] : [])];
  return [...lines.slice(0, h + 1), ...fresh, ...lines.slice(n)].join('\n');
}

function parseRepos(spec) {
  const repos = Object.create(null);
  const order = [];
  for (const part of String(spec).split(',')) {
    const i = part.indexOf('=');
    const alias = i < 0 ? '' : part.slice(0, i).trim();
    const repo = i < 0 ? '' : part.slice(i + 1).trim();
    if (!alias || !REPO.test(repo)) throw new ToolError(`--repos 的寫法要是「別名=owner/repo」、逗號分隔：認不出「${part}」`);
    repos[alias] = repo;
    order.push(alias);
  }
  return { repos, order };
}

function parseArgs(argv) {
  const opts = { repos: null, order: [], days: DAYS, nowMs: null, mainBranch: 'main', file: null, write: false, acceptance: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => { i += 1; if (i >= argv.length) throw new ToolError(`${a} 後面要接值`); return argv[i]; };
    if (a === '--repos') { const r = parseRepos(next()); opts.repos = r.repos; opts.order = r.order; }
    else if (a === '--days') { const d = Number(next()); if (!Number.isInteger(d) || d < 1 || d > 60) throw new ToolError('--days 要是 1〜60 的整數'); opts.days = d; }
    else if (a === '--now') { const ms = parseInstant(next()); if (ms === null) throw new ToolError('--now 要是帶時區的時間（例如 2026-10-09T10:00:00+08:00）'); opts.nowMs = ms; }
    else if (a === '--main') opts.mainBranch = next();
    else if (a === '--file') opts.file = next();
    else if (a === '--write') opts.write = true;
    else if (a === '--no-acceptance') opts.acceptance = false;
    else throw new ToolError(`不認得的參數：${a}`);
  }
  if (!opts.repos) throw new ToolError('要帶 --repos 別名=owner/repo[,…]');
  if (opts.write && !opts.file) throw new ToolError('--write 要配 --file <摘要檔>');
  return opts;
}

/** 一個倉庫：照 updated 新到舊翻頁，直到一頁不滿、或最舊的那一筆已經早於窗口。 */
function fetchMerged(runner, repo, opts) {
  const since = opts.nowMs - opts.days * 86400000;
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const list = askArray(runner, `repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${PAGE}&page=${page}`);
    all.push(...list);
    if (list.length < PAGE) break;
    const oldest = parseInstant(String(list[list.length - 1].updated_at || ''));
    if (oldest === null || oldest < since) break;
  }
  return mergedWithin(all, opts);
}

function run(argv, { runner = runGh, out = process.stdout, err = process.stderr } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { if (e instanceof ToolError) { err.write(`本週成果產生器：${e.message}\n`); return 2; } throw e; }
  if (opts.nowMs === null) opts.nowMs = Date.now();
  let text = null;
  if (opts.file) {
    try { text = fs.readFileSync(opts.file, 'utf8'); } catch (e) { err.write(`本週成果產生器：讀不到 ${opts.file}（${e.message}）\n`); return 2; }
  }
  const items = [];
  const counts = [];
  try {
    for (const alias of opts.order) {
      const repo = opts.repos[alias];
      const merged = fetchMerged(runner, repo, opts);
      counts.push(`${alias} ${merged.length} 支`);
      for (const m of merged) {
        const accepted = opts.acceptance ? acceptedDate(askArray(runner, `repos/${repo}/issues/${m.number}/comments?per_page=${PAGE}`)) : null;
        items.push({ alias, number: m.number, title: m.title, mergedMs: m.mergedMs, accepted });
      }
    }
  } catch (e) { if (e instanceof ToolError) { err.write(`本週成果產生器：${e.message}\n`); return 2; } throw e; }
  const lines = render(items, { order: opts.order });
  err.write(`本週成果產生器｜最近 ${opts.days} 天合併進 ${opts.mainBranch} 的：${counts.join('、')}（共 ${items.length} 支；問了 ${HOST}）\n`);
  if (!opts.write) { out.write(`${lines.join('\n')}\n`); return 0; }
  const next = replaceSection(text, lines);
  if (next === null) { err.write(`本週成果產生器：${opts.file} 裡找不到唯一的「${HEADING}」那一節，沒有寫\n`); return 2; }
  fs.writeFileSync(opts.file, next);
  out.write(`已把 ${opts.file} 的「${HEADING}」那一節換成 ${lines.length} 行（其餘的節沒動；記得提交那份檔）\n`);
  return 0;
}

if (require.main === module) process.exit(run(process.argv.slice(2)));

module.exports = { run, parseArgs, parseRepos, mergedWithin, dayOf, render, replaceSection, acceptedDate, fetchMerged, ghEnv, DAYS, HEADING, TZ };
