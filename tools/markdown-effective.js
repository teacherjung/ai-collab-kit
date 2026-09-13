#!/usr/bin/env node
// 「哪一段文字算生效」只有這一份（里程碑 3 r2 Medium③：原話行、協作欄位、範本小標三個消費端各自判，
// 各漏一種容器——程式碼圍欄裡的欄位被當成填了、引用的懶續行被當成最外層、三個反引號提早關掉四個反引號的圍欄）。
//
// 防誰：寫說明與留言的人**手滑**——把範例貼進程式碼圍欄、引用了別人的欄位、把一段註解掉忘了拿出來。
// 不防刻意構造的標記語言（寫這些東西的人本來就能直接改內容，擋不住也不必擋）。
//
// 兩件事，分開做：
//
// 一、effectiveLines／effectiveText：拿掉兩種容器，剩下的才是生效文字——
//   ①程式碼圍欄：開頭是 0〜3 個空白加至少三個反引號或波浪號；**關閉行要同一種符號、長度不短於開頭**、
//     後面只准空白（CommonMark 的規則——三個反引號關不掉四個反引號開的圍欄）；沒關閉就一路到底；
//     開頭那一行後面的字（資訊字串）整行都屬於圍欄，不再解讀。
//   ②引用區塊：以 > 開頭的行，加上緊接在後、沒有空行隔開的續行（懶續行），到空行為止。
//
// 二、htmlCommentLine：**HTML 註解不解讀，只偵測**（r4 Medium②之後改的）。回第一個註解開頭「<!--」所在的行號，沒有就回 0。
//   消費端看到非 0 就停下來、叫人把註解拿掉，不猜註解裡藏的算不算、外面的字有沒有被吞掉。
//   為什麼不照舊剝掉：r1〜r4 連四輪都在這一族中刀（r1 註解整個沒處理、r2 各端各判、r3 註解與圍欄交錯、
//   r4 圍欄開頭行先被當成註解），而且兩個方向都錯過（多留：圍欄裡的範例被搬成生效文字；多剝：圍欄開頭行帶記號，
//   就把後面看得見的壞標頭吞掉——下面量真語料又發現行內程式碼裡提到記號也會吞）。
//   2026-09-13 量過原專案與本倉庫共 2,393 則留言與變更說明：圍欄外出現「<!--」的 42 則，幾乎都是在行內程式碼裡
//   **提到**這個記號；舊的剝法改動了其中 41 則的生效文字（14 則少掉兩百字以上）。這支偵測只標出 6 則：
//   1 則是刻意的整行註解，另 5 則都是在討論這個記號本身的留言（寧可多報的那一側）。剝註解幾乎沒守到東西，卻在正常寫法上出錯。
//   同一個做法本倉庫早就在用：案例簿那一題也是「看到註解記號就紅」、不解讀。
//   偵測時不看的地方：圍欄裡（同上①的規則）、行內程式碼裡。行內程式碼的配對只在「同一段（空行或圍欄之間）
//   每一行的反引號都在本行配得完、而且沒有緊貼反斜線的反引號」時才採用；否則整段不扣掉行內程式碼、照原文找——
//   同一段裡有配不完的反引號時，平台會跨行去配、配法跟單行不同，那種情況寧可多報。
//
// 誠實劃界（兩個方向都可能錯，所以各消費端的判準仍要求固定形狀：行首、逐字）：
//   縮排式程式碼區塊、HTML 區塊、清單裡縮排四格以上的圍欄、引用裡的圍欄、表格儲存格、行內 HTML 標籤裡的反引號，
//   都不照平台的畫面判。要完全照畫面判就要換真的解析器，那是另一支的題目。
//   結論閘的標頭（原文第一個非空行）與作廢行（標頭後緊接的收件區）是兩條窄路徑，本來就不經過這一支。
'use strict';

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const fenceCloses = (line, fence) => {
  const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  return Boolean(m && m[1][0] === fence.ch && m[1].length >= fence.len);
};
const splitLines = (md) => String(md || '').replace(/\r\n?/g, '\n').split('\n');

function effectiveLines(md) {
  const out = [];
  let fence = null;      // { ch, len }
  let inQuote = false;
  for (const line of splitLines(md)) {
    if (fence) {
      if (fenceCloses(line, fence)) fence = null;
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) { fence = { ch: open[1][0], len: open[1].length }; inQuote = false; continue; }
    if (/^ {0,3}>/.test(line)) { inQuote = true; continue; }
    if (!line.trim()) { inQuote = false; out.push(line); continue; }
    if (inQuote) continue;
    out.push(line);
  }
  return out;
}

const effectiveText = (md) => effectiveLines(md).join('\n');

/** 一行裡的行內程式碼換成一個空白。paired＝這一行的反引號都在本行配完、而且沒有緊貼反斜線的反引號。 */
function stripCodeSpans(line) {
  const runAt = (i) => { let n = 0; while (line[i + n] === '`') n += 1; return n; };
  let text = '';
  let paired = true;
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') { text += line[i]; i += 1; continue; }
    const n = runAt(i);
    if (line[i - 1] === '\\') { paired = false; text += line.slice(i, i + n); i += n; continue; }
    let j = i + n;
    let close = -1;
    while (j < line.length) {
      if (line[j] !== '`') { j += 1; continue; }
      const m = runAt(j);
      if (m === n) { close = j; break; }
      j += m;
    }
    if (close === -1) { paired = false; text += line.slice(i, i + n); i += n; continue; }
    text += ' ';
    i = close + n;
  }
  return { text, paired };
}

/** 第一個「<!--」在第幾行（圍欄與行內程式碼裡的不算，規則見檔頭「二」）；沒有＝0。 */
function htmlCommentLine(md) {
  let fence = null;
  let group = [];
  const flush = () => {
    const usePairs = group.every((g) => g.paired);
    const hit = group.find((g) => (usePairs ? g.text : g.raw).includes('<!--'));
    group = [];
    return hit ? hit.no : 0;
  };
  const lines = splitLines(md);
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    if (fence) {
      if (fenceCloses(line, fence)) fence = null;
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open || !line.trim()) {
      const hit = flush();
      if (hit) return hit;
      if (open) fence = { ch: open[1][0], len: open[1].length };
      continue;
    }
    group.push({ no: k + 1, raw: line, ...stripCodeSpans(line) });
  }
  return flush();
}

module.exports = { effectiveLines, effectiveText, htmlCommentLine };
