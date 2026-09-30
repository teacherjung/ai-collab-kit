'use strict';
// 說明書網頁產生器的考題（manual/build.js；只在套件倉庫、不在共用路徑裡）。
// 守的是「規矩頁有沒有忠實排出規則資料」與「抽不到就停」；網頁長得好不好看不在這裡。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const manual = require('./build.js');
const rulesBook = require('../tools/build-rules.js');

const sources = () => manual.readSources(manual.ROOT);
const plainOf = (value, roles) => rulesBook.tokenize(value, roles, '', []).map((seg) => seg.value).join('');

/** 一張規則卡的 HTML（從 id 開始到下一個 </article>）。 */
function card(html, id) {
  const at = html.indexOf(`<article class="rule" id="rule-${id}"`);
  assert.ok(at >= 0, `找不到 ${id} 那張卡`);
  return html.slice(at, html.indexOf('</article>', at));
}

test('① 規矩頁：每一條都有一張卡，主句與每個子點的文字都在它自己那張卡裡', () => {
  const src = sources();
  const { html, counts } = manual.build(src);
  const roles = src.rules.roles;
  const ids = src.rules.sections.flatMap((s) => s.rules.map((r) => `${s.letter}${r.n}`));
  assert.equal(counts.total, ids.length);
  assert.equal((html.match(/<article class="rule" /gu) || []).length, ids.length, '卡的張數要等於規則條數');
  assert.ok(ids.length >= rulesBook.MIN_RULES, '規則條數少於規則書產生器的下限：來源可能讀錯了');
  for (const section of src.rules.sections) {
    for (const rule of section.rules) {
      const id = `${section.letter}${rule.n}`;
      const text = card(html, id).replace(/<[^>]+>/gu, '');
      for (const field of [rule.text, ...(rule.items || []).map((it) => it.text)]) {
        assert.ok(text.includes(manual.esc(plainOf(field, roles))), `${id} 那張卡少了這段字：${plainOf(field, roles).slice(0, 40)}`);
      }
    }
  }
});

test('② 標籤：以登記名開頭才算新的一段；續句接回上一段；第一段對不到登記名＝丟例外', () => {
  const labels = manual.parseLabels(sources().machines);
  const names = labels.map((l) => l.name);
  assert.deepEqual(manual.splitTag('雲端：只驗四欄有填；角色那兩欄要填登記過的名字', labels), [{ name: '雲端', rest: '：只驗四欄有填；角色那兩欄要填登記過的名字' }]);
  assert.deepEqual(manual.splitTag('考題：只守忽略清單；靠自覺：其餘', labels).map((p) => p.name), ['考題', '靠自覺']);
  assert.throws(() => manual.splitTag('沒登記的名字：隨便', labels), /不是以登記的名字開頭/u);
  // 真資料：每一條的標籤都切得開，每個標籤鈕都是登記名，每一條至少一顆
  const { html } = manual.build(sources());
  const chips = [...html.matchAll(/data-label="([^"]+)"/gu)].map((m) => m[1]);
  assert.ok(chips.length >= (html.match(/<article class="rule" /gu) || []).length);
  for (const chip of chips) assert.ok(names.includes(chip), `標籤鈕「${chip}」不在 MACHINES.md 的標籤表`);
});

test('③ 篩選的三個數字：機器、一部分、全靠自覺加起來等於總條數，且跟逐條重算的一樣', () => {
  const src = sources();
  const labels = manual.parseLabels(src.machines);
  const tally = { machine: 0, mixed: 0, self: 0 };
  for (const s of src.rules.sections) {
    for (const r of s.rules) {
      const parts = manual.splitTag(r.tag, labels);
      const m = parts.some((p) => p.name !== '靠自覺');
      const self = parts.some((p) => p.name === '靠自覺');
      tally[m && self ? 'mixed' : m ? 'machine' : 'self'] += 1;
    }
  }
  const { counts, html } = manual.build(src);
  assert.deepEqual({ machine: counts.machine, mixed: counts.mixed, self: counts.self }, tally);
  assert.equal(tally.machine + tally.mixed + tally.self, counts.total);
  for (const [k, n] of Object.entries(tally)) {
    assert.equal((html.match(new RegExp(`data-kind="${k}"`, 'gu')) || []).length, n, `${k} 的卡數跟篩選數字對不上`);
  }
});

test('④ 跳窗資料：每個標籤一筆；「用到它的規矩」合起來就是每一條規矩的每個標籤', () => {
  const src = sources();
  const labels = manual.parseLabels(src.machines);
  const { html } = manual.build(src);
  const json = html.match(/<script type="application\/json" id="label-data">([\s\S]*?)<\/script>/u);
  assert.ok(json, '找不到跳窗資料');
  assert.ok(!json[1].includes('<'), '跳窗資料放在 <script> 裡，不能有原始的「<」（要寫成 \\u003c），否則內容裡的 </script> 會提早結束那一段');
  const data = JSON.parse(json[1]);
  assert.deepEqual(Object.keys(data).sort(), labels.map((l) => l.name).sort());
  const want = [];
  for (const s of src.rules.sections) {
    for (const r of s.rules) for (const p of manual.splitTag(r.tag, labels)) want.push(`${p.name}:${s.letter}${r.n}`);
  }
  const got = [];
  for (const [name, entry] of Object.entries(data)) {
    for (const m of entry.html.matchAll(/data-goto="rule-([A-K]\d+)"/gu)) got.push(`${name}:${m[1]}`);
  }
  assert.deepEqual(got.sort(), want.sort());
});

test('⑤ 抽不到就停：少一個來源、規則資料不合契約、標籤表或版面約定不見，都丟例外', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-src-'));
  try {
    fs.copyFileSync(path.join(manual.ROOT, 'rules.json'), path.join(dir, 'rules.json'));
    fs.copyFileSync(path.join(manual.ROOT, 'MACHINES.md'), path.join(dir, 'MACHINES.md'));
    assert.throws(() => manual.readSources(dir), /讀不到 GLOSSARY\.md/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const src = sources();
  const broken = JSON.parse(JSON.stringify(src.rules));
  broken.sections[0].rules[0].text = '落單的*星號';
  assert.throws(() => manual.build({ ...src, rules: broken }), /不合資料契約/u);
  assert.throws(() => manual.build({ ...src, machines: src.machines.replace('| 標籤 | 意思 | 守不到的 |', '| 名字 | 意思 | 守不到的 |') }), /找不到「\| 標籤/u);
  assert.throws(() => manual.build({ ...src, glossary: src.glossary.replace('## 版面約定', '## 別的') }), /找不到「## 版面約定」/u);
  assert.throws(() => manual.build({ ...src, machines: src.machines.replace(/^\| 靠自覺 \|.*$/mu, '') }), /標籤表裡沒有「靠自覺」/u);
});

test('⑥ 跳脫：來源裡的尖括號以文字出現、不變成標籤（真資料：版面約定的 `未執行：<原因>`）', () => {
  const { html } = manual.build(sources());
  assert.ok(html.includes('<code>未執行：&lt;原因&gt;</code>'), '版面約定那個灰底框沒有照字面出現');
  assert.equal(manual.mdInline('a <b> **粗** `<c>`'), 'a &lt;b&gt; <strong>粗</strong> <code>&lt;c&gt;</code>');
  assert.equal(manual.esc('"&<>'), '&quot;&amp;&lt;&gt;');
});

test('⑦ 網頁格式：<title> 在開頭 8KB 內、不自帶 doctype／html／body、九頁照擁有者列的順序、沒有這台機器的絕對路徑', () => {
  const { html } = manual.build(sources(), { stamp: '測試' });
  assert.match(html.slice(0, 8192), /<title>[^<]+<\/title>/u);
  assert.doesNotMatch(html, /<!doctype|<html[\s>]|<body[\s>]/iu);
  const routes = [...html.matchAll(/data-route="([a-z]+)"/gu)].map((m) => m[1]);
  assert.deepEqual(routes, ['rules', 'machines', 'tools', 'tests', 'templates', 'settings', 'adopt', 'glossary', 'cases']);
  assert.deepEqual(manual.PAGES.map((p) => p.name), ['規矩', '機器', '工具', '考題', '範本', '設定', '套用', '名詞', '案例']);
  assert.doesNotMatch(html, /\/Users\/|\/private\/|\/home\//u);
  assert.ok(html.includes('產生自套件 測試'));
  assert.ok(manual.build(sources(), { stamp: '<b>x</b>' }).html.includes('產生自套件 &lt;b&gt;x&lt;/b&gt;'), '頁尾註記要跳脫');
});

test('⑧ 命令列：要 --out；不認得的參數、缺值都退 1；給了 --out 才寫檔', () => {
  const script = path.join(__dirname, 'build.js');
  const run = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  assert.equal(run([]).status, 1);
  assert.match(run([]).stderr, /要給 --out/u);
  assert.equal(run(['--out']).status, 1);
  assert.equal(run(['--nope', 'x']).status, 1);
  assert.match(run(['--nope', 'x', '--out', 'y']).stderr, /不認得的參數：--nope/u);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-out-'));
  try {
    const out = path.join(dir, 'index.html');
    const stdout = execFileSync(process.execPath, [script, '--out', out], { encoding: 'utf8' });
    assert.match(stdout, /寫好說明書：9 頁/u);
    assert.equal(fs.readFileSync(out, 'utf8'), manual.build(sources()).html);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
