#!/usr/bin/env node
// 待裁清單（規矩 D1、I1〜I3）：把「問了裁示者、他還沒回」的問題列出來。
//
// 為什麼：裁示者定了「沒有時限、問了就等」（I2）。那「還在等哪些」就得有東西在數，不然靠下一個
// 開工的人剛好想起來。這支讓裁示者不必自己翻留言串就知道還欠哪些答案，也讓 AI 不會重問或自己拍板。
//
// ⚠️ 這不是閘：它不擋任何事、不寫任何留言、不判「可不可以先做」。不要把它接進鉤子或合併步驟。
//
// 形狀只認範本（templates/ruling-record.md）：
//   問  ＝第一行「## ❓ 待裁（YYYY-MM-DD）：〈標題〉」
//   裁示＝第一行「## ⚖️ 〈裁示者識別值〉 裁示（YYYY-MM-DD）：〈標題〉」＋一行「原話（對話中，〈識別值〉 轉述）：**「…」**」，
//         **而且要由裁示者的貼文帳號貼的**（別人貼的裁示不算，會另列成疑似）
//   撤回＝第一行「## 🚫 撤回（YYYY-MM-DD）：〈標題〉」＋「撤回理由：〈三選一〉（依據）」＋「〈識別值〉 撤回、〈裁示者〉 未回；他隨時可以要我重問」
// 配對＝裁示或撤回的內文（引用區塊以外）出現原 ❓ 留言的編號（貼網址就自然含有），而且比 ❓ 晚。
// 已裁與已撤回一定印出來、附配對，讓錯的配對看得見；長得像但形狀不合的另列成疑似。
//
// 誠實劃界：只掃開著的變更（裁示貼在已關掉的變更上看不到）；「已裁」是推導不是事實（引了編號不等於
// 在回答它）；原話那一行只驗形狀，驗不出引號裡是不是他真的說的；分頁是那條登記指令的責任。
// 退出碼：0＝算出來了（含「沒有還沒回的」）；2＝算不出來（設定沒填、平台問不到）。刻意沒有 1。
'use strict';
const { ask, PlatformError } = require('./platform.js');
const { read: readSettings } = require('./settings-data.js');

const UNSET = '未設定';
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const ASK = /^## ❓ 待裁（(\d{4}-\d{2}-\d{2})）：(\S.*)$/u;
const WITHDRAW = /^## 🚫 撤回（(\d{4}-\d{2}-\d{2})）：(\S.*)$/u;
const WITHDRAW_REASON = /^撤回理由：(題目依附的東西沒了|問題本身問錯了|跟另一則 ❓ 重複)（[^\n）]*\S[^\n）]*）[ \t]*$/mu;
const NEAR = /❓|⚖|🚫|待裁|裁示|撤回/u;

const realDate = (s) => { const m = DATE.exec(s); if (!m) return false; const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const { effectiveText } = require('./markdown-effective.js');
/**
 * 生效文字只有一份定義（r2 Medium③：原本第一行、原話行、配對各自剝不同的容器——原話放進程式碼範例照樣算數）。
 * 註解、程式碼圍欄、引用（含懶續行）裡的字一律不算：第一行、原話、撤回理由、自報句、配對，全部從同一份文字取。
 */
const clean = (body) => effectiveText(body);
const firstLine = (body) => clean(body).split('\n').find((l) => l.trim()) || '';
const outsideQuotes = clean;
// 編號要整個對上：前後不可以再接字母或數字（c1 不可以命中 c12）；但連字號與底線算邊界——網址尾碼是「issuecomment-<編號>」。
const cites = (body, id) => new RegExp(`(?<![0-9A-Za-z])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z])`, 'u').test(outsideQuotes(body));

const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 裁示者：角色以「裁示者」開頭的那一位；識別值與帳號都要填。順便帶回全部登記的識別值與帳號。 */
function deciderOf(settings) {
  const all = Array.isArray(settings.participants) ? settings.participants : [];
  const p = all.find((x) => x && typeof x.role === 'string' && x.role.startsWith('裁示者'));
  if (!p || !p.id || p.id === UNSET || !p.account || p.account === UNSET) return null;
  const ids = all.map((x) => x && x.id).filter((v) => typeof v === 'string' && v && v !== UNSET);
  const accounts = all.map((x) => x && x.account).filter((v) => typeof v === 'string' && v && v !== UNSET);
  return { id: p.id, account: p.account, ids, accounts };
}

/**
 * 純判斷層。comments＝[{ id, author, body, createdAt, change }]（change＝所屬變更編號，只用來印）。
 */
const at = (c) => Date.parse(String(c.createdAt));

function evaluate(comments, decider) {
  // 時間契約（r2 Medium④）：每一則的時間都要讀得出，先後用時間值比——字串比會讓不同時區的合法寫法排錯，
  // 一則其實比問題早的裁示會把後來的問題關掉。讀不出＝整份算不出來，由呼叫端退 2。
  if (comments.some((c) => !Number.isFinite(at(c)))) return { open: [], ruled: [], withdrawn: [], near: [], unsure: '有留言的時間讀不出來' };
  const ids = decider.ids && decider.ids.length ? decider.ids : [decider.id];
  const accounts = new Set(decider.accounts && decider.accounts.length ? decider.accounts : [decider.account]);
  const idAlt = `(?:${ids.map(esc).join('|')})`;
  const rulingRe = new RegExp(`^## ⚖️? ${esc(decider.id)} 裁示（(\\d{4}-\\d{2}-\\d{2})）：(\\S.*)$`, 'u');
  // 轉述者的識別值必須是登記過的、不帶任何記號（範本明說角色包粗體＝不合；r1 Medium⑨）
  const quoteRe = new RegExp(`^原話（對話中，${idAlt} 轉述）：\\*\\*「.+」\\*\\*[ \\t]*$`, 'mu');
  const withdrawSelf = new RegExp(`^${idAlt} 撤回、${esc(decider.id)} 未回；他隨時可以要我重問[ \\t]*$`, 'mu');
  const asks = [];
  const rulings = [];
  const withdraws = [];
  const near = [];
  const sorted = [...comments].sort((a, b) => at(a) - at(b));
  for (const c of sorted) {
    const first = firstLine(c.body);
    // 三種留痕都只採計登記過的貼文帳號（設定的貼文帳號資格；r1 Medium⑧：原本只有裁示看帳號，外人能撤掉待裁）
    if (!accounts.has(c.author) && (ASK.test(first) || WITHDRAW.test(first) || rulingRe.test(first))) {
      near.push({ ...c, why: `不是登記的貼文帳號貼的（${c.author}），不採計` });
      continue;
    }
    const a = ASK.exec(first);
    if (a) {
      if (!realDate(a[1])) { near.push({ ...c, why: '日期不是真的日子' }); continue; }
      asks.push({ ...c, date: a[1], title: a[2].trim() });
      continue;
    }
    const r = rulingRe.exec(first);
    if (r) {
      if (!realDate(r[1])) { near.push({ ...c, why: '日期不是真的日子' }); continue; }
      if (c.author !== decider.account) { near.push({ ...c, why: `裁示不是裁示者的帳號貼的（${c.author}）` }); continue; }
      if (!quoteRe.test(clean(c.body))) { near.push({ ...c, why: '少了「原話（對話中，〈登記的識別值〉 轉述）：**「…」**」那一行（轉述者要是登記的識別值、不帶記號）' }); continue; }
      rulings.push({ ...c, date: r[1], title: r[2].trim() });
      continue;
    }
    const w = WITHDRAW.exec(first);
    if (w) {
      if (!realDate(w[1])) { near.push({ ...c, why: '日期不是真的日子' }); continue; }
      if (!WITHDRAW_REASON.test(clean(c.body))) { near.push({ ...c, why: '撤回理由不是三選一、或沒有具體依據' }); continue; }
      if (!withdrawSelf.test(clean(c.body))) { near.push({ ...c, why: '少了「〈登記的識別值〉 撤回、〈裁示者〉 未回；他隨時可以要我重問」那一行' }); continue; }
      withdraws.push({ ...c, date: w[1], title: w[2].trim() });
      continue;
    }
    if (NEAR.test(first)) near.push({ ...c, why: '第一行長得像留痕、但形狀不合範本' });
  }
  const open = [];
  const ruled = [];
  const withdrawn = [];
  for (const q of asks) {
    const later = (x) => at(x) > at(q);
    const r = rulings.find((x) => later(x) && cites(x.body, q.id));
    if (r) { ruled.push({ ask: q, by: r }); continue; }
    const w = withdraws.find((x) => later(x) && cites(x.body, q.id));
    if (w) { withdrawn.push({ ask: q, by: w }); continue; }
    open.push(q);
  }
  return { open, ruled, withdrawn, near };
}

function render({ open, ruled, withdrawn, near }) {
  const lines = [];
  const where = (c) => `變更 ${c.change}｜留言 ${c.id}`;
  lines.push(`還沒回：${open.length} 則`);
  for (const q of open) lines.push(`  ・${q.date}｜${q.title}｜${where(q)}`);
  lines.push(`已裁：${ruled.length} 則（配對是推導，錯的看得見）`);
  for (const { ask: q, by } of ruled) lines.push(`  ・${q.title}｜問：${where(q)}｜裁：${by.date}，${where(by)}`);
  lines.push(`已撤回：${withdrawn.length} 則`);
  for (const { ask: q, by } of withdrawn) lines.push(`  ・${q.title}｜問：${where(q)}｜撤：${by.date}，${where(by)}`);
  if (near.length) {
    lines.push(`疑似（長得像留痕但不採計）：${near.length} 則`);
    for (const n of near) lines.push(`  ・${where(n)}：${n.why}——「${firstLine(n.body).slice(0, 60)}」`);
  }
  return lines;
}

function run({ settings = readSettings(), platform = { ask } } = {}) {
  const decider = deciderOf(settings);
  if (!decider) return { code: 2, lines: ['專案設定裡的裁示者識別值或貼文帳號還沒填：分不出誰的裁示算數，算不出來。'] };
  let changes;
  const comments = [];
  try {
    changes = platform.ask('openChanges', {}, { settings });
    for (const ch of changes) {
      for (const c of platform.ask('comments', { change: ch.id }, { settings })) comments.push({ ...c, change: ch.id });
    }
  } catch (e) {
    if (e instanceof PlatformError || (e && e.name === 'PlatformError')) return { code: 2, lines: [`待裁清單：問不到平台（${e.message}）——算不出來。`] };
    throw e;
  }
  const result = evaluate(comments, decider);
  if (result.unsure) return { code: 2, lines: [`待裁清單：${result.unsure}——先後判不了，算不出來（不會把任何題移出待裁）。`] };
  const lines = [`待裁清單（掃了 ${changes.length} 支開著的變更、${comments.length} 則留言；只掃開著的）`, ...render(result)];
  return { code: 0, lines };
}

if (require.main === module) {
  let result;
  try { result = run(); } catch (e) { result = { code: 2, lines: [`待裁清單：沒預期到的錯誤（${(e && e.code) || (e && e.message) || '不明'}）——算不出來。`] }; }
  process.stdout.write(`${result.lines.join('\n')}\n`);
  process.exit(result.code);
}

module.exports = { run, evaluate, render, deciderOf, cites, realDate, outsideQuotes };
