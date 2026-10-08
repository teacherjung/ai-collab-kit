// 守進度摘要檢查（規矩 J5）。它不是閘；它讓更新摘要的人在提交前看到自己漏了哪一欄、時間寫反、附件指不到、「已合併」跟平台對不上。
//
// 守得到的：
//   ①標題四段：五段（舊格式的確認時間還在）、專案不在三選一、狀態不在六選一、第四段沒有「・」都列出來；
//     縮排或井號數不對的標題不會被靜靜丟掉（第一則之前的內容、則裡像標題的行都列）；同名的節出現兩次＝查不了（r1 R1）；
//   ②八欄：少一欄（八欄逐欄各試一次，清單寫死在本檔、不用工具匯出的那一份；r1 R6）、空一欄、順序錯、同一欄寫兩次、舊的五欄寫法（沒有清單記號）、不是清單的行都列出來；
//   ③時間欄：缺整理、缺核實、核實沒有月/日 時:分、核實晚於整理；相等不算；
//   ④證據欄引的附件條號不存在；範圍「45〜47」「1 〜 3」都會展開（r1 R4）；拆不開、倒過來、超出安全整數或上限的條號列成問題、不會卡住（r1 R3）；證據欄一條都沒引也列；
//   ⑤已合併：引到的附件沒有 PR＝核不了；離線只查這一點；平台答案不是布林（字串、物件）＝核不了，不當成已合併（r1 R5）；
//     有答案時沒有一支合併＝列；施工中或等複審、沒寫已合併、引到的全合併了＝可能過期；「套件 #45」這種寫法要 --repos 登記才算，`__proto__` 也登記得進去（r1 R8）；
//     切段只看空白、不看任何標點（擁有者 2026-10-08 裁）：一段裡第一個「://」不是 http(s) 的 GitHub PR 網址（大小寫不分、ftp 這類也算網址），那一段後面的全部不算
//     （外站網址裡夾的字、夾的 GitHub 網址都不當證據，r5〜r7 R1）；「套件 #N」從別名到編號所在那一段含 :// 的不算——兩端黏著網址都核不了、不問平台；
//   ⑥已結束那一節的形狀與 30 天；本週成果那一節的七天，而且每個子項目上面都要有合法的「- 月/日」（孤立的子項目、縮排的日期行都列；r4 R2）；未來的日期不算過期；
//   ⑦指令入口：有問題也退 0、--strict 才退 1、沒問題退 0；檔讀不到、少了節、參數不對、--now 寫法錯＝退 2；--pr-states 的檔當平台的答案；
//   ⑧問平台：固定問 github.com、環境裡的選主機變數先清掉（r1 R7）；gh 退非零、回的不是 JSON、形狀不對、merged_at 不是時間＝那一支 merged: null（核不了），不猜；
//   ⑨CRLF 換行的摘要判得跟 LF 一樣（r1 R2）。
// ⚠️ 守不到的：內容真不真；「已驗收」；跨年；真的 gh 沒在考題裡跑（用假的 runner）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, evaluate, fetchPrStates, ghEnv, expandRefs, parseRefs, prRefs, parseArgs, FIELDS, DONE_DAYS, WEEK_DAYS } = require('../tools/check-progress-summary.js');

const TOOL = path.join(__dirname, '..', 'tools', 'check-progress-summary.js');
const NOW = { year: 2026, month: 10, day: 7 };
const REPOS = { 套件: 'acme/kit', 理財: 'acme/money' };
// 八欄寫死在這裡，不從工具拿：工具的清單少一欄時，照它造的測資也會少一欄，缺欄的保護就靜靜消失（r1 R6）。
const EIGHT = ['他要的', '做了什麼', '到哪一步', '現在誰在動', '下一步是', '動哪些檔', '證據', '時間'];

/** 一則合格的進行中的線；over 可以換掉任一欄、標題、或整段 body。 */
function entry(over = {}) {
  const fields = {
    他要的: '他要摘要答得準',
    做了什麼: '改成八欄',
    到哪一步: '已合併',
    現在誰在動: '沒人；等他看',
    下一步是: 'William 看一下、說一聲',
    動哪些檔: 'progress-summary.md',
    證據: '附件第 1 條。',
    時間: '整理 10/07 18:26；核實 10/07 18:18（核了 GitHub）。',
    ...over.fields,
  };
  const title = over.title || '### 共用｜進度摘要本身｜施工中｜Claude・07 專案';
  const body = over.body || EIGHT.filter((f) => fields[f] !== undefined).map((f) => `- ${f}：${fields[f]}`);
  return [title, ...body, ''].join('\n');
}

function doc({ entries = [entry()], done = [], week = [], attachments = ['1. 套件 #41 https://github.com/acme/kit/pull/41 已合併。'], extraActive = [] } = {}) {
  return [
    '# 進度摘要', '', '怎麼寫：略', '', '---', '', '## 全貌', '', '略', '', '---', '',
    '## 進行中的線', '', ...extraActive, ...entries, '---', '',
    '## 等裁示（只列有 ❓ 留痕的）', '', '沒有', '', '---', '',
    '## 本週成果（最近七天）', '', ...week, '', '---', '',
    '## 已結束（留 30 天）', '', ...done, '', '---', '',
    '## 待辦', '', '略', '', '---', '',
    '## 附件（證據位置）', '', ...attachments, '',
  ].join('\n');
}

const MERGED = { 'acme/kit#41': { merged: true } };
const problemsOf = (text, opts = {}) => evaluate(text, { now: NOW, prStates: MERGED, ...opts }).problems;

test('對照組：合格的摘要沒有問題；少了進行中或附件那一節、同名的節出現兩次＝查不了', () => {
  assert.deepEqual(FIELDS, EIGHT, '工具的八欄清單要跟本檔寫死的一樣（改八欄要兩邊一起改）');
  const r = evaluate(doc(), { now: NOW, prStates: MERGED });
  assert.equal(r.unsure, null);
  assert.deepEqual(r.problems, []);
  assert.equal(r.entries, 1); assert.equal(r.attachments, 1); assert.deepEqual(r.cited, ['acme/kit#41']);
  assert.match(evaluate(doc().replace('## 進行中的線', '## 進行中'), { now: NOW }).unsure, /進行中的線/u);
  assert.match(evaluate(doc().replace('## 附件（證據位置）', '## 證據'), { now: NOW }).unsure, /附件/u);
  assert.match(evaluate(doc(), { now: { year: 2026, month: 13, day: 1 } }).unsure, /日期/u);
  // 同名的節出現兩次：後一節不可以靜靜蓋掉前一節（r1 R1）
  const twice = doc({ extraActive: [entry({ fields: { 他要的: undefined } }), '## 進行中的線', ''] });
  assert.match(evaluate(twice, { now: NOW, prStates: MERGED }).unsure, /出現 2 次/u);
});

test('①標題：五段（舊格式）、專案不在三選一、狀態不在六選一、第四段沒有「・」；縮排或井號數不對的標題不會被靜靜丟掉', () => {
  const five = problemsOf(doc({ entries: [entry({ title: '### 套件｜第 2 批｜施工中｜Claude・batch2｜確認時間 10/07 21:38' })] }));
  assert.ok(five.some((p) => p.includes('五段') || p.includes('5 段')), five.join('\n'));
  assert.ok(five.some((p) => p.includes('確認時間')), '要點出是舊格式');
  const project = problemsOf(doc({ entries: [entry({ title: '### 教學｜某事｜施工中｜Claude・x' })] }));
  assert.ok(project.some((p) => p.includes('專案「教學」')), project.join('\n'));
  const state = problemsOf(doc({ entries: [entry({ title: '### 套件｜某事｜完成｜Claude・x' })] }));
  assert.ok(state.some((p) => p.includes('狀態「完成」')), state.join('\n'));
  const who = problemsOf(doc({ entries: [entry({ title: '### 套件｜某事｜施工中｜Claude' })] }));
  assert.ok(who.some((p) => p.includes('「・」')), who.join('\n'));
  // r1 R1：標題縮排一格、再刪一欄＝以前印「進行中 0 則、沒有問題」
  const indented = evaluate(doc({ entries: [entry({ title: ' ### 套件｜隔離驗證｜等驗收｜Codex・review', fields: { 做了什麼: undefined } })] }), { now: NOW, prStates: MERGED });
  assert.ok(indented.problems.some((p) => p.includes('不屬於任何一則') && p.includes('隔離驗證')), indented.problems.join('\n'));
  const fourHash = problemsOf(doc({ entries: [entry(), entry({ title: '#### 套件｜四個井號｜施工中｜Claude・x' })] }));
  assert.ok(fourHash.some((p) => p.includes('像是寫壞的標題') && p.includes('四個井號')), fourHash.join('\n'));
  // r2 R1：寫成兩個井號的標題會變成一節、從所有檢查裡消失；檔頭沒規定的節都要列出來
  const twoHash = evaluate(doc({ entries: [entry({ title: '## 套件｜兩個井號｜等驗收｜Codex・review', fields: { 做了什麼: undefined } })] }), { now: NOW, prStates: MERGED });
  assert.equal(twoHash.unsure, null);
  assert.ok(twoHash.problems.some((p) => p.includes('多了一節') && p.includes('兩個井號') && p.includes('整則沒有被檢查')), twoHash.problems.join('\n'));
  const extraSection = problemsOf(doc().replace('## 待辦', '## 我自己加的一節\n\n略\n\n## 待辦'));
  assert.ok(extraSection.some((p) => p.includes('多了一節') && p.includes('我自己加的一節')), extraSection.join('\n'));
});

test('②八欄：逐欄少一欄、逐欄空一欄、順序錯、寫兩次、舊的五欄寫法、不是清單的行', () => {
  for (const f of EIGHT) {
    const missing = problemsOf(doc({ entries: [entry({ fields: { [f]: undefined } })] }));
    assert.ok(missing.some((p) => p.includes(`少了「${f}」`)), `${f}：${missing.join('\n')}`);
    const empty = problemsOf(doc({ entries: [entry({ fields: { [f]: '   ' } })] }));
    assert.ok(empty.some((p) => p.includes(`「${f}」是空的`)), `${f}：${empty.join('\n')}`);
  }
  const base = entry().split('\n');
  const swapped = [base[0], base[2], base[1], ...base.slice(3)].join('\n');
  const order = problemsOf(doc({ entries: [swapped] }));
  assert.ok(order.some((p) => p.includes('順序')), order.join('\n'));
  const twice = problemsOf(doc({ entries: [entry({ body: [...entry().split('\n').slice(1, 9), '- 證據：附件第 1 條。'] })] }));
  assert.ok(twice.some((p) => p.includes('「證據」寫了兩次')), twice.join('\n'));
  const old = problemsOf(doc({ entries: [[
    '### 套件｜第 2 批三台機器｜施工中｜Claude・batch2',
    '到哪一步：第一台合併了。', '下一步是：Claude 等雲端。', '狀態說明：施工中。', '動哪些檔：工具。', '證據：附件第 1 條。', '',
  ].join('\n')] }));
  assert.ok(old.some((p) => p.includes('舊的五欄寫法')), old.join('\n'));
  assert.ok(old.some((p) => p.includes('少了「他要的」')), '舊寫法也要列出少了哪些欄');
  const prose = problemsOf(doc({ entries: [entry({ body: [...entry().split('\n').slice(1, 9), '還沒安置的後續：匯入過期指紋。'] })] }));
  assert.ok(prose.some((p) => p.includes('不是清單')), prose.join('\n'));
  const sub = problemsOf(doc({ entries: [entry({ body: [...entry().split('\n').slice(1, 9), '- 還沒安置的後續：', '  - 匯入過期指紋另案修'] })] }));
  assert.deepEqual(sub, [], '八欄以外的清單行與第二層子項目不算問題');
});

test('③時間欄：缺整理、缺核實、核實沒有時間、核實晚於整理；相等不算', () => {
  const noEdit = problemsOf(doc({ entries: [entry({ fields: { 時間: '核實 10/07 18:18' } })] }));
  assert.ok(noEdit.some((p) => p.includes('缺「整理')), noEdit.join('\n'));
  const noVerify = problemsOf(doc({ entries: [entry({ fields: { 時間: '整理 10/07 18:26' } })] }));
  assert.ok(noVerify.some((p) => p.includes('缺「核實」')), noVerify.join('\n'));
  const vague = problemsOf(doc({ entries: [entry({ fields: { 時間: '整理 10/07 18:26；核實：沿用 Codex 的紀錄' } })] }));
  assert.ok(vague.some((p) => p.includes('「核實」後面要有一個')), vague.join('\n'));
  const reused = problemsOf(doc({ entries: [entry({ fields: { 時間: '整理 10/07 18:26；核實：沿用 Codex 10/07 13:51 的紀錄，Claude 沒核' } })] }));
  assert.deepEqual(reused, [], '沿用舊紀錄、寫了那份紀錄的時間＝合格');
  const reversed = problemsOf(doc({ entries: [entry({ fields: { 時間: '整理 10/07 18:00；核實 10/07 18:18' } })] }));
  assert.ok(reversed.some((p) => p.includes('晚於整理')), reversed.join('\n'));
  const equal = problemsOf(doc({ entries: [entry({ fields: { 時間: '整理 10/07 18:18；核實 10/07 18:18（核了 GitHub）' } })] }));
  assert.deepEqual(equal, []);
});

test('④證據：引的附件條號不存在；範圍展開（含帶空白的）；拆不開、倒過來、超出範圍的條號列成問題而且不卡住；一條都沒引', () => {
  const missing = problemsOf(doc({ entries: [entry({ fields: { 證據: '附件第 1、9 條。' } })] }));
  assert.ok(missing.some((p) => p.includes('附件第 9 條不存在')), missing.join('\n'));
  assert.deepEqual(expandRefs('附件第 45〜47 條、附件第 12、13 條與第 3 條'), [45, 46, 47, 12, 13]);
  assert.deepEqual(expandRefs('附件第 ６８ 條'), [68], '全形數字也認');
  assert.deepEqual(expandRefs('附件第 1 〜 3 條'), [1, 2, 3], 'r1 R4：範圍兩側有空白也是範圍，不是只引兩端');
  assert.deepEqual(parseRefs('附件第 50〜1 條'), { numbers: [], bad: ['50〜1'] }, '倒過來的範圍不展開、列成寫壞的');
  assert.deepEqual(parseRefs('附件第 0 條').bad, ['0']);
  assert.deepEqual(parseRefs('附件第 〜 條').bad, ['〜']);
  const middle = problemsOf(doc({ entries: [entry({ fields: { 證據: '附件第 1 〜 3 條。' } })], attachments: ['1. https://github.com/acme/kit/pull/41 甲', '3. 丙'] }));
  assert.ok(middle.some((p) => p.includes('附件第 2 條不存在')), middle.join('\n'));
  const badRef = problemsOf(doc({ entries: [entry({ fields: { 證據: '附件第 50〜1 條。' } })] }));
  assert.ok(badRef.some((p) => p.includes('條號寫法') && p.includes('50〜1')), badRef.join('\n'));
  // r1 R3：超出安全整數的範圍以前會讓迴圈停不下來——放進子行程、限時跑
  const huge = spawnSync(process.execPath, ['-e', `
    const { parseRefs } = require(${JSON.stringify(TOOL)});
    process.stdout.write(JSON.stringify(parseRefs('附件第 9007199254740992〜9007199254740992 條')));
  `], { encoding: 'utf8', timeout: 5000 });
  assert.equal(huge.status, 0, `子行程沒有正常結束（${huge.signal || huge.stderr}）`);
  assert.deepEqual(JSON.parse(huge.stdout), { numbers: [], bad: ['9007199254740992〜9007199254740992'] });
  assert.deepEqual(parseRefs('附件第 100001 條').bad, ['100001'], '超過上限的條號列成寫壞的');
  // r2 R5：一個範圍最多 200 條是閉區間
  assert.equal(parseRefs('附件第 1〜200 條').numbers.length, 200);
  assert.deepEqual(parseRefs('附件第 1〜201 條'), { numbers: [], bad: ['1〜201'] });
  // r2 R2：含小數點或文字的引用以前根本進不了清單，另有一個正常引用就全綠
  assert.deepEqual(parseRefs('附件第 1 條、附件第 2.5 條'), { numbers: [1], bad: ['2.5'] });
  assert.deepEqual(parseRefs('附件第 xxx 條'), { numbers: [], bad: ['xxx'] });
  // r3 R2：長清單不可以因為字數就整段消失
  const long = `附件第 ${Array.from({ length: 25 }, (_, i) => i + 1).join('、')} 條`;
  assert.equal(parseRefs(long).numbers.length, 25, '25 條的合法清單要全部解析');
  const longMissing = problemsOf(doc({ entries: [entry({ fields: { 證據: `附件第 1 條、${long}。` } })] }));
  assert.ok(longMissing.some((p) => p.includes('附件第 25 條不存在')), longMissing.join('\n'));
  const decimal = problemsOf(doc({ entries: [entry({ fields: { 證據: '附件第 1 條、附件第 2.5 條。' } })] }));
  assert.ok(decimal.some((p) => p.includes('條號寫法') && p.includes('2.5')), decimal.join('\n'));
  const none = problemsOf(doc({ entries: [entry({ fields: { 證據: '見對話。' } })] }));
  assert.ok(none.some((p) => p.includes('沒有引到任何')), none.join('\n'));
});

test('⑤已合併：附件沒有 PR＝核不了；離線只查這點；答案不是布林＝核不了；平台說沒合併＝列；施工中卻全合併了＝可能過期；--repos 的寫法', () => {
  const noPr = problemsOf(doc({ attachments: ['1. 合併了，見 GitHub。'] }));
  assert.ok(noPr.some((p) => p.includes('核不了')), noPr.join('\n'));
  const offline = problemsOf(doc(), { prStates: {}, offline: true });
  assert.deepEqual(offline, [], '離線：有 PR 網址就不再追問平台');
  const notMerged = problemsOf(doc(), { prStates: { 'acme/kit#41': { merged: false } } });
  assert.ok(notMerged.some((p) => p.includes('沒有一支合併了')), notMerged.join('\n'));
  const unknown = problemsOf(doc(), { prStates: { 'acme/kit#41': { merged: null, why: 'gh 不在' } } });
  assert.ok(unknown.some((p) => p.includes('核不了')), unknown.join('\n'));
  // r1 R5：答案只認布林；字串 "false"、物件、陣列都不是證據
  for (const bad of ['false', 'true', {}, [], 1]) {
    const r = problemsOf(doc(), { prStates: { 'acme/kit#41': { merged: bad } } });
    assert.ok(r.some((p) => p.includes('核不了')), `merged=${JSON.stringify(bad)}：${r.join('\n')}`);
    assert.ok(!r.some((p) => p.includes('沒有一支合併了')), '形狀不對不可以當成沒合併');
  }
  const stale = problemsOf(doc({ entries: [entry({ fields: { 到哪一步: '草稿開著、等雲端綠' } })] }));
  assert.ok(stale.some((p) => p.includes('可能過期')), stale.join('\n'));
  const staleBad = problemsOf(doc({ entries: [entry({ fields: { 到哪一步: '草稿開著、等雲端綠' } })] }), { prStates: { 'acme/kit#41': { merged: 'true' } } });
  assert.ok(!staleBad.some((p) => p.includes('可能過期')), '字串 "true" 不算全合併了');
  const paused = problemsOf(doc({ entries: [entry({ title: '### 共用｜某事｜暫停中｜Codex・x', fields: { 到哪一步: '套件側做完；同步本身無' } })] }));
  assert.deepEqual(paused, [], '暫停中引到已合併的 PR 不算過期');
  const bare = doc({ attachments: ['1. 套件 #41 合併了。'] });
  assert.ok(problemsOf(bare).some((p) => p.includes('核不了')), '沒登記 --repos 時「套件 #41」不算 PR');
  assert.deepEqual(problemsOf(bare, { repos: REPOS }), [], '登記了就認得「套件 #41」');
  assert.deepEqual([...prRefs('理財 #667、PFW #641 與 https://github.com/acme/kit/pull/41#issuecomment-1', REPOS)].sort(), ['acme/kit#41', 'acme/money#667']);
  // r2 R3：別名互為字尾時不可以被較短的搶走，也跟登記順序無關
  const twoWays = [{ 套件: 'acme/old', 新套件: 'acme/new' }, { 新套件: 'acme/new', 套件: 'acme/old' }];
  for (const repos of twoWays) {
    assert.deepEqual([...prRefs('新套件 #41', repos)], ['acme/new#41'], JSON.stringify(repos));
    assert.deepEqual([...prRefs('套件 #41', repos)], ['acme/old#41']);
    assert.deepEqual([...prRefs('只在要求時更新＝套件 #39', repos)], ['acme/old#39'], '前面接標點的別名算對上');
    assert.deepEqual([...prRefs('舊套件 #41', repos)], [], '前面接字的不算（沒登記「舊套件」就核不了，不可以猜成「套件」）');
  }
  const collide = doc({ attachments: ['1. 新套件 #41 合併了。'] });
  const collideStates = { 'acme/new#41': { merged: false }, 'acme/old#41': { merged: true } };
  for (const repos of twoWays) {
    const r = problemsOf(collide, { repos, prStates: collideStates });
    assert.ok(r.some((p) => p.includes('沒有一支合併了') && p.includes('acme/new#41')), `${JSON.stringify(repos)}：${r.join('\n')}`);
  }
  // r2 R4：別站網址裡夾著 github.com、查詢字串裡的 github.com、沒帶 https:// 的，都不是證據
  assert.deepEqual([...prRefs('https://notgithub.com/acme/kit/pull/41')], []);
  assert.deepEqual([...prRefs('https://example.org/?back=github.com/acme/kit/pull/41')], []);
  assert.deepEqual([...prRefs('https://github.com.evil.test/acme/kit/pull/41')], []);
  assert.deepEqual([...prRefs('github.com/acme/kit/pull/41')], [], '沒帶 https:// 的不認（檔頭寫明）');
  assert.deepEqual([...prRefs('見 https://www.github.com/acme/kit/pull/41/files 與 https://github.com/acme/kit/pull/42#issuecomment-9 。')].sort(), ['acme/kit#41', 'acme/kit#42']);
  assert.deepEqual([...prRefs('https://github.com/acme/kit/pulls/41')], [], '路徑不是 /pull/N 的不認');
  const fakeHost = problemsOf(doc({ attachments: ['1. https://notgithub.com/acme/kit/pull/41 合併了。'] }));
  assert.ok(fakeHost.some((p) => p.includes('核不了')), fakeHost.join('\n'));
  // r3 R3：網址裡的字不可以冒充裸別名
  assert.deepEqual([...prRefs('https://example.org/套件#41', { 套件: 'acme/kit' })], []);
  assert.deepEqual([...prRefs('https://example.org/x?a=套件#41 與 套件 #42', { 套件: 'acme/kit' })], ['acme/kit#42'], '網址外、用空白隔開的裸別名照認');
  const urlAlias = problemsOf(doc({ attachments: ['1. https://example.org/套件#41 合併了。'] }), { repos: { 套件: 'acme/kit' } });
  assert.ok(urlAlias.some((p) => p.includes('核不了')), urlAlias.join('\n'));
  // r4 R1 的案例在擁有者 2026-10-08 裁「只認用空白隔開的寫法」之後：網址後面用空白隔開的別名照認；只隔一個頓號、沒有空白的，跟網址算同一段，不認
  assert.deepEqual([...prRefs('[說明](https://example.org/a) 、套件 #41', { 套件: 'acme/kit' })], ['acme/kit#41']);
  assert.deepEqual([...prRefs('[說明](https://example.org/a)、套件 #41', { 套件: 'acme/kit' })], [], '頓號後沒有空白＝黏著網址，不認（要認就加空白）');
  assert.deepEqual([...prRefs('https://github.com/acme/kit/pull/41 、套件 #42', { 套件: 'acme/kit' })].sort(), ['acme/kit#41', 'acme/kit#42']);
  assert.deepEqual([...prRefs('https://github.com/acme/kit/pull/41、套件 #42', { 套件: 'acme/kit' })], ['acme/kit#41'], '沒空白的別名不認，網址本身照認');
  const twoPrs = problemsOf(doc({ entries: [entry({ fields: { 到哪一步: '已測試' } })], attachments: ['1. https://github.com/acme/kit/pull/41 、套件 #42'] }), { repos: { 套件: 'acme/kit' }, prStates: { 'acme/kit#41': { merged: true }, 'acme/kit#42': { merged: false } } });
  assert.deepEqual(twoPrs, [], '兩支裡還有一支沒合併，不可以報可能過期');
  // r5 R1 → r6 R1（r3 R3 起同族第四輪；擁有者 2026-10-08 裁「只認用空白隔開的寫法」）：切段只看空白、不看任何標點——
  // 網址裡有半形或全形括號、外站網址的查詢字串裡夾 GitHub 網址、別名黏在網址後面沒空白，都不認（核不了、不拿去問平台）；用空白隔開的照認
  const paren = { 套件: 'acme/kit' };
  assert.deepEqual([...prRefs('[外站](https://example.org/(套件#41))', paren)], [], '網址裡的半形括號不可以把後半段放出來冒充別名');
  assert.deepEqual([...prRefs('[外站](https://example.org/a?x=(套件#41))', paren)], []);
  assert.deepEqual([...prRefs('[外站](https://example.org/（套件#41）)', paren)], [], 'r6：全形括號也一樣，標點不切段');
  assert.deepEqual([...prRefs('https://example.org/a?x=（套件#41）', paren)], []);
  assert.deepEqual([...prRefs('[外站](https://example.org/a?back=(https://github.com/acme/kit/pull/41))', paren)], [], 'r6：外站網址裡夾的 GitHub 網址不算——第一個外站網址之後整段不算');
  assert.deepEqual([...prRefs('https://github.com/acme/kit/actions/runs/1、https://github.com/acme/kit/pull/41', paren)], [], '第一個不是 PR 的 GitHub 網址之後也整段不算');
  assert.deepEqual([...prRefs('https://example.org/a https://github.com/acme/kit/pull/41', paren)], ['acme/kit#41'], '外站網址只擋它自己那一段，空白之後的另一段照認');
  assert.deepEqual([...prRefs('https://github.com/acme/kit/pull/41、https://github.com/acme/kit/pull/42', paren)].sort(), ['acme/kit#41', 'acme/kit#42'], '同一段裡接連的 GitHub PR 網址都算');
  assert.deepEqual([...prRefs('[說明](https://example.org/a)套件 #41', paren)], [], '黏著網址、沒有空白隔開的別名不認（拿不準往核不了倒）');
  assert.deepEqual([...prRefs('(套件 #41)', paren)], ['acme/kit#41'], 'ASCII 括號包住的別名照認');
  assert.deepEqual([...prRefs('https://github.com/acme/kit/pull/41 （套件 #42）', paren)].sort(), ['acme/kit#41', 'acme/kit#42'], '用空白隔開再包全形括號的別名照認');
  assert.deepEqual([...prRefs('https://github.com/acme/kit/pull/41（套件 #42）', paren)], ['acme/kit#41'], '全形括號沒有空白＝跟網址同一段，別名不認');
  // r7 R1 入口 A：「套件 #N」的編號那一端黏著網址也不算——整段從別名到編號都要跟網址隔開
  assert.deepEqual([...prRefs('套件 #41https://example.org/a', paren)], [], '編號後面直接接網址＝黏著網址，不認');
  assert.deepEqual([...prRefs('[套件 #41](https://example.org/a)', paren)], [], '別名當連結文字、目的地是外站＝黏著網址，不認');
  assert.deepEqual([...prRefs('套件 #41 https://example.org/a', paren)], ['acme/kit#41'], '編號跟網址之間有空白才認');
  // r7 R1 入口 B：外層網址的 scheme 大寫、或不是 http(s)，一樣是「第一個網址」，後面夾的 GitHub 網址不算；GitHub 網址自己寫大寫照認
  assert.deepEqual([...prRefs('[外站](HTTPS://example.org/a?back=(https://github.com/acme/kit/pull/41))', paren)], [], '外層 HTTPS:// 不可以被跳過');
  assert.deepEqual([...prRefs('ftp://example.org/(https://github.com/acme/kit/pull/41)', paren)], [], 'ftp 也是網址，後面夾的不算');
  assert.deepEqual([...prRefs('xhttps://github.com/acme/kit/pull/41', paren)], [], 'scheme 不是 http(s) 的怪寫法不認');
  assert.deepEqual([...prRefs('HTTPS://github.com/acme/kit/pull/41', paren)], ['acme/kit#41'], 'GitHub 網址 scheme 大寫照認');
  const gluedDoc = doc({ attachments: ['1. [套件 #41](https://example.org/a)'] });
  const gluedRun = evaluate(gluedDoc, { now: NOW, repos: paren, prStates: { 'acme/kit#41': { merged: true } } });
  assert.deepEqual(gluedRun.cited, [], '黏著外站網址的「套件 #41」不會拿去問平台');
  assert.ok(gluedRun.problems.some((p) => p.includes('核不了')), gluedRun.problems.join('\n'));
  const upperRun = evaluate(doc({ attachments: ['1. [外站](HTTPS://example.org/a?back=(https://github.com/acme/kit/pull/41))'] }), { now: NOW, repos: paren, prStates: { 'acme/kit#41': { merged: true } } });
  assert.deepEqual(upperRun.cited, [], '外層大寫 HTTPS 的外站網址裡夾的 GitHub 網址不會拿去問平台');
  const parenDoc = doc({ attachments: ['1. [外站](https://example.org/（套件#41）)'] });
  const parenRun = evaluate(parenDoc, { now: NOW, repos: paren, prStates: { 'acme/kit#41': { merged: true } } });
  assert.deepEqual(parenRun.cited, [], '沒有引到任何 PR，不會拿 acme/kit#41 去問平台');
  const nestedRun = evaluate(doc({ attachments: ['1. [外站](https://example.org/a?back=(https://github.com/acme/kit/pull/41))'] }), { now: NOW, repos: paren, prStates: { 'acme/kit#41': { merged: true } } });
  assert.deepEqual(nestedRun.cited, [], '外站網址裡夾的 GitHub 網址也不會拿去問平台');
  assert.ok(nestedRun.problems.some((p) => p.includes('核不了')), nestedRun.problems.join('\n'));
  assert.ok(parenRun.problems.some((p) => p.includes('核不了')), parenRun.problems.join('\n'));
  const parenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-paren-'));
  fs.writeFileSync(path.join(parenDir, 'paren.md'), parenDoc);
  fs.writeFileSync(path.join(parenDir, 'states.json'), JSON.stringify({ 'acme/kit#41': { merged: true } }));
  const parenCli = spawnSync(process.execPath, [TOOL, '--file', path.join(parenDir, 'paren.md'), '--now', '10/07', '--repos', '套件=acme/kit', '--pr-states', path.join(parenDir, 'states.json'), '--strict'], { encoding: 'utf8' });
  assert.equal(parenCli.status, 1, `正式 CLI 要退 1：${parenCli.stdout}${parenCli.stderr}`);
  assert.match(parenCli.stdout, /引到 0 支 PR/u);
  fs.writeFileSync(path.join(parenDir, 'glued.md'), gluedDoc);
  const gluedCli = spawnSync(process.execPath, [TOOL, '--file', path.join(parenDir, 'glued.md'), '--now', '10/07', '--repos', '套件=acme/kit', '--pr-states', path.join(parenDir, 'states.json'), '--strict'], { encoding: 'utf8' });
  assert.equal(gluedCli.status, 1, `r7 入口 A 的正式 CLI 要退 1：${gluedCli.stdout}${gluedCli.stderr}`);
  assert.match(gluedCli.stdout, /引到 0 支 PR/u);
  // r4 R3：「幾個別名都對上取最長」要真的有兩個候選才驗得到（「新-套件」前面接的是連字號，「套件」也對上）
  for (const repos of [{ 套件: 'acme/old', '新-套件': 'acme/new' }, { '新-套件': 'acme/new', 套件: 'acme/old' }]) {
    assert.deepEqual([...prRefs('新-套件 #41', repos)], ['acme/new#41'], JSON.stringify(repos));
  }
  // r3 R4：Markdown 的包裝（反引號、引號、連結語法）要先剝掉，裡面的合法網址照認
  for (const wrapped of ['`https://github.com/acme/kit/pull/41`', '[看](https://github.com/acme/kit/pull/41)', '"https://github.com/acme/kit/pull/41"', '（https://github.com/acme/kit/pull/41）']) {
    assert.deepEqual([...prRefs(wrapped)], ['acme/kit#41'], wrapped);
  }
  assert.deepEqual(problemsOf(doc({ attachments: ['1. 套件 #41＝`https://github.com/acme/kit/pull/41`。'] })), [], '反引號包住的網址當證據');
  // r1 R8：保留字當別名也要登記得進去、認得出來
  const proto = parseArgs(['--file', 'x.md', '--repos', '__proto__=acme/kit']);
  assert.ok(Object.hasOwn(proto.repos, '__proto__'), '__proto__ 要變成自有的鍵');
  assert.deepEqual([...prRefs('__proto__ #41', proto.repos)], ['acme/kit#41']);
  assert.equal(Object.getPrototypeOf(proto.repos), null, '別名表不帶原型，登記什麼名字都不會改到別的東西');
});

test('⑥已結束的形狀與 30 天；本週成果七天、子項目要有日期父項；未來的日期不算過期', () => {
  const bad = problemsOf(doc({ done: ['### 套件｜某事｜已結束｜附件第 1 條'] }));
  assert.ok(bad.some((p) => p.includes('不是合法的紀錄') && p.includes('某事')), bad.join('\n'));
  const ok = problemsOf(doc({ done: ['### 套件｜某事｜已結束 09/10｜已留：附件第 1 條', '### 理財｜別事｜已結束 10/01｜無永久決定'] }));
  assert.deepEqual(ok, []);
  const old = problemsOf(doc({ done: ['### 套件｜某事｜已結束 09/06｜已留：附件第 1 條'] }));
  assert.ok(old.some((p) => p.includes(`上限 ${DONE_DAYS}`)), old.join('\n'));
  const dangling = problemsOf(doc({ done: ['### 套件｜某事｜已結束 10/01｜已留：附件第 7 條'] }));
  assert.ok(dangling.some((p) => p.includes('附件第 7 條不存在')), dangling.join('\n'));
  // r2 R1：已結束那一節縮排一格的紀錄以前會跳過全部檢查；r2 R2／R5：「已留」要有解析得出的條號，寫壞的要列
  const indentedDone = problemsOf(doc({ done: [' ### 套件｜舊工作｜已結束 09/01｜已留：附件第 999 條'] }));
  assert.ok(indentedDone.some((p) => p.includes('已結束') && p.includes('不是合法的紀錄') && p.includes('舊工作')), indentedDone.join('\n'));
  assert.ok(!indentedDone.some((p) => p.includes('附件第 999 條不存在')), '縮排的那一行不是紀錄，不再往下查附件（它整行已經被列出來）');
  // r3 R1（同族第三輪，換做法）：已結束那一節只認一種形狀，其餘非空行一律列出——不再枚舉「哪些壞法算壞」
  for (const bad of ['###套件｜舊工作｜已結束 09/01｜已留：附件第 999 條', '####### 套件｜舊工作｜已結束 09/01｜已留：附件第 999 條', '  ### 套件｜舊工作｜已結束 09/01｜已留：附件第 999 條', '舊工作 09/01 結束了，見附件第 999 條']) {
    const r = problemsOf(doc({ done: [bad] }));
    assert.ok(r.some((p) => p.includes('已結束') && p.includes('不是合法的紀錄') && p.includes('舊工作')), `${bad}：${r.join('\n')}`);
  }
  // 本週成果同樣只認「- 月/日」與縮排的子項目
  const weekProse = problemsOf(doc({ week: ['- 10/07', '  - 套件：甲', '09/01 乙（沒有清單記號、躲過七天）', '- 09/02 丙'] }));
  assert.ok(weekProse.some((p) => p.includes('本週成果') && p.includes('09/01 乙')), weekProse.join('\n'));
  assert.ok(weekProse.some((p) => p.includes('本週成果') && p.includes('09/02 丙')), '「- 月/日 字」不是日期行也不是子項目，要列');
  const badDoneRef = problemsOf(doc({ done: ['### 套件｜舊工作｜已結束 10/01｜已留：附件第 xxx 條'] }));
  assert.ok(badDoneRef.some((p) => p.includes('條號寫法不對') && p.includes('xxx')), badDoneRef.join('\n'));
  assert.ok(badDoneRef.some((p) => p.includes('沒有一個解析得出的附件條號')), badDoneRef.join('\n'));
  const week = problemsOf(doc({ week: ['- 10/07', '  - 套件：甲', '- 09/29', '  - 理財：乙'] }));
  assert.ok(week.some((p) => p.includes('09/29') && p.includes(`只留 ${WEEK_DAYS} 天`)), week.join('\n'));
  assert.deepEqual(problemsOf(doc({ week: ['- 10/01', '  - 甲'], done: ['### 套件｜某事｜已結束 12/01｜無永久決定'] })), [], '七天內與未來的日期都不列');
  // r4 R2（同族第四輪；擁有者 2026-10-08 裁 a「守結構」）：子項目要屬於上面某個合法的「- 月/日」，不然它的保留天數核不了——
  // 只剩子項目（沒有任何日期行）、整組多縮排兩格（日期行也縮了）以前都退 0，七天的檢查就消失
  const orphan = problemsOf(doc({ week: ['  - 套件：完成重要成果'] }));
  assert.ok(orphan.some((p) => p.includes('本週成果') && p.includes('沒有合法的「- 月/日」父項') && p.includes('完成重要成果')), orphan.join('\n'));
  const shifted = problemsOf(doc({ week: ['  - 09/01', '    - 套件：完成重要成果'] }));
  assert.ok(shifted.some((p) => p.includes('本週成果') && p.includes('日期行') && p.includes('縮排') && p.includes('09/01')), shifted.join('\n'));
  assert.ok(shifted.some((p) => p.includes('沒有合法的「- 月/日」父項') && p.includes('完成重要成果')), shifted.join('\n'));
  // 縮在合法日期底下的日期行也要點名：它底下的成果會被算成上一個日期（10/07）的，09/01 的舊成果就躲過七天
  const nested = problemsOf(doc({ week: ['- 10/07', '  - 套件：甲', '  - 09/01', '    - 理財：舊成果'] }));
  assert.ok(nested.some((p) => p.includes('日期行') && p.includes('09/01') && p.includes('10/07')), nested.join('\n'));
  assert.ok(!nested.some((p) => p.includes('沒有合法的「- 月/日」父項')), `上面有合法日期的子項目不算孤立：${nested.join('\n')}`);
  // 對照：一個日期底下好幾個子項目（含更深一層）、再接下一個日期，一條都不列——父項要一直記到下一個日期行為止
  assert.deepEqual(problemsOf(doc({ week: ['- 10/07', '  - 套件：甲', '  - 理財：乙', '    - 乙的細項', '- 10/06', '  - 共用：丙'] })), [], '有日期父項的子項目都不列');
});

test('⑦指令入口：有問題退 0、--strict 退 1、沒問題退 0；讀不到、少節、參數錯、--now 寫法錯＝退 2；--pr-states 當平台答案', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-check-'));
  const good = path.join(dir, 'good.md');
  const bad = path.join(dir, 'bad.md');
  const states = path.join(dir, 'states.json');
  fs.writeFileSync(good, doc());
  fs.writeFileSync(bad, doc({ entries: [entry({ fields: { 他要的: undefined } })] }));
  fs.writeFileSync(states, JSON.stringify(MERGED));
  const cli = (...args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });
  const g = cli('--file', good, '--now', '10/07', '--pr-states', states);
  assert.equal(g.status, 0, g.stdout + g.stderr); assert.match(g.stdout, /問題 0 條/u); assert.match(g.stdout, /沒有問題/u);
  const b = cli('--file', bad, '--now', '10/07', '--pr-states', states);
  assert.equal(b.status, 0, '只列不擋'); assert.match(b.stdout, /少了「他要的」/u); assert.match(b.stdout, /只列不擋/u);
  assert.equal(cli('--file', bad, '--now', '10/07', '--pr-states', states, '--strict').status, 1, '--strict 才擋');
  assert.equal(cli('--file', good, '--now', '10/07', '--offline').status, 0);
  assert.match(cli('--file', good, '--now', '10/07', '--offline').stdout, /離線/u);
  const notMerged = path.join(dir, 'not-merged.json');
  fs.writeFileSync(notMerged, JSON.stringify({ 'acme/kit#41': { merged: false } }));
  assert.match(cli('--file', good, '--now', '10/07', '--pr-states', notMerged).stdout, /沒有一支合併了/u);
  const stringFalse = path.join(dir, 'string-false.json');
  fs.writeFileSync(stringFalse, JSON.stringify({ 'acme/kit#41': { merged: 'false' } }));
  const sf = cli('--file', good, '--now', '10/07', '--pr-states', stringFalse, '--strict');
  assert.equal(sf.status, 1, 'r1 R5：答案檔寫字串 "false" 不可以印沒有問題'); assert.match(sf.stdout, /核不了/u);
  for (const top of ['[]', 'null', 'true', '"x"']) {
    const f = path.join(dir, 'top.json');
    fs.writeFileSync(f, top);
    assert.equal(cli('--file', good, '--now', '10/07', '--pr-states', f).status, 2, `r2 R5：答案檔頂層是 ${top} 要退 2`);
  }
  // r2 R5：正式的呼叫點真的用清過的環境、固定主機——放一支假的 gh 在 PATH 最前面，記下它收到的參數與環境
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const record = path.join(dir, 'gh-record.json');
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nnode -e 'require("fs").writeFileSync(${JSON.stringify(record)}, JSON.stringify({ args: process.argv.slice(1), env: process.env }))' -- "$@"\nprintf '%s' '{"state":"open","merged_at":null}'\n`, { mode: 0o755 });
  const viaFakeGh = spawnSync(process.execPath, [TOOL, '--file', good, '--now', '10/07', '--strict'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GH_HOST: 'review-only.invalid', GH_REPO: 'x/y', GIT_DIR: '/nowhere' } });
  assert.equal(viaFakeGh.status, 1, viaFakeGh.stdout + viaFakeGh.stderr);
  assert.match(viaFakeGh.stdout, /沒有一支合併了/u, '假的 gh 回沒合併，正式路徑要用上它的答案');
  const recorded = JSON.parse(fs.readFileSync(record, 'utf8'));
  assert.deepEqual(recorded.args, ['api', '--hostname', 'github.com', 'repos/acme/kit/pulls/41']);
  assert.equal(recorded.env.GH_HOST, undefined); assert.equal(recorded.env.GH_REPO, undefined); assert.equal(recorded.env.GIT_DIR, undefined);
  assert.equal(cli('--file', path.join(dir, 'nope.md'), '--now', '10/07').status, 2);
  const noSection = path.join(dir, 'no-section.md');
  fs.writeFileSync(noSection, doc().replace('## 附件（證據位置）', '## 證據'));
  assert.equal(cli('--file', noSection, '--now', '10/07').status, 2);
  assert.equal(cli('--file', good, '--pr', '5').status, 2);
  assert.equal(cli('--now', '10/07').status, 2, '沒給 --file');
  assert.equal(cli('--file', good, '--now', '10-07', '--offline').status, 2);
  assert.equal(cli('--file', good, '--now', '10/07', '--repos', 'kit', '--offline').status, 2, '--repos 寫法錯');
  assert.throws(() => parseArgs(['--file']), /後面要接值/u);
  // 純函式層：run 不問平台（注入的 fetch 要被叫到、答案要被用上）
  let asked = null;
  const r = run(['--file', good, '--now', '10/07'], { fetch: (prs) => { asked = prs; return { 'acme/kit#41': { merged: false } }; } });
  assert.deepEqual(asked, ['acme/kit#41']); assert.equal(r.code, 0); assert.ok(r.lines.some((l) => l.includes('沒有一支合併了')));
  let askedOffline = false;
  run(['--file', good, '--now', '10/07', '--offline'], { fetch: () => { askedOffline = true; return {}; } });
  assert.equal(askedOffline, false, '--offline 不問平台');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('⑧問平台：固定問 github.com、先清選主機變數；合併了、沒合併、gh 退非零、回的不是 JSON、形狀不對、merged_at 不是時間', () => {
  const answers = {
    'repos/acme/kit/pulls/1': { status: 0, stdout: JSON.stringify({ state: 'closed', merged_at: '2026-10-07T09:37:41Z' }), stderr: '' },
    'repos/acme/kit/pulls/2': { status: 0, stdout: JSON.stringify({ state: 'open', merged_at: null }), stderr: '' },
    'repos/acme/kit/pulls/3': { status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)\n' },
    'repos/acme/kit/pulls/4': { status: 0, stdout: '<html>', stderr: '' },
    'repos/acme/kit/pulls/5': { status: 0, stdout: '{}', stderr: '' },
    'repos/acme/kit/pulls/6': { status: 0, stdout: JSON.stringify({ state: 'closed', merged_at: 'false' }), stderr: '' },
    'repos/acme/kit/pulls/7': { status: 0, stdout: '[]', stderr: '' },
  };
  const seen = [];
  const runner = (args) => { seen.push(args); return answers[args[args.length - 1]]; };
  const r = fetchPrStates(['acme/kit#1', 'acme/kit#2', 'acme/kit#3', 'acme/kit#4', 'acme/kit#5', 'acme/kit#6', 'acme/kit#7', 'bad'], runner);
  assert.equal(r['acme/kit#1'].merged, true);
  assert.equal(r['acme/kit#2'].merged, false);
  assert.equal(r['acme/kit#3'].merged, null); assert.match(r['acme/kit#3'].why, /404/u);
  assert.equal(r['acme/kit#4'].merged, null);
  assert.equal(r['acme/kit#5'].merged, null, 'r1 R5：沒有 merged_at 的答案不可以猜成沒合併');
  assert.match(r['acme/kit#5'].why, /沒有 merged_at/u, '原因要說是形狀不對，不是時間不合法');
  assert.equal(r['acme/kit#6'].merged, null, 'merged_at 不是時間不可以當成合併了');
  assert.equal(r['acme/kit#7'].merged, null);
  assert.equal(r.bad.merged, null);
  for (const args of seen) assert.deepEqual(args.slice(0, 3), ['api', '--hostname', 'github.com'], 'r1 R7：證據網址是 github.com，查詢也只准問 github.com');
  const saved = { GH_HOST: process.env.GH_HOST, GH_REPO: process.env.GH_REPO };
  process.env.GH_HOST = 'review-only.invalid'; process.env.GH_REPO = 'x/y';
  try {
    const env = ghEnv();
    assert.equal(env.GH_HOST, undefined, '選主機的變數要清掉'); assert.equal(env.GH_REPO, undefined);
    assert.equal(env.GIT_DIR, undefined);
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('⑨CRLF 換行的摘要判得跟 LF 一樣（r1 R2）', () => {
  const lf = doc({ entries: [entry(), entry({ fields: { 動哪些檔: undefined } })] });
  const crlf = lf.replace(/\n/gu, '\r\n');
  const a = evaluate(lf, { now: NOW, prStates: MERGED });
  const b = evaluate(crlf, { now: NOW, prStates: MERGED });
  assert.deepEqual(b, a);
  assert.equal(a.entries, 2); assert.equal(a.attachments, 1);
  assert.ok(a.problems.some((p) => p.includes('少了「動哪些檔」')), '對照組：LF 那一份真的只缺那一欄');
  assert.equal(a.problems.length, 1);
});
