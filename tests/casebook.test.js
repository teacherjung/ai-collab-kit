// 守案例簿的幾條進門規矩，把原本靠人每輪用手掃的事情交給機器。
//
// ⚠️ 這一題被獨立審查者連三輪打穿，根因始終是同一個：**我用「找得到這串字」代替「那個東西在不在」**。
//    第一輪：別欄的敘述提到「- 代價：」就能替缺欄代答；表格外補個連結就算列入；重複列被去重抹掉；
//    名字掃描一遇到網址就放掉整行尾巴。第二輪：案例改成整份照固定形狀讀了，索引那一半卻沒改——
//    把整列原字塞進檔尾的 HTML 註解或三反引號範例裡照樣算數，連表頭與分隔列都刪掉也照樣「對帳通過」；
//    而且案例可以用 CR 換行開出隱藏區塊（我只切 LF，看不到），或用 `<!-- -->` 讓空欄通過「非空」。
//    這一版把索引也做成封閉形狀，並且**先擋掉會製造隱藏內容的字元**，再談形狀。
//
// 守得到的：
//   ⓪案例與索引都**不含 CR 等其他換行字元、也不含 HTML 註解記號**——那兩樣都能做出
//     「我看不到、讀者也看不到」的隱藏內容，不先擋掉，後面的形狀檢查等於白做；
//   ①索引的**表格本身是封閉形狀**：指定的表頭、分隔列、然後連續的資料列，到表格結束為止；
//     表格以外任何長得像表格列的文字（註解、範例）一律不算，而且會被當成錯誤。表格列與檔案
//     **雙向唯一對應**，「共 N 則」要對得上，索引列的日期／標題／條號要跟檔案裡的一致；
//   ②每則**整份檔案就是那個固定形狀**：第一行標題、空行、六欄依序各一行、最後可有一行「相關」，
//     再無別的內容——不是「檔案裡找得到這幾串字」（上一版是那樣寫，於是註解或舉例可以替缺欄代答）；
//     每則至少一個有效條號、條號都存在；而且**本文每一條都至少有一則案例指著**（進門規則）；
//   ③案例正文與索引都不出現裁示者名字與 AI 產品名——**只認一份已知的字表、不分大小寫、
//     整行照掃不給任何豁免**（上一版對網址整段放行，結果網址後面緊接著的名字也被吞掉；
//     來源網址裡本來就不該出現字表上的名字，所以根本不需要那個例外）。
//
// ⚠️ 守不到的，照實說：
//    ・欄位「非空」指的是**原始欄值非空**，不是「呈現出來看得到字」——這一題不解讀 Markdown，
//      只靠 ⓪ 擋掉已知會產生隱藏內容的那兩樣；別種寫法仍可能讓呈現與原文不一致。
//    ・事實對不對、一事一檔、來源連結活不活著、條號撐不撐得住那條規矩（字面引用 ≠ 事件支撐）、
//      這份字表以外的新產品名與變形拼寫、其他個人狀況——全部仍然靠人與獨立審查者。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { read } = require('../tools/build-rules.js');

const root = path.join(__dirname, '..');
const casesDir = path.join(root, 'cases');
const indexFile = path.join(casesDir, 'README.md');
// 六欄，順序就是案例的固定格式。
const FIELDS = ['日期', '本文條號', '發生什麼', '代價', '教訓', '來源'];
// 一份已知的字表；辨認這份以外的名字不是這題的事。
const FORBIDDEN = ['william', 'codex', 'claude', 'grok', 'gpt', 'anthropic', 'openai'];
// 索引表格列：| 日期 | [標題](檔名.md) | 條號 |
const INDEX_ROW = /^\|\s*([^|]+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\.md\)\s*\|\s*([^|]*?)\s*\|\s*$/u;
// 索引表格的頭兩列，逐字釘住：形狀變了就不該再自稱「對帳通過」。
const INDEX_HEAD = '| 日期 | 案例 | 本文條號 |';
const INDEX_SEP = '|---|---|---|';
// 會做出「我看不到、讀者也看不到」的隱藏內容：LF 以外的換行、以及 HTML 註解記號。
const HIDDEN = /[\r\u0085\u2028\u2029\v\f]|<!--|-->/u;

function caseFiles() {
  return fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();
}

/**
 * 照固定形狀讀一則案例：**整份檔案就是這個形狀**，多一行少一行都報錯。
 * 形狀＝`# 標題` ／ 空行 ／ 六欄依序各一行 ／（可有）一行「- 相關：」 ／（可有）結尾空行。
 * 用形狀而不是「找得到這幾串字」，是因為後者可以被註解、舉例或別欄的敘述代答。
 */
function readCase(file) {
  const lines = fs.readFileSync(path.join(casesDir, file), 'utf8').split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  assert.ok(
    lines.length === FIELDS.length + 2 || lines.length === FIELDS.length + 3,
    `${file} 的行數是 ${lines.length}：案例的固定形狀是標題、空行、六欄，最多再加一行「相關」`,
  );
  assert.ok(lines[0].startsWith('# ') && lines[0].slice(2).trim() !== '', `${file} 第一行不是標題`);
  assert.equal(lines[1], '', `${file} 第二行要空著`);
  const fields = { 標題: lines[0].slice(2).trim() };
  FIELDS.forEach((name, i) => {
    const line = lines[i + 2];
    const head = `- ${name}：`;
    assert.ok(line.startsWith(head), `${file} 第 ${i + 3} 行應該是「${head}…」，實際是：${line.slice(0, 24)}`);
    const value = line.slice(head.length).trim();
    assert.notEqual(value, '', `${file} 的「${name}」欄是空的`);
    fields[name] = value;
  });
  if (lines.length === FIELDS.length + 3) {
    assert.ok(lines[FIELDS.length + 2].startsWith('- 相關：'), `${file} 最後一行只能是「- 相關：…」`);
  }
  fields.條號 = fields['本文條號'].split('、').map((x) => x.trim()).filter(Boolean);
  assert.ok(fields.條號.length > 0, `${file} 沒有任何有效的本文條號`);
  return fields;
}

/**
 * 索引只認**那一張表格**：逐字釘住的表頭、分隔列，然後連續的資料列，遇到第一個不是資料列的
 * 行就結束。表格之外任何長得像資料列的文字（註解、範例）都不算，而且直接報錯——
 * 上一版是整檔掃、於是檔尾註解裡的一列也能替真正缺的那一列代答。
 */
function indexRows() {
  const lines = fs.readFileSync(indexFile, 'utf8').split('\n');
  const head = lines.indexOf(INDEX_HEAD);
  assert.ok(head >= 0, `索引裡找不到逐字相符的表頭「${INDEX_HEAD}」`);
  assert.equal(lines.indexOf(INDEX_HEAD, head + 1), -1, '索引裡有兩個表頭');
  assert.equal(lines[head + 1], INDEX_SEP, `索引表頭下一行要是「${INDEX_SEP}」`);
  const rows = [];
  let i = head + 2;
  for (; i < lines.length; i += 1) {
    const m = INDEX_ROW.exec(lines[i]);
    if (!m) break;
    rows.push({ date: m[1], title: m[2], slug: m[3], ids: m[4] });
  }
  for (let j = i; j < lines.length; j += 1) {
    assert.ok(!INDEX_ROW.test(lines[j]), `索引表格之外還有一行長得像資料列（第 ${j + 1} 行）：註解或範例不能替表格列代答`);
  }
  return rows;
}

function ruleIds() {
  const ids = [];
  for (const section of read().sections) for (const rule of section.rules) ids.push(`${section.letter}${rule.n}`);
  return ids;
}

test('案例與索引都不含會製造隱藏內容的字元', () => {
  for (const file of [...caseFiles(), 'README.md']) {
    const text = fs.readFileSync(path.join(casesDir, file), 'utf8');
    const hit = HIDDEN.exec(text);
    assert.equal(
      hit,
      null,
      `${file} 裡出現 ${JSON.stringify(hit && hit[0])}：CR 之類的換行與 HTML 註解都能做出看不到的內容，案例簿一律不收`,
    );
  }
});

test('索引表格列與案例檔雙向唯一對應，欄位一致，總數對得上', () => {
  const files = caseFiles();
  assert.ok(files.length >= 20, `只找到 ${files.length} 則案例：目錄空掉的話下面幾題會變成空包彈`);
  const rows = indexRows();
  const bySlug = new Map();
  for (const row of rows) {
    assert.ok(!bySlug.has(row.slug), `索引裡有兩列都指向 ${row.slug}`);
    bySlug.set(row.slug, row);
  }
  assert.equal(rows.length, files.length, `索引有 ${rows.length} 列、案例有 ${files.length} 檔`);
  for (const file of files) {
    const slug = file.slice(0, -3);
    const row = bySlug.get(slug);
    assert.ok(row, `${file} 沒有出現在索引表格裡（表格外的連結不算）`);
    const fields = readCase(file);
    assert.equal(row.date, fields['日期'], `${file} 的日期與索引那一列對不上`);
    assert.equal(row.title, fields.標題, `${file} 的標題與索引那一列對不上`);
    assert.equal(row.ids, fields['本文條號'], `${file} 的本文條號與索引那一列對不上`);
  }
  const declared = /^共 (\d+) 則。$/mu.exec(fs.readFileSync(indexFile, 'utf8'));
  assert.ok(declared, '索引裡找不到「共 N 則。」那一行');
  assert.equal(Number(declared[1]), files.length, '索引自報的則數跟實際檔案數對不上');
});

test('每則六欄各一個且非空、條號都存在，而且本文每一條都有案例指著', () => {
  const ids = ruleIds();
  const covered = new Set();
  for (const file of caseFiles()) {
    for (const id of readCase(file).條號) {
      assert.ok(ids.includes(id), `${file} 指到不存在的條號 ${id}`);
      covered.add(id);
    }
  }
  const orphans = ids.filter((id) => !covered.has(id));
  assert.deepEqual(orphans, [], `這幾條規矩沒有任何案例指著它（案例簿的進門規則：一條規矩要進本文，就要說得出它為什麼存在）：${orphans.join('、')}`);
});

test('案例與索引都不出現裁示者名字與 AI 產品名（只認一份已知字表、不分大小寫）', () => {
  for (const file of [...caseFiles(), 'README.md']) {
    fs.readFileSync(path.join(casesDir, file), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        // 整行照掃、不給任何豁免：來源網址裡本來就不該出現字表上的名字。
        const scannable = line.toLowerCase();
        for (const word of FORBIDDEN) {
          assert.ok(
            !scannable.includes(word),
            `${file} 第 ${i + 1} 行出現「${word}」：案例簿要能公開，人名與產品名一律寫成角色`,
          );
        }
      });
  }
});
