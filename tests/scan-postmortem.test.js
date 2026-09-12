// 守掃描後比對（規矩 G2；裁示者 2026-09-12 裁「丙」）。
//
// 守得到的：
//   ①沒有機密可比、機密太短、沒有輸出＝退 2（什麼都沒比就說乾淨，比沒有比對更危險）；
//   ②機密出現在回覆、日誌內容、**檔名**＝退 1；JSON 轉義一層、兩層的寫法也認得；
//   ③印出來的每一行都不含機密的值；命中只記位置與編號；
//   ④有輸出驗不了（非 UTF-8、超過單檔或總量上限）＝退 2；但同一趟另有命中時事故優先（退 1）；
//   ⑤日誌區有符號連結之類的非一般檔案＝退 1；收集器不跟符號連結、超過檔數上限＝回報讀不完。
//
// ⚠️ 守不到的：編碼過、拆段過、轉義超過兩層的外洩（漏報方向）；憑形狀認機密那一族刻意不搬。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { compare, collectOutputs, escapeForms, MIN_SECRET } = require('../tools/scan-postmortem.js');

const SECRET = 'LIVE-CANARY-k7x9q2-abcdef12';
const NEEDLE = 'tok"en\\with/quotes-98765';

test('沒有機密、機密太短、沒有輸出：退 2', () => {
  assert.equal(compare({ secrets: [], outputs: [{ where: '回覆', text: 'x' }] }).code, 2);
  assert.equal(compare({ secrets: ['a'.repeat(MIN_SECRET - 1)], outputs: [{ where: '回覆', text: 'x' }] }).code, 2);
  assert.equal(compare({ secrets: [SECRET], outputs: [] }).code, 2);
});

test('乾淨：退 0', () => {
  const r = compare({ secrets: [SECRET, NEEDLE], outputs: [{ where: '回覆', text: '看起來沒問題' }, { where: 'log/a.jsonl', bytes: Buffer.from('{"a":1}') }] });
  assert.equal(r.code, 0);
  assert.equal(r.hits.length, 0);
});

test('機密出現在回覆、日誌內容、檔名：退 1，行裡不印值，命中只記位置', () => {
  for (const outputs of [
    [{ where: '回覆', text: `前面…${SECRET}…後面` }],
    [{ where: 'log/a.jsonl', bytes: Buffer.from(`{"x":"${SECRET}"}`) }],
    [{ where: `log/${SECRET}.jsonl`, bytes: Buffer.from('無害') }],
  ]) {
    const r = compare({ secrets: [SECRET], outputs });
    assert.equal(r.code, 1, JSON.stringify(outputs));
    assert.ok(r.hits.length >= 1);
    assert.ok(!r.lines.join('\n').includes(SECRET), '機密的值不可以被印出來');
    assert.ok(r.hits.every((h) => !JSON.stringify(h).includes(SECRET)), '命中紀錄不可以帶值');
    assert.match(r.lines.join('\n'), /事故/u);
  }
});

test('JSON 轉義一層、兩層的寫法也認得（三種寫法互不相同才有意義）', () => {
  const forms = escapeForms(NEEDLE);
  assert.equal(new Set(forms).size, 3, '這個機密含引號與反斜線，三種寫法應該互不相同');
  for (const [i, form] of forms.entries()) {
    const r = compare({ secrets: [NEEDLE], outputs: [{ where: 'log.jsonl', text: `{"content":"${form}"}` }] });
    assert.equal(r.code, 1, `寫法 ${i}`);
    assert.ok(r.hits.some((h) => h.form === i), `該記成寫法 ${i}`);
  }
});

test('有輸出驗不了：退 2；同一趟另有命中時事故優先', () => {
  const bad = Buffer.from([0xff, 0xfe, 0xfd]);
  const r2 = compare({ secrets: [SECRET], outputs: [{ where: 'bin', bytes: bad }, { where: '回覆', text: 'ok' }] });
  assert.equal(r2.code, 2);
  assert.deepEqual(r2.unverified, ['bin']);
  const r1 = compare({ secrets: [SECRET], outputs: [{ where: 'bin', bytes: bad }, { where: '回覆', text: SECRET }] });
  assert.equal(r1.code, 1);
  const big = compare({ secrets: [SECRET], outputs: [{ where: 'huge', bytes: Buffer.alloc(10) }], caps: { files: 10, depth: 2, fileBytes: 5, totalBytes: 100 } });
  assert.equal(big.code, 2, '超過單檔上限＝驗不了');
});

test('日誌區的符號連結＝事故；收集器不跟連結、超過檔數＝讀不完', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-postmortem-'));
  try {
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'a.jsonl'), '{"ok":true}\n');
    fs.symlinkSync('/etc/hosts', path.join(dir, 'shortcut'));
    const { outputs, over } = collectOutputs(dir);
    assert.equal(over, '');
    assert.ok(outputs.some((o) => o.where === 'shortcut' && o.special === '符號連結'));
    assert.ok(outputs.some((o) => o.where === 'sub/a.jsonl' && Buffer.isBuffer(o.bytes)));
    const r = compare({ secrets: [SECRET], outputs });
    assert.equal(r.code, 1);
    assert.ok(r.hits.some((h) => h.where === 'shortcut' && h.part === '非一般檔案'));
    const capped = collectOutputs(dir, { files: 1, depth: 12, fileBytes: 1e6, totalBytes: 1e6 });
    assert.match(capped.over, /檔數超過/u);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
