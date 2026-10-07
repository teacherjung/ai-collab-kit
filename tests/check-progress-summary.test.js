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
//   ⑥已結束那一節的形狀與 30 天；本週成果那一節的七天；未來的日期不算過期；
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
  // r1 R8：保留字當別名也要登記得進去、認得出來
  const proto = parseArgs(['--file', 'x.md', '--repos', '__proto__=acme/kit']);
  assert.ok(Object.hasOwn(proto.repos, '__proto__'), '__proto__ 要變成自有的鍵');
  assert.deepEqual([...prRefs('__proto__ #41', proto.repos)], ['acme/kit#41']);
  assert.equal(Object.getPrototypeOf(proto.repos), null, '別名表不帶原型，登記什麼名字都不會改到別的東西');
});

test('⑥已結束的形狀與 30 天；本週成果七天；未來的日期不算過期', () => {
  const bad = problemsOf(doc({ done: ['### 套件｜某事｜已結束｜附件第 1 條'] }));
  assert.ok(bad.some((p) => p.includes('不合形狀')), bad.join('\n'));
  const ok = problemsOf(doc({ done: ['### 套件｜某事｜已結束 09/10｜已留：附件第 1 條', '### 理財｜別事｜已結束 10/01｜無永久決定'] }));
  assert.deepEqual(ok, []);
  const old = problemsOf(doc({ done: ['### 套件｜某事｜已結束 09/06｜已留：附件第 1 條'] }));
  assert.ok(old.some((p) => p.includes(`上限 ${DONE_DAYS}`)), old.join('\n'));
  const dangling = problemsOf(doc({ done: ['### 套件｜某事｜已結束 10/01｜已留：附件第 7 條'] }));
  assert.ok(dangling.some((p) => p.includes('附件第 7 條不存在')), dangling.join('\n'));
  const week = problemsOf(doc({ week: ['- 10/07', '  - 套件：甲', '- 09/29', '  - 理財：乙'] }));
  assert.ok(week.some((p) => p.includes('09/29') && p.includes(`只留 ${WEEK_DAYS} 天`)), week.join('\n'));
  assert.deepEqual(problemsOf(doc({ week: ['- 10/01', '  - 甲'], done: ['### 套件｜某事｜已結束 12/01｜無永久決定'] })), [], '七天內與未來的日期都不列');
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
