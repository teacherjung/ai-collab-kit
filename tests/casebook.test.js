// 守案例簿的三條進門規矩，把原本靠人每次用手掃的事情交給機器：
//   ①索引與檔案要對得上（每一則都在索引裡、索引每一列都指得到檔、「共 N 則」不是寫死會漂的數字）；
//   ②每一則的條號都存在，而且**本文每一條都至少有一則案例指著**（案例簿的進門規則）；
//   ③案例簿將來會進公開倉庫：不可以出現裁示者的名字、AI 的產品名。
// ⚠️ 這一題守不到的：事實對不對、一事一檔、來源欄的連結真的活著——那些仍然靠人與獨立審查者。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { read } = require('../tools/build-rules.js');

const root = path.join(__dirname, '..');
const casesDir = path.join(root, 'cases');
const indexFile = path.join(casesDir, 'README.md');
const FIELDS = ['- 日期：', '- 本文條號：', '- 發生什麼：', '- 代價：', '- 教訓：', '- 來源：'];
// 不可以出現在公開案例簿裡的字。⚠️ 來源網址裡的帳號是約定的定位方式，逐行排除。
const FORBIDDEN = ['William', 'Codex', 'Claude', 'Grok', 'GPT', 'Anthropic', 'OpenAI'];
const SOURCE_URL = 'https://github.com/';

function caseFiles() {
  return fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();
}

function ruleIds() {
  const ids = [];
  for (const section of read().sections) for (const rule of section.rules) ids.push(`${section.letter}${rule.n}`);
  return ids;
}

test('索引與案例檔逐一對得上', () => {
  const files = caseFiles();
  assert.ok(files.length >= 20, `只找到 ${files.length} 則案例：目錄空掉的話下面幾題會變成空包彈`);
  const index = fs.readFileSync(indexFile, 'utf8');
  const listed = new Set([...index.matchAll(/\]\(([^)]+)\.md\)/gu)].map((m) => m[1]));
  for (const file of files) {
    assert.ok(listed.has(file.slice(0, -3)), `${file} 沒有列進索引`);
  }
  for (const slug of listed) {
    assert.ok(fs.existsSync(path.join(casesDir, `${slug}.md`)), `索引列了 ${slug}，但檔案不存在`);
  }
  const declared = /^共 (\d+) 則。$/mu.exec(index);
  assert.ok(declared, '索引裡找不到「共 N 則。」那一行');
  assert.equal(Number(declared[1]), files.length, '索引自報的則數跟實際檔案數對不上');
});

test('每一則的六欄都在，條號都存在，而且本文每一條都有案例指著', () => {
  const ids = ruleIds();
  const covered = new Set();
  for (const file of caseFiles()) {
    const text = fs.readFileSync(path.join(casesDir, file), 'utf8');
    for (const field of FIELDS) {
      assert.ok(text.includes(field), `${file} 少了「${field}」這一欄`);
    }
    const line = /^- 本文條號：(.*)$/mu.exec(text)[1];
    for (const id of line.split('、').map((s) => s.trim()).filter(Boolean)) {
      assert.ok(ids.includes(id), `${file} 指到不存在的條號 ${id}`);
      covered.add(id);
    }
  }
  const orphans = ids.filter((id) => !covered.has(id));
  assert.deepEqual(orphans, [], `這幾條規矩沒有任何案例指著它（案例簿的進門規則：一條規矩要進本文，就要說得出它為什麼存在）：${orphans.join('、')}`);
});

test('公開案例簿裡不出現裁示者的名字與 AI 的產品名', () => {
  for (const file of caseFiles()) {
    fs.readFileSync(path.join(casesDir, file), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const scannable = line.includes(SOURCE_URL) ? line.slice(0, line.indexOf(SOURCE_URL)) : line;
        for (const word of FORBIDDEN) {
          assert.ok(
            !scannable.includes(word),
            `${file} 第 ${i + 1} 行出現「${word}」：案例簿要能公開，人名與產品名一律寫成角色`,
          );
        }
      });
  }
});
