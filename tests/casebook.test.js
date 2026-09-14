// 守案例簿的幾條進門規矩，把原本靠人每輪用手掃的事情交給機器。
//
// ⚠️ 這一題被獨立審查者連三輪打穿，根因始終是同一個：**我用「找得到這串字」代替「那個東西在不在」**。
//    第一輪：別欄的敘述提到「- 代價：」就能替缺欄代答；表格外補個連結就算列入；重複列被去重抹掉；
//    名字掃描一遇到網址就放掉整行尾巴。第二輪：案例改成整份照固定形狀讀了，索引那一半卻沒改——把整列原字塞進檔尾的 HTML 註解或
//    三反引號範例裡照樣算數，連表頭與分隔列都刪掉也照樣「對帳通過」。第三輪：索引改成封閉表格了，
//    但我只驗表格後面、不驗前面——把整張表包進圍欄或 `<pre>` 就整份變成範例，照樣綠。
//
//    **所以索引也不再由我去「找出那張表」：它跟本文一樣改成產物。**
//    `tools/build-casebook-index.js` 從案例檔算出索引，這一題只比「磁碟上的 README 是不是等於
//    重新算一次的結果」。包進圍欄、搬進註解、多一列少一列、順序不同，全都對不上。
//
// 守得到的：
//   ⓪案例與索引都**不含 CR 等其他換行字元、也不含 HTML 註解記號**——那兩樣都能做出
//     「我看不到、讀者也看不到」的隱藏內容，不先擋掉，後面的形狀檢查等於白做；
//   ①**cases/README.md 必須與重新產生的結果逐字元相同**——索引是產物，手改就紅；
//     雙向唯一對應、「共 N 則」、每列的日期／標題／條號，都由產生器算，不再靠比對；
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
const { build: buildIndex, outFile: indexOutFile } = require('../tools/build-casebook-index.js');

const root = path.join(__dirname, '..');
const casesDir = path.join(root, 'cases');
// 六欄，順序就是案例的固定格式。
const FIELDS = ['日期', '本文條號', '發生什麼', '代價', '教訓', '來源'];
// 一份已知的字表；辨認這份以外的名字不是這題的事。
const FORBIDDEN = ['william', 'codex', 'claude', 'grok', 'gpt', 'anthropic', 'openai'];
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

test('索引與重新產生的結果逐字元相同（索引是產物、不要手改）', () => {
  const files = caseFiles();
  assert.ok(files.length >= 20, `只找到 ${files.length} 則案例：目錄空掉的話下面幾題會變成空包彈`);
  assert.equal(
    fs.readFileSync(indexOutFile, 'utf8'),
    buildIndex(),
    'cases/README.md 跟案例檔對不上：索引是產物，要改請改案例或 cases/index.json，再跑 node tools/build-casebook-index.js',
  );
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
