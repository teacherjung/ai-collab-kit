// 守合併後驗收分級（規矩 H6）：只算不擋；讓裁示者少做不必要的驗收、不漏必要的。
//
// 守得到的：①動作累積、級別寫最重的；②沒列到的路徑當指定那一級並列出來；③改名前的舊路徑也算；
//   ④分級表沒填好（少欄、unknownTier 不在 tiers 裡、家族指到不存在的級）＝退 2；平台問不到＝退 2；沒有路徑＝退 2。
// ⚠️ 守不到的：表本身對不對（新家族出現時它會落到指定那一級並被列出，由改表的人補）；有沒有照印出來的做。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, classify, tableOf } = require('../tools/acceptance-tier.js');
const { PlatformError } = require('../tools/platform.js');

const TOOL = path.join(__dirname, '..', 'tools', 'acceptance-tier.js');
const ACC = {
  tiers: [{ id: '重啟走流程', action: '重啟並走一遍核心流程' }, { id: '重新整理', action: '重新整理頁面看一眼' }, { id: '不需驗收', action: '回報不需驗收' }],
  families: [{ pattern: '^lib/', tier: '重啟走流程' }, { pattern: '^public/', tier: '重新整理' }, { pattern: '^docs/', tier: '不需驗收' }, { pattern: '^[^/]+\\.md$', tier: '不需驗收' }],
  unknownTier: '重啟走流程',
};
const settings = { acceptance: ACC };
const table = tableOf(settings);

test('①動作累積、級別寫最重的；只命中最輕的就只有最輕的', () => {
  const r = classify(['docs/a.md', 'public/x.js', 'lib/y.js'], table);
  assert.equal(r.level, '重啟走流程');
  assert.deepEqual(r.actions.map((a) => a.tier), ['重啟走流程', '重新整理', '不需驗收']);
  assert.equal(classify(['README.md'], table).level, '不需驗收');
});

test('②沒列到的路徑當指定那一級並列出來（不確定就往重的算）', () => {
  const r = classify(['docs/a.md', 'weird/new.js'], table);
  assert.equal(r.level, '重啟走流程');
  assert.deepEqual(r.unknown, ['weird/new.js']);
});

test('③改名前的舊路徑也算；④設定沒填好、平台問不到、沒有路徑＝退 2', () => {
  const platform = { ask: () => [{ path: 'docs/new.md', status: 'renamed', previousPath: 'lib/old.js' }] };
  const r = run('7', { settings, platform });
  assert.equal(r.code, 0);
  assert.equal(r.result.level, '重啟走流程', '舊路徑在 lib/ 底下，要算最重的');
  for (const bad of [{}, { acceptance: { ...ACC, unknownTier: '不存在' } }, { acceptance: { ...ACC, families: [{ pattern: '^x', tier: '不存在' }] } }, { acceptance: { ...ACC, tiers: [] } }]) {
    assert.equal(run('7', { settings: bad, platform }).code, 2, JSON.stringify(bad));
  }
  assert.equal(run('7', { settings, platform: { ask() { throw new PlatformError('x'); } } }).code, 2);
  assert.equal(run('7', { settings, platform: { ask: () => [] } }).code, 2, '沒有路徑不猜');
  assert.equal(run(undefined, { settings, platform }).code, 2);
  assert.throws(() => run('7', { settings, platform: { ask() { throw new TypeError('程式寫錯'); } } }), TypeError);
  assert.equal(spawnSync(process.execPath, [TOOL, '7'], { encoding: 'utf8' }).status, 2, '本倉庫設定未填');
});
