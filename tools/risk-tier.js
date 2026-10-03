#!/usr/bin/env node
// 合併前風險分級（規矩 D4）：依這支PR動到的檔案，照專案設定的風險表先算高／中／低，並印出這一級在複審與掃描分級表上的那一列。
//
// 為什麼：審多深、掃不掃照風險級別查表（F2、G1），級別要是每次由送審的人自己估，就回到原專案 PFW #655 那樣各輪各估各的。
// 先由機器依檔案算，實作者只能往重調、複審者第 1 輪核實、裁示者往上往下都可以改（D4）。
//
// 跟合併後的驗收分級（tools/acceptance-tier.js）是兩張不同的表、方向也不同：同一個檔對驗收可能最輕、對風險卻是高（例如工具）。
// 「這支動到哪些檔」兩支共用同一份算法（changedPaths），不各算各的。
//
// 守不到的：內容碰不碰到升級條件（要讀內容才知道，這支只印出條件提醒）；有沒有照印出來的級別送審；
// 「只升不降」：它只看這支當下動到的檔、不記前幾輪算過的級別，拿掉一個高風險的檔就會印出比較輕的級別。
// 退出碼：0＝算出來了／2＝算不出來（風險表沒填好、平台問不到、沒有路徑）。⚠️ 不是閘。
'use strict';
const { ask } = require('./platform.js');
const { read: readSettings } = require('./settings-data.js');
const { classify, changedPaths } = require('./acceptance-tier.js');
const { RISK_TIERS } = require('./build-settings.js');

/**
 * 讀設定裡的風險表；形狀不對＝null。
 * ⚠️ 有一筆壞就整張不算、不濾掉（跟驗收分級表同一個理由：濾掉一筆＝那一族靜靜落到「沒列到」）；
 *    不過這裡沒列到的一律算高（D4：判不出＝高），所以濾掉只會變重——仍然不濾，壞表就該被看見。
 */
function riskTableOf(settings) {
  const r = settings.risk || {};
  if (!Array.isArray(r.families) || !r.families.length) return null;
  const families = [];
  for (const f of r.families) {
    if (!f || typeof f.pattern !== 'string' || !f.pattern.startsWith('^') || !RISK_TIERS.includes(f.tier)) return null;
    let re;
    try { re = new RegExp(f.pattern, 'u'); } catch { return null; }
    families.push({ re, tier: f.tier });
  }
  const raise = Array.isArray(r.raise) ? r.raise.filter((x) => typeof x === 'string' && x.trim() && x !== '未設定') : [];
  // 級別從重到輕排（classify 取第一個命中的當級別）；沒列到的＝高
  return { tiers: RISK_TIERS.map((id) => ({ id, action: '' })), families, unknownTier: RISK_TIERS[0], raise };
}

function run(changeId, { settings = readSettings(), platform = { ask } } = {}) {
  if (!changeId) return { code: 2, lines: ['用法：node tools/risk-tier.js <變更編號>'] };
  const table = riskTableOf(settings);
  if (!table) return { code: 2, lines: [`專案設定裡的風險表沒填好（risk.families 要有，每一筆的樣式以 ^ 開頭、是合法正規式，級別只能是 ${RISK_TIERS.join('／')}）：算不出來。`] };
  const got = changedPaths(changeId, { settings, platform, what: '風險分級' });
  if (got.error) return { code: 2, lines: got.error };
  const { paths, countNote } = got;
  const r = classify(paths, table);
  const lines = [`風險分級｜變更 ${changeId}：${r.level}（依檔案先算；動到 ${paths.length} 個路徑）${countNote}`];
  for (const id of RISK_TIERS) {
    const hit = r.hits.filter((h) => h.tier === id && h.known).map((h) => h.path);
    if (hit.length) lines.push(`  ・${id}：${hit.join('、')}`);
  }
  if (r.unknown.length) lines.push(`  ⚠️ 沒列在風險表上的路徑，一律算高（D4：判不出＝高）：${r.unknown.join('、')}——改表的人要核對它們該屬哪一級。`);
  const row = (settings.reviewTiers || {})[r.level];
  if (row) lines.push(`  照複審與掃描分級表（${r.level}）：全審 ${row.full}；只核差異 ${row.diffOnly}；通過後照 F6 回頭改的那一輪 ${row.afterPassFix}；掃描 ${row.scan}`);
  else lines.push(`  ⚠️ 複審與掃描分級表沒有「${r.level}」那一列：全審幾輪、掃不掃查不到。`);
  lines.push(table.raise.length
    ? `  內容碰到任一條升級條件，整支就算高（${table.raise.join('；')}）；實作者只能往重調，往下只有裁示者能改；每次送審重算、只升不降，這支工具不記前幾輪的級別（D4）。`
    : '  ⚠️ 專案設定沒填升級條件：內容要不要往重調，只能靠實作者與複審者自己判斷（D4）。');
  return { code: 0, lines, result: r };
}

if (require.main === module) {
  let result;
  try { result = run(process.argv[2]); } catch (e) { result = { code: 2, lines: [`風險分級：沒預期到的錯誤（${(e && e.code) || (e && e.message) || '不明'}）——算不出來。`] }; }
  process.stdout.write(`${result.lines.join('\n')}\n`);
  process.exit(result.code);
}

module.exports = { run, riskTableOf };
