// 守待裁清單（規矩 D1、I1〜I3）。它不是閘；它讓裁示者與 AI 都不必翻留言串就知道還欠哪些答案。
//
// 守得到的：
//   ①三種留痕只認範本的形狀：問／裁示／撤回；日期要是真的日子；
//   ②裁示要由裁示者的帳號貼、要有原話那一行；別人貼的、缺原話的＝疑似，不關題；
//   ③撤回要有三選一的理由（附依據）與自報句；缺一＝疑似；
//   ④配對：裁示或撤回要引到原 ❓ 的留言編號、在引用區塊以外、而且比 ❓ 晚；引在引用區塊裡不算；先貼的不算；
//   ⑤已裁與已撤回一定印出來、附配對；長得像但形狀不合＝疑似；
//   ⑥裁示者沒填、平台問不到＝退 2；不擋任何事（沒有退 1）；
//   ⑦三種留痕都只採計登記的貼文帳號（r1 Medium⑧：外人不可以撤掉待裁、外人的問也不入）；
//   ⑧轉述者要是登記的識別值、不帶記號；藏在 HTML 註解裡的原話行與網址不算；引用區塊的懶續行也算引用（r1 Medium⑨）；
//   ⑨生效文字只有一份定義（r2 Medium③）：原話與配對放在程式碼圍欄、引用的懶續行裡都不算；
//   ⑩時間用時間值比（r2 Medium④）：比問題早的異時區裁示不關題；時間讀不出＝退 2、不移出待裁。
// ⚠️ 守不到的：只掃開著的變更；已裁是推導不是事實；原話只驗形狀。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, evaluate, deciderOf, cites, realDate, outsideQuotes } = require('../tools/pending-rulings.js');
const { PlatformError } = require('../tools/platform.js');

const TOOL = path.join(__dirname, '..', 'tools', 'pending-rulings.js');
const D = { id: 'Boss', account: 'boss-acct', ids: ['Boss', 'Alpha'], accounts: ['boss-acct', 'ai-acct'] };
let n = 0;
const c = (body, over = {}) => ({ id: `c${++n}`, author: 'ai-acct', createdAt: `2026-09-13T00:00:${String(n).padStart(2, '0')}Z`, change: '7', body, ...over });
const ask = (title = '要不要做') => c(`## ❓ 待裁（2026-09-13）：${title}\n選項：甲／乙\n建議：甲`);
const ruling = (askId, over = {}) => c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n原話（對話中，Alpha 轉述）：**「甲」**\n落點：https://x/pull/7#issuecomment-${askId}`, { author: 'boss-acct', ...over });
const withdraw = (askId) => c(`## 🚫 撤回（2026-09-13）：不用問了\n撤回理由：題目依附的東西沒了（那支變更已關）\nAlpha 撤回、Boss 未回；他隨時可以要我重問\nhttps://x/pull/7#issuecomment-${askId}`);

test('①②④基準：問了沒回＝還沒回；裁示者引到編號＝已裁；別人貼的裁示＝疑似、不關題', () => {
  const q = ask();
  assert.equal(evaluate([q], D).open.length, 1);
  const r = evaluate([q, ruling(q.id)], D);
  assert.equal(r.open.length, 0); assert.equal(r.ruled.length, 1); assert.equal(r.ruled[0].by.author, 'boss-acct');
  const fake = evaluate([q, ruling(q.id, { author: 'ai-acct' })], D);
  assert.equal(fake.open.length, 1, '別人貼的裁示不可以關題');
  assert.ok(fake.near.some((x) => x.why.includes('不是裁示者的帳號')));
});

test('②裁示缺原話那一行＝疑似；識別值不是裁示者的＝不認；日期不是真的日子＝疑似', () => {
  const q = ask();
  const noQuote = c('## ⚖️ Boss 裁示（2026-09-13）：選甲\n落點 https://x#issuecomment-' + q.id, { author: 'boss-acct' });
  assert.equal(evaluate([q, noQuote], D).open.length, 1);
  const wrongId = c(`## ⚖️ Other 裁示（2026-09-13）：選甲\n原話（對話中，Alpha 轉述）：**「甲」**\n${q.id}`, { author: 'boss-acct' });
  assert.equal(evaluate([q, wrongId], D).open.length, 1);
  const badDate = c(`## ⚖️ Boss 裁示（2026-99-99）：選甲\n原話（對話中，Alpha 轉述）：**「甲」**\n${q.id}`, { author: 'boss-acct' });
  const r = evaluate([q, badDate], D);
  assert.equal(r.open.length, 1); assert.ok(r.near.some((x) => x.why.includes('日期')));
  assert.equal(realDate('2026-02-30'), false); assert.equal(realDate('2026-02-28'), true);
  assert.equal(realDate('not-a-date'), false, '形狀不對也是假日期（這一格在流程裡走不到，但函式是公開的）');
});

test('③撤回：理由三選一附依據、自報句，缺一＝疑似；齊了＝已撤回（不是已裁）', () => {
  const q = ask();
  const ok = evaluate([q, withdraw(q.id)], D);
  assert.equal(ok.open.length, 0); assert.equal(ok.withdrawn.length, 1); assert.equal(ok.ruled.length, 0);
  const noReason = c(`## 🚫 撤回（2026-09-13）：x\nAlpha 撤回、Boss 未回；他隨時可以要我重問\n${q.id}`);
  assert.equal(evaluate([q, noReason], D).open.length, 1);
  const badReason = c(`## 🚫 撤回（2026-09-13）：x\n撤回理由：不想問了（沒依據）\nAlpha 撤回、Boss 未回；他隨時可以要我重問\n${q.id}`);
  assert.equal(evaluate([q, badReason], D).open.length, 1);
  const emptyBasis = c(`## 🚫 撤回（2026-09-13）：x\n撤回理由：問題本身問錯了（）\nAlpha 撤回、Boss 未回；他隨時可以要我重問\n${q.id}`);
  assert.equal(evaluate([q, emptyBasis], D).open.length, 1, '依據不可以是空的');
  const noSelf = c(`## 🚫 撤回（2026-09-13）：x\n撤回理由：問題本身問錯了（重複）\n${q.id}`);
  assert.equal(evaluate([q, noSelf], D).open.length, 1);
});

test('④配對：引在引用區塊裡不算；先貼的不算；編號要整個對上不是子字串', () => {
  const q = ask();
  const quoted = ruling('x'); quoted.body = `## ⚖️ Boss 裁示（2026-09-13）：選甲\n原話（對話中，Alpha 轉述）：**「甲」**\n> 見 ${q.id}`;
  assert.equal(evaluate([q, quoted], D).open.length, 1, '引用區塊裡的編號不算在回答它');
  const early = ruling(q.id); early.createdAt = '2026-09-12T00:00:00Z';
  assert.equal(evaluate([q, early], D).open.length, 1, '比問題早的裁示不算');
  assert.equal(cites('see c12 here', 'c1'), false, '子字串不算（後面接字）');
  assert.equal(cites('see 9c1 here', 'c1'), false, '子字串不算（前面接字）——只釘後面那格的話，前面那道邊界拿掉也不會紅');
  assert.equal(cites('see c1 here', 'c1'), true);
  assert.equal(cites('https://x/pull/7#issuecomment-5560311732', '5560311732'), true, '網址尾碼算');
});

test('⑤長得像但不合形狀＝疑似，並說原因', () => {
  const near = c('## ❓ 待裁：忘了寫日期');
  const r = evaluate([near], D);
  assert.equal(r.open.length, 0); assert.equal(r.near.length, 1);
  assert.equal(evaluate([c('普通留言')], D).near.length, 0);
});

test('⑥裁示者沒填＝退 2；平台問不到＝退 2；算出來＝退 0，掃每一支開著的變更', () => {
  assert.equal(deciderOf({ participants: [{ role: '裁示者（人）', id: 'Boss', account: '未設定' }] }), null);
  assert.equal(run({ settings: { participants: [] }, platform: { ask() { throw new Error('不該問'); } } }).code, 2);
  const settings = { participants: [{ role: '裁示者（人）', id: 'Boss', account: 'boss-acct' }, { role: 'AI 甲', id: 'Alpha', account: 'ai-acct' }] };
  assert.equal(run({ settings, platform: { ask() { throw new PlatformError('x'); } } }).code, 2);
  const q = ask();
  const asked = [];
  const platform = { ask(op, args) { asked.push([op, args]); return op === 'openChanges' ? [{ id: '7' }, { id: '8' }] : (args.change === '7' ? [q] : []); } };
  const r = run({ settings, platform });
  assert.equal(r.code, 0);
  assert.deepEqual(asked.map((x) => x[0]), ['openChanges', 'comments', 'comments'], '每一支開著的變更都要掃');
  assert.match(r.lines.join('\n'), /還沒回：1 則/u);
  assert.throws(() => run({ settings, platform: { ask() { throw new TypeError('程式寫錯'); } } }), TypeError);
  assert.equal(spawnSync(process.execPath, [TOOL], { encoding: 'utf8' }).status, 2, '本倉庫設定未填');
});

test('⑦外人的撤回關不了題、外人的問不入待裁；都列成疑似', () => {
  const q = ask();
  const outsiderWithdraw = withdraw(q.id); outsiderWithdraw.author = 'outsider';
  const r = evaluate([q, outsiderWithdraw], D);
  assert.equal(r.open.length, 1, '外人撤不掉');
  assert.ok(r.near.some((x) => x.why.includes('不是登記的貼文帳號')));
  const outsiderAsk = ask(); outsiderAsk.author = 'outsider';
  const r2 = evaluate([outsiderAsk], D);
  assert.equal(r2.open.length, 0); assert.equal(r2.near.length, 1);
});

test('⑧原話署名包粗體＝不合；原話行與網址藏在 HTML 註解＝不算；引用的懶續行也是引用', () => {
  const q = ask();
  const bold = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n原話（對話中，**Alpha** 轉述）：**「甲」**\n${q.id}`, { author: 'boss-acct' });
  assert.equal(evaluate([q, bold], D).open.length, 1, '包粗體的署名範本明說不合');
  const unknownId = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n原話（對話中，Nobody 轉述）：**「甲」**\n${q.id}`, { author: 'boss-acct' });
  assert.equal(evaluate([q, unknownId], D).open.length, 1, '轉述者要是登記的識別值');
  const hidden = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n<!--\n原話（對話中，Alpha 轉述）：**「甲」**\n${q.id}\n-->`, { author: 'boss-acct' });
  assert.equal(evaluate([q, hidden], D).open.length, 1, '註解裡的東西畫面上看不見，不算');
  const lazy = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n原話（對話中，Alpha 轉述）：**「甲」**\n> 引用別人說的\n見 ${q.id} 這一則`, { author: 'boss-acct' });
  assert.equal(evaluate([q, lazy], D).open.length, 1, '緊接在 > 後面沒有空行隔開的行仍是引用');
  assert.equal(outsideQuotes('> a\nb\n\nc'), '\nc', '懶續行 b 屬於引用，空行之後的 c 不是');
  const afterBlank = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n原話（對話中，Alpha 轉述）：**「甲」**\n> 引用\n\n${q.id}`, { author: 'boss-acct' });
  assert.equal(evaluate([q, afterBlank], D).open.length, 0, '空行之後回到最外層，配對成立');
});

test('⑨原話與配對放在程式碼圍欄裡＝不算；原話放在引用的懶續行＝不算（生效文字只有一份定義）', () => {
  const q = ask();
  const fenced = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n\`\`\`md\n原話（對話中，Alpha 轉述）：**「甲」**\n${q.id}\n\`\`\``, { author: 'boss-acct' });
  assert.equal(evaluate([q, fenced], D).open.length, 1, '圍欄裡的原話與網址是範例，不算');
  const quotedQuote = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n> 引用範例\n原話（對話中，Alpha 轉述）：**「甲」**\n\n${q.id}`, { author: 'boss-acct' });
  assert.equal(evaluate([q, quotedQuote], D).open.length, 1, '原話在引用的懶續行裡，不算；網址雖在最外層也不夠');
  const longFence = c(`## ⚖️ Boss 裁示（2026-09-13）：選甲\n\`\`\`\`\n\`\`\`\n原話（對話中，Alpha 轉述）：**「甲」**\n${q.id}\n\`\`\`\`\n`, { author: 'boss-acct' });
  assert.equal(evaluate([q, longFence], D).open.length, 1, '四反引號圍欄裡的三反引號不是關閉');
});

test('⑩時間用時間值比：異時區但其實較早的裁示不關題；時間讀不出＝退 2 且不移出待裁', () => {
  const q = ask(); q.createdAt = '2026-09-13T02:00:00Z';
  const earlier = ruling(q.id); earlier.createdAt = '2026-09-13T03:00:00+02:00';   // ＝01:00Z，比問題早
  const r = evaluate([q, earlier], D);
  assert.equal(r.open.length, 1, '字串序會排錯，時間值不會');
  const later = ruling(q.id); later.createdAt = '2026-09-13T05:00:00+02:00';   // ＝03:00Z，比問題晚
  assert.equal(evaluate([q, later], D).open.length, 0);
  const broken = ruling(q.id); broken.createdAt = 'not-a-time';
  const settings = { participants: [{ role: '裁示者（人）', id: 'Boss', account: 'boss-acct' }, { role: 'AI 甲', id: 'Alpha', account: 'ai-acct' }] };
  const platform = { ask: (op) => (op === 'openChanges' ? [{ id: '7' }] : [q, broken]) };
  const out = run({ settings, platform });
  assert.equal(out.code, 2);
  assert.match(out.lines.join('\n'), /時間讀不出/u);
});
