// 守案例簿的幾條進門規矩，把原本靠人每輪用手掃的事情交給機器。
//
// ⚠️ 第一版被獨立審查者實測打穿三處，根因都一樣：**我用「整份字串裡有沒有出現這串字」
//    代替「那個欄位在不在」**——於是別欄的敘述提到「- 代價：」就能替缺欄代答；索引只要
//    在表格外補一個連結就算列入；重複的表格列被去重抹掉；名字掃描一遇到網址就放掉整行尾巴。
//    這一版改成**照固定格式讀真正的欄位與表格列**，並且不整行豁免。
//
// 守得到的：
//   ①索引表格列與檔案**雙向唯一對應**，「共 N 則」要對得上，而且索引列的日期／標題／條號
//     要跟檔案裡的一致（不是只比檔名連結）；
//   ②每則**整份檔案就是那個固定形狀**：第一行標題、空行、六欄依序各一行、最後可有一行「相關」，
//     再無別的內容——不是「檔案裡找得到這幾串字」（上一版是那樣寫，於是註解或舉例可以替缺欄代答）；
//     每則至少一個有效條號、條號都存在；而且**本文每一條都至少有一則案例指著**（進門規則）；
//   ③案例正文與索引都不出現裁示者名字與 AI 產品名——**只認一份已知的字表、不分大小寫、
//     整行照掃不給任何豁免**（上一版對網址整段放行，結果網址後面緊接著的名字也被吞掉；
//     來源網址裡本來就不該出現字表上的名字，所以根本不需要那個例外）。
//
// ⚠️ 守不到的，照實說：事實對不對、一事一檔、來源連結活不活著、條號撐不撐得住那條規矩
//    （字面引用 ≠ 事件支撐）、以及這份字表以外的新產品名、變形拼寫與其他個人狀況——
//    全部仍然靠人與獨立審查者。
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

function indexRows() {
  const rows = [];
  for (const line of fs.readFileSync(indexFile, 'utf8').split('\n')) {
    const m = INDEX_ROW.exec(line);
    if (m && m[1] !== '日期') rows.push({ date: m[1], title: m[2], slug: m[3], ids: m[4] });
  }
  return rows;
}

function ruleIds() {
  const ids = [];
  for (const section of read().sections) for (const rule of section.rules) ids.push(`${section.letter}${rule.n}`);
  return ids;
}

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
