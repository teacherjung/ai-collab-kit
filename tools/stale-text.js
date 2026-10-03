#!/usr/bin/env node
// 舊文字掃描（規矩 K5）：把這支刪掉或改掉的字串拿去搜整個倉庫，列出還出現在哪裡；只列不擋。
//
// 為什麼：改了行為，考題會自己紅、逼你改；契約、規矩文件、畫面文字、註解不會紅，漏了就變成假話。
// 原專案 #641〜#657 共 197 條複審發現裡，82 條（42%）是這一類，是最大的一類；PFW #655 第二輪唯一擋合併的，
// 就是契約裡一句被這次改動變成假話的句子，而那句話裡的字正是第一版刪掉的。裁示者 2026-10-03 選「A」：
// 實作者送審前跑這支、逐條看，只列不擋。
//
// 抓哪些字串（從刪掉的行裡取；同一個字串也出現在新增的行裡＝作者自己留著用，不列）：
//   ①引號或反引號框住的字（「」『』“”"'`）；②連續 4 個以上的漢字；③看得出是程式名字的英數字（含底線、連字號、點，或大小寫駝峰）。
// 守不到的：只抓字面相同的——意思變了但用字沒變、或換了說法的，抓不到；常見的字會列出不相干的位置，要人判斷；
// 只比已提交的版本（工作樹裡還沒提交的改動不算）。
//
// 退出碼：0＝掃完了（有沒有命中都是 0）／2＝掃不了（不在倉庫裡、基準版本找不到、git 出錯）。⚠️ 不是閘。
'use strict';
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('./git-env.js');
const { read: readSettings } = require('./settings-data.js');

// 一次最多搜幾個字串、每個字串最多列幾處；超過的照實印出還剩多少，不靜靜截掉
const MAX_PHRASES = 300;
const MAX_HITS = 10;

const QUOTED = /「([^」\n]{2,40})」|『([^』\n]{2,40})』|“([^”\n]{2,40})”|"([^"\n]{4,60})"|'([^'\n]{4,60})'|`([^`\n]{4,60})`/gu;
const HAN = /\p{Script=Han}{4,60}/gu;
const IDENT = /[A-Za-z_][A-Za-z0-9_]*(?:[-.][A-Za-z0-9_]+)*/gu;
/** 看得出是程式名字：至少 6 個字元，而且帶底線、連字號、點，或小寫後面接大寫（駝峰）。一般英文單字不算。 */
const looksLikeName = (w) => w.length >= 6 && (/[_.-]/u.test(w) || /[a-z][A-Z]/u.test(w));

function git(args, { cwd, input } = {}) {
  return spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
}

/** 讀 git diff --unified=0 的輸出，分出刪掉的行與新增的行（不含檔頭那兩行）。 */
function parseDiff(text) {
  const removed = [];
  const added = [];
  for (const line of String(text).split('\n')) {
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    if (line.startsWith('-')) removed.push(line.slice(1));
    else if (line.startsWith('+')) added.push(line.slice(1));
  }
  return { removed, added };
}

/** 從刪掉的行取候選字串，照第一次出現的順序；新增的行裡也有的不算（作者自己留著用）。 */
function phrasesOf(removed, added) {
  const seen = new Set();
  const out = [];
  const keep = (p) => {
    const t = p.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const line of removed) {
    for (const m of line.matchAll(QUOTED)) keep(m.slice(1).find((x) => x !== undefined));
    for (const m of line.matchAll(HAN)) keep(m[0]);
    for (const m of line.matchAll(IDENT)) if (looksLikeName(m[0])) keep(m[0]);
  }
  const addedText = added.join('\n');
  return out.filter((p) => !addedText.includes(p));
}

/** 一次 git grep 搜全部字串，再把每一行分回它命中的字串。 */
function searchAll(phrases, cwd) {
  const hits = new Map(phrases.map((p) => [p, []]));
  if (!phrases.length) return { hits };
  const r = git(['grep', '-n', '-I', '-F', '--no-color', '-f', '-'], { cwd, input: `${phrases.join('\n')}\n` });
  // git grep 沒找到任何一處＝退 1，不是錯誤
  if (r.status === 1 && !r.stdout) return { hits };
  if (r.status !== 0) return { error: `git grep 出錯（退出碼 ${r.status}）：${(r.stderr || '').trim().split('\n')[0]}` };
  for (const line of r.stdout.split('\n')) {
    const m = /^(.*?):(\d+):(.*)$/u.exec(line);
    if (!m) continue;
    for (const p of phrases) if (m[3].includes(p)) hits.get(p).push({ file: m[1], line: Number(m[2]), text: m[3].trim() });
  }
  return { hits };
}

function run(args = [], { settings = readSettings(), cwd = process.cwd() } = {}) {
  let base = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) base = args[++i];
    else return { code: 2, lines: [`用法：node tools/stale-text.js [--base <基準版本>]（不認得「${args[i]}」）`] };
  }
  if (!base) {
    if (!settings.mainBranch || settings.mainBranch === '未設定') return { code: 2, lines: ['專案設定的主幹分支名沒填，又沒給 --base：不知道跟哪一版比，掃不了。'] };
    base = `origin/${settings.mainBranch}`;
  }
  const top = git(['rev-parse', '--show-toplevel'], { cwd });
  if (top.status !== 0) return { code: 2, lines: ['這裡不在版本控制的倉庫裡：掃不了。'] };
  const root = top.stdout.trim();
  if (git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], { cwd: root }).status !== 0) {
    return { code: 2, lines: [`找不到基準版本「${base}」（要先 git fetch？）：掃不了。`] };
  }
  const diff = git(['diff', '--no-color', '--no-ext-diff', '-M', '--unified=0', `${base}...HEAD`], { cwd: root });
  if (diff.status !== 0) return { code: 2, lines: [`git diff 出錯（退出碼 ${diff.status}）：${(diff.stderr || '').trim().split('\n')[0]}`] };
  const { removed, added } = parseDiff(diff.stdout);
  const all = phrasesOf(removed, added);
  const phrases = all.slice(0, MAX_PHRASES);
  const found = searchAll(phrases, root);
  if (found.error) return { code: 2, lines: [`舊文字掃描：${found.error}——掃不了。`] };
  const live = phrases.filter((p) => found.hits.get(p).length);
  const lines = [`舊文字掃描｜${base}...HEAD：刪掉或改掉的字串 ${all.length} 個，其中 ${live.length} 個還出現在倉庫裡（只列不擋，K5）`];
  if (all.length > phrases.length) lines.push(`  ⚠️ 字串太多，只搜了前 ${phrases.length} 個；另有 ${all.length - phrases.length} 個沒搜（可以用更近的 --base 分段掃）`);
  for (const p of live) {
    const h = found.hits.get(p);
    lines.push(`「${p}」還出現在 ${h.length} 處：`);
    for (const x of h.slice(0, MAX_HITS)) lines.push(`  ${x.file}:${x.line}：${x.text.slice(0, 100)}`);
    if (h.length > MAX_HITS) lines.push(`  …另有 ${h.length - MAX_HITS} 處沒列`);
  }
  lines.push('逐條看：還在講舊行為的就改（契約、規矩文件、畫面文字、驗收步驟）；不用改的在「PR說明」寫一行理由。只抓字面相同的，意思變了用字沒變的抓不到。');
  return { code: 0, lines, result: { phrases: all, live } };
}

if (require.main === module) {
  let result;
  try { result = run(process.argv.slice(2)); } catch (e) { result = { code: 2, lines: [`舊文字掃描：沒預期到的錯誤（${(e && e.code) || (e && e.message) || '不明'}）——掃不了。`] }; }
  process.stdout.write(`${result.lines.join('\n')}\n`);
  process.exit(result.code);
}

module.exports = { run, parseDiff, phrasesOf, searchAll, looksLikeName, MAX_PHRASES, MAX_HITS };
