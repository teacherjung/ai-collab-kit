#!/usr/bin/env node
// 從 rules.json 產生 RULES.md。**本文是產物、不要手改**：手改會被 tests/rules-length.test.js 抓到。
//
// 為什麼要產生：字數上限那道考題原本得自己判斷「RULES.md 的哪幾行算規矩」，等於用土法重做
// Markdown 的呈現規則——連七輪被獨立審查者用不同寫法繞過（項目符號、有序清單、縮排、Tab、
// 不換行空白、引言記號、七個井號、CR 換行）。改成由資料產生之後，就沒有「哪幾行算規矩」
// 這個問題：字數直接對資料算，本文只要跟產生結果逐字元相同即可。
//
// ⚠️ 但「由資料產生」本身不夠：第八輪實測，**不計字的欄位可以跑出它該待的位置**——
// 小節標題裡塞一個換行，後面那段就變成獨立的正文段落、完全不計字；句尾標籤裡先關括號再換行，
// 就能長出一整條沒人數的新規矩。所以下面這份**資料契約**才是這一族真正的收口：
// 每一個會被輸出的欄位都必須是「單行純文字」，標籤另外不准帶全形括號。
// 契約由 validate() 一處說了算，產生器與考題都用它，兩邊不會各寫各的。
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataFile = path.join(root, 'rules.json');
const outFile = path.join(root, 'RULES.md');

// 會讓一個欄位跑出它該待的位置的字元：各種換行與分段。
const LINE_BREAK = /[\n\r\u0085\u2028\u2029\v\f]/u;
// 規矩至少要有幾條，才算「這份資料還是一份規矩清單」（不是實際條數，寫死會漂）。
const MIN_RULES = 20;

function checkPlain(value, what, problems) {
  if (typeof value !== 'string') {
    problems.push(`${what} 不是字串（是 ${Array.isArray(value) ? '陣列' : typeof value}）：非字串會被硬轉成字串，可能夾帶換行`);
    return false;
  }
  if (value.trim() === '') {
    problems.push(`${what} 是空的`);
    return false;
  }
  if (LINE_BREAK.test(value)) {
    problems.push(`${what} 裡有換行：它會跑出自己該待的位置，在本文裡變成一段沒人數的正文`);
    return false;
  }
  return true;
}

/** 資料契約。回傳問題清單；空陣列＝合格。產生器與考題共用這一份。 */
function validate(data) {
  const problems = [];
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return ['rules.json 的最外層不是一個物件'];
  }
  checkPlain(data.title, '本文標題 title', problems);
  checkPlain(data.preamble, '開頭那句指路 preamble', problems);
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    problems.push('rules.json 沒有任何小節');
    return problems;
  }
  const seenLetters = new Set();
  const seenIds = new Set();
  let count = 0;
  for (const section of data.sections) {
    const letter = section && section.letter;
    if (typeof letter !== 'string' || !/^[A-Z]$/u.test(letter)) {
      problems.push(`小節代號「${letter}」不是單一個大寫英文字母`);
      continue;
    }
    if (seenLetters.has(letter)) problems.push(`小節代號 ${letter} 重複了`);
    seenLetters.add(letter);
    checkPlain(section.title, `小節 ${letter} 的標題 title`, problems);
    if (!Array.isArray(section.rules)) {
      problems.push(`小節 ${letter} 沒有規矩清單`);
      continue;
    }
    section.rules.forEach((rule, i) => {
      const id = `${letter}${rule && rule.n}`;
      if (!Number.isInteger(rule && rule.n) || rule.n !== i + 1) {
        problems.push(`${id} 的編號不對：同一節裡要從 1 開始連號`);
      }
      if (seenIds.has(id)) problems.push(`條號 ${id} 重複了`);
      seenIds.add(id);
      checkPlain(rule && rule.text, `${id} 的正文 text`, problems);
      if (checkPlain(rule && rule.tag, `${id} 的執行者標籤 tag`, problems) && /[（）]/u.test(rule.tag)) {
        problems.push(`${id} 的執行者標籤裡有全形括號：標籤本來就被包在括號裡，再帶一個就能提早關掉它、後面長出沒人數的內容`);
      }
      count += 1;
    });
  }
  if (count < MIN_RULES) {
    problems.push(`只找到 ${count} 條規矩（至少要 ${MIN_RULES} 條）：資料整份變形的話字數會算成零、考題就變成永遠綠的空包彈`);
  }
  return problems;
}

/** 由資料產生本文的完整內容（換行一律用 \n）。資料不合契約就直接丟例外，不產生半成品。 */
function build(data) {
  const problems = validate(data);
  if (problems.length) {
    throw new Error(`rules.json 不合資料契約，沒有產生任何東西：\n- ${problems.join('\n- ')}`);
  }
  const out = [`# ${data.title}`, '', data.preamble, ''];
  for (const section of data.sections) {
    out.push(`## ${section.letter}、${section.title}`);
    for (const rule of section.rules) {
      out.push(`- ${section.letter}${rule.n} ${rule.text}（${rule.tag}）`);
    }
    out.push('');
  }
  return out.join('\n');
}

function read() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

if (require.main === module) {
  const data = read();
  fs.writeFileSync(outFile, build(data), 'utf8');
  const n = data.sections.reduce((s, x) => s + x.rules.length, 0);
  process.stdout.write(`寫好 RULES.md：${data.sections.length} 節、${n} 條\n`);
}

module.exports = { build, read, validate, dataFile, outFile, MIN_RULES };
