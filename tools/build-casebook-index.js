#!/usr/bin/env node
// 從 cases/ 底下的案例檔產生 cases/README.md（案例簿索引）。**索引是產物、不要手改。**
//
// 為什麼要產生：索引原本是手寫、靠考題去「找出那張表格」來對帳，而那等於在解讀 Markdown
// 的呈現規則——連三輪被獨立審查者繞過（把整列搬進 HTML 註解、搬進三反引號範例、刪掉表頭與
// 分隔列、把整張表包進圍欄或 `<pre>` 變成範例）。每一次我都再多驗一種上下文，每一次都撐不到
// 下一輪。本文那一族早就換過做法了：資料存起來、文件是產物、比對逐字元相同。索引照做。
//
// 於是「哪一段才是真正的索引表格」這個問題整個消失：索引由案例檔算出來，考題只比
// 「磁碟上的 README 是不是等於重新算一次的結果」。包進圍欄、搬進註解、多一列少一列，都對不上。
//
// 索引裡不是表格的那幾段（開頭說明、末尾的方法示例）住在 cases/index.json。
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const casesDir = path.join(root, 'cases');
const notesFile = path.join(casesDir, 'index.json');
const outFile = path.join(casesDir, 'README.md');

const FIELDS = ['日期', '本文條號', '發生什麼', '代價', '教訓', '來源'];

function caseFiles() {
  return fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();
}

/** 讀一則案例的標題與六欄。形狀不合就丟例外，不要產生半成品的索引。 */
function readCase(file) {
  const lines = fs.readFileSync(path.join(casesDir, file), 'utf8').split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines[0] || !lines[0].startsWith('# ')) throw new Error(`${file} 第一行不是標題`);
  const fields = { slug: file.slice(0, -3), 標題: lines[0].slice(2).trim() };
  FIELDS.forEach((name, i) => {
    const head = `- ${name}：`;
    const line = lines[i + 2];
    if (typeof line !== 'string' || !line.startsWith(head)) {
      throw new Error(`${file} 第 ${i + 3} 行應該是「${head}…」`);
    }
    fields[name] = line.slice(head.length).trim();
  });
  return fields;
}

/** 由案例檔與 index.json 產生索引的完整內容（換行一律用 \n）。 */
function build() {
  const notes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
  const rows = caseFiles()
    .map(readCase)
    .sort((a, b) => (a.日期 === b.日期 ? a.slug.localeCompare(b.slug) : a.日期.localeCompare(b.日期)));
  const out = [`# ${notes.title}`, ''];
  for (const line of notes.intro) out.push(line);
  out.push('', `共 ${rows.length} 則。`, '', '| 日期 | 案例 | 本文條號 |', '|---|---|---|');
  for (const row of rows) {
    out.push(`| ${row.日期} | [${row.標題}](${row.slug}.md) | ${row['本文條號']} |`);
  }
  out.push('');
  for (const section of notes.sections) {
    out.push(`## ${section.title}`, '');
    for (const line of section.lines) out.push(line);
    out.push('');
  }
  return out.join('\n');
}

if (require.main === module) {
  fs.writeFileSync(outFile, build(), 'utf8');
  process.stdout.write(`寫好 cases/README.md：${caseFiles().length} 則\n`);
}

module.exports = { build, outFile, notesFile, caseFiles, readCase, FIELDS };
