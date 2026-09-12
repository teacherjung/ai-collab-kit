#!/usr/bin/env node
// 從 rules.json 產生 RULES.md。**本文是產物、不要手改**：手改會被 tests/rules-length.test.js 抓到。
//
// 為什麼要產生：字數上限那道考題原本得自己判斷「哪幾行算規矩」，等於在重做 Markdown 的
// 呈現規則——連七輪被獨立審查者用不同寫法繞過（項目符號、有序清單、縮排、Tab、不換行空白、
// 引言記號、七個井號、CR 換行）。改成由資料產生之後，就沒有「哪幾行算規矩」這個問題：
// 字數直接對資料算，本文只要跟產生結果逐字元相同即可。
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataFile = path.join(root, 'rules.json');
const outFile = path.join(root, 'RULES.md');

/** 由資料產生本文的完整內容（換行一律用 \n）。 */
function build(data) {
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
  fs.writeFileSync(outFile, build(read()), 'utf8');
  const data = read();
  const n = data.sections.reduce((s, x) => s + x.rules.length, 0);
  process.stdout.write(`寫好 RULES.md：${data.sections.length} 節、${n} 條\n`);
}

module.exports = { build, read, dataFile, outFile };
