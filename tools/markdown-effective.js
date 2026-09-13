#!/usr/bin/env node
// 「哪一段文字算生效」只有這一份（里程碑 3 r2 Medium③：原話行、協作欄位、範本小標三個消費端各自判，
// 各漏一種容器——程式碼圍欄裡的欄位被當成填了、引用的懶續行被當成最外層、三個反引號提早關掉四個反引號的圍欄）。
//
// 拿掉三種容器，剩下的才是生效文字：
//   ①HTML 註解（畫面上看不見）；
//   ②程式碼圍欄：開頭是 0〜3 個空白加至少三個反引號或波浪號；**關閉行要同一種符號、長度不短於開頭**、
//     後面只准空白（CommonMark 的規則——三個反引號關不掉四個反引號開的圍欄）；沒關閉就一路到底；
//   ③引用區塊：以 > 開頭的行，加上緊接在後、沒有空行隔開的續行（懶續行），到空行為止。
//
// 誠實劃界：不是完整的 Markdown 解析器。縮排式程式碼區塊、HTML 區塊、清單裡的巢狀容器都不處理——
// 方向是「多留」（可能把容器裡的字當成生效），所以各消費端的判準仍要求固定形狀（行首、逐字），
// 不能只靠這一支。要更嚴就換真的解析器，那是另一支的題目。
'use strict';

function effectiveLines(md) {
  const text = String(md || '').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  let fence = null;      // { ch, len }
  let inQuote = false;
  for (const line of text.split('\n')) {
    if (fence) {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len) fence = null;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = { ch: open[1][0], len: open[1].length }; inQuote = false; continue; }
    if (/^ {0,3}>/.test(line)) { inQuote = true; continue; }
    if (!line.trim()) { inQuote = false; out.push(line); continue; }
    if (inQuote) continue;
    out.push(line);
  }
  return out;
}

const effectiveText = (md) => effectiveLines(md).join('\n');

module.exports = { effectiveLines, effectiveText };
