#!/usr/bin/env node
// 「機器讀說明與留言，讀哪一段」只有這一份（r2 Medium③ 起共用；r5 之後換成現在這個形狀）。
//
// 讀法：從第一行往下讀，碰到第一個「特殊行」就停——那一行和它之後都不讀。
// 特殊行＝有可能開出容器、把字藏起來、或把字變成程式碼的行（只有空白的行算空行、不算特殊行）。
// ①〜④看「開頭」＝去掉行首空白、再去掉清單記號（- * + 或 1. 1) 加空白，可以疊好幾層）之後的第一個字：
//   ①以 > 開頭（引用）；②以三個以上反引號或波浪號開頭（程式碼圍欄）；③以 [ 開頭（連結定義、註腳定義；核取清單的「[ ]」「[x]」後面接空白不算——那不可能是定義）；
//   ④以 $$ 開頭（數學區塊）；
// ⑤原本的行首有 tab 或四個以上空白，或清單記號後面接 tab 或五個以上空白（縮排式程式碼、清單裡的巢狀內容）；
//   ⑥行內有「<」緊接英文字母、/、!、?（HTML 標籤、註解、自動連結的開頭）；⑦行內有「![」（圖片）；
//   ⑧這一行的反引號在本行配不完（行內程式碼會跨行，或本來就是打錯）。
//   ⑥⑦只看行內程式碼以外的字：⑧先確定這一行的反引號都在本行配完、而且前面的行都不是特殊行（同一段裡沒有
//   配不完的反引號可以跨行來配），這時本行怎麼配就是平台怎麼配；反引號在「<」之前開頭＝平台也當程式碼（看得見的字）。
//
// 為什麼這樣讀（不再判「平台畫面上看得到哪些字」）：r1〜r5 連五輪都在那個判斷上中刀——註解、圍欄、行內程式碼、
// 引用誰先誰後，補一格就露下一格，而且兩個方向都錯過。那是在重做平台的標記語言解析器，追不上。
// 現在問的是一個量得到的東西：**第一個特殊行之前，每一行都是看得見的普通文字**——會開出容器或藏字的開頭一個都還沒出現，
// 就沒有東西能把這些行收進程式碼、引用或藏起來（後面的行最多把前面的段落變成標題或表格，仍看得見）。
// 要守的只有這份清單：清單寬了＝早一點停、讀得比畫面少，「要找的東西沒找到」就擋下來、指出行號；清單漏了一種開頭＝會讀到容器裡的字，
// 所以清單逐項有考題、清單外的寫在誠實劃界。
//
// 所以寫的人要配合一件事：**機器要讀的東西寫在最前面**（範本本來就這樣排：協作欄位在說明開頭；裁示的原話與網址
// 緊接在標題下）。停在哪一行會回報，消費端把行號印進訊息。
//
// 不經過這一支的兩條窄路：結論閘的標頭讀原文第一個非空行、作廢行讀標頭後緊接的收件區；結論閘找 🤖 讀整份原文、什麼都不剝。
//
// 誠實劃界：特殊行的清單是依 CommonMark 與 GitHub 的區塊、行內規則挑的「會開出容器或藏字的開頭」。
// 清單以外的平台擴充（將來新增的語法）沒有列進來；表格、清單、標題、強調、刪除線都照普通文字讀（畫面上看得見）。
'use strict';

/** 這一行是不是特殊行（規則見檔頭①〜⑧）。 */
function isSpecial(line) {
  if (!line.trim()) return false;
  if (/^(?:\t| {0,3}\t| {4,})/.test(line)) return true;
  let t = line.replace(/^\s+/, '');
  for (let m; (m = /^(?:[-*+]|\d{1,9}[.)])(\s*)/.exec(t)) && (m[1].length > 0 || m[0].length === t.length);) {
    if (/\t/.test(m[1]) || m[1].length >= 5) return true;
    t = t.slice(m[0].length);
  }
  if (/^(?:>|`{3,}|~{3,}|\$\$)/.test(t) || (t.startsWith('[') && !/^\[[ xX]\](?:\s|$)/.test(t))) return true;
  const { paired, outside } = codeSpans(line);
  if (!paired) return true;
  return /<[A-Za-z/!?]/.test(outside) || outside.includes('![');
}

/**
 * 本行的行內程式碼：反引號串要等長才配、由左往右找最近的一個；前面緊貼反斜線的反引號算配不完。
 * paired＝本行的反引號都配完；outside＝把配到的行內程式碼換成一個空白之後剩下的字。
 */
function codeSpans(line) {
  const runAt = (i) => { let n = 0; while (line[i + n] === '`') n += 1; return n; };
  let outside = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') { outside += line[i]; i += 1; continue; }
    const n = runAt(i);
    if (line[i - 1] === '\\') return { paired: false, outside };
    let j = i + n;
    let close = -1;
    while (j < line.length) {
      if (line[j] !== '`') { j += 1; continue; }
      const m = runAt(j);
      if (m === n) { close = j; break; }
      j += m;
    }
    if (close === -1) return { paired: false, outside };
    outside += ' ';
    i = close + n;
  }
  return { paired: true, outside };
}

/** 讀到第一個特殊行之前。stopAt＝那一行的行號（從 1 起算）；整份都沒有特殊行＝0。 */
function leadingLines(md) {
  const all = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const k = all.findIndex(isSpecial);
  return k === -1 ? { lines: all, stopAt: 0 } : { lines: all.slice(0, k), stopAt: k + 1 };
}

const leadingText = (md) => leadingLines(md).lines.join('\n');

/** 訊息用：停在哪一行，白話說一句（沒停＝空字串）。 */
const stopNote = (md) => {
  const { stopAt } = leadingLines(md);
  return stopAt ? `（機器讀到第 ${stopAt} 行就停了：那一行是引用、程式碼、HTML、圖片、連結定義或縮排之類的特殊行；要讀的東西請寫在它前面）` : '';
};

module.exports = { leadingLines, leadingText, stopNote, isSpecial };
