// 守時間點契約（r3 High①）：沒帶時區的時間不收；同一份輸入在不同執行時區要判一樣。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { parseInstant } = require('../tools/time-point.js');

test('帶 Z 或明確 offset 才收；只有日期、沒時區、亂字都回 null', () => {
  assert.equal(parseInstant('2026-09-13T03:00:00Z'), Date.UTC(2026, 8, 13, 3));
  assert.equal(parseInstant('2026-09-13T05:00:00+02:00'), Date.UTC(2026, 8, 13, 3), 'offset 要折成同一個時間點');
  assert.equal(parseInstant('2026-09-13T03:00Z'), Date.UTC(2026, 8, 13, 3), '秒可省');
  assert.equal(parseInstant('2026-09-13T03:00:00.250Z'), Date.UTC(2026, 8, 13, 3, 0, 0, 250));
  for (const bad of ['2026-09-13T03:00:00', '2026-09-13', '2026-09-13 03:00:00Z', 'not-a-time', '', null, 42, '2026-13-40T00:00:00Z']) {
    assert.equal(parseInstant(bad), null, JSON.stringify(bad));
  }
});

test('同一份輸入在 TZ=UTC 與 TZ=Asia/Taipei 判一樣（沒時區的一律 null，有時區的數值相同）', () => {
  const script = `const { parseInstant } = require(${JSON.stringify(require.resolve('../tools/time-point.js'))});
    process.stdout.write(JSON.stringify([parseInstant('2026-09-13T03:00:00'), parseInstant('2026-09-13T03:00:00Z'), parseInstant('2026-09-13T05:00:00+02:00')]));`;
  const outs = ['UTC', 'Asia/Taipei', 'America/Los_Angeles'].map((tz) => spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { ...process.env, TZ: tz } }).stdout);
  assert.equal(new Set(outs).size, 1, `三個時區的結果不一樣：${outs.join(' | ')}`);
  assert.deepEqual(JSON.parse(outs[0]), [null, Date.UTC(2026, 8, 13, 3), Date.UTC(2026, 8, 13, 3)]);
});
