#!/usr/bin/env node
// 進度摘要檢查（規矩 J5）：讀倉庫外那份共用進度摘要，列出不合檔頭寫法、時間寫反、附件條號指不到、
// 「已合併」跟平台對不上的地方；只列不擋（有問題也退 0），接進鉤子時帶 --strict 才擋。
//
// 為什麼：進度摘要是擁有者最常看的檔，卻沒有任何機器看它（套件缺點稽核 2026-10-06 第一主題）。
// 2026-10-07 改成八欄之後三小時，另一個工作階段照它記憶裡的舊檔頭把自己那一則蓋回五欄——
// 格式只住在檔頭、靠每個 AI 記得讀，就會這樣。這一支讀的形狀＝摘要檔頭「怎麼寫」那一段（2026-10-07 版）；
// 檔頭改了這裡要跟著改，每一條判準各有考題釘著。
//
// 查什麼：
//   ①「進行中的線」每一則：標題四段（專案三選一、狀態六選一、誰・資料夾有「・」）、八欄齊全且依序、每欄非空、
//     每一行都是清單（舊的五欄寫法沒有清單記號，抓得到）；
//   ②時間欄：整理與核實都要有「月/日 時:分」，核實不可以晚於整理；
//   ③證據欄引的「附件第 N 條」在附件裡找得到（已結束那一節引的也查；「45〜47」這種範圍會展開）；
//   ④到哪一步寫了「已合併」：引到的附件裡要找得到 PR（完整網址，或 --repos 登記過的「套件 #N」這種寫法），
//     而且問得到平台時至少一支真的合併了；狀態是施工中或等複審、到哪一步沒寫已合併、引到的 PR 卻全部合併了＝可能過期；
//   ⑤已結束那一節：每一行的形狀、滿 30 天該刪；本週成果那一節：日期超過七天該刪。
// 平台只問一件事：那支 PR 合併了沒（gh api）；答案可以用 --pr-states <json 檔> 代替（考題與離線用）；
// --offline＝不問平台，④只查引不引得到 PR。
// ⚠️ 守不到的：內容真不真（「他要的」是不是他要的、核實時間有沒有真的核）；「已驗收」對不對（平台上沒有固定形狀可查）；
//   跨年的先後（只比月日，未來的日期當成還沒到）；附件以外的網址；有沒有人跑它。
// 退出碼：0＝查完了（有沒有問題都是 0；--strict 時有問題＝1）／2＝查不了（檔讀不到、少了要查的節、參數不對）。
'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('./git-env.js');

const PROJECTS = ['套件', '理財', '共用'];
const STATES = ['施工中', '等複審', '等驗收', '等裁示', '暫停中', '已結束'];
const FIELDS = ['他要的', '做了什麼', '到哪一步', '現在誰在動', '下一步是', '動哪些檔', '證據', '時間'];
const SECTIONS = { active: '## 進行中的線', week: '## 本週成果', done: '## 已結束', attachments: '## 附件' };
const DONE_DAYS = 30;
const WEEK_DAYS = 7;
const STAMP = /(\d{2})\/(\d{2}) (\d{2}):(\d{2})/u;
const PR_URL = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)/gu;
const BARE_PR = /(\S+?)\s*#(\d+)/gu;
const ATTACHMENT_REF = /附件第\s*([0-9０-９、，,〜~\-－\s]+?)\s*條/gu;
const OLD_FIELD = /^(到哪一步|下一步是|狀態說明|動哪些檔|證據)：/u;

/** 月/日 時:分 → 可以直接比大小的字串；讀不出＝null。 */
function stamp(text) {
  const m = STAMP.exec(text || '');
  return m ? `${m[1]}/${m[2]} ${m[3]}:${m[4]}` : null;
}

/** 「45〜47」「12、13」「16、23、55」都展開成數字清單；展不開的段落丟掉。 */
function expandRefs(text) {
  const out = [];
  for (const m of String(text).matchAll(ATTACHMENT_REF)) {
    const normalized = m[1].replace(/[０-９]/gu, (d) => String(d.charCodeAt(0) - 0xff10));
    for (const part of normalized.split(/[、，,\s]+/u).filter(Boolean)) {
      const range = /^(\d+)\s*[〜~\-－]\s*(\d+)$/u.exec(part);
      if (range) {
        const [a, b] = [Number(range[1]), Number(range[2])];
        if (b >= a && b - a <= 200) for (let i = a; i <= b; i += 1) out.push(i);
      } else if (/^\d+$/u.test(part)) out.push(Number(part));
    }
  }
  return out;
}

/** 從一段文字裡找 PR：完整網址，加上 --repos 登記過的「套件 #45」這種寫法。回「owner/repo#n」的集合。 */
function prRefs(text, repos = {}) {
  const out = new Set();
  for (const m of String(text).matchAll(PR_URL)) out.add(`${m[1]}/${m[2]}#${m[3]}`);
  const names = Object.keys(repos);
  if (names.length) {
    for (const m of String(text).matchAll(BARE_PR)) {
      const name = names.find((n) => m[1].endsWith(n));
      if (name) out.add(`${repos[name]}#${m[2]}`);
    }
  }
  return out;
}

/** 把檔案切成節：每個 ## 標題起、到下一個 ## 標題前。回 { 標題行: [行…] }，標題行只比開頭。節與節之間的分隔線（---）不算內容。 */
function splitSections(text) {
  const sections = {};
  let current = null;
  for (const line of String(text).split('\n')) {
    if (line.startsWith('## ')) { current = line; sections[current] = []; continue; }
    if (/^-{3,}\s*$/u.test(line)) continue;
    if (current) sections[current].push(line);
  }
  return sections;
}

function findSection(sections, heading) {
  const key = Object.keys(sections).find((k) => k.startsWith(heading));
  return key ? sections[key] : null;
}

/** 附件：編號 → 那一條的全文（含接在後面、沒有編號的續行）。 */
function parseAttachments(lines) {
  const out = new Map();
  let current = null;
  for (const line of lines) {
    const m = /^(\d+)\. (.*)$/u.exec(line);
    if (m) { current = Number(m[1]); out.set(current, m[2]); continue; }
    if (current !== null && line.trim()) out.set(current, `${out.get(current)}\n${line}`);
  }
  return out;
}

/** 進行中的線：每一則＝標題行＋到下一則之前的行。 */
function parseEntries(lines) {
  const entries = [];
  for (const line of lines) {
    if (line.startsWith('### ')) { entries.push({ title: line.slice(4), body: [] }); continue; }
    if (entries.length) entries[entries.length - 1].body.push(line);
  }
  return entries;
}

/** 天數差：now 減 date（都只有月日；年用 now 的年）。未來的日期回負數。 */
function daysBefore(now, month, day) {
  const a = Date.UTC(now.year, now.month - 1, now.day);
  const b = Date.UTC(now.year, month - 1, day);
  return Math.round((a - b) / 86400000);
}

function checkEntry(entry, ctx) {
  const problems = [];
  const segs = entry.title.split('｜');
  const label = segs.length >= 2 ? `${segs[0]}｜${segs[1]}` : entry.title;
  const say = (why) => problems.push(`${label}：${why}`);
  if (segs.length !== 4) say(`標題要四段（專案｜事情｜狀態｜誰・資料夾），這一則有 ${segs.length} 段${segs.length === 5 ? '（像是舊格式的「確認時間」還在標題裡）' : ''}`);
  if (!PROJECTS.includes(segs[0])) say(`專案「${segs[0]}」不在 ${PROJECTS.join('／')} 裡`);
  const state = segs[2];
  if (segs.length >= 3 && !STATES.includes(state)) say(`狀態「${state}」不是六選一（${STATES.join('／')}）`);
  if (segs.length >= 4 && !segs[3].includes('・')) say('第四段要寫「誰・資料夾」，中間用「・」');

  const fields = new Map();
  const order = [];
  for (const raw of entry.body) {
    if (!raw.trim()) continue;
    if (OLD_FIELD.test(raw)) { say(`「${raw.split('：')[0]}」是舊的五欄寫法（沒有清單記號、少了八欄）`); continue; }
    if (!/^(\s*)- /u.test(raw)) { say(`有一行不是清單：「${raw.trim().slice(0, 30)}」`); continue; }
    const m = /^- ([^：]+)：(.*)$/u.exec(raw);
    if (!m) continue;
    if (FIELDS.includes(m[1])) {
      if (fields.has(m[1])) say(`「${m[1]}」寫了兩次`);
      fields.set(m[1], m[2]);
      order.push(m[1]);
    }
  }
  for (const f of FIELDS) {
    if (!fields.has(f)) say(`少了「${f}」這一欄`);
    else if (!fields.get(f).trim()) say(`「${f}」是空的`);
  }
  const expected = FIELDS.filter((f) => fields.has(f));
  if (expected.some((f, i) => order[i] !== f)) say(`八欄的順序要照檔頭（${FIELDS.join('／')}）`);

  const time = fields.get('時間') || '';
  const edited = stamp(/整理[^核]*/u.exec(time)?.[0]);
  const verifiedPart = /核實[\s\S]*$/u.exec(time)?.[0];
  const verified = stamp(verifiedPart);
  if (!edited) say('時間欄缺「整理 月/日 時:分」');
  if (!verifiedPart) say('時間欄缺「核實」');
  else if (!verified) say('「核實」後面要有一個月/日 時:分（沿用舊紀錄就寫那份紀錄的時間）');
  if (edited && verified && verified > edited) say(`核實時間（${verified}）晚於整理時間（${edited}）：核實之後改了字就要更新整理時間`);

  const refs = expandRefs(fields.get('證據') || '');
  if (fields.has('證據') && refs.length === 0) say('證據欄沒有引到任何「附件第 N 條」');
  for (const n of refs) if (!ctx.attachments.has(n)) say(`證據引的附件第 ${n} 條不存在`);

  const step = fields.get('到哪一步') || '';
  const cited = new Set();
  for (const n of refs) for (const pr of prRefs(ctx.attachments.get(n) || '', ctx.repos)) cited.add(pr);
  const claimsMerged = /已合併/u.test(step);
  if (claimsMerged) {
    if (cited.size === 0) say('到哪一步寫「已合併」，但引到的附件裡找不到任何 PR（完整網址或登記過的寫法），核不了');
    else if (!ctx.offline) {
      const states = [...cited].map((pr) => ctx.prStates[pr]);
      const unknown = [...cited].filter((pr) => !ctx.prStates[pr] || ctx.prStates[pr].merged === null);
      if (unknown.length) say(`問不到平台，核不了：${unknown.join('、')}`);
      else if (!states.some((s) => s.merged)) say(`到哪一步寫「已合併」，但引到的 PR 在平台上沒有一支合併了（${[...cited].join('、')}）`);
    }
  } else if (['施工中', '等複審'].includes(state) && cited.size && !ctx.offline) {
    const states = [...cited].map((pr) => ctx.prStates[pr]);
    if (states.every((s) => s && s.merged)) say(`狀態是${state}、到哪一步沒寫已合併，引到的 PR 卻全部合併了（${[...cited].join('、')}）：可能過期`);
  }
  return { problems, cited: [...cited] };
}

function checkDone(lines, ctx) {
  const problems = [];
  for (const line of lines) {
    if (!line.startsWith('### ')) continue;
    const m = /^### (套件|理財|共用)｜(.+?)｜已結束 (\d{2})\/(\d{2})｜(已留：附件第[^｜]+條.*|無永久決定.*)$/u.exec(line);
    if (!m) { problems.push(`已結束：「${line.slice(4, 40)}」不合形狀（專案｜事情｜已結束 月/日｜已留：附件第 N 條 或 無永久決定）`); continue; }
    const age = daysBefore(ctx.now, Number(m[3]), Number(m[4]));
    if (age > DONE_DAYS) problems.push(`已結束：「${m[2]}」結束滿 ${age} 天（上限 ${DONE_DAYS}），該刪`);
    for (const n of expandRefs(m[5])) if (!ctx.attachments.has(n)) problems.push(`已結束：「${m[2]}」引的附件第 ${n} 條不存在`);
  }
  return problems;
}

function checkWeek(lines, ctx) {
  const problems = [];
  for (const line of lines) {
    const m = /^- (\d{2})\/(\d{2})\s*$/u.exec(line);
    if (!m) continue;
    const age = daysBefore(ctx.now, Number(m[1]), Number(m[2]));
    if (age > WEEK_DAYS) problems.push(`本週成果：${m[1]}/${m[2]} 已經是 ${age} 天前（只留 ${WEEK_DAYS} 天），該刪`);
  }
  return problems;
}

/**
 * 純判斷層。text＝整份摘要；now＝{ year, month, day }；prStates＝{ 'owner/repo#n': { merged: true|false|null } }；
 * repos＝{ 套件: 'owner/repo' }；offline＝不看 prStates。
 * 回 { unsure, problems, entries, attachments, cited }：unsure 非空＝查不了。
 */
function evaluate(text, { now, prStates = {}, repos = {}, offline = false } = {}) {
  const sections = splitSections(text);
  const active = findSection(sections, SECTIONS.active);
  const attachmentLines = findSection(sections, SECTIONS.attachments);
  if (!active) return { unsure: `找不到「${SECTIONS.active}」那一節` };
  if (!attachmentLines) return { unsure: `找不到「${SECTIONS.attachments}」那一節` };
  if (!now || !(now.year >= 2000) || !(now.month >= 1 && now.month <= 12) || !(now.day >= 1 && now.day <= 31)) return { unsure: '今天的日期讀不出來' };
  const attachments = parseAttachments(attachmentLines);
  const ctx = { now, prStates, repos, offline, attachments };
  const entries = parseEntries(active);
  const problems = [];
  const cited = new Set();
  for (const entry of entries) {
    const r = checkEntry(entry, ctx);
    problems.push(...r.problems);
    for (const pr of r.cited) cited.add(pr);
  }
  const done = findSection(sections, SECTIONS.done);
  if (done) problems.push(...checkDone(done, ctx));
  const week = findSection(sections, SECTIONS.week);
  if (week) problems.push(...checkWeek(week, ctx));
  return { unsure: null, problems, entries: entries.length, attachments: attachments.size, cited: [...cited] };
}

/** 問平台「這支合併了沒」。runner 可換（考題用）；問不到＝merged: null、附原因。 */
function fetchPrStates(prs, runner = runGh) {
  const out = {};
  for (const pr of prs) {
    const m = /^([^/]+)\/([^#]+)#(\d+)$/u.exec(pr);
    if (!m) { out[pr] = { merged: null, why: '寫法認不得' }; continue; }
    const r = runner(['api', `repos/${m[1]}/${m[2]}/pulls/${m[3]}`]);
    if (r.status !== 0) { out[pr] = { merged: null, why: (r.stderr || '').trim().split('\n')[0] || `退出碼 ${r.status}` }; continue; }
    try {
      const data = JSON.parse(r.stdout);
      out[pr] = { merged: Boolean(data.merged_at), state: data.state };
    } catch { out[pr] = { merged: null, why: '平台回的不是 JSON' }; }
  }
  return out;
}

function runGh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', env: gitEnv(), maxBuffer: 16 * 1024 * 1024 });
  if (r.error) return { status: 127, stdout: '', stderr: String(r.error.message) };
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function parseArgs(argv) {
  const opts = { file: null, now: null, offline: false, strict: false, prStatesFile: null, repos: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => { i += 1; if (i >= argv.length) throw new Error(`${a} 後面要接值`); return argv[i]; };
    if (a === '--file') opts.file = next();
    else if (a === '--now') opts.now = next();
    else if (a === '--offline') opts.offline = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--pr-states') opts.prStatesFile = next();
    else if (a === '--repos') {
      for (const pair of next().split(',')) {
        const [name, repo] = pair.split('=');
        if (!name || !repo || !/^[^/]+\/[^/]+$/u.test(repo)) throw new Error(`--repos 的寫法是 名稱=owner/repo，用逗號隔開（收到「${pair}」）`);
        opts.repos[name.trim()] = repo.trim();
      }
    } else throw new Error(`不認得的參數：${a}。用法：node tools/check-progress-summary.js --file <摘要檔> [--now 月/日] [--offline] [--strict] [--pr-states <json 檔>] [--repos 套件=owner/repo,...]`);
  }
  if (!opts.file) throw new Error('要給 --file <摘要檔>');
  return opts;
}

function todayLocal() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function parseNow(text) {
  const m = /^(\d{1,2})\/(\d{1,2})$/u.exec(text || '');
  if (!m) return null;
  return { year: todayLocal().year, month: Number(m[1]), day: Number(m[2]) };
}

function run(argv, { fetch = fetchPrStates } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { return { code: 2, lines: [`進度摘要檢查：${e.message}`] }; }
  let text;
  try { text = fs.readFileSync(opts.file, 'utf8'); } catch (e) { return { code: 2, lines: [`進度摘要檢查：讀不到 ${opts.file}（${e.code || e.message}）`] }; }
  const now = opts.now ? parseNow(opts.now) : todayLocal();
  if (!now) return { code: 2, lines: [`進度摘要檢查：--now 要寫成 月/日（收到「${opts.now}」）`] };
  let prStates = {};
  if (opts.prStatesFile) {
    try { prStates = JSON.parse(fs.readFileSync(opts.prStatesFile, 'utf8')); } catch (e) { return { code: 2, lines: [`進度摘要檢查：--pr-states 讀不到或不是 JSON（${e.code || e.message}）`] }; }
  }
  // 先離線跑一次，只為了知道要問平台哪幾支；再帶著答案真的判。
  const dry = evaluate(text, { now, repos: opts.repos, offline: true });
  if (dry.unsure) return { code: 2, lines: [`進度摘要檢查：${dry.unsure}——查不了。`] };
  if (!opts.offline && !opts.prStatesFile && dry.cited.length) prStates = fetch(dry.cited);
  const result = evaluate(text, { now, prStates, repos: opts.repos, offline: opts.offline });
  if (result.unsure) return { code: 2, lines: [`進度摘要檢查：${result.unsure}——查不了。`] };
  const lines = [`進度摘要檢查｜${opts.file}：進行中 ${result.entries} 則、附件 ${result.attachments} 條、引到 ${result.cited.length} 支 PR${opts.offline ? '（離線，沒問平台）' : ''}；問題 ${result.problems.length} 條`];
  for (const p of result.problems) lines.push(`  ・${p}`);
  lines.push(result.problems.length ? '只列不擋（--strict 才擋）；照檔頭「怎麼寫」逐條改，改完再跑一次。' : '沒有問題。');
  return { code: opts.strict && result.problems.length ? 1 : 0, lines };
}

if (require.main === module) {
  const result = run(process.argv.slice(2));
  process.stdout.write(`${result.lines.join('\n')}\n`);
  process.exit(result.code);
}

module.exports = { run, evaluate, fetchPrStates, expandRefs, prRefs, parseArgs, FIELDS, STATES, PROJECTS, DONE_DAYS, WEEK_DAYS };
