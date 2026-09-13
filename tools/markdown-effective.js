#!/usr/bin/env node
// 「哪一段文字算生效」只有這一份（里程碑 3 r2 Medium③：原話行、協作欄位、範本小標三個消費端各自判，
// 各漏一種容器——程式碼圍欄裡的欄位被當成填了、引用的懶續行被當成最外層、三個反引號提早關掉四個反引號的圍欄）。
//
// 拿掉三種容器，剩下的才是生效文字：
//   ①HTML 註解（畫面上看不見）——只在圍欄外判，沒關閉的一路到底都不算；
//   ②程式碼圍欄：開頭是 0〜3 個空白加至少三個反引號或波浪號；**關閉行要同一種符號、長度不短於開頭**、
//     後面只准空白（CommonMark 的規則——三個反引號關不掉四個反引號開的圍欄）；沒關閉就一路到底；
//   ③引用區塊：以 > 開頭的行，加上緊接在後、沒有空行隔開的續行（懶續行），到空行為止。
//
// 誠實劃界：不是完整的 Markdown 解析器。縮排式程式碼區塊、HTML 區塊、清單裡的巢狀容器都不處理——
// 方向是「多留」（可能把容器裡的字當成生效），所以各消費端的判準仍要求固定形狀（行首、逐字），
// 不能只靠這一支。要更嚴就換真的解析器，那是另一支的題目。
'use strict';

function effectiveLines(md) {
  const out = [];
  let fence = null;      // { ch, len }
  let inQuote = false;
  let inComment = false;
  // ⚠️ 註解與圍欄要在**同一個狀態機**裡判（r3 Medium②）：原本先全域刪註解再看圍欄，圍欄裡的「<!--」只是程式碼文字，
  //    卻被拿去跟外面的「-->」配對，把第一段的關圍欄也刪掉，第二段的開圍欄就變成關圍欄、裡面的範例反而成了生效文字。
  //    現在：在圍欄裡什麼都不解析；在圍欄外才處理註解，沒關閉的註解一路到底都不算。
  for (let line of String(md || '').replace(/\r\n?/g, '\n').split('\n')) {
    const wasBlank = !line.trim();
    if (fence) {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len) fence = null;
      continue;
    }
    if (inComment) {
      const j = line.indexOf('-->');
      if (j === -1) continue;
      line = line.slice(j + 3);
      inComment = false;
    }
    // 行內完整的註解剝掉；開了沒關的＝之後都不算
    let kept = '';
    let rest = line;
    for (;;) {
      const i = rest.indexOf('<!--');
      if (i === -1) { kept += rest; break; }
      kept += rest.slice(0, i);
      const j = rest.indexOf('-->', i + 4);
      if (j === -1) { inComment = true; break; }
      rest = rest.slice(j + 3);
    }
    line = kept;
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = { ch: open[1][0], len: open[1].length }; inQuote = false; continue; }
    if (/^ {0,3}>/.test(line)) { inQuote = true; continue; }
    if (!line.trim()) {
      // 原本就是空行＝結束引用、保留；只因為剝掉註解才變空的行不算空行（保守：不讓一行註解把引用切開）
      if (wasBlank) { inQuote = false; out.push(line); }
      continue;
    }
    if (inQuote) continue;
    out.push(line);
  }
  return out;
}

const effectiveText = (md) => effectiveLines(md).join('\n');

module.exports = { effectiveLines, effectiveText };
