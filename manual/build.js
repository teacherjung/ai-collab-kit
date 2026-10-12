'use strict';
// 套件說明書網頁的產生器。擁有者 2026-09-27 裁：內容從套件本身自動產生，只有「白話說明」與「優缺點」手寫；
// 2026-09-30 裁：做成九頁、可以有跳窗、發成私人網頁連結（留痕在套件 #24）；2026-10-05 裁 a：最前面再加一頁「總覽」放優缺點（留痕在套件 #40）；
// 2026-10-05 裁 a（留痕在套件 #36）：名詞手冊等規矩告一段落再照當時的規矩重寫、併進名詞頁，他看過改過才算數＝名詞頁最上面的「白話手冊」，手寫的字在 manual/handbook.md。
// 只給套件倉庫自己用：不在共用路徑裡（tools/kit-lock.js 的 SHARED_PATHS），不會被搬進使用專案。
// 產生器不自己存檔（擁有者 2026-09-30 裁 a）：網頁印到標準輸出、摘要印到標準錯誤，存到哪裡由跑的人指定；
// 產出不進版控＝跑的人要存到套件倉庫外（沒有機器擋，靠自覺）。什麼時候跑：只在擁有者明確要求更新網頁時（2026-10-05）——
// 日常的 PR、合併之後都不跑這支與它的專屬考題 manual/build.verify.js；步驟見 README「本倉庫自己怎麼合併」的「說明書網頁」那一項。
// 下面檢查到的來源形狀不對就丟例外、標準輸出什麼都不印：半套的說明書比沒有更糟（讀的人以為那就是全部）。
//
//   node manual/build.js [--stamp <頁尾註記，例如版本碼與日期>] > <套件倉庫外的檔>
//   node manual/build.js --handbook-codes   （印白話手冊引到的每一條規矩現在的核對碼；重看完白話、要換碼時用）

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const rulesBook = require('../tools/build-rules.js');
// 設定頁的說明文字住在設定說明產生器裡（每個專案的 PROJECT-SETTINGS.md 也是它產的）；這裡只拿它對空白範本的產出來排版，不另寫一份會漂的說明
const settingsBook = require('../tools/build-settings.js');

const ROOT = path.join(__dirname, '..');

// 擁有者列的九頁與順序（2026-09-30），最前面加總覽（2026-10-05）：打開網頁先看到總覽。
const PAGES = [
  { id: 'overview', name: '總覽' },
  { id: 'rules', name: '規矩' },
  { id: 'machines', name: '機器' },
  { id: 'tools', name: '工具' },
  { id: 'tests', name: '考題' },
  { id: 'templates', name: '範本' },
  { id: 'settings', name: '設定' },
  { id: 'adopt', name: '套用' },
  { id: 'glossary', name: '名詞' },
  { id: 'cases', name: '案例' },
];

const LABEL_HEADER = /^\| 標籤 \| 意思 \| 守不到的 \|$/u;
const TABLE_RULE = /^\|(\s*:?-+:?\s*\|){3}$/u;
const SELF = '靠自覺';
const MACHINE_HEADER = '| 本文 | 原專案的實作 | 違反時會紅的條件 | 守不到的 | 啟用前提 | 移植狀態 |';
const MACHINE_RULE = /^\|(\s*:?-+:?\s*\|){6}$/u;
const MACHINE_FIELDS = ['原專案的實作', '違反時會紅的條件', '守不到的', '啟用前提'];
const RULE_ID = /^[A-K]\d+$/u;
// 機器表第一格不是條號、但合法的字面值（照字面顯示、不連結）；其餘不在規則裡的一律停下，免得打錯字靜靜少掉連結
const NON_RULE_KEYS = ['案例簿'];
// tools/ 底下認得的東西：.js 程式、gates/ 子資料夾、package.json、.gitkeep；其他的要人先決定歸到哪一組
const TOOLS_OTHER = ['package.json', '.gitkeep'];
// tests/ 底下認得的東西：清單上的 .test.js、helpers/ 子資料夾（裡面的檔不列）、manifest.json、package.json
const TESTS_OTHER = ['manifest.json', 'package.json'];
// 範本說明裡相鄰兩個條號之間要有的分隔；沒有就停（G1〜G3、**G1**〜**G3**、G1 到 G3、G1 與 G3 都停），說明書不猜那是兩條還是一個範圍
const RULE_SEPARATOR = /[、，,；;。]/u;
// tests/helpers/ 底下會停的程式檔：副檔名是這幾種、檔名含 test（不分大小寫）。Node 文件列的預設找考題寫法都要檔名或資料夾名含 test
// （2026-10-01 在 Node 26 實測：test-a.js、b.test.cjs、c_test.mjs、e.test.ts、test/ 底下的檔都會被當考題跑，latest.js、data-test.json 不會）；這一條比它寬，寧可多停
const HELPER_TEST_LIKE = /^(?=.*test).*\.(?:js|cjs|mjs|ts|cts|mts)$/iu;
const TEMPLATE_HEAD = '## 範本（本文指到「範本」的地方）';
// 程式碼框的圍欄（套用頁的編號清單項底下用）
const FENCE = '```';
const TEMPLATE_ITEM = /^- (`templates\/[^`]+`(?:、`templates\/[^`]+`)*)：(.+)$/u;
// 範本跳窗與套用頁不收的字：tab 與換行以外的控制字元（Unicode 的控制字元＝U+0000〜U+001F、U+007F〜U+009F）——瀏覽器顯示不出它們
// （NUL 會被丟掉、\r 會變成換行、其餘看不見），網頁上就不是原文了
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u;
// 案例頁：cases/ 底下一則一檔，形狀的正本＝tools/build-casebook-index.js 與 tests/casebook.test.js（標題、空行、六欄依序各一行、最後可有一行「相關」）。
// cases/README.md 是用同一批檔產生的索引：說明書不讀它，照它的排法（照日期、同一天照檔名）自己排
const CASE_FIELDS = ['日期', '本文條號', '發生什麼', '代價', '教訓', '來源'];
const CASE_RELATED = '相關';
const CASE_SLUG = /^[a-z0-9-]+$/u;
const CASE_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CASE_RULES = /^[A-Z]\d+(?:、[A-Z]\d+)*$/u;
// 案例檔、索引說明與用語對照表裡不收的字：tab、控制字元、U+2028／U+2029（網頁上顯示不出原文）
const CASE_HIDDEN = /[\t\u2028\u2029]/u;
// 案例欄位今天有、只在案例頁多認的兩種行內寫法：指到別則案例的連結（字跟檔名一樣）、網址的自動連結（只有 https）
const CASE_LINK = /^\[([a-z0-9-]+)\]\(([a-z0-9-]+)\.md\)/u;
const CASE_AUTOLINK = /^<https:\/\/[^\s<>]+>/u;
// GitHub 的網址自動連結（http://、https://、ftp://、www. 開頭）一路延伸到空白或「<」為止，中間的 *、`、[ 與像條號的字都算進網址、不排；
// 說明書照字面印網址，碰到這種位置就說不準 GitHub 排不排，停。已經結束的灰底框、尖括號網址不算在那一段裡（GitHub 先排它們）
const URL_START = /(?:https?|ftp):\/\/|www\./iu;
const endsInUrl = (s) => URL_START.test(s.split(/[\s<]/u).pop());
// 名詞頁：GLOSSARY.md「版面約定」那一節照規矩頁的讀法（parseLegend）讀；其餘一類名詞的一項＝「**名詞**：解釋」，
// 名詞頁只認最簡單的名詞：不收 *、`、\
const GLOSSARY_LEGEND = '版面約定';
// 版面約定講的是規則書原文（RULES.md）的排法；這個網頁的規矩頁排得不一樣，規矩頁與名詞頁排版面約定時都先寫這一句
const LEGEND_WEB_NOTE = '這個網頁上：條號不帶【】、放在每一條的左上角；標籤在「把關」那一行。';
const GLOSSARY_TERM = /^\*\*([^*`\\]+)\*\*：(.*)$/u;
// 名詞頁、白話說明與優缺點的行內多認條號：A〜K 加數字、後面不緊接半形英數字（前面也不緊接，另外看；看的是原文裡同一段字的前後）
const RULE_REF = /^[A-K]\d+(?![A-Za-z0-9])/u;
// 範本跳窗開頭那一句：這一份怎麼顯示
const TEMPLATE_NOTE = {
  laid: '這一份照說明書的排法顯示（跟設定頁同一套）：只排標題、段落、表格、清單、灰底框、粗體，其他字照原文、不照 GitHub 的畫法（只有寫在符號前面、讓符號不被當成排版記號的「\\」不顯示）。',
  md: '這一份用到說明書不排的寫法，照原始檔顯示：字跟檔案裡的一樣，只是沒有排版。',
  other: '這一份不是 .md 文件，照原始檔顯示。',
};

/**
 * 排版那一套（設定頁、範本跳窗、套用頁、名詞頁、說明書手寫檔共用；行內那一半案例頁也用）認不得某一行或某個行內記號時丟的例外。設定頁、套用頁、名詞頁、案例頁、手寫檔照樣整份停下；
 * 範本跳窗只接這一種、改成照原始檔顯示——其他例外（程式自己的錯）一律往外丟，說明書不產生。
 */
class LayoutError extends Error {}
// 分類只說「標籤裡列了哪種把關」，不說守到多少：機器守到哪裡寫在標籤冒號後面，守不到的寫在 MACHINES.md。
const KIND_TEXT = { machine: '只列機器', mixed: '機器＋靠自覺', self: '只有靠自覺' };

function esc(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/**
 * MACHINES.md、GLOSSARY.md 那種散文的行內記號：`框` 與 **粗體**，其餘一律跳脫。
 * 先把灰底框換成記號再找粗體：粗體可以把灰底框包在裡面（B1 那一列就是），先切框的話星號會原樣印出來。
 */
function mdInline(value) {
  const text = String(value);
  if (text.includes('\u0000')) throw new Error('散文裡有 NUL 字元，說明書不產生');
  const codes = [];
  const marked = text.replace(/`([^`]+)`/gu, (all, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  return esc(marked)
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(/\u0000(\d+)\u0000/gu, (all, i) => `<code>${esc(codes[Number(i)])}</code>`);
}

function segments(value, roles, what) {
  const problems = [];
  const segs = rulesBook.tokenize(value, roles, what, problems);
  if (problems.length) throw new Error(`規則資料的記號不合格：${problems.join('；')}`);
  return segs;
}

function segHtml(segs) {
  return segs
    .map((seg) => {
      if (seg.kind === 'role') return `<strong class="role">${esc(seg.value)}</strong>`;
      if (seg.kind === 'code') return `<code>${esc(seg.value)}</code>`;
      return esc(seg.value);
    })
    .join('');
}

/** 規則資料的主句、子點：照規則書產生器的切法（角色粗體／灰底框／其餘文字），這裡只換成 HTML。 */
function rich(value, roles, what) {
  return segHtml(segments(value, roles, what));
}

/**
 * MACHINES.md 最上面那張「標籤｜意思｜守不到的」表。表格這一塊＝表頭之後到第一個空行為止，
 * 這一塊裡每一行都要是「|」開頭、「|」結尾、剛好三格都有字的一列（名字不重複）；空行之後接的下一個東西
 * 要是下一節的標題（「## 」）或檔案結尾——表格後面冒出來的東西不知道算不算表格，就停下。
 */
function parseLabels(text) {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => LABEL_HEADER.test(line));
  if (at < 0) throw new Error('MACHINES.md 找不到「| 標籤 | 意思 | 守不到的 |」那張表');
  if (!TABLE_RULE.test(lines[at + 1] || '')) throw new Error(`MACHINES.md 標籤表第 ${at + 2} 行應該是分隔列（|---|---|---|）`);
  const labels = [];
  let i = at + 2;
  for (; i < lines.length && lines[i].trim(); i += 1) {
    const raw = lines[i].split('|');
    const cells = raw.slice(1, -1).map((cell) => cell.trim());
    if (!lines[i].startsWith('|') || !lines[i].trimEnd().endsWith('|') || raw.length !== 5 || cells.some((cell) => !cell)) {
      throw new Error(`MACHINES.md 標籤表第 ${i + 1} 行要剛好三格（頭尾都有「|」）、每格都有字：${lines[i]}`);
    }
    if (labels.some((label) => label.name === cells[0])) throw new Error(`MACHINES.md 標籤表第 ${i + 1} 行：「${cells[0]}」登記了兩次`);
    labels.push({ name: cells[0], meaning: cells[1], limits: cells[2] });
  }
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i < lines.length && !lines[i].startsWith('## ')) throw new Error(`MACHINES.md 第 ${i + 1} 行：標籤表之後接的不是下一節的標題（「## 」），說明書不知道它算不算表格`);
  if (!labels.some((label) => label.name === SELF)) throw new Error(`MACHINES.md 標籤表裡沒有「${SELF}」`);
  return labels;
}

/**
 * GLOSSARY.md 的「## 版面約定」：只收「開頭一段＋頂層『- 』條列」這個形狀（開頭那一段可以換行、不可以空行分成兩段）。
 * 縮排行、開頭第二段、條列後面又冒出的段落、別種條列記號、小標都丟例外——收進來會被靜靜搬位置、併段或攤平。
 */
function parseLegend(text) {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => line.trim() === '## 版面約定');
  if (at < 0) throw new Error('GLOSSARY.md 找不到「## 版面約定」');
  const lead = [];
  const bullets = [];
  let leadClosed = false;
  for (let i = at + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      if (lead.length) leadClosed = true;
      continue;
    }
    const where = `GLOSSARY.md 第 ${i + 1} 行`;
    if (/^\s/u.test(line)) throw new Error(`${where}：「## 版面約定」底下有縮排行，說明書只收頂層條列`);
    if (/^(#|\* |\+ |\d+[.)] |>)/u.test(line)) throw new Error(`${where}：「## 版面約定」底下只收開頭一段與「- 」條列`);
    if (line.startsWith('- ')) bullets.push(line.slice(2));
    else if (bullets.length) throw new Error(`${where}：條列後面又有段落，說明書不知道它該放哪裡`);
    else if (leadClosed) throw new Error(`${where}：開頭有第二段，說明書只收開頭一段`);
    else lead.push(line.trim());
  }
  if (!lead.length) throw new Error('GLOSSARY.md「## 版面約定」底下沒有開頭那一段');
  if (!bullets.length) throw new Error('GLOSSARY.md「## 版面約定」底下沒有條列');
  return { lead: lead.join(' '), bullets };
}

/** MACHINES.md 第一行的大標題（「# 」開頭）。 */
function parseMachinesTitle(text) {
  const first = text.split('\n')[0];
  if (!first.startsWith('# ') || !first.slice(2).trim()) throw new Error('MACHINES.md 第一行應該是「# 」開頭的大標題');
  return first.slice(2).trim();
}

/**
 * MACHINES.md「## 本文條目 → 機器」：標題與表頭之間的說明段落，加上那張六欄表。
 * 表格這一塊的定法跟標籤表一樣（表頭之後到第一個空行；塊內每一行都要是「|」開頭結尾、剛好六格都有字；
 * 空行之後要接下一節標題）；第一格的條號用「、」分開，像條號的（A〜K 加數字）一定要是規則裡有的條號，
 * 不像條號的（例如「案例簿」）照字面顯示。
 */
function parseMachineRows(text, ruleIds) {
  const lines = text.split('\n');
  const head = lines.findIndex((line) => line.trim() === '## 本文條目 → 機器');
  if (head < 0) throw new Error('MACHINES.md 找不到「## 本文條目 → 機器」');
  const at = lines.findIndex((line, i) => i > head && line === MACHINE_HEADER);
  if (at < 0) throw new Error('MACHINES.md「## 本文條目 → 機器」底下找不到「| 本文 | 原專案的實作 | …| 移植狀態 |」那張表');
  const intro = [];
  let introClosed = false;
  for (let k = head + 1; k < at; k += 1) {
    const line = lines[k];
    if (!line.trim()) {
      if (intro.length) introClosed = true;
      continue;
    }
    const where = `MACHINES.md 第 ${k + 1} 行`;
    if (/^\s/u.test(line) || /^(#|\||- |\* |\+ |\d+[.)] |>|<)/u.test(line)) throw new Error(`${where}：「## 本文條目 → 機器」標題與表格之間只收一段說明`);
    if (introClosed) throw new Error(`${where}：「## 本文條目 → 機器」的說明有第二段，說明書只收一段`);
    intro.push(line.trim());
  }
  if (!intro.length) throw new Error('MACHINES.md「## 本文條目 → 機器」標題與表格之間沒有說明段落');
  if (!MACHINE_RULE.test(lines[at + 1] || '')) throw new Error(`MACHINES.md 第 ${at + 2} 行應該是六欄的分隔列`);
  const rows = [];
  let i = at + 2;
  for (; i < lines.length && lines[i].trim(); i += 1) {
    const raw = lines[i].split('|');
    const cells = raw.slice(1, -1).map((cell) => cell.trim());
    if (!lines[i].startsWith('|') || !lines[i].trimEnd().endsWith('|') || raw.length !== 8 || cells.some((cell) => !cell)) {
      throw new Error(`MACHINES.md 第 ${i + 1} 行要剛好六格（頭尾都有「|」）、每格都有字`);
    }
    const keys = cells[0].split('、').map((k) => k.trim());
    if (keys.some((k) => !k)) throw new Error(`MACHINES.md 第 ${i + 1} 行：第一格有空的條號`);
    for (const k of keys) {
      if (RULE_ID.test(k) && !ruleIds.includes(k)) throw new Error(`MACHINES.md 第 ${i + 1} 行：條號 ${k} 不在規則裡`);
      if (!RULE_ID.test(k) && !NON_RULE_KEYS.includes(k)) throw new Error(`MACHINES.md 第 ${i + 1} 行：第一格的「${k}」不是規則裡的條號、也不是登記過的字面值（${NON_RULE_KEYS.join('、')}）`);
    }
    rows.push({ id: `m${rows.length + 1}`, keys, fields: cells.slice(1, 5), status: cells[5] });
  }
  // 第一格一樣的列（例如兩列都只寫 H1）在鈕與跳窗標題上要分得出來：補上「原專案的實作」裡第一個灰底框
  for (const row of rows) {
    const base = row.keys.join('、');
    const first = (row.fields[0].match(/`([^`]+)`/u) || [])[1];
    row.sub = first || '';
    row.label = rows.filter((r) => r.keys.join('、') === base).length > 1 ? `${base}：${first || row.id}` : base;
  }
  if (!rows.length) throw new Error('MACHINES.md「本文條目 → 機器」那張表沒有任何一列');
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i < lines.length && !lines[i].startsWith('## ')) throw new Error(`MACHINES.md 第 ${i + 1} 行：那張表之後接的不是下一節的標題（「## 」）`);
  return { intro: intro.join(' '), rows };
}

/** tools/ 與 tools/gates/ 底下每一支 .js 的檔頭第一句（前三行裡第一個「// 」開頭的那一行）；沒有就停。 */
function readTools(root) {
  const out = [];
  for (const dir of ['tools', 'tools/gates']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) throw new Error(`讀不到 ${dir}/：說明書不產生`);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const known = entry.isDirectory() ? dir === 'tools' && entry.name === 'gates' : entry.name.endsWith('.js') || (dir === 'tools' && TOOLS_OTHER.includes(entry.name));
      if (!known) throw new Error(`${dir}/${entry.name}：工具頁不知道它歸哪一組（認得的只有 .js、tools/gates/、${TOOLS_OTHER.join('、')}）`);
    }
    for (const name of fs.readdirSync(abs).filter((f) => f.endsWith('.js')).sort()) {
      const rel = `${dir}/${name}`;
      out.push({ path: rel, text: fs.readFileSync(path.join(abs, name), 'utf8') });
    }
  }
  return out;
}

/**
 * 工具與考題檔頭的第一句：從前三行裡第一個「// 」行起，把接著的「//」行接起來（遇到空的「//」或不是註解的行就停），
 * 取到第一個「。」為止。說明第一行沒寫完那一句的檔，接起來才是整句；讀不到「。」就停。
 * 接行時，接縫的任一邊是半形英數字、而且兩邊都不在 U+3000〜303F（中日文標點）與 U+FF00〜FFEF（全形字）這兩段，
 * 就補一個空格（「範本」接「tests/…」→「範本 tests/…」；「；」接「K1」不補）。
 */
function firstSentence(tool, page = '工具頁') {
  const lines = tool.text.split('\n');
  const start = lines.slice(0, 3).findIndex((l) => l.startsWith('// '));
  if (start < 0) throw new Error(`${tool.path} 的前三行沒有「// 」開頭的說明，${page}不知道它做什麼`);
  const para = [];
  for (let k = start; k < lines.length && lines[k].startsWith('//'); k += 1) {
    const text = lines[k].replace(/^\/\/ ?/u, '').trim();
    if (!text) break;
    para.push(text);
  }
  const joined = para.reduce((acc, line) => {
    if (!acc) return line;
    const a = acc.slice(-1);
    const b = line[0];
    const space = /[A-Za-z0-9]/u.test(a + b) && !/[\u3000-\u303F\uFF00-\uFFEF]/u.test(a + b);
    return acc + (space ? ' ' : '') + line;
  }, '');
  const sentence = joined.match(/^[^。]*。/u);
  if (!sentence) throw new Error(`${tool.path} 檔頭的第一段沒有「。」，${page}取不到完整的第一句`);
  return sentence[0];
}

/**
 * tests/manifest.json 的清單（照它的順序）與每一支的原文。清單要是不重複的檔名、跟 tests/ 底下的 .test.js 一模一樣；
 * tests/ 裡不認得的東西（清單外的檔、helpers/ 以外的資料夾）就停——考題頁不知道它算不算考題。
 */
function readTests(root) {
  const abs = path.join(root, 'tests');
  if (!fs.existsSync(abs)) throw new Error('讀不到 tests/：說明書不產生');
  const listFile = path.join(abs, 'manifest.json');
  if (!fs.existsSync(listFile)) throw new Error('讀不到 tests/manifest.json：說明書不產生');
  let list;
  try {
    list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  } catch {
    throw new Error('tests/manifest.json 不是合法的 JSON');
  }
  if (!Array.isArray(list) || !list.length || list.some((f) => typeof f !== 'string' || !/^[a-z0-9-]+\.test\.js$/u.test(f))) {
    throw new Error('tests/manifest.json 要是一串考題檔名（英文小寫、數字、「-」，以 .test.js 結尾）');
  }
  if (new Set(list).size !== list.length) throw new Error('tests/manifest.json 有重複的檔名');
  const onDisk = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === 'helpers') {
      // helpers/ 底下的檔不列；但考卷也會跑子資料夾裡的考題，那裡冒出子資料夾或像考題的程式檔就停（不知道它算不算考題）
      for (const h of fs.readdirSync(path.join(abs, 'helpers'), { withFileTypes: true })) {
        if (h.isDirectory() || HELPER_TEST_LIKE.test(h.name)) {
          throw new Error(`tests/helpers/${h.name}：考題頁不知道它算不算考題（helpers/ 底下只收一層的檔，程式檔的檔名不可以含 test）`);
        }
      }
      continue;
    }
    if (!entry.isDirectory() && TESTS_OTHER.includes(entry.name)) continue;
    if (!entry.isDirectory() && entry.name.endsWith('.test.js')) onDisk.push(entry.name);
    else throw new Error(`tests/${entry.name}：考題頁不知道它算不算考題（認得的只有清單上的 .test.js、tests/helpers/、${TESTS_OTHER.join('、')}）`);
  }
  for (const f of onDisk) if (!list.includes(f)) throw new Error(`tests/${f} 不在 tests/manifest.json 的清單上`);
  for (const f of list) if (!onDisk.includes(f)) throw new Error(`tests/manifest.json 列了 ${f}，但 tests/ 底下沒有這個檔`);
  return list.map((f) => ({ path: `tests/${f}`, text: fs.readFileSync(path.join(abs, f), 'utf8') }));
}

/**
 * templates/ 底下每一份範本的檔名與原文（照檔名排）；裡面有資料夾就停——範本頁只認一層的檔。
 * 原文要是合法的 UTF-8（不合法就停：照一般讀法會被換成「�」，跳窗就不是原文了）；開頭的 BOM 照留。
 */
function readTemplates(root) {
  const abs = path.join(root, 'templates');
  if (!fs.existsSync(abs)) throw new Error('讀不到 templates/：說明書不產生');
  const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (!entry.isFile()) throw new Error(`templates/${entry.name}：範本頁只認 templates/ 第一層的檔`);
    const bytes = fs.readFileSync(path.join(abs, entry.name));
    let text;
    try {
      text = utf8.decode(bytes);
    } catch {
      throw new Error(`templates/${entry.name} 不是合法的 UTF-8 文字：跳窗沒辦法照原文顯示，說明書不產生`);
    }
    out.push({ path: `templates/${entry.name}`, text });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * cases/：索引的說明段（index.json）與每一則案例（.md，照檔名排；README.md、DIGEST.md 是案例索引產生器產生的，不讀）。
 * 別的檔、子資料夾都停（說明書不知道它算不算案例）；不是合法的 UTF-8 也停（網頁上就不是原文了）。
 */
function readCases(root) {
  const abs = path.join(root, 'cases');
  if (!fs.existsSync(abs)) throw new Error('讀不到 cases/：說明書不產生');
  const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const decode = (name) => {
    try {
      return utf8.decode(fs.readFileSync(path.join(abs, name)));
    } catch {
      throw new Error(`cases/${name} 不是合法的 UTF-8 文字：說明書不產生`);
    }
  };
  if (!fs.existsSync(path.join(abs, 'index.json'))) throw new Error('讀不到 cases/index.json：說明書不產生');
  const files = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'README.md' || entry.name === 'DIGEST.md' || entry.name === 'index.json') continue; // README.md、DIGEST.md 是案例索引產生器的產物，不是案例
    if (!entry.isFile() || !entry.name.endsWith('.md')) throw new Error(`cases/${entry.name}：案例頁不知道它算不算案例`);
    files.push({ path: `cases/${entry.name}`, text: decode(entry.name) });
  }
  return { notes: decode('index.json'), files: files.sort((a, b) => (a.path < b.path ? -1 : 1)) };
}

/**
 * MACHINES.md「## 範本（本文指到「範本」的地方）」那一節：標題之後到下一節標題（或檔案結尾）為止，
 * 每一行要是空行、或「- `templates/…`（多份用「、」接）：說明」這個形狀；別的東西（段落、縮排續行、別種條列）就停。
 * 同一份列兩次、列了卻不在 templates/、templates/ 裡有卻沒列，都停——範本頁的內容只有這一節，沒列的範本沒有說明可放。
 * 說明裡的條號（灰底框外、A〜K 加數字）要是規則裡有的，打錯就停；說明是空白、或相鄰兩個條號之間沒有「、」「，」「；」「。」也停。
 */
function parseTemplates(text, files, ruleIds) {
  const lines = text.split('\n');
  const at = lines.indexOf(TEMPLATE_HEAD);
  if (at < 0) throw new Error(`MACHINES.md 找不到「${TEMPLATE_HEAD}」`);
  const items = [];
  const seen = [];
  for (let i = at + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    if (!lines[i].trim()) continue;
    const m = lines[i].match(TEMPLATE_ITEM);
    if (!m) throw new Error(`MACHINES.md 第 ${i + 1} 行：「範本」那一節只收「- \`templates/…\`：說明」這種條列`);
    const paths = m[1].split('、').map((x) => x.slice(1, -1));
    for (const p of paths) {
      if (seen.includes(p)) throw new Error(`MACHINES.md 第 ${i + 1} 行：${p} 在「範本」那一節列了兩次`);
      if (!files.includes(p)) throw new Error(`MACHINES.md 第 ${i + 1} 行：列了 ${p}，但 templates/ 底下沒有這個檔`);
      seen.push(p);
    }
    if (!m[2].trim()) throw new Error(`MACHINES.md 第 ${i + 1} 行：「範本」那一節的這一則沒有說明`);
    const bare = m[2].replace(/`[^`]*`/gu, ' ');
    const hits = [...bare.matchAll(/(?<![A-Za-z0-9])([A-K]\d+)(?![A-Za-z0-9])/gu)];
    const rules = [];
    hits.forEach((r, k) => {
      if (!ruleIds.includes(r[1])) throw new Error(`MACHINES.md 第 ${i + 1} 行：說明裡的條號 ${r[1]} 不在規則裡`);
      if (k > 0) {
        const gap = bare.slice(hits[k - 1].index + hits[k - 1][0].length, r.index);
        if (!RULE_SEPARATOR.test(gap)) throw new Error(`MACHINES.md 第 ${i + 1} 行：說明裡的條號 ${hits[k - 1][1]} 與 ${r[1]} 之間沒有「、」「，」「；」「。」（中間是「${gap}」），說明書不知道那是兩條還是一個範圍——請逐條用「、」分開`);
      }
      if (!rules.includes(r[1])) rules.push(r[1]);
    });
    items.push({ paths, desc: m[2], rules });
  }
  for (const f of files) if (!seen.includes(f)) throw new Error(`${f} 不在 MACHINES.md「範本」那一節：範本頁沒有它的說明（要先在那一節補一行）`);
  return { heading: TEMPLATE_HEAD.slice(3), items };
}

/**
 * 行內排版（設定頁、範本跳窗、套用頁、案例頁、名詞頁、白話說明與優缺點共用；認不得就丟 LayoutError）。設定說明產生器（tools/build-settings.js）把值裡的半形標點全寫成「\標點」，
 * 沒跳脫的記號只會來自它程式裡寫死的說明句；範本、README 與案例是人寫的，同一套規則照用。只認下面幾種、其餘可能被 GitHub 當成排版的寫法一律停（寧可多停）：
 * 「\」＋半形標點＝那個標點本身；一對反引號＝灰底框（框裡照字面；空框、頭尾有空白、連續反引號都停）；
 * 一對 **＝粗體（** 緊貼的那一側要是字、不是空白或標點，否則停）；單獨的 *、後面緊接著字而可能開始斜體的 _、
 * 後面緊接著字的 ~（刪除線）、後面緊接著半形字元的 <（HTML、連結、信箱）、後面接英文字母或 # 的 &（字元代碼）、[（連結）都停；
 * 其他字元照字面顯示——說明書不照 GitHub 的畫法（擁有者 2026-10-02 裁 a，留痕在 #28）：GitHub 另外加工的寫法（表情代碼、網址自動連結等）這裡照字面。
 * caseLinks（只有案例頁給：檔名 → 標題）：給了才多認兩種，其餘的「[」與「<」接半形字元照舊停——
 * 指到別則案例的連結 [檔名](檔名.md)（字跟檔名要一樣、那一則要在；前面緊接著沒跳脫的「!」＝GitHub 的圖片，停）排成行內的連結，
 * 字是那一則的標題、點了打開那一則；網址的自動連結 <https://…>（尖括號裡沒有空白與尖括號）照字面顯示、連尖括號，不變成連結。
 * ruleIds（名詞頁、白話說明與優缺點給：規則資料裡的條號）：灰底框外、原文裡前後不緊接半形英數字的「A〜K 加數字」排成點得到那一條規矩的行內連結，規則資料裡沒有的就停。
 * 網址（http://、https://、ftp://、www. 開頭）到下一個空白或「<」之前，又出現 *、`、[ 或像條號的字：GitHub 會把它們算進網址，停（見 URL_START）；
 * 網址從哪裡算起：上一個空白、「<」，或上一個已經結束的灰底框、尖括號網址之後（案例連結前面若有網址，到「[」就停了）。
 */
function settingsInline(text, where, caseLinks = null, ruleIds = null) {
  return inlineParts(text, where, caseLinks, ruleIds).html;
}

/** settingsInline 的本體：另外回傳最後那一段字從哪裡算起（runFrom），粗體收尾時用它看網址有沒有延伸到收尾的「**」。 */
function inlineParts(text, where, caseLinks, ruleIds) {
  let out = '';
  let i = 0;
  // 上一個照字面印出的「!」在哪（跳脫的「\!」不算）：緊接著連結就是 GitHub 的圖片
  let bang = null;
  let runFrom = 0;
  const urlHere = (k) => endsInUrl(text.slice(runFrom, k));
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1] || '';
    if (ch === '\\' && /^[!-/:-@[-`{-~]$/u.test(next)) {
      out += esc(next);
      i += 2;
    } else if (ch === '`') {
      if (urlHere(i)) throw new LayoutError(`${where}：網址後面緊接著「\`」，GitHub 會把它算進網址、不排灰底框，說明書不排`);
      if (next === '`') throw new LayoutError(`${where}：連續的反引號，說明書不排`);
      const j = text.indexOf('`', i + 1);
      if (j < 0) throw new LayoutError(`${where}：反引號沒有成對，說明書不知道灰底框到哪裡結束`);
      const code = text.slice(i + 1, j);
      if (!code || /^\s|\s$/u.test(code)) throw new LayoutError(`${where}：灰底框是空的、或頭尾有空白，說明書不排`);
      if (text[j + 1] === '`') throw new LayoutError(`${where}：連續的反引號，說明書不排`);
      out += `<code>${esc(code)}</code>`;
      i = j + 1;
      runFrom = i;
    } else if (ch === '*') {
      if (urlHere(i)) throw new LayoutError(`${where}：網址後面緊接著「*」，GitHub 會把它算進網址、不排粗體，說明書不排`);
      if (next !== '*' || text[i + 2] === '*') throw new LayoutError(`${where}：單獨的「*」或連續三個以上，GitHub 可能當成斜體，說明書不排`);
      const j = text.indexOf('**', i + 2);
      if (j < 0) throw new LayoutError(`${where}：** 沒有成對，說明書不知道粗體到哪裡結束`);
      const inner = text.slice(i + 2, j);
      if (!inner || /^[\s\p{P}\p{S}]|[\s\p{P}\p{S}]$/u.test(inner) || text[j + 2] === '*') {
        throw new LayoutError(`${where}：粗體的頭尾緊貼空白或標點（或連著三個 *），GitHub 不一定當成粗體，說明書不排`);
      }
      const sub = inlineParts(inner, where, caseLinks, ruleIds);
      if (endsInUrl(inner.slice(sub.runFrom))) throw new LayoutError(`${where}：網址後面緊接著收尾的「**」，GitHub 會把它算進網址、不排粗體，說明書不排`);
      out += `<strong>${sub.html}</strong>`;
      // 粗體裡有已經結束的灰底框之類：外面那一段從它後面算起
      if (sub.runFrom > 0) runFrom = i + 2 + sub.runFrom;
      i = j + 2;
    } else if (ch === '_' || ch === '~') {
      let k = i;
      while (text[k] === ch) k += 1;
      const before = text[i - 1];
      const after = text[k];
      const mayOpen = after !== undefined && !/\s/u.test(after) && (ch === '~' || before === undefined || /[\s\p{P}\p{S}]/u.test(before));
      if (mayOpen) throw new LayoutError(`${where}：「${ch}」後面緊接著字，GitHub 可能當成${ch === '_' ? '斜體' : '刪除線'}，說明書不排`);
      out += esc(text.slice(i, k));
      i = k;
    } else if (ch === '<' && /^[!-~]$/u.test(next)) {
      const auto = caseLinks ? text.slice(i).match(CASE_AUTOLINK) : null;
      if (!auto) throw new LayoutError(`${where}：「<」後面緊接著半形字元（英文、數字、標點），GitHub 可能當成 HTML、連結或信箱，說明書不排`);
      out += esc(auto[0]);
      i += auto[0].length;
      runFrom = i;
    } else if (ch === '&' && /^[A-Za-z#]$/u.test(next)) {
      throw new LayoutError(`${where}：「&」後面接英文字母或 #，GitHub 可能當成字元代碼，說明書不排`);
    } else if (ch === '[') {
      if (urlHere(i)) throw new LayoutError(`${where}：網址後面緊接著「[」，GitHub 會把它算進網址，說明書不排`);
      const link = caseLinks ? text.slice(i).match(CASE_LINK) : null;
      if (!link) throw new LayoutError(`${where}：「[」GitHub 可能當成連結，說明書不排`);
      if (bang === i - 1) throw new LayoutError(`${where}：「![」GitHub 會當成圖片，說明書不排`);
      if (link[1] !== link[2]) throw new LayoutError(`${where}：連結的字「${link[1]}」跟它指到的 ${link[2]}.md 不一樣，說明書不知道該顯示哪一個`);
      if (!caseLinks.has(link[1])) throw new LayoutError(`${where}：連結指到的 ${link[1]}.md 不在 cases/`);
      // 用行內的連結、不用鈕：鈕是拆不開的一整塊，標題一長整顆被推到下一行，前一行留一大片空白、「、」掉到行首
      out += `<a href="#cases" class="case-link" data-case="${link[1]}">${esc(caseLinks.get(link[1]))}</a>`;
      i += link[0].length;
    } else if (ruleIds && !/[A-Za-z0-9]/u.test(text[i - 1] || '') && RULE_REF.test(text.slice(i))) {
      const id = text.slice(i).match(RULE_REF)[0];
      if (urlHere(i)) throw new LayoutError(`${where}：網址裡有像條號的「${id}」，GitHub 會把它算進網址，說明書不知道它算不算條號`);
      if (!ruleIds.includes(id)) throw new LayoutError(`${where}：條號 ${id} 不在規則資料裡`);
      // 行內的連結、不用鈕：鈕前後都可以斷行，「、」會掉到行首（案例頁量過）
      out += `<a href="#rules" class="rule-ref" data-goto="rule-${id}">${id}</a>`;
      i += id.length;
    } else {
      if (ch === '!') bang = i;
      out += esc(ch);
      i += 1;
    }
  }
  return { html: out, runFrom };
}

/** 表格的一列切成格：沒被反斜線跳脫的「|」才是分格（設定說明產生器把值裡的「|」寫成「\|」；範本裡要放「|」也這樣寫）。 */
function tableCells(line, where) {
  if (!line.startsWith('|') || !line.endsWith('|')) throw new LayoutError(`${where}：表格的一列要「|」開頭、「|」結尾`);
  const cells = [];
  let cur = '';
  for (let i = 1; i < line.length; i += 1) {
    if (line[i] === '\\' && i + 1 < line.length) {
      cur += line[i] + line[i + 1];
      i += 1;
    } else if (line[i] === '|') {
      // 格子頭尾只去掉半形空白（GitHub 的表格也只去這種）；全形空白、不換行空白是字，照留
      cells.push(cur.replace(/^ +| +$/gu, ''));
      cur = '';
    } else {
      cur += line[i];
    }
  }
  if (cur) throw new LayoutError(`${where}：表格這一列結尾的「|」被跳脫了（\\|），這一列沒有收尾`);
  return cells;
}

// 設定說明產生器今天只產這一種分隔列；別種（冒號、少於三個 -、夾了字）一律停（範本也一樣）
const SETTINGS_TABLE_RULE = /^\|(?:---\|)+$/u;

/**
 * 段落、標題、清單項、子項的字：開頭不能是空白或沒跳脫的半形標點（GitHub 會把它讀成別的區塊），結尾不能有空白。
 * leadingBold（套用頁、名詞頁、說明書手寫檔打開）：開頭是 ** 而且後面緊接著不是空白、不是 * 的字＝粗體開頭，照收（GitHub 不會把它讀成別種區塊；粗體成不成對由行內排版再核）。
 */
function settingsText(text, where, leadingBold = false) {
  if (!text || /^\s|\s$/u.test(text)) throw new LayoutError(`${where}：字是空的、或頭尾有空白，說明書不排`);
  const boldStart = leadingBold && /^\*\*[^\s*]/u.test(text);
  if (!boldStart && /^[!-/:-@[-`{-~]/u.test(text) && !/^\\[!-/:-@[-`{-~]/u.test(text)) throw new LayoutError(`${where}：開頭是沒跳脫的半形標點（${text[0]}），GitHub 可能讀成別種區塊，說明書不排`);
  return text;
}

/** 標題結尾是沒跳脫的「#」＝GitHub 會當成標題的收尾記號拿掉，說明書不排。 */
function noClosingHash(title, where) {
  if (/(^|[^\\])#$/u.test(title)) throw new LayoutError(`${where}：標題結尾是「#」，GitHub 會把它當成標題的收尾記號拿掉，說明書不排`);
  return title;
}

/**
 * 一份 Markdown 整份讀成大標題、開頭、一節一節（設定頁、範本跳窗、套用頁、名詞頁、說明書手寫檔共用）。只認設定說明產生器今天產的這幾種行，
 * 其他一律丟 LayoutError（說明產生器的格式變了，要人先決定說明書怎麼排；範本則改成照原始檔顯示）：
 * 第一行「# 」大標題、「## 」節標題（前面空一行）、空行（真的空）、段落（一行一段）、表格（表頭、只准 |---| 的分隔列、
 * 每一列格數一樣；格子可以空，例如還沒驗過的日期）、「- 」清單、清單項底下兩格縮排、從 1 連號的「N. 」子項。
 * 區塊之間要空一行（清單接清單項、清單項接子項、表格的列除外）；兩串清單只隔一個空行也停（GitHub 會把它們當成同一串）。
 * 整份有 tab 或 \r、或任何一行結尾有空白，也停。name＝訊息裡怎麼稱呼這一份。opts：needSections＝至少要有一節（設定說明要、範本不用）；
 * lineOffset＝訊息裡的行號要加多少（套用頁從 README 中間切出一節來讀，行號照 README 的）；
 * readme＝多認三種（只有套用頁打開）：開頭是粗體的字、頂格從 1 連號的「N. 」編號清單（項目之間可以空一行；空行後接著寫下一個號碼＝同一串，
 * 寫 1＝停，GitHub 會把它們併成一串）、編號清單項底下的程式碼框（前面空一行，三個反引號＋可有可無的語言名，縮排剛好對齊那一項的字；
 * 框裡每一行至少縮排那麼多（多的照留）或是空行；去掉那個縮排之後以 0〜3 格空白加三個反引號開頭的行停（說明書不知道框到哪裡結束），
 * 多 4 格以上的照字面；收尾的三個反引號剛好對齊、後面要空一行；語言名跟三個反引號一樣是記號，不顯示）。
 * leadingBold＝只多認 readme 三種裡的第一種：開頭是粗體的字（名詞頁打開：用語對照表每一項都是粗體的名詞開頭；說明書手寫檔打開：優缺點每一項都是粗體開頭）。
 */
function parseDoc(md, name, opts = {}) {
  const { needSections = false, lineOffset = 0, readme = false, leadingBold = false } = opts;
  const at = (i) => `${name}第 ${i + 1 + lineOffset} 行`;
  const text = (t, where) => settingsText(t, where, readme || leadingBold);
  if (/[\t\r]/u.test(md)) throw new LayoutError(`${name}裡有 tab 或 \\r，說明書不排`);
  const lines = md.split('\n');
  if (!lines[0].startsWith('# ')) throw new LayoutError(`${name}第一行應該是「# 」開頭的大標題`);
  const doc = { title: noClosingHash(text(lines[0].slice(2), `${name}的大標題`), `${name}的大標題`), intro: [], sections: [] };
  let blocks = doc.intro;
  let prev = 'heading';
  let lastBlock = null;
  let table = null;
  let list = null;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const where = at(i);
    if (!line.trim()) {
      if (line) throw new LayoutError(`${where}：空行裡有空白字元`);
      prev = 'blank';
      table = null;
      list = null;
      continue;
    }
    if (/\s$/u.test(line)) throw new LayoutError(`${where}：結尾有空白`);
    if (line.startsWith('|')) {
      if (table) {
        const cells = tableCells(line, where);
        if (cells.length !== table.head.length) throw new LayoutError(`${where}：這一列 ${cells.length} 格、表頭 ${table.head.length} 格`);
        table.rows.push(cells);
      } else if (prev === 'blank' || prev === 'heading') {
        const head = tableCells(line, where);
        const rule = lines[i + 1] || '';
        if (!SETTINGS_TABLE_RULE.test(rule) || tableCells(rule, at(i + 1)).length !== head.length) {
          throw new LayoutError(`${at(i + 1)}：表頭底下應該是一樣格數的分隔列（|---|）`);
        }
        table = { kind: 'table', head, rows: [] };
        blocks.push(table);
        lastBlock = table;
        i += 1;
      } else {
        throw new LayoutError(`${where}：表格前面要空一行`);
      }
      prev = 'table';
      continue;
    }
    if (table) throw new LayoutError(`${where}：表格後面直接接了別的東西，說明書不知道它算不算表格`);
    if (readme && /^ +```/u.test(line) && prev === 'blank' && lastBlock && lastBlock.kind === 'olist') {
      const item = lastBlock.items[lastBlock.items.length - 1];
      const pad = ' '.repeat(item.n.length + 2);
      const open = line.startsWith(pad + FENCE) ? line.slice(pad.length + 3) : null;
      if (open === null || !/^[A-Za-z0-9+-]*$/u.test(open)) {
        throw new LayoutError(`${where}：程式碼框要剛好縮排 ${pad.length} 格（對齊第 ${item.n} 項的字）、三個反引號後面只准接語言名（英文字母、數字、+、-）`);
      }
      const code = [];
      let j = i + 1;
      for (; j < lines.length && lines[j] !== pad + FENCE; j += 1) {
        if (lines[j] && !lines[j].startsWith(pad)) throw new LayoutError(`${at(j)}：程式碼框裡的每一行都要縮排 ${pad.length} 格（或是空行）`);
        if (/\s$/u.test(lines[j])) throw new LayoutError(`${at(j)}：結尾有空白`);
        const content = lines[j].slice(pad.length);
        if (/^ {0,3}```/u.test(content)) throw new LayoutError(`${at(j)}：程式碼框裡又有三個反引號開頭的行，說明書不知道框到哪裡結束`);
        code.push(content);
      }
      if (j >= lines.length) throw new LayoutError(`${where}：程式碼框沒有收尾（要有一行剛好縮排 ${pad.length} 格的三個反引號）`);
      if (lines[j + 1]) throw new LayoutError(`${at(j + 1)}：程式碼框後面要空一行`);
      item.code.push(code);
      i = j;
      prev = 'code';
      continue;
    }
    const sub = line.match(/^ {2}(\d+)\. (.*)$/u);
    if (sub) {
      if (!list || list.kind !== 'list') throw new LayoutError(`${where}：子項前面要是「- 」清單`);
      const item = list.items[list.items.length - 1];
      if (sub[1] !== String(item.sub.length + 1)) throw new LayoutError(`${where}：子項要從 1 起連號、照寫成 ${item.sub.length + 1}（這裡寫的是 ${sub[1]}）`);
      const subText = text(sub[2], where);
      if (/^\d{1,9}[.)](\s|$)/u.test(subText)) throw new LayoutError(`${where}：子項的字像編號清單，GitHub 會讀成更深一層的清單，說明書不排`);
      item.sub.push(subText);
      prev = 'sub';
      continue;
    }
    const olItem = readme ? line.match(/^(\d{1,9})\. (.*)$/u) : null;
    if (olItem) {
      const itemText = text(olItem[2], where);
      if (/^\d{1,9}[.)](\s|$)/u.test(itemText)) throw new LayoutError(`${where}：編號清單項的字又像編號清單，GitHub 會讀成巢狀清單，說明書不排`);
      const same = list && list.kind === 'olist' ? list : prev === 'blank' && lastBlock && lastBlock.kind === 'olist' ? lastBlock : null;
      if (same) {
        if (olItem[1] !== String(same.items.length + 1)) throw new LayoutError(`${where}：編號清單要從 1 起連號、照寫成 ${same.items.length + 1}（這裡寫的是 ${olItem[1]}）`);
        same.items.push({ n: olItem[1], text: itemText, code: [] });
        list = same;
      } else if (prev === 'blank' || prev === 'heading') {
        if (olItem[1] !== '1') throw new LayoutError(`${where}：編號清單要從 1 起（這裡寫的是 ${olItem[1]}）`);
        list = { kind: 'olist', items: [{ n: '1', text: itemText, code: [] }] };
        blocks.push(list);
        lastBlock = list;
      } else {
        throw new LayoutError(`${where}：清單前面要空一行`);
      }
      prev = 'item';
      continue;
    }
    if (line.startsWith('- ')) {
      const itemText = text(line.slice(2), where);
      if (/^\d{1,9}[.)](\s|$)/u.test(itemText)) throw new LayoutError(`${where}：清單項的字像編號清單，GitHub 會讀成巢狀清單，說明書不排`);
      if (list && list.kind === 'list') {
        list.items.push({ text: itemText, sub: [] });
      } else if (list) {
        throw new LayoutError(`${where}：編號清單後面直接接了「- 」清單，說明書不排`);
      } else if (prev === 'blank' || prev === 'heading') {
        if (prev === 'blank' && lastBlock && lastBlock.kind === 'list') throw new LayoutError(`${where}：兩串清單之間只隔一個空行，GitHub 會把它們當成同一串，說明書不排`);
        list = { kind: 'list', items: [{ text: itemText, sub: [] }] };
        blocks.push(list);
        lastBlock = list;
      } else {
        throw new LayoutError(`${where}：清單前面要空一行`);
      }
      prev = 'item';
      continue;
    }
    if (list) throw new LayoutError(`${where}：清單後面直接接了別的東西，說明書不知道它算不算清單的一部分`);
    if (line.startsWith('## ')) {
      if (prev !== 'blank') throw new LayoutError(`${where}：節標題前面要空一行`);
      const title = noClosingHash(text(line.slice(3), where), where);
      const section = { title, blocks: [] };
      doc.sections.push(section);
      blocks = section.blocks;
      lastBlock = null;
      prev = 'heading';
      continue;
    }
    if (prev !== 'blank' && prev !== 'heading') throw new LayoutError(`${where}：段落前面要空一行（說明書一段只收一行）`);
    const paraText = text(line, where);
    if (/^\d{1,9}[.)](\s|$)/u.test(paraText)) throw new LayoutError(`${where}：段落的字像編號清單，GitHub 會讀成清單，說明書不排`);
    const para = { kind: 'p', text: paraText };
    blocks.push(para);
    lastBlock = para;
    prev = 'p';
  }
  if (needSections && !doc.sections.length) throw new LayoutError(`${name}裡沒有任何一節（「## 」）`);
  return doc;
}

/** 設定說明整份讀成一節一節（至少要有一節）。 */
function parseSettingsDoc(md) {
  return parseDoc(md, '設定說明', { needSections: true });
}

/**
 * 標籤那一行切成段。先照規則書的切法分出角色粗體與灰底框，只在框外的文字切「；」；
 * 一段要剛好是登記名、或以「登記名：」開頭，才算新的一段，否則接回上一段
 * （E1「雲端：只驗四欄有填；角色那兩欄要填登記過的名字」的後半是同一段的續句）。
 * 第一段一定要以登記名開頭——MACHINES.md 檔頭就是這樣要求本文的。半形「;」不認，直接丟例外。
 */
function splitTag(tag, labels, roles = [], what = '標籤') {
  const names = labels.map((label) => label.name);
  const pieces = [[]];
  for (const seg of segments(tag, roles, what)) {
    if (seg.kind !== 'text') {
      pieces[pieces.length - 1].push(seg);
      continue;
    }
    if (seg.value.includes(';')) throw new Error(`${what}「${tag}」用了半形「;」：本文分段用全形「；」`);
    seg.value.split('；').forEach((part, i) => {
      if (i > 0) pieces.push([]);
      if (part) pieces[pieces.length - 1].push({ kind: 'text', value: part });
    });
  }
  const parts = [];
  for (const piece of pieces) {
    const first = piece[0] && piece[0].kind === 'text' ? piece[0].value : '';
    const name = names.find((n) => (piece.length === 1 && first === n) || first.startsWith(`${n}：`));
    if (name) {
      const restSegs = [{ kind: 'text', value: first.slice(name.length) }, ...piece.slice(1)].filter((s) => s.value);
      parts.push({ name, segs: restSegs });
    } else if (parts.length) {
      parts[parts.length - 1].segs.push({ kind: 'text', value: '；' }, ...piece);
    } else {
      throw new Error(`${what}「${tag}」不是以登記的名字開頭（登記的只有 ${names.join('、')}）`);
    }
  }
  return parts.map((part) => ({ name: part.name, rest: part.segs.map((s) => s.value).join(''), html: segHtml(part.segs) }));
}

function kindOf(parts) {
  const machine = parts.some((part) => part.name !== SELF);
  const self = parts.some((part) => part.name === SELF);
  if (machine && self) return 'mixed';
  return machine ? 'machine' : 'self';
}

/** 標籤鈕：點了打開那個標籤的意思與守不到的（規矩頁、機器頁、白話手冊共用）。 */
function labelChip(name) {
  return `<button type="button" class="chip chip-${name === SELF ? 'self' : 'machine'}" data-label="${esc(name)}">${esc(name)}</button>`;
}

/** 子點：同一層、同一種（編號或圓點）連成一份清單，第二層掛在前一個第一層底下。 */
function itemsHtml(items, roles, where) {
  const groups = [];
  let current = null;
  items.forEach((item, i) => {
    const level = item.level || 1;
    const kind = item.numbered ? 'ol' : 'ul';
    const html = rich(item.text, roles, `${where} 的第 ${i + 1} 個子點`);
    if (level === 1) {
      if (!current || current.kind !== kind) {
        current = { kind, lis: [] };
        groups.push(current);
      }
      current.lis.push({ html, children: [] });
    } else if (level === 2) {
      if (!current) throw new Error(`${where}：第二層子點前面沒有第一層`);
      const parent = current.lis[current.lis.length - 1];
      let child = parent.children[parent.children.length - 1];
      if (!child || child.kind !== kind) {
        child = { kind, lis: [] };
        parent.children.push(child);
      }
      child.lis.push(html);
    } else {
      throw new Error(`${where}：子點層級 ${level} 不認得（只有 1、2）`);
    }
  });
  return groups
    .map((g) => `<${g.kind} class="items">${g.lis
      .map((li) => `<li>${li.html}${li.children.map((c) => `<${c.kind}>${c.lis.map((x) => `<li>${x}</li>`).join('')}</${c.kind}>`).join('')}</li>`)
      .join('')}</${g.kind}>`)
    .join('');
}

function rulesPage(data, labels, legend, machineRows, tplByRule) {
  const roles = data.roles || [];
  const rules = [];
  const usedBy = {};
  const sections = data.sections.map((section) => {
    const cards = section.rules.map((rule) => {
      const id = `${section.letter}${rule.n}`;
      const parts = splitTag(rule.tag, labels, roles, `${id} 的標籤`);
      const kind = kindOf(parts);
      rules.push({ id, kind });
      for (const name of new Set(parts.map((part) => part.name))) (usedBy[name] = usedBy[name] || []).push(id);
      const tag = parts
        .map((part) => `${labelChip(part.name)}${part.html}`)
        .join('；');
      return `<article class="rule" id="rule-${id}" data-kind="${kind}" tabindex="-1">
<div class="rule-head"><span class="rule-no">${id}</span><span class="rule-kind kind-${kind}">${KIND_TEXT[kind]}</span></div>
<p class="rule-text">${rich(rule.text, roles, `${id} 的主句`)}</p>${itemsHtml(rule.items || [], roles, id)}
<p class="rule-tag"><span class="tag-lead">把關</span>${tag}</p>${machineLinks(machineRows, id)}${templateLinks(tplByRule, id)}
</article>`;
    });
    return `<section class="rule-section" id="sec-${esc(section.letter)}">
<h2><span class="sec-letter">${esc(section.letter)}</span>${esc(section.title)}<span class="sec-count">${section.rules.length} 條</span></h2>
${cards.join('\n')}
</section>`;
  });
  const count = (k) => rules.filter((r) => r.kind === k).length;
  const total = rules.length;
  const bar = ['machine', 'mixed', 'self']
    .map((k) => `<span class="bar-seg seg-${k}" style="flex-grow:${count(k)}" title="${KIND_TEXT[k]} ${count(k)} 條"></span>`)
    .join('');
  const filters = [['all', '全部', total], ['machine', KIND_TEXT.machine, count('machine')], ['mixed', KIND_TEXT.mixed, count('mixed')], ['self', KIND_TEXT.self, count('self')]]
    .map(([k, text, n], i) => `<button type="button" class="filter${i === 0 ? ' is-on' : ''}" data-filter="${k}" aria-pressed="${i === 0}">${k === 'all' ? '' : `<span class="dot seg-${k}" aria-hidden="true"></span>`}${esc(text)}<span class="num">${n}</span></button>`)
    .join('');
  const jumps = data.sections
    .map((s) => `<button type="button" class="jump" data-jump="sec-${esc(s.letter)}"><b>${esc(s.letter)}</b>${esc(s.title.replace(/（.*）$/u, ''))}</button>`)
    .join('');
  const html = `<section class="page" id="page-rules" data-page="rules" hidden>
<header class="page-head">
<p class="eyebrow">規矩本文</p>
<h1>${esc(data.title)}</h1>
<p class="page-sum">${total} 條，分 ${data.sections.length} 節（${esc(data.sections[0].letter)}〜${esc(data.sections[data.sections.length - 1].letter)}）。每一條的「把關」那一行寫這條由誰把關；點標籤看它的意思、它守不到什麼。有「範本」那一行的，列的是 MACHINES.md 範本那一節裡說明寫到這一條的範本（一則說明講好幾份的會一起列），點檔名看全文。</p>
</header>
<div class="overview">
<div class="bar" role="img" aria-label="${esc(`${KIND_TEXT.machine} ${count('machine')} 條、${KIND_TEXT.mixed} ${count('mixed')} 條、${KIND_TEXT.self} ${count('self')} 條`)}">${bar}</div>
<div class="filters" role="group" aria-label="依標籤篩選">${filters}</div>
<p class="overview-note">這三類只照每一條「把關」那一行列了哪些名字來分，不代表整條都有人守住：機器守到哪裡，看標籤冒號後面那一句；守不到什麼，點標籤看。規則書檔頭原文：${esc(data.preamble)}</p>
</div>
<nav class="jumps" aria-label="跳到某一節">${jumps}</nav>
<details class="legend"><summary>規則書原文（RULES.md）的版面約定</summary><p class="muted">${LEGEND_WEB_NOTE}</p><p>${mdInline(legend.lead)}</p><ul>${legend.bullets.map((b) => `<li>${mdInline(b)}</li>`).join('')}</ul></details>
${sections.join('\n')}
<p class="source-note">來源：套件的規則資料 rules.json（產生規則書的同一份）、MACHINES.md 的標籤表與「本文條目 → 機器」那張表（每條的機器表連結）、MACHINES.md「範本」那一節（每條的範本連結＝那一節的說明寫到這一條條號的範本）與 templates/ 底下的檔（範本全文）、GLOSSARY.md 的版面約定。</p>
</section>`;
  const labelData = {};
  for (const label of labels) {
    const ids = usedBy[label.name] || [];
    labelData[label.name] = {
      html: `<dl class="def"><dt>意思</dt><dd>${mdInline(label.meaning)}</dd><dt>守不到的</dt><dd>${mdInline(label.limits)}</dd></dl>
<p class="used">${ids.length ? `用到它的規矩（${ids.length} 條）：` : '目前沒有規矩用到它。'}${ids.map((id) => `<button type="button" class="rule-link" data-goto="rule-${id}">${id}</button>`).join('')}</p>`,
    };
  }
  return { html, labelData, counts: { total, machine: count('machine'), mixed: count('mixed'), self: count('self') } };
}

function machineLinks(rows, id) {
  const hits = rows.filter((row) => row.keys.includes(id));
  if (!hits.length) return '';
  return `\n<p class="rule-mach"><span class="tag-lead">機器表</span>${hits.map((row) => `<button type="button" class="mach-link" data-machine="${row.id}">${esc(row.label)} 那一列</button>`).join('')}</p>`;
}

/** 開範本全文跳窗的鈕：字是檔名（templates/ 只有一層，檔名不會重複）。 */
function templateButton(p) {
  return `<button type="button" class="tpl-link" data-template="${esc(p)}">${esc(p.slice('templates/'.length))}</button>`;
}

/** 規矩卡上的「範本」那一行：MACHINES.md「範本」那一節的說明寫到這一條條號的範本（照那一節的順序）；沒有就不印。 */
function templateLinks(byRule, id) {
  const paths = byRule.get(id) || [];
  if (!paths.length) return '';
  return `\n<p class="rule-tpl"><span class="tag-lead">範本</span>${paths.map(templateButton).join('')}</p>`;
}

function machinesPage(title, labels, table, ruleIds) {
  const labelDefs = labels
    .map((l) => `<div class="label-def">${labelChip(l.name)}<dl class="def"><dt>意思</dt><dd>${mdInline(l.meaning)}</dd><dt>守不到的</dt><dd>${mdInline(l.limits)}</dd></dl></div>`)
    .join('\n');
  const cards = table.rows
    .map((row) => {
      const keys = row.keys
        .map((k) => (ruleIds.includes(k) ? `<button type="button" class="rule-link" data-goto="rule-${esc(k)}">${esc(k)}</button>` : `<span class="key-plain">${esc(k)}</span>`))
        .join('');
      return `<article class="mrow" id="mach-${row.id}" tabindex="-1">
<div class="mrow-head">${keys}${row.sub ? `<code class="mrow-sub">${esc(row.sub)}</code>` : ''}</div>
<p class="mrow-status"><span class="tag-lead">移植狀態</span>${mdInline(row.status)}</p>
<button type="button" class="more" data-machine="${row.id}" aria-label="看 ${esc(row.label)} 這台機器怎麼守">看這台機器怎麼守</button>
</article>`;
    })
    .join('\n');
  const machineData = {};
  for (const row of table.rows) {
    const linked = row.keys.filter((k) => ruleIds.includes(k));
    machineData[row.id] = {
      title: `${row.label} 的機器`,
      html: `<dl class="def">${MACHINE_FIELDS.map((f, i) => `<dt>${f}</dt><dd>${mdInline(row.fields[i])}</dd>`).join('')}<dt>移植狀態</dt><dd>${mdInline(row.status)}</dd></dl>${linked.length ? `
<p class="used">這一列對到的規矩：${linked.map((k) => `<button type="button" class="rule-link" data-goto="rule-${esc(k)}">${esc(k)}</button>`).join('')}</p>` : ''}`,
    };
  }
  const html = `<section class="page" id="page-machines" data-page="machines" hidden>
<header class="page-head">
<p class="eyebrow">機器索引</p>
<h1>${esc(title)}</h1>
<p class="page-sum">標籤 ${labels.length} 種；規矩對到機器的表 ${table.rows.length} 列。點條號跳到那一條規矩，點「看這台機器怎麼守」看它怎麼做到、違反時什麼會紅、守不到什麼、要先備好什麼。</p>
</header>
<section class="block"><h2>標籤</h2><p class="muted">規矩每一條「把關」那一行用的名字，定義在這裡。</p>
${labelDefs}
</section>
<section class="block"><h2>規矩對到哪台機器</h2><p class="muted">${mdInline(table.intro)}</p>
${cards}
</section>
<p class="source-note">來源：MACHINES.md 的大標題、標籤表與「本文條目 → 機器」那張表。</p>
</section>`;
  return { html, machineData };
}

/**
 * 機器表「原專案的實作」那一欄用灰底框寫到這幾個路徑之一的列（照表的順序），一列一顆鈕；一列都沒有就寫明。
 * 「寫到」只認一個灰底框剛好放這一個路徑；那一欄沒有這種框、卻用別的寫法提到它（兩個路徑放同一個框、沒有框）就停——
 * 不然頁上會說「沒有直接寫到它」，其實有。已經有這種框的列照算，同一格別處再提（例如跑法的指令框）不停。
 */
function rowRefs(rows, paths, none = '機器表的「原專案的實作」那一欄沒有直接寫到它') {
  for (const row of rows) {
    for (const p of paths) {
      if (row.fields[0].includes(`\`${p}\``)) continue; // 已經有一個灰底框剛好放這個路徑＝這一列算寫到它，別處再提（例如寫在跑法的指令框裡）不會讓頁上漏列
      const rest = row.fields[0].split(`\`${p}\``).join(' ');
      const loose = new RegExp(`(?<![A-Za-z0-9_./-])${p.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![A-Za-z0-9_.-])`, 'u');
      if (loose.test(rest)) throw new Error(`MACHINES.md 機器表「${row.label}」那一列的「原專案的實作」提到 ${p}，但不是一個灰底框剛好放這一個路徑：說明書認不出算不算寫到它`);
    }
  }
  const hits = rows.filter((row) => paths.some((p) => row.fields[0].includes(`\`${p}\``)));
  const refs = hits.length
    ? hits.map((row) => `<button type="button" class="mach-link" data-machine="${row.id}">${esc(row.label)} 那一列</button>`).join('')
    : `<span class="muted">${none}</span>`;
  return `<p class="rule-mach"><span class="tag-lead">機器表</span>${refs}</p>`;
}

function toolsPage(tools, rows) {
  const groups = [['tools/', '工具（tools/）'], ['tools/gates/', '合併前的閘（tools/gates/）']].map(([prefix, heading]) => {
    const items = tools
      .filter((t) => t.path.startsWith(prefix) && !t.path.slice(prefix.length).includes('/'))
      .map((t) => `<article class="tool"><h3><code>${esc(t.path)}</code></h3><p>${mdInline(firstSentence(t))}</p>${rowRefs(rows, [t.path])}</article>`);
    return `<section class="block"><h2>${esc(heading)}<span class="sec-count">${items.length} 支</span></h2>\n${items.join('\n')}\n</section>`;
  });
  return `<section class="page" id="page-tools" data-page="tools" hidden>
<header class="page-head">
<p class="eyebrow">tools/ 底下的程式</p>
<h1>工具</h1>
<p class="page-sum">${tools.length} 支程式，每支一句話說它做什麼（取自它檔頭的第一句）；後面列出機器表「原專案的實作」那一欄寫到它的列，點了看那台機器怎麼守。</p>
</header>
${groups.join('\n')}
<p class="source-note">來源：tools/ 與 tools/gates/ 底下每一支 .js 的檔頭，以及 MACHINES.md「本文條目 → 機器」那張表的「原專案的實作」欄。</p>
</section>`;
}

function testsPage(tests, rows) {
  const items = tests.map((t) => `<article class="tool"><h3><code>${esc(t.path)}</code></h3><p>${mdInline(firstSentence(t, '考題頁'))}</p>${rowRefs(rows, [t.path])}</article>`);
  return `<section class="page" id="page-tests" data-page="tests" hidden>
<header class="page-head">
<p class="eyebrow">tests/ 底下的考題</p>
<h1>考題</h1>
<p class="page-sum">${tests.length} 支考題檔（照 tests/manifest.json 的清單與順序），每支一句話（取自它檔頭的第一句）；後面列出機器表「原專案的實作」那一欄寫到它的列，點了看那台機器怎麼守。</p>
</header>
<section class="block"><h2>考題檔（tests/）<span class="sec-count">${items.length} 支</span></h2>
${items.join('\n')}
</section>
<p class="source-note">來源：tests/manifest.json 的清單、每一支考題檔的檔頭，以及 MACHINES.md「本文條目 → 機器」那張表的「原專案的實作」欄。tests/helpers/ 底下的檔不列。</p>
</section>`;
}

function templatesPage(tpl, files, rows, laidOut) {
  const cards = tpl.items.map((item) => {
    const rules = item.rules.length
      ? item.rules.map((id) => `<button type="button" class="rule-link" data-goto="rule-${esc(id)}">${esc(id)}</button>`).join('')
      : '<span class="muted">說明裡沒有寫到條號</span>';
    return `<article class="tool"><h3>${item.paths.map((p) => `<code>${esc(p)}</code>`).join('、')}</h3><p>${mdInline(item.desc)}</p>
<p class="rule-tpl"><span class="tag-lead">全文</span>${item.paths.map(templateButton).join('')}</p><p class="rule-mach"><span class="tag-lead">規矩</span>${rules}</p>${rowRefs(rows, item.paths, item.paths.length > 1 ? '機器表的「原專案的實作」那一欄沒有直接寫到這幾份' : undefined)}</article>`;
  });
  return `<section class="page" id="page-templates" data-page="templates" hidden>
<header class="page-head">
<p class="eyebrow">templates/ 底下的範本</p>
<h1>範本</h1>
<p class="page-sum">${files.length} 份範本、${tpl.items.length} 則說明（取自 MACHINES.md「範本」那一節，一則可以講好幾份）。每則後面列出說明裡寫到的條號（點了跳到那一條規矩），以及機器表「原專案的實作」那一欄寫到這幾份的列。「全文」那一行點檔名看範本全文：說明書排得了的照它的排法顯示（現在 ${laidOut} 份），其餘照原始檔顯示。</p>
</header>
<section class="block"><h2>${esc(tpl.heading)}<span class="sec-count">${tpl.items.length} 則</span></h2>
${cards.join('\n')}
</section>
<p class="source-note">來源：templates/ 底下的檔（檔名與全文）、MACHINES.md「範本」那一節（說明與條號；條號只認灰底框以外、A〜K 加數字的寫法）與「本文條目 → 機器」那張表的「原專案的實作」欄。</p>
</section>`;
}

function settingsBlocksHtml(blocks, where) {
  return blocks
    .map((b, k) => {
      const at = `${where}的第 ${k + 1} 塊`;
      if (b.kind === 'p') return `<p>${settingsInline(b.text, at)}</p>`;
      if (b.kind === 'table') {
        // GitHub 的表格先把格子裡的「\|」換回「|」再排行內（灰底框裡也是），這裡照做
        const cell = (c) => settingsInline(c.split('\\|').join('|'), at);
        return `<div class="table-wrap"><table class="grid"><thead><tr>${b.head.map((c) => `<th>${cell(c)}</th>`).join('')}</tr></thead><tbody>${b.rows
          .map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`;
      }
      if (b.kind === 'olist') {
        return `<ol class="items">${b.items
          .map((it) => `<li>${settingsInline(it.text, at)}${it.code.map((c) => `<pre class="code-box"><code>${esc(c.join('\n'))}</code></pre>`).join('')}</li>`)
          .join('')}</ol>`;
      }
      return `<ul class="items">${b.items
        .map((it) => `<li>${settingsInline(it.text, at)}${it.sub.length ? `<ol>${it.sub.map((x) => `<li>${settingsInline(x, at)}</li>`).join('')}</ol>` : ''}</li>`)
        .join('')}</ul>`;
    })
    .join('\n');
}

function settingsPage(doc) {
  const titles = doc.sections.map((sec) => settingsInline(sec.title, `設定說明「${sec.title}」那一節的標題`));
  const jumps = titles
    .map((html, i) => {
      const label = html.replace(/<[^>]+>/gu, '').replace(/（.*$/u, '').trim();
      if (!label) throw new LayoutError(`設定說明第 ${i + 1} 節的標題取不出跳節鈕的字（「（」前面是空的）`);
      return `<button type="button" class="jump" data-jump="set-${i + 1}">${label}</button>`;
    })
    .join('');
  const sections = doc.sections.map((sec, i) => `<section class="block" id="set-${i + 1}" tabindex="-1">
<h2>${titles[i]}</h2>
${settingsBlocksHtml(sec.blocks, `設定說明「${sec.title}」那一節`)}
</section>`);
  return `<section class="page" id="page-settings" data-page="settings" hidden>
<header class="page-head">
<p class="eyebrow">空白設定範本</p>
<h1>設定</h1>
<p class="page-sum">新專案的設定從空白範本 tests/helpers/unfilled-settings.json 開始。下面是 tools/build-settings.js 用那份範本產生的設定說明（跟每個專案的 PROJECT-SETTINGS.md 同一個產生器），共 ${doc.sections.length} 節。</p>
</header>
<nav class="jumps" aria-label="跳到某一節">${jumps}</nav>
<div class="settings-body">
<p class="doc-title">${settingsInline(doc.title, '設定說明的大標題')}</p>
${settingsBlocksHtml(doc.intro, '設定說明開頭')}
${sections.join('\n')}
</div>
<p class="source-note">來源：tests/helpers/unfilled-settings.json（空白範本）經 tools/build-settings.js 產生的說明。這一頁不照 GitHub 的畫法：只排標題、段落、表格、清單、灰底框、粗體，其他字照原文顯示（只有寫在符號前面、讓符號不被當成排版記號的「\\」不顯示；GitHub 會把表情代碼變成圖示、網址變成連結，這裡照字面）。說明書認不得的行，以及一部分 GitHub 可能另作排版的行內記號（例如會變成斜體、HTML 的寫法），會讓整份停下不產生。</p>
</section>`;
}

/** 空白範本（原文）→ 設定說明產生器的產出（Markdown 字串）。範本不是 JSON、或產生器產不出來，都停。 */
function settingsMarkdown(templateText) {
  let data;
  try {
    data = JSON.parse(templateText);
  } catch {
    throw new Error('空白設定範本（tests/helpers/unfilled-settings.json）不是合法的 JSON');
  }
  try {
    return settingsBook.build(data);
  } catch (err) {
    throw new Error(`空白設定範本產生不出設定說明：${err.message}`);
  }
}

/** 設定說明（Markdown 字串）→ 設定頁的 HTML；讀不懂的形狀、行內記號都在這裡停。 */
function renderSettings(md) {
  return settingsPage(parseSettingsDoc(md));
}

// 套用頁從 README.md 取的兩節（照這個順序）
const ADOPT_HEADINGS = ['搬進一個專案', '專案裡改到套件的檔'];

/**
 * README.md 裡套用頁要的那兩節：「## 」開頭、標題剛好是 ADOPT_HEADINGS 那幾個字，或那幾個字後面接「（」補充；每一個都要剛好找到一行，
 * 一節到下一個「## 」（或檔案結尾）為止；那一節裡有 tab 與換行以外的控制字元就停（跟範本跳窗同一條）。
 * 每一節照設定頁那一套讀，另外打開 readme 那三種（parseDoc），訊息裡的行號照 README 的。
 */
function parseAdopt(readme) {
  const lines = readme.split('\n');
  return ADOPT_HEADINGS.map((head) => {
    const hits = lines.map((l, i) => [l, i]).filter(([l]) => l === `## ${head}` || l.startsWith(`## ${head}（`));
    if (hits.length !== 1) throw new Error(`README.md 裡標題是「${head}」的那一節要剛好一節（找到 ${hits.length} 節）：說明書不產生`);
    const at = hits[0][1];
    const next = lines.findIndex((l, i) => i > at && l.startsWith('## '));
    const body = lines.slice(at, next < 0 ? lines.length : next);
    if (CONTROL_CHARS.test(body.join('\n'))) throw new Error(`README.md「${head}」那一節裡有 tab 與換行以外的控制字元（例如 \\r、NUL）：網頁顯示不出原文，說明書不產生`);
    // 前面補一行大標題與一個空行，讓它照整份文件的規矩讀；那一節的標題在第 3 行，所以行號要加 at - 2
    return parseDoc(`# README.md\n\n${body.join('\n')}`, 'README.md ', { needSections: true, readme: true, lineOffset: at - 2 }).sections[0];
  });
}

function adoptPage(sections) {
  const titles = sections.map((sec) => settingsInline(sec.title, `README.md「${sec.title}」那一節的標題`));
  // 跳節鈕的字＝那一節的標題在「（」之前的字，照 parseAdopt 的找法剛好就是 ADOPT_HEADINGS 那幾個字
  const jumps = ADOPT_HEADINGS.map((h, i) => `<button type="button" class="jump" data-jump="adopt-${i + 1}">${esc(h)}</button>`).join('');
  const body = sections.map((sec, i) => `<section class="block" id="adopt-${i + 1}" tabindex="-1">
<h2>${titles[i]}</h2>
${settingsBlocksHtml(sec.blocks, `README.md「${sec.title}」那一節`)}
</section>`);
  return `<section class="page" id="page-adopt" data-page="adopt" hidden>
<header class="page-head">
<p class="eyebrow">README 的兩節</p>
<h1>套用</h1>
<p class="page-sum">怎麼把套件搬進一個專案、專案裡改到套件的檔要怎麼辦：下面是 README.md 的${ADOPT_HEADINGS.map((h) => `「${h}」`).join('')}這 ${sections.length} 節原文，照說明書的排法排。</p>
</header>
<nav class="jumps" aria-label="跳到某一節">${jumps}</nav>
<div class="settings-body adopt-body">
${body.join('\n')}
</div>
<p class="source-note">來源：README.md 的${ADOPT_HEADINGS.map((h) => `「${h}」`).join('')}兩節。這一頁不照 GitHub 的畫法：只排標題、段落、表格、清單（含從 1 連號的編號清單，與編號清單項底下的程式碼框）、灰底框、粗體，其他字照原文顯示（只有寫在符號前面、讓符號不被當成排版記號的「\\」，與程式碼框開頭的語言名不顯示；GitHub 會把表情代碼變成圖示、網址變成連結，這裡照字面）。說明書認不得的行，以及一部分 GitHub 可能另作排版的行內記號（例如會變成斜體、刪除線、HTML 的寫法），會讓整份停下不產生。</p>
</section>`;
}

/** README.md（原文）→ 套用頁的 HTML；認不得的形狀、行內記號都在這裡停。 */
function renderAdopt(readme) {
  return adoptPage(parseAdopt(readme));
}

/**
 * cases/index.json：索引的標題、開頭幾行、末尾幾個小節（{ title, lines }）。鍵要剛好這幾個；每一個字都要一行、非空、頭尾沒有空白，
 * 不含換行、tab、控制字元、U+2028／U+2029。案例簿的索引產生器把這些字的半形標點全部跳脫、照字面顯示，這裡也照字面。
 */
function parseCaseNotes(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('cases/index.json 不是合法的 JSON：說明書不產生');
  }
  const shape = (value, keys, what, optional = []) => {
    const ok = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).filter((k) => !optional.includes(k)).sort().join() === [...keys].sort().join();
    if (!ok) throw new Error(`cases/index.json 的${what}要剛好有 ${keys.join('、')} 這幾個鍵${optional.length ? `（另外可以有 ${optional.join('、')}）` : ''}：說明書不產生`);
    return value;
  };
  const line = (value, what) => {
    if (typeof value !== 'string' || !value || /^\s|\s$|\n/u.test(value) || CONTROL_CHARS.test(value) || CASE_HIDDEN.test(value)) {
      throw new Error(`cases/index.json 的${what}要是一行非空、頭尾沒有空白、沒有 tab 與控制字元的字：說明書不產生`);
    }
    return value;
  };
  const list = (value, what) => {
    if (!Array.isArray(value)) throw new Error(`cases/index.json 的${what}要是陣列：說明書不產生`);
    return value;
  };
  shape(data, ['title', 'intro', 'sections'], '最外層', ['digest']); // digest＝cases/DIGEST.md 的原料（案例索引產生器自己驗），案例頁不排它
  return {
    title: line(data.title, '標題'),
    intro: list(data.intro, '開頭').map((v, i) => line(v, `開頭第 ${i + 1} 行`)),
    sections: list(data.sections, '小節').map((s, k) => {
      shape(s, ['title', 'lines'], `第 ${k + 1} 個小節`);
      return { title: line(s.title, `第 ${k + 1} 個小節的標題`), lines: list(s.lines, `第 ${k + 1} 個小節的內容`).map((v, i) => line(v, `第 ${k + 1} 個小節第 ${i + 1} 行`)) };
    }),
  };
}

/**
 * 每一則案例照固定形狀讀，多一行少一行都停：第 1 行「# 標題」、第 2 行空著、接著六欄依序各一行「- 欄名：值」、最後可有一行「- 相關：值」
 * （檔尾的空行不算）。檔名要是小寫英數與連字號；值不能空、頭尾不能有空白；日期寫成 YYYY-MM-DD；本文條號寫成 A1 或 A1、B2，
 * 每一條都要在規則資料裡、不重複；標題結尾不能是「#」（GitHub 會拿掉），也不能有排版記號或連續的空白（索引、跳窗的標題、指到它的連結都顯示同一串字，
 * 瀏覽器會把連續的空白併成一個）；有 tab、控制字元或 U+2028／U+2029 就停。照日期、同一天照檔名排，檔名比字碼、不跟著機器的語系走
 * （cases/README.md 的索引產生器用跟著語系走的比法：2026-10-05 量過英文、中文等十幾種語系兩者順序一樣，立陶宛語系不一樣）。
 */
function parseCases(cases, ruleIds) {
  const notes = parseCaseNotes(cases.notes);
  const list = cases.files.map((file) => {
    const slug = file.path.slice('cases/'.length, -'.md'.length);
    if (!CASE_SLUG.test(slug)) throw new Error(`${file.path}：檔名要是小寫英數與連字號，說明書不產生`);
    if (CONTROL_CHARS.test(file.text) || CASE_HIDDEN.test(file.text)) throw new Error(`${file.path} 裡有 tab、控制字元或 U+2028／U+2029：網頁顯示不出原文，說明書不產生`);
    const lines = file.text.split('\n');
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    const at = (i) => `${file.path} 第 ${i + 1} 行`;
    if (lines.length !== CASE_FIELDS.length + 2 && lines.length !== CASE_FIELDS.length + 3) {
      throw new Error(`${file.path} 有 ${lines.length} 行：案例的固定形狀是標題、空行、${CASE_FIELDS.length} 欄，最多再加一行「${CASE_RELATED}」，說明書不產生`);
    }
    if (!lines[0].startsWith('# ')) throw new Error(`${at(0)}：要是「# 標題」`);
    const title = lines[0].slice(2);
    if (!title || /^\s|\s$/u.test(title)) throw new Error(`${at(0)}：標題是空的、或頭尾有空白`);
    if (/ {2}/u.test(title)) throw new LayoutError(`${at(0)}：標題裡有連續的空白，說明書不排——索引、跳窗的標題、指到它的連結都顯示同一串字，瀏覽器會把連續的空白併成一個`);
    noClosingHash(title, at(0));
    if (settingsInline(title, `${at(0)}的標題`) !== esc(title)) throw new LayoutError(`${at(0)}：標題裡有排版記號（灰底框、粗體、跳脫），說明書不排——索引、跳窗的標題、指到它的連結鈕都顯示同一串字`);
    if (lines[1] !== '') throw new Error(`${at(1)}：要空著`);
    const names = lines.length === CASE_FIELDS.length + 3 ? [...CASE_FIELDS, CASE_RELATED] : CASE_FIELDS;
    const fields = {};
    names.forEach((name, k) => {
      const i = k + 2;
      const head = `- ${name}：`;
      if (!lines[i].startsWith(head)) throw new Error(`${at(i)}：應該是「${head}…」`);
      const value = lines[i].slice(head.length);
      if (!value || /^\s|\s$/u.test(value)) throw new Error(`${at(i)}：「${name}」是空的、或頭尾有空白`);
      fields[name] = { value, where: at(i) };
    });
    if (!CASE_DATE.test(fields.日期.value)) throw new Error(`${fields.日期.where}：日期要寫成 YYYY-MM-DD`);
    if (!CASE_RULES.test(fields.本文條號.value)) throw new Error(`${fields.本文條號.where}：本文條號要寫成 A1 或 A1、B2`);
    const rules = fields.本文條號.value.split('、');
    for (const id of rules) if (!ruleIds.includes(id)) throw new Error(`${fields.本文條號.where}：本文條號 ${id} 不在規則資料裡`);
    if (new Set(rules).size !== rules.length) throw new Error(`${fields.本文條號.where}：本文條號有一條寫了兩次`);
    return { slug, path: file.path, title, date: fields.日期.value, rules, fields };
  });
  list.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.slug < b.slug ? -1 : 1));
  return { notes, cases: list };
}

/** 條號一顆一顆鈕，點了跳到那一條規矩（索引那一格、跳窗的「本文條號」共用）。 */
function caseRuleLinks(ids) {
  return `<span class="case-rules">${ids.map((id) => `<button type="button" class="rule-link" data-goto="rule-${id}">${id}</button>`).join('')}</span>`;
}

/**
 * 案例頁：索引的說明、照日期排的索引表（日期｜案例｜本文條號；案例的標題是開跳窗的鈕）、索引末尾的小節；
 * 每一則一筆跳窗資料（以檔名為鍵）：日期、本文條號、發生什麼、代價、教訓、來源、相關（有才有），欄位的字照案例頁的行內排版排。
 */
function casesPage(book) {
  const caseLinks = new Map(book.cases.map((c) => [c.slug, c.title]));
  const rows = book.cases.map((c) => `<tr><td>${esc(c.date)}</td><td><button type="button" class="case-link" data-case="${c.slug}">${esc(c.title)}</button></td><td>${caseRuleLinks(c.rules)}</td></tr>`);
  const caseData = {};
  for (const c of book.cases) {
    const field = (name) => `<dt>${name}</dt><dd>${settingsInline(c.fields[name].value, `${c.fields[name].where}的「${name}」`, caseLinks)}</dd>`;
    const texts = [...CASE_FIELDS.slice(2), ...(c.fields[CASE_RELATED] ? [CASE_RELATED] : [])];
    caseData[c.slug] = {
      title: c.title,
      html: `<dl class="def case-def"><dt>日期</dt><dd>${esc(c.date)}</dd><dt>本文條號</dt><dd>${caseRuleLinks(c.rules)}</dd>${texts.map(field).join('')}</dl>`,
    };
  }
  const n = book.cases.length;
  const intro = book.notes.intro.map((l) => `<p class="muted">${esc(l)}</p>`).join('\n');
  const extra = book.notes.sections.map((s) => `<section class="block"><h2>${esc(s.title)}</h2>\n${s.lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}\n</section>`);
  const html = `<section class="page" id="page-cases" data-page="cases" hidden>
<header class="page-head">
<p class="eyebrow">cases/ 底下的案例簿</p>
<h1>案例</h1>
<p class="page-sum">${n} 則案例，一則一檔，照日期排（同一天照檔名）。點標題看全文：發生什麼、代價、教訓、來源、相關；點條號跳到那一條規矩。</p>
</header>
<section class="block"><h2>${esc(book.notes.title)}<span class="sec-count">${n} 則</span></h2>
${intro}
<div class="table-wrap"><table class="grid case-index"><thead><tr><th>日期</th><th>案例</th><th>本文條號</th></tr></thead><tbody>
${rows.join('\n')}
</tbody></table></div>
</section>
${extra.join('\n')}
<p class="source-note">來源：cases/ 底下每一則案例檔（標題、六欄、「相關」）與 cases/index.json（索引的標題、開頭的說明、末尾的小節）；cases/README.md 是用同一批檔產生的索引，這一頁不讀它，自己照日期、同一天照檔名排。案例的字照說明書的排法：只排灰底框、粗體，指到別則案例的連結顯示成那一則的標題、點了打開那一則；其他字照原文顯示（只有寫在符號前面、讓符號不被當成排版記號的「\\」不顯示；GitHub 會把表情代碼變成圖示、網址變成連結，這裡照字面，用尖括號包住的網址也照字面、連尖括號）。索引的說明與小節照原文顯示。說明書認不得的寫法（例如會變成斜體、刪除線、圖片、HTML 的記號），會讓整份停下不產生。</p>
</section>`;
  return { html, caseData };
}

/** cases/ 的來源（readCases 的形狀）→ 案例頁的 HTML 與跳窗資料；認不得的形狀、行內記號都在這裡停。 */
function renderCases(cases, ruleIds) {
  return casesPage(parseCases(cases, ruleIds));
}

/**
 * GLOSSARY.md（用語對照表）→ 名詞頁要的形狀，照原文的順序。「## 版面約定」那一節照規矩頁那一套讀（parseLegend：開頭一段＋頂層條列，
 * 開頭那一段可以換行），放回它原本的位置；其餘照設定頁那一套讀（parseDoc，另外認粗體開頭的字）——讀之前把版面約定那一節
 * （從那一行到下一個「## 」）換成空行，行號照舊；後面又有一節同名的就停（規矩頁只讀第一節）。大標題底下、第一節之前不收東西。
 * 其餘每一節要是「全是段落」（照原文排成說明）或「剛好一串清單、每一項都是 **名詞**：解釋」（排成一類名詞），
 * 別的形狀（表格、子項、段落接清單、空的一節）都停。名詞結尾不能有空白（開頭的空白 parseDoc 先停）、結尾不能是網址、整份不能重複；
 * 解釋不能是空的、開頭不能是空白。整份不收 tab、控制字元、U+2028／U+2029。
 */
function parseGlossary(md) {
  if (CONTROL_CHARS.test(md) || CASE_HIDDEN.test(md)) throw new LayoutError('GLOSSARY.md 裡有 tab、控制字元或 U+2028／U+2029：網頁顯示不出原文，說明書不產生');
  const lines = md.split('\n');
  const at = lines.findIndex((line) => line.trim() === `## ${GLOSSARY_LEGEND}`);
  let legend = null;
  if (at >= 0) {
    // 放回去的位置＝它前面有幾節（parseDoc 把每一個「## 」開頭的行都當成一節，不然就停）
    legend = { ...parseLegend(md), index: lines.slice(0, at).filter((line) => line.startsWith('## ')).length };
    const end = lines.findIndex((line, i) => i > at && line.startsWith('## '));
    for (let i = at + 1; i < (end < 0 ? lines.length : end); i += 1) {
      // parseLegend 把這些行收進開頭那一段；開頭是沒跳脫的半形標點（```、~~~、<!--、---…）GitHub 會讀成別種區塊，停（跟別節同一條）
      if (lines[i].trim()) settingsText(lines[i].startsWith('- ') ? lines[i].slice(2) : lines[i], `GLOSSARY.md 第 ${i + 1} 行`, true);
    }
    for (let i = at; i < (end < 0 ? lines.length : end); i += 1) lines[i] = '';
  }
  const doc = parseDoc(lines.join('\n'), 'GLOSSARY.md ', { needSections: true, leadingBold: true });
  if (doc.intro.length) throw new LayoutError('GLOSSARY.md 大標題底下、第一節之前有東西：名詞頁不知道它算哪一節');
  if (doc.sections.some((sec) => sec.title === GLOSSARY_LEGEND)) throw new LayoutError(`GLOSSARY.md 有兩節「${GLOSSARY_LEGEND}」：規矩頁只排第一節，第二節哪一頁都不會排`);
  const seen = new Set();
  const sections = doc.sections
    .map((sec) => {
      const where = `GLOSSARY.md「${sec.title}」那一節`;
      if (sec.blocks.length && sec.blocks.every((b) => b.kind === 'p')) return { title: sec.title, kind: 'prose', paras: sec.blocks.map((b) => b.text) };
      if (sec.blocks.length !== 1 || sec.blocks[0].kind !== 'list') throw new LayoutError(`${where}要是「全是段落」或「剛好一串名詞清單」，名詞頁不知道怎麼排`);
      const terms = sec.blocks[0].items.map((item, k) => {
        const at = `${where}第 ${k + 1} 項`;
        if (item.sub.length) throw new LayoutError(`${at}底下有子項，名詞頁不排`);
        const m = item.text.match(GLOSSARY_TERM);
        if (!m) throw new LayoutError(`${at}不是「**名詞**：解釋」的形狀（名詞裡不收 *、\`、\\），名詞頁不排`);
        const [, term, def] = m;
        if (/\s$/u.test(term)) throw new LayoutError(`${at}：名詞結尾有空白`);
        if (endsInUrl(term)) throw new LayoutError(`${at}：名詞的結尾是網址，GitHub 會把收尾的 ** 算進網址、不排粗體，名詞頁不排`);
        if (!def || /^\s/u.test(def)) throw new LayoutError(`${at}：「${term}」的解釋是空的、或開頭是空白`);
        if (seen.has(term)) throw new LayoutError(`${at}：名詞「${term}」出現兩次`);
        seen.add(term);
        return { term, def };
      });
      return { title: sec.title, kind: 'terms', terms };
    });
  if (!sections.some((sec) => sec.kind === 'terms')) throw new LayoutError('GLOSSARY.md 裡沒有任何一類名詞');
  if (legend) sections.splice(legend.index, 0, { kind: 'legend', title: GLOSSARY_LEGEND, lead: legend.lead, bullets: legend.bullets });
  return { title: doc.title, sections };
}

const HANDBOOK_FILE = 'manual/handbook.md';
// 白話手冊一節裡每一項的開頭；寫到哪一種之後，下一項可以是哪幾種（HB_NEXT[0]＝第一項；照 HB_HEADS 的順序，原文可以有好幾則、每則後面可接一則白話）
const HB_HEADS = ['一句話：', '原文 ', '白話：', '比方：', '見名詞：'];
const HB_NEXT = [['一句話：'], ['原文 '], ['原文 ', '白話：', '比方：', '見名詞：'], ['原文 ', '比方：', '見名詞：'], ['見名詞：'], []];
const HB_ORDER = '一句話（剛好一則）→ 原文（一則以上，每則後面可接一則白話）→ 比方（最多一則）→ 見名詞（最多一則）';
const HB_QUOTE = /^原文 ([A-Z]\d+)｜核對碼 ([0-9a-f]{8})：必含(.*)$/u;
// 白話最容易說大的四個字（規矩 J3 子點列的）：一句話、比方裡有、那一節引的原文卻都沒有，或白話裡有、它接著的那一則原文沒有，就停
const HB_ABSOLUTE = ['一律', '固定', '直到', '只有'];
// 手寫的字跟規矩原文或名詞解釋連著這麼多個字一樣＝手打了原文：原文要由產生器照條號抽，手打的那一份規矩一改就漂
const HB_COPY = 20;
// 看不見的格式字元（軟連字號、零寬空白與連接字元、左右方向記號、字連接符、BOM）：網頁上看不出來，卻能把 J3 那四個字或照抄的一段拆開，讓兩道檢查都比不到
const HB_INVISIBLE = /[\u00AD\u200B-\u200F\u2060\uFEFF]/u;
const HB_INTRO = '白話不是規矩：跟原文有出入時，以原文為準。';
const HB_NOTE = `白話手冊那一塊出自 ${HANDBOOK_FILE}：節名、一句話、白話、比方、見名詞是手寫的；原文（主句與子點）與把關標籤照條號從規則資料 rules.json 抽，排法跟規矩頁一樣。引的規矩一改（核對碼對不上），整份停下不產生，要先回原文重看白話。`;

/** 比對用的字：拿掉粗體與灰底框的記號、連續空白併成一個、去頭尾空白。 */
const hbNorm = (s) => String(s).replace(/\*\*|`/gu, '').replace(/\s+/gu, ' ').trim();
/** 規矩一條的全文（主句與每一個子點用換行接起來），照比對用的字。 */
const ruleFull = (rule) => hbNorm([rule.text, ...(rule.items || []).map((item) => item.text)].join('\n'));
const ruleMap = (rules) => new Map(rules.sections.flatMap((s) => s.rules.map((r) => [`${s.letter}${r.n}`, r])));

/**
 * 規矩一條的核對碼：全文（ruleFull）的 sha256 取前 8 個十六進位字。白話手冊每一則原文都記著它（Fable 2026-10-12 代裁 C：必含的字與核對碼都要），
 * 規矩一改就對不上、說明書停下，讀的人才知道要回去重看白話；只動空白、粗體或灰底框的記號不會變。
 */
function handbookCode(rule) {
  return crypto.createHash('sha256').update(ruleFull(rule), 'utf8').digest('hex').slice(0, 8);
}

/** 必含、見名詞那種「灰底框用『、』接」的一串：一個以上、框裡不是空的、頭尾沒有空白、拿掉記號後不是空的（只寫 ** 的必含什麼都比得到）、不重複。 */
function hbList(text, at, what) {
  if (!text) throw new LayoutError(`${at}：${what}是空的，至少要寫一個`);
  if (!/^`[^`]+`(?:、`[^`]+`)*$/u.test(text)) throw new LayoutError(`${at}：${what}要寫成灰底框、用「、」接（例如 \`字\`、\`字\`）`);
  const list = text.slice(1, -1).split('`、`');
  const bad = list.find((w) => /^\s|\s$/u.test(w));
  if (bad !== undefined) throw new LayoutError(`${at}：${what}的「${bad}」頭尾有空白`);
  const blank = list.find((w) => !hbNorm(w));
  if (blank !== undefined) throw new LayoutError(`${at}：${what}的「${blank}」拿掉粗體記號後是空的`);
  const dup = list.find((w, i) => list.indexOf(w) !== i);
  if (dup !== undefined) throw new LayoutError(`${at}：${what}的「${dup}」寫了兩次`);
  return list;
}

/**
 * manual/handbook.md（名詞頁最上面的白話手冊，手寫）。大標題與開頭那一段給維護的人看、不上網頁；開頭不是剛好一段就停。
 * 每一節＝「## 節名」底下剛好一串「- 」條列（不收子項、段落、表格），一項一行，開頭照這個順序（HB_ORDER）：
 * 「一句話：」→「原文 條號｜核對碼 八個十六進位字：必含 `字`、`字`」→「白話：」→「比方：」→「見名詞：`名詞`、`名詞`」。
 * 大標題不是「白話手冊」、有看不見的格式字元（HB_INVISIBLE）、順序不對、認不得的開頭、冒號後面是空的、同一節引同一條兩次、必含或見名詞寫法不對、
 * 節名重複或有排版記號，都停（LayoutError）。這裡只讀形狀：條號在不在、核對碼與必含對不對、名詞在不在，由 checkHandbook 看。
 */
function parseHandbook(md) {
  if (CONTROL_CHARS.test(md) || CASE_HIDDEN.test(md)) throw new LayoutError(`${HANDBOOK_FILE} 裡有 tab、控制字元或 U+2028／U+2029：網頁顯示不出原文，說明書不產生`);
  const lines = md.split('\n');
  const hidden = lines.findIndex((line) => HB_INVISIBLE.test(line));
  if (hidden >= 0) {
    const code = lines[hidden].match(HB_INVISIBLE)[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    throw new LayoutError(`${HANDBOOK_FILE} 第 ${hidden + 1} 行有看不見的格式字元 U+${code}（零寬空白、方向記號、軟連字號、BOM 這一類）：網頁上看不出來，卻會讓 J3 那四個字與照抄的檢查比不到，說明書不產生`);
  }
  const doc = parseDoc(md, `${HANDBOOK_FILE} `, { needSections: true });
  // 大標題不上網頁，但它是這份檔是什麼的記號：寫錯一個字多半是貼錯檔
  if (doc.title !== '白話手冊') throw new LayoutError(`${HANDBOOK_FILE} 的大標題要剛好是「白話手冊」（現在是「${doc.title}」）`);
  if (doc.intro.length !== 1 || doc.intro[0].kind !== 'p') throw new LayoutError(`${HANDBOOK_FILE} 大標題底下、第一節之前要剛好一段（給維護的人看的說明，不上網頁）：多寫的字不知道該排到哪裡`);
  const names = [];
  return doc.sections.map((sec, s) => {
    const where = `${HANDBOOK_FILE}「${sec.title}」那一節`;
    // 節名也是名詞那一頭回來的鈕上的字（鈕裡放不了連結與排版），所以只收純文字
    if (settingsInline(sec.title, `${where}的節名`) !== esc(sec.title)) throw new LayoutError(`${where}：節名裡有排版記號（灰底框、粗體、跳脫），說明書不排——節名也是名詞那一頭回來的鈕上的字`);
    if (names.includes(sec.title)) throw new LayoutError(`${where}出現兩次`);
    names.push(sec.title);
    if (sec.blocks.length !== 1 || sec.blocks[0].kind !== 'list') throw new LayoutError(`${where}要剛好是一串「- 」條列（不收段落、表格）`);
    const entry = { id: `hb-${s + 1}`, name: sec.title, oneLine: '', quotes: [], analogy: '', terms: [] };
    let step = 0;
    sec.blocks[0].items.forEach((item, k) => {
      const at = `${where}第 ${k + 1} 項`;
      if (item.sub.length) throw new LayoutError(`${at}底下有子項，說明書不排`);
      const head = HB_HEADS.find((h) => item.text.startsWith(h));
      if (!head) throw new LayoutError(`${at}：開頭要是${HB_HEADS.map((h) => `「${h.slice(0, -1)}」`).join('')}其中一種`);
      const label = head.slice(0, -1);
      if (!HB_NEXT[step].includes(head)) throw new LayoutError(`${at}：「${label}」放錯位置（順序是 ${HB_ORDER}）`);
      step = HB_HEADS.indexOf(head) + 1;
      const body = item.text.slice(head.length);
      if (head === '原文 ') {
        const m = item.text.match(HB_QUOTE);
        if (!m || (m[3] && !m[3].startsWith(' '))) throw new LayoutError(`${at}：原文那一項要寫成「原文 條號｜核對碼 八個十六進位字：必含 \`字\`、\`字\`」`);
        if (entry.quotes.some((q) => q.id === m[1])) throw new LayoutError(`${where}：同一節引了 ${m[1]} 兩次`);
        entry.quotes.push({ id: m[1], code: m[2], must: hbList(m[3].slice(1), `${at}（${m[1]}）`, '必含'), plain: '' });
      } else if (head === '見名詞：') {
        entry.terms = hbList(body, at, '見名詞');
      } else {
        if (!body || /^\s/u.test(body)) throw new LayoutError(`${at}：「${label}」後面是空的、或開頭是空白`);
        if (head === '一句話：') entry.oneLine = body;
        else if (head === '白話：') entry.quotes[entry.quotes.length - 1].plain = body;
        else entry.analogy = body;
      }
    });
    if (step < 2) throw new LayoutError(`${where}：至少要有「一句話」與一則「原文」`);
    return entry;
  });
}

/**
 * 白話手冊對規則資料與用語對照表的檢查（擁有者 2026-10-12 要求把手冊併進名詞頁；Fable 同日代裁 C）。照這個順序，任何一道不過就停、說明書不產生：
 * 條號不在規則資料裡；核對碼對不上（規矩改過了：一次列出每一處的條號、節名與新的核對碼）；必含的字不在那一條的原文裡；
 * J3 列的四個字：一句話、比方裡有、那一節引的原文卻都沒有，或白話裡有、它接著的那一則原文沒有（白話只講那一條）；
 * 手寫的字跟任何一條規矩的原文、任何一個名詞的解釋連著 HB_COPY 個字一樣；見名詞寫的名詞不在 GLOSSARY.md。回傳每一節，每則原文帶上規則資料裡的那一條。
 * 守不到的：核對碼只看得出原文改了、看不出白話還對不對——換碼前有沒有逐節回原文重看（J3），靠自覺；
 * 核對碼只算主句與子點的字：把關標籤（rule.tag）、子點的層級或編號改了，核對碼不變、不會停，白話裡講誰把關（機器擋、靠自覺）的句子
 * 要在標籤改的時候自己回來重看；換句話說的照抄、不到 HB_COPY 個字的照抄、沒用那四個字卻把話說大了，都看不到。
 */
function checkHandbook(entries, rules, gloss) {
  const byId = ruleMap(rules);
  const at = (e) => `${HANDBOOK_FILE}「${e.name}」那一節`;
  for (const e of entries) {
    for (const q of e.quotes) if (!byId.has(q.id)) throw new Error(`${at(e)}引的 ${q.id}：條號不在規則資料裡（刪了或改號）：這一節要照現行規矩重寫`);
  }
  const stale = entries.flatMap((e) => e.quotes.filter((q) => handbookCode(byId.get(q.id)) !== q.code).map((q) => `${q.id}（「${e.name}」那一節）：新核對碼 ${handbookCode(byId.get(q.id))}`));
  if (stale.length) throw new Error(`${HANDBOOK_FILE} 引的規矩改過了（核對碼對不上），說明書不產生：\n- ${stale.join('\n- ')}\n逐節回原文重看白話（J3），不能只換核對碼與必含的字；看完再換成新的核對碼（node manual/build.js --handbook-codes 印得出每一條現在的）。`);
  for (const e of entries) {
    for (const q of e.quotes) {
      const full = ruleFull(byId.get(q.id));
      const miss = q.must.find((w) => !full.includes(hbNorm(w)));
      if (miss !== undefined) throw new Error(`${at(e)}引的 ${q.id}：必含的「${miss}」不在原文裡`);
    }
  }
  // 每一節手寫的字（一句話、白話、比方）、訊息裡怎麼稱呼它、J3 只對照哪一條（白話＝它接著的那一則；一句話與比方是 null＝這一節引的每一則）
  const hand = (e) => [[e.oneLine, '一句話', null], ...e.quotes.filter((q) => q.plain).map((q) => [q.plain, ` ${q.id} 的白話`, q.id]), ...(e.analogy ? [[e.analogy, '比方', null]] : [])];
  for (const e of entries) {
    for (const [text, what, own] of hand(e)) {
      const ids = own ? [own] : e.quotes.map((q) => q.id);
      const quoted = ids.map((id) => ruleFull(byId.get(id))).join('\n');
      const word = HB_ABSOLUTE.find((w) => hbNorm(text).includes(w) && !quoted.includes(w));
      if (word) throw new Error(`${at(e)}的${what}有「${word}」，${own ? `這一條（${own}）的原文沒有` : `這一節引的原文（${ids.join('、')}）都沒有`}：白話不能比原文說得死（J3），改掉這個字${own ? '（白話只對照它接著的那一則原文）' : '，或改引有這個字的那一條'}`);
    }
  }
  const terms = gloss.sections.filter((sec) => sec.kind === 'terms').flatMap((sec) => sec.terms);
  const copied = new Map();
  for (const [from, text] of [...[...byId].map(([id, r]) => [`${id} 的原文`, ruleFull(r)]), ...terms.map((t) => [`名詞「${t.term}」的解釋`, hbNorm(t.def)])]) {
    const chars = Array.from(text);
    for (let i = 0; i + HB_COPY <= chars.length; i += 1) {
      const piece = chars.slice(i, i + HB_COPY).join('');
      if (!copied.has(piece)) copied.set(piece, from);
    }
  }
  for (const e of entries) {
    for (const [text, what] of hand(e)) {
      const chars = Array.from(hbNorm(text));
      for (let i = 0; i + HB_COPY <= chars.length; i += 1) {
        const piece = chars.slice(i, i + HB_COPY).join('');
        if (copied.has(piece)) throw new Error(`${at(e)}的${what}跟${copied.get(piece)}連著 ${HB_COPY} 個字一樣（「${piece}」）：原文由產生器照條號抽、不手打，白話要用自己的話寫`);
      }
    }
  }
  const names = new Set(terms.map((t) => t.term));
  for (const e of entries) {
    for (const t of e.terms) if (!names.has(t)) throw new Error(`${at(e)}的見名詞「${t}」不在 GLOSSARY.md 的名詞裡（改名或刪了）`);
  }
  return entries.map((e) => ({ ...e, quotes: e.quotes.map((q) => ({ ...q, rule: byId.get(q.id) })) }));
}

/**
 * 換核對碼用（node manual/build.js --handbook-codes）：manual/handbook.md 引到的每一條，照第一次出現的順序、不重複，一行印「條號 核對碼」。
 * 只認「- 原文 條號」開頭的行、其餘形狀不看（新加的一則還沒寫碼也印得出來）；條號不在規則資料裡就停。
 */
function handbookCodeLines(md, rules) {
  const problems = rulesBook.validate(rules);
  if (problems.length) throw new Error(`規則資料不合資料契約，印不出核對碼：\n- ${problems.join('\n- ')}`);
  const byId = ruleMap(rules);
  const ids = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^- 原文 ([^｜：\s]+)/u);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids
    .map((id) => {
      if (!byId.has(id)) throw new Error(`${HANDBOOK_FILE} 引的 ${id}：條號不在規則資料裡（刪了或改號）：這一節要照現行規矩重寫`);
      return `${id} ${handbookCode(byId.get(id))}\n`;
    })
    .join('');
}

/**
 * 名詞頁最上面的白話手冊：一節一個展開框（框上是節名與一句話）；展開是每一則原文（從規則資料抽、跟規矩頁同一套排法，條號點得到那一條）
 * 與它的白話，再來比方、每一條的把關標籤（點了看標籤的意思）、見名詞（點了跳到底下那個名詞）。手寫的字照名詞頁的行內排版。
 */
function handbookBlock(hb, inline, termIds) {
  const details = hb.entries.map((e) => {
    const where = `${HANDBOOK_FILE}「${e.name}」那一節`;
    const quotes = e.quotes.map((q) => {
      const plain = q.plain ? `\n<p class="hb-plain"><span class="tag-lead">白話</span>${inline(q.plain, `${where} ${q.id} 的白話`)}</p>` : '';
      return `<blockquote class="hb-quote"><p class="hb-src"><span class="tag-lead">原文</span>${inline(q.id, `${where}引的條號`)}</p><p class="hb-rule">${rich(q.rule.text, hb.roles, `${q.id} 的主句`)}</p>${itemsHtml(q.rule.items || [], hb.roles, q.id)}</blockquote>${plain}`;
    });
    const analogy = e.analogy ? `\n<p class="hb-analogy"><span class="tag-lead">比方</span>${inline(e.analogy, `${where}的比方`)}</p>` : '';
    const tags = e.quotes
      .map((q) => `<span class="hb-tag"><span class="hb-tag-id">${q.id}</span>${[...new Set(splitTag(q.rule.tag, hb.labels, hb.roles, `${q.id} 的標籤`).map((p) => p.name))].map(labelChip).join('')}</span>`)
      .join('');
    const terms = e.terms.length ? `\n<p class="hb-terms"><span class="tag-lead">見名詞</span>${e.terms.map((t) => `<button type="button" class="jump" data-jump="${termIds.get(t)}">${esc(t)}</button>`).join('')}</p>` : '';
    return `<details class="hb-entry" id="${e.id}" tabindex="-1">\n<summary><span class="hb-name">${esc(e.name)}</span><span class="hb-line">${inline(e.oneLine, `${where}的一句話`)}</span></summary>\n${quotes.join('\n')}${analogy}\n<p class="hb-tags"><span class="tag-lead">把關</span>${tags}</p>${terms}\n</details>`;
  });
  return `<section class="block handbook" id="hb" tabindex="-1">\n<h2>白話手冊<span class="sec-count">${hb.entries.length} 節</span></h2>\n<p class="muted">${HB_INTRO}</p>\n${details.join('\n')}\n</section>`;
}

/**
 * 一節的內文：版面約定（跟規矩頁同一句網頁上的差別、開頭一段、條列）、說明（照原文段落）、一類名詞（名詞｜解釋）。
 * mark（有白話手冊時給：名詞 → { id：名詞那一格的錨點屬性, back：解釋後面回到白話手冊的鈕 }）。
 */
function glossaryBody(sec, where, inline, mark = null) {
  if (sec.kind === 'legend') {
    return `<p class="muted">${LEGEND_WEB_NOTE}</p>\n<p>${inline(sec.lead, `${where}開頭那一段`)}</p>\n<ul class="items">${sec.bullets.map((b, k) => `<li>${inline(b, `${where}第 ${k + 1} 條`)}</li>`).join('')}</ul>`;
  }
  if (sec.kind === 'prose') return sec.paras.map((p, k) => `<p>${inline(p, `${where}第 ${k + 1} 段`)}</p>`).join('\n');
  return `<dl class="gloss">\n${sec.terms
    .map((t, k) => {
      const at = `${where}第 ${k + 1} 項「${t.term}」`;
      const m = mark ? mark(t.term) : { id: '', back: '' };
      return `<dt${m.id}><strong>${inline(t.term, `${at}的名詞`)}</strong></dt><dd>${inline(t.def, `${at}的解釋`)}${m.back}</dd>`;
    })
    .join('\n')}\n</dl>`;
}

/**
 * 名詞頁：每一節一塊（照原文的順序），字照名詞頁的行內排版（條號點得到那一條規矩）；跳節鈕只列名詞的那幾類。
 * hb（checkHandbook 回傳的每一節＋規則資料的角色與標籤表）＝最上面加白話手冊、跳節鈕最前面加一顆、頁首那一句先講最上面是白話手冊；
 * 每一個名詞一個錨點（term-1 起照原文的順序；跟展開框一樣 tabindex="-1"，跳過去時焦點落得上去），讓見名詞點得到，
 * 解釋後面再列回到白話手冊的鈕（哪幾節的見名詞寫了它）。
 */
function glossaryPage(gloss, ruleIds, hb = null) {
  const inline = (text, where) => settingsInline(text, where, null, ruleIds);
  const groups = gloss.sections.filter((sec) => sec.kind === 'terms');
  const total = groups.reduce((n, sec) => n + sec.terms.length, 0);
  const termIds = new Map(groups.flatMap((sec) => sec.terms).map((t, k) => [t.term, `term-${k + 1}`]));
  const mark = hb
    ? (term) => {
      const from = hb.entries.filter((e) => e.terms.includes(term));
      const back = from.length ? `<span class="hb-back">白話手冊：${from.map((e) => `<button type="button" class="hb-link" data-jump="${e.id}">${esc(e.name)}</button>`).join('、')}</span>` : '';
      return { id: ` id="${termIds.get(term)}" tabindex="-1"`, back };
    }
    : null;
  const blocks = gloss.sections.map((sec, i) => {
    const where = `GLOSSARY.md「${sec.title}」那一節`;
    const title = inline(sec.title, `${where}的標題`);
    const body = glossaryBody(sec, where, inline, mark);
    const count = sec.kind === 'terms' ? `<span class="sec-count">${sec.terms.length} 個</span>` : '';
    return { id: `gloss-${i + 1}`, sec, title, html: `<section class="block" id="gloss-${i + 1}" tabindex="-1">\n<h2>${title}${count}</h2>\n${body}\n</section>` };
  });
  const jumps = (hb ? '<button type="button" class="jump" data-jump="hb">白話手冊</button>' : '') + blocks
    .filter((b) => b.sec.kind === 'terms')
    .map((b) => {
      const label = b.title.replace(/<[^>]+>/gu, '').replace(/（.*$/u, '').trim();
      if (!label) throw new LayoutError(`GLOSSARY.md「${b.sec.title}」那一節的標題取不出跳節鈕的字（「（」前面是空的）`);
      return `<button type="button" class="jump" data-jump="${b.id}">${label}</button>`;
    })
    .join('');
  const html = `<section class="page" id="page-glossary" data-page="glossary" hidden>
<header class="page-head">
<p class="eyebrow">GLOSSARY.md 的名詞</p>
<h1>${inline(gloss.title, 'GLOSSARY.md 的大標題')}</h1>
<p class="page-sum">${hb ? `最上面是白話手冊（${hb.entries.length} 節，展開看原文與白話）；底下 ` : ''}${total} 個名詞，分 ${groups.length} 類，照對照表的順序。寫到的條號，點了跳到那一條規矩。</p>
</header>
<nav class="jumps" aria-label="跳到某一類">${jumps}</nav>
<div class="gloss-body">
${hb ? `${handbookBlock(hb, inline, termIds)}\n` : ''}${blocks.map((b) => b.html).join('\n')}
</div>
<p class="source-note">來源：GLOSSARY.md 整份，照原文的順序：大標題；「${GLOSSARY_LEGEND}」照規矩頁讀它的那一套讀（開頭一段＋條列）；其餘每一節，全是段落的照原文排成說明，每一項都是粗體的名詞接「：」與解釋的清單排成一類名詞。這一頁不照 GitHub 的畫法：只排灰底框、粗體、條列，條號（灰底框以外、原文裡前後不緊接半形英數字的 A〜K 加數字）排成點得到那一條規矩的連結；其他字照原文顯示（只有寫在符號前面、讓符號不被當成排版記號的「\\」，與名詞後面那個「：」（名詞與解釋分成兩欄）不顯示；GitHub 會把表情代碼變成圖示、網址變成連結，這裡照字面）。說明書認不得的寫法（例如會變成斜體、刪除線、HTML 的記號，或緊接在網址後面的排版記號），以及規則資料裡沒有的條號，會讓整份停下不產生。${hb ? HB_NOTE : ''}</p>
</section>`;
  return { html, terms: total, groups: groups.length, handbook: hb ? hb.entries.length : 0 };
}

/**
 * GLOSSARY.md（原文）→ 名詞頁的 HTML 與數字；認不得的形狀、行內記號、不在規則資料裡的條號都在這裡停。
 * hb（整份產生時給：{ md：manual/handbook.md 的原文, rules：規則資料, labels：MACHINES.md 的標籤表 }）＝最上面加白話手冊，它的形狀或檢查（checkHandbook）不過也停；
 * 不給就只排對照表。
 */
function renderGlossary(md, ruleIds, hb = null) {
  const gloss = parseGlossary(md);
  if (!hb) return glossaryPage(gloss, ruleIds);
  const entries = checkHandbook(parseHandbook(hb.md), hb.rules, gloss);
  return glossaryPage(gloss, ruleIds, { entries, roles: hb.rules.roles || [], labels: hb.labels });
}

const PLAIN_FILE = 'manual/plain.md';
const PLAIN_LISTS = ['優點', '缺點'];

/**
 * 手寫的那兩塊（擁有者 2026-09-27：說明書只有「白話說明」與「優缺點」手寫）＝manual/plain.md。
 * 大標題與開頭那一段給維護的人看、不上網頁；開頭不是剛好一段就停（多寫的字不知道該排到哪一頁）。
 * 每一頁各一節（節名＝頁名、照頁的順序，總覽也算一頁），只收段落；再來優點、缺點各一節，只收一串「- 」條列（不收子項、後面不接別的）。
 * 節多、少、重複、順序不對、空的，或寫成別種形狀，就停。
 */
function parsePlain(md) {
  if (CONTROL_CHARS.test(md) || CASE_HIDDEN.test(md)) throw new LayoutError(`${PLAIN_FILE} 裡有 tab、控制字元或 U+2028／U+2029：網頁顯示不出原文，說明書不產生`);
  const doc = parseDoc(md, `${PLAIN_FILE} `, { needSections: true, leadingBold: true });
  if (doc.intro.length !== 1 || doc.intro[0].kind !== 'p') throw new LayoutError(`${PLAIN_FILE} 大標題底下、第一節之前要剛好一段（給維護的人看的說明，不上網頁）：多寫的字不知道該排到哪一頁`);
  const want = [...PAGES.map((p) => p.name), ...PLAIN_LISTS];
  const got = doc.sections.map((sec) => sec.title);
  if (got.join('\n') !== want.join('\n')) throw new LayoutError(`${PLAIN_FILE} 的節要剛好是「${want.join('、')}」照這個順序；現在是「${got.join('、')}」`);
  const pages = new Map();
  const lists = {};
  for (const sec of doc.sections) {
    const where = `${PLAIN_FILE}「${sec.title}」那一節`;
    if (PLAIN_LISTS.includes(sec.title)) {
      if (sec.blocks.length !== 1 || sec.blocks[0].kind !== 'list') throw new LayoutError(`${where}要剛好是一串「- 」條列`);
      if (sec.blocks[0].items.some((item) => item.sub.length)) throw new LayoutError(`${where}的條列底下有子項，說明書不排`);
      lists[sec.title] = sec.blocks[0].items.map((item) => item.text);
    } else {
      if (!sec.blocks.length || sec.blocks.some((b) => b.kind !== 'p')) throw new LayoutError(`${where}要是一段以上的段落（不收條列、表格）`);
      pages.set(sec.title, sec.blocks.map((b) => b.text));
    }
  }
  return { pages, pros: lists[PLAIN_LISTS[0]], cons: lists[PLAIN_LISTS[1]] };
}

/** 總覽頁（擁有者 2026-10-05 裁 a）：開頭的白話說明照別頁的放法放（withPlain），底下是優點、缺點兩串條列；字全是手寫的。 */
function overviewPage(plain, ruleIds) {
  const list = (title, id, items) => `<section class="block pros-cons" id="${id}" tabindex="-1">\n<h2>${title}<span class="sec-count">${items.length} 項</span></h2>\n<ul class="items">${items.map((t, k) => `<li>${settingsInline(t, `${PLAIN_FILE}「${title}」第 ${k + 1} 項`, null, ruleIds)}</li>`).join('')}</ul>\n</section>`;
  return `<section class="page" id="page-overview" data-page="overview">
<header class="page-head">
<p class="eyebrow">整個套件</p>
<h1>總覽</h1>
<p class="page-sum">優點 ${plain.pros.length} 項、缺點 ${plain.cons.length} 項。這一頁的內容是手寫的，出自 ${PLAIN_FILE}。</p>
</header>
${list(PLAIN_LISTS[0], 'pros', plain.pros)}
${list(PLAIN_LISTS[1], 'cons', plain.cons)}
<p class="source-note">來源：${PLAIN_FILE} 的「${PLAIN_LISTS[0]}」「${PLAIN_LISTS[1]}」兩節。</p>
</section>`;
}

/** 把一頁的白話說明放進那一頁的開頭（標題底下、自動產生的那一句上面），來源那一行補一句它是手寫的。 */
function withPlain(html, page, paras, ruleIds) {
  const where = `${PLAIN_FILE}「${page.name}」那一節`;
  const sum = '<p class="page-sum">';
  const note = '<p class="source-note">';
  if (html.split(sum).length !== 2 || html.split(note).length !== 2) throw new LayoutError(`「${page.name}」頁的開頭說明或來源那一行不是剛好一個，白話說明不知道放哪裡`);
  const body = paras.map((p, k) => `<p>${settingsInline(p, `${where}第 ${k + 1} 段`, null, ruleIds)}</p>`).join('');
  const withIntro = html.replace(sum, () => `<div class="plain">${body}</div>\n${sum}`);
  const at = withIntro.indexOf('</p>', withIntro.indexOf(note));
  return `${withIntro.slice(0, at)}最上面那段白話說明是手寫的（${PLAIN_FILE}）。${withIntro.slice(at)}`;
}

/** 排得了的範本：大標題、開頭各塊、每一節（跳窗的標題是 h2，節標題用 h3）。 */
function templateDocHtml(doc, name) {
  const parts = [`<p class="doc-title">${settingsInline(doc.title, `${name}的大標題`)}</p>`, settingsBlocksHtml(doc.intro, `${name}開頭`)];
  for (const sec of doc.sections) {
    parts.push(`<h3>${settingsInline(sec.title, `${name}「${sec.title}」那一節的標題`)}</h3>`, settingsBlocksHtml(sec.blocks, `${name}「${sec.title}」那一節`));
  }
  return `<div class="tpl-body">\n${parts.join('\n')}\n</div>`;
}

/**
 * 一份範本在跳窗裡怎麼顯示。.md 先用設定頁那一套排（可以沒有「## 」節）：任何一行或行內記號認不得（LayoutError）
 * 就整份照原始檔顯示，不會半份排版半份原文；不是 .md 的一律照原始檔顯示。有 tab 與換行以外的控制字元就停：照原始檔也顯示不出原文。
 */
function templateView(file) {
  if (CONTROL_CHARS.test(file.text)) throw new Error(`${file.path} 裡有 tab 與換行以外的控制字元（例如 \\r、NUL）：跳窗沒辦法照原文顯示，說明書不產生`);
  if (file.path.endsWith('.md')) {
    const name = `${file.path} `;
    try {
      return { laidOut: true, html: templateDocHtml(parseDoc(file.text, name), name) };
    } catch (err) {
      if (!(err instanceof LayoutError)) throw err;
    }
  }
  return { laidOut: false, html: `<pre class="tpl-raw"><code>${esc(file.text)}</code></pre>` };
}

/** 每一份範本一筆跳窗資料（以路徑為鍵）：MACHINES.md 對它的說明（一則講好幾份的，寫明一起講哪幾份）、怎麼顯示的那一句、全文。 */
function templatePopups(files, items) {
  const itemOf = new Map();
  for (const item of items) for (const p of item.paths) itemOf.set(p, item);
  const data = {};
  let laidOut = 0;
  for (const file of files) {
    const view = templateView(file);
    if (view.laidOut) laidOut += 1;
    const note = view.laidOut ? TEMPLATE_NOTE.laid : file.path.endsWith('.md') ? TEMPLATE_NOTE.md : TEMPLATE_NOTE.other;
    const item = itemOf.get(file.path);
    const shared = item.paths.length > 1 ? `<p class="tpl-shared">這則說明一起講 ${item.paths.length} 份：${item.paths.map((p) => esc(p.slice('templates/'.length))).join('、')}。</p>\n` : '';
    data[file.path] = {
      title: file.path,
      html: `<p class="tpl-desc"><span class="tag-lead">MACHINES.md 的說明</span>${mdInline(item.desc)}</p>\n${shared}<p class="tpl-note">${note}</p>\n${view.html}`,
    };
  }
  return { data, laidOut };
}

const CSS = `
/* 版面：左側目錄＋右側閱讀欄（手機改成頂端橫向目錄）；規矩像法規條文，條號是錨點，把關標籤像印章 */
:root{
  --bg:#F3F5F2;--surface:#FFFFFF;--ink:#1C2420;--muted:#5C6862;--line:#D6DDD8;
  --accent:#1E5C55;--accent-soft:#E1EEEA;--self:#86652B;--self-soft:#F3EBDB;--code-bg:#E9EDEA;--scrim:rgba(10,14,12,.45);
  --display:"Noto Serif TC","Songti TC","PMingLiU",serif;
  --body:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#101513;--surface:#171E1B;--ink:#E3E9E5;--muted:#98A49E;--line:#2A342F;
  --accent:#6BBFB0;--accent-soft:#1B322D;--self:#D8AD62;--self-soft:#31281A;--code-bg:#212A26;--scrim:rgba(0,0,0,.62);color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#101513;--surface:#171E1B;--ink:#E3E9E5;--muted:#98A49E;--line:#2A342F;
  --accent:#6BBFB0;--accent-soft:#1B322D;--self:#D8AD62;--self-soft:#31281A;--code-bg:#212A26;--scrim:rgba(0,0,0,.62);color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.8}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.app{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:100%;
  background:linear-gradient(to right,var(--surface) 230px,var(--line) 230px,var(--line) 231px,transparent 231px)}
.side{position:sticky;top:env(safe-area-inset-top,0px);align-self:start;max-height:100vh;overflow-y:auto;
  min-width:0;padding:28px 16px}
.brand{font-family:var(--display);font-size:21px;font-weight:700;line-height:1.3;padding:0 10px 18px}
.brand small{display:block;font-family:var(--body);font-weight:400;font-size:13px;color:var(--muted);letter-spacing:.08em}
.side nav{display:flex;flex-direction:column;gap:2px}
.side nav a{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:6px;
  color:var(--ink);text-decoration:none;font-size:16px}
.side nav a:hover{background:var(--bg)}
.side nav a[aria-current="page"]{background:var(--accent-soft);color:var(--accent);font-weight:600}
.stamp{margin:22px 10px 0;font-size:12px;color:var(--muted);line-height:1.6}
main{min-width:0;padding-inline:clamp(16px,5vw,56px);padding-block:36px 96px}
.page{max-width:780px}
.page-head{display:grid;gap:6px;margin-bottom:22px}
.eyebrow{margin:0;font-size:13px;letter-spacing:.14em;color:var(--accent)}
h1{margin:0;font-family:var(--display);font-size:clamp(28px,4vw,36px);line-height:1.3;text-wrap:balance}
.page-sum{margin:0;color:var(--muted);max-width:62ch}
.plain{display:grid;gap:8px;max-width:62ch;margin:4px 0 2px;padding-left:14px;border-left:3px solid var(--accent)}
.plain p{margin:0;white-space:pre-wrap}
.pros-cons .items{max-width:62ch}
.pros-cons .items li{margin:8px 0;line-height:1.75;white-space:pre-wrap}
.overview{display:grid;gap:12px;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--surface);margin-bottom:16px}
.overview-note{margin:0;font-size:14px;line-height:1.7;color:var(--muted)}
.bar{display:flex;gap:3px;height:12px}
.bar-seg{min-width:4px;border-radius:2px}
.seg-machine{background:var(--accent)}
.seg-mixed{background:repeating-linear-gradient(135deg,var(--accent) 0 6px,var(--self) 6px 12px)}
.seg-self{background:var(--self)}
.filters{display:flex;flex-wrap:wrap;gap:8px}
.filter{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;cursor:pointer;font-size:15px}
.filter .num{font-variant-numeric:tabular-nums;color:var(--muted)}
.dot{width:10px;height:10px;border-radius:2px;flex:none}
.filter.is-on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
.jumps{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.jump{border:1px solid var(--line);background:var(--surface);border-radius:6px;padding:2px 10px;font-size:14px;cursor:pointer}
.jump b{font-family:var(--display);margin-right:4px;color:var(--accent)}
.legend{border:1px solid var(--line);border-radius:8px;padding:10px 16px;margin-bottom:28px;background:var(--surface);font-size:15px}
.legend summary{cursor:pointer;color:var(--accent)}
.legend ul{padding-left:1.2em;margin:6px 0}
.rule-section{margin-top:40px;scroll-margin-top:16px}
.rule-section h2{display:flex;align-items:baseline;gap:10px;margin:0 0 6px;padding-bottom:8px;border-bottom:2px solid var(--ink);
  font-family:var(--display);font-size:24px;text-wrap:balance}
.sec-letter{font-size:30px;color:var(--accent)}
.sec-count{margin-left:auto;font-family:var(--body);font-size:14px;font-weight:400;color:var(--muted);white-space:nowrap}
.rule{padding:20px 0 18px;border-bottom:1px solid var(--line);scroll-margin-top:16px}
.rule:focus{outline:none}
.rule:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
.rule-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.rule-no{font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:.02em}
.rule-kind{font-size:12px;letter-spacing:.06em;padding:1px 8px;border-radius:3px}
.kind-machine{background:var(--accent-soft);color:var(--accent)}
.kind-mixed{background:var(--accent-soft);color:var(--ink)}
.kind-self{background:var(--self-soft);color:var(--self)}
.rule-text{margin:0;font-size:18px;font-weight:600;line-height:1.7}
.items{margin:8px 0 0;padding-left:1.4em}
.items li{margin:2px 0}
.items ol,.items ul{padding-left:1.3em;margin:2px 0}
.rule-tag{margin:10px 0 0;font-size:15px;color:var(--muted);line-height:2}
.tag-lead{font-size:12px;letter-spacing:.1em;margin-right:8px}
.chip{border:1px solid currentColor;border-radius:3px;padding:0 8px;margin-right:2px;font-size:14px;font-weight:600;cursor:pointer;background:transparent;line-height:1.7}
.chip-machine{color:var(--accent);background:var(--accent-soft)}
.chip-self{color:var(--self);background:var(--self-soft)}
strong.role{font-weight:700}
code{font-family:var(--mono);font-size:.88em;background:var(--code-bg);padding:1px 5px;border-radius:3px;overflow-wrap:anywhere}
.source-note{margin-top:40px;font-size:13px;color:var(--muted)}
.muted{color:var(--muted);font-size:15px}
.modal{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:16px;background:var(--scrim)}
.sheet{width:min(560px,100%);max-height:85vh;overflow:auto;overscroll-behavior:contain;background:var(--surface);color:var(--ink);border-radius:10px;border:1px solid var(--line);padding:18px 20px 22px}
.sheet header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.sheet.wide{width:min(860px,100%)}
.sheet h2{margin:0;font-family:var(--display);font-size:22px;overflow-wrap:anywhere}
.close{border:1px solid var(--line);background:transparent;border-radius:6px;width:36px;height:36px;cursor:pointer;font-size:20px;line-height:1}
.def{margin:0}
.def dt{font-size:13px;letter-spacing:.1em;color:var(--muted);margin-top:10px}
.def dd{margin:2px 0 0;overflow-wrap:anywhere}
.used{margin:16px 0 0;font-size:15px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.rule-link{border:1px solid var(--line);background:var(--bg);border-radius:4px;padding:0 8px;cursor:pointer;font-family:var(--display);font-weight:700}
.block{margin-top:36px}
.block>h2{display:flex;align-items:baseline;gap:10px;margin:0 0 6px;padding-bottom:8px;border-bottom:2px solid var(--ink);font-family:var(--display);font-size:24px;text-wrap:balance}
.label-def{display:grid;grid-template-columns:7em minmax(0,1fr);gap:4px 14px;align-items:start;padding:14px 0;border-bottom:1px solid var(--line)}
.label-def .chip{justify-self:start}
.label-def .def dt:first-child{margin-top:0}
.mrow{padding:16px 0;border-bottom:1px solid var(--line);scroll-margin-top:16px;display:grid;gap:6px}
.mrow:focus{outline:none}
.mrow:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
.mrow-head{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.mrow-sub{font-size:13px;color:var(--muted)}
html.modal-open,html.modal-open body{overflow:hidden}
.key-plain{font-family:var(--display);font-weight:700;padding:0 8px;border:1px dashed var(--line);border-radius:4px}
.mrow-status{margin:0;font-size:15px;color:var(--muted)}
.more{justify-self:start;border:1px solid var(--accent);color:var(--accent);background:var(--accent-soft);border-radius:6px;padding:2px 12px;font-size:15px;cursor:pointer}
.rule-mach,.rule-tpl{margin:6px 0 0;font-size:15px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.mach-link,.tpl-link{border:1px solid var(--line);background:var(--surface);border-radius:4px;padding:0 8px;font-size:14px;cursor:pointer;color:var(--ink)}
.tpl-link{font-family:var(--mono);overflow-wrap:anywhere;text-align:left}
.tool{padding:14px 0;border-bottom:1px solid var(--line)}
.tool h3{margin:0 0 4px;font-size:16px;font-weight:600}
.tool p{margin:0}
.settings-body p,.settings-body li,.tpl-body p,.tpl-body li{overflow-wrap:anywhere}
/* 排好版的字照原文留空白：連續空白不合併（說明書不照 GitHub 的畫法，其他字照原文） */
.settings-body :is(p,li,th,td),.tpl-body :is(p,li,th,td){white-space:pre-wrap}
.settings-body .block{scroll-margin-top:16px}
.adopt-body ol.items>li{margin:10px 0}
.code-box{margin:8px 0 0;padding:10px 12px;background:var(--code-bg);border-radius:6px;font-family:var(--mono);font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.code-box code{background:none;padding:0;border-radius:0;font-size:inherit}
.settings-body .block:focus{outline:none}
.doc-title{font-weight:700;margin:0 0 8px}
.table-wrap{overflow-x:auto;margin:10px 0}
table.grid{border-collapse:collapse;font-size:15px;line-height:1.6}
table.grid th,table.grid td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top;min-width:6em}
table.grid th{background:var(--bg);font-weight:600}
.tpl-desc{margin:0 0 6px;font-size:15px;overflow-wrap:anywhere}
.tpl-shared{margin:0 0 6px;font-size:13px;color:var(--muted);overflow-wrap:anywhere}
.tpl-note{margin:0 0 14px;font-size:13px;color:var(--muted)}
.tpl-body h3{margin:18px 0 4px;font-size:17px;overflow-wrap:anywhere}
.tpl-body table.grid th,.tpl-body table.grid td{min-width:3em}
.tpl-raw{margin:0;padding:12px 14px;background:var(--code-bg);border-radius:6px;font-family:var(--mono);font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.tpl-raw code{background:none;padding:0;border-radius:0;font-size:inherit}
table.case-index{width:100%}
table.case-index th,table.case-index td{min-width:0}
table.case-index td:first-child{white-space:nowrap;font-variant-numeric:tabular-nums}
.case-rules{display:flex;flex-wrap:wrap;gap:6px}
.case-link{border:0;background:none;padding:0;color:var(--accent);text-align:left;cursor:pointer;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
/* 案例的字與索引的說明照原文留空白：連續空白不合併（跟設定頁、範本跳窗同一條） */
.case-def dd,[data-page="cases"] .block :is(h2,p){white-space:pre-wrap}
/* 名詞頁：寬的螢幕一列一個名詞（名詞｜解釋）；900px 以下（平板直放、手機）改成名詞在上、解釋在下，解釋才不會擠在窄欄裡 */
.gloss{display:grid;grid-template-columns:minmax(6em,11em) minmax(0,1fr);gap:0 18px;margin:8px 0 0}
.gloss dt,.gloss dd{margin:0;padding:10px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}
.gloss-body .block{scroll-margin-top:16px}
.gloss-body .block:focus{outline:none}
.rule-ref{color:var(--accent);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
/* 名詞、解釋、說明與版面約定照原文留空白：連續空白不合併（跟設定頁、案例頁同一條） */
.gloss :is(dt,dd),.gloss-body .block :is(h2,p,li){white-space:pre-wrap}
/* 名詞頁最上面的白話手冊：一節一個展開框；原文放引用框（主句、子點跟規矩頁同一套），手寫的字照原文留空白（跟白話說明同一條）；
   跳過去時焦點落在展開框或名詞上（給鍵盤與報讀器），不畫框線，跟名詞頁各節一樣 */
.hb-entry{border-bottom:1px solid var(--line);padding:10px 0;scroll-margin-top:16px}
.hb-entry:focus,.gloss dt:focus{outline:none}
.hb-entry summary{cursor:pointer;line-height:1.7}
.hb-name{font-weight:700;margin-right:10px}
.hb-line{color:var(--muted)}
.hb-entry :is(summary,.hb-plain,.hb-analogy){white-space:pre-wrap}
.hb-quote{margin:12px 0 0;padding:8px 14px;border-left:3px solid var(--line);background:var(--surface)}
.hb-src,.hb-rule{margin:0}
.hb-rule{font-weight:600}
.hb-plain,.hb-analogy{margin:8px 0 0;max-width:62ch}
.hb-tags,.hb-terms{margin:8px 0 0;font-size:15px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.hb-tag{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;margin-right:8px}
.hb-tag-id{font-family:var(--display);font-weight:700;color:var(--ink)}
.hb-back{display:block;margin-top:4px;font-size:14px;color:var(--muted)}
.hb-link{border:0;background:none;padding:0;color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:3px;text-align:left}
.gloss dt{scroll-margin-top:16px}
@media (max-width:900px){
  .gloss{grid-template-columns:minmax(0,1fr)}
  .gloss dt{padding-bottom:0;border-bottom:0}
  .gloss dd{padding-top:2px}
}
@media (max-width:760px){
  .app{grid-template-columns:minmax(0,1fr);background:none}
  .side{z-index:10;max-height:none;padding:10px 0 0;background:var(--surface);border-bottom:1px solid var(--line)}
  .brand{padding:0 16px 6px;font-size:18px}
  .brand small{display:inline;margin-left:8px}
  .side nav{flex-direction:row;overflow-x:auto;gap:4px;padding:0 12px 8px}
  .side nav a{flex:0 0 auto;padding:6px 12px}
  .stamp{display:none}
  main{padding-block:24px 72px}
  .rule,.rule-section,.mrow,.settings-body .block,.gloss-body .block,.hb-entry,.gloss dt{scroll-margin-top:120px}
  .label-def{grid-template-columns:minmax(0,1fr)}
  table.case-index th,table.case-index td{padding:6px 8px}
  table.case-index td:first-child{font-size:13px}
  table.case-index th:last-child{white-space:nowrap}
  table.case-index th:last-child,table.case-index td:last-child{width:1%}
}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

// 網頁上的互動。開跳窗時背後的頁面會捲回頂端（html、body 鎖住捲動），所以開的時候記下捲到哪、關掉時捲回去，
// 不靠「焦點回到原來那顆鈕」帶回去（有的瀏覽器點鈕不給焦點）；從一則案例跳到另一則時，記的仍是最早那一刻。
// 網址指到頁裡的某個位置（例如 #rule-B1；網頁自己的連結只帶頁名，這種是手打或外面貼來的）：切到它所在的那一頁、捲到它；頁名、位置都不是＝總覽。
// 名詞頁、白話說明與優缺點的條號是行內連結（<a>）：左鍵點（按著 Cmd 也一樣）、按 Enter 不照它的網址走，跟條號鈕一樣在原分頁切到規矩頁、捲到那一條；中鍵照瀏覽器的做法開新分頁，網址只帶到規矩頁。
// 白話手冊的一節收在 <details> 裡：跳到它或它裡面的東西（跳節鈕、名詞那一頭回來的鈕、網址），先展開再捲——收著的框裡的東西捲不到。
const JS = `
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var app = document.querySelector('.app');
  var pages = Array.prototype.slice.call(document.querySelectorAll('[data-page]'));
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-route]'));
  var current = null;
  var pending = null;
  function pageName(p){ return p.getAttribute('data-page'); }
  function spot(){
    var id = (location.hash || '').slice(1);
    if (!id || pages.some(function(p){ return pageName(p) === id; })) return null;
    var el = document.getElementById(id);
    return el && el.closest('[data-page]') ? el : null;
  }
  function show(id){
    if (!pages.some(function(p){ return pageName(p) === id; })) { var at = spot(); id = at ? pageName(at.closest('[data-page]')) : 'overview'; }
    var changed = id !== current;
    current = id;
    pages.forEach(function(p){ p.hidden = pageName(p) !== id; });
    links.forEach(function(a){
      if (a.getAttribute('data-route') === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    return changed;
  }
  window.addEventListener('hashchange', function(){
    if (!modal.hidden) closeModal(false);
    var changed = show((location.hash || '').slice(1) || 'overview');
    if (pending) { var target = pending; pending = null; land(target); }
    else { var at = spot(); if (at) land(at); else if (changed) window.scrollTo(0, 0); }
  });

  show((location.hash || '').slice(1) || 'overview');
  var labels = JSON.parse(document.getElementById('label-data').textContent);
  var machines = JSON.parse(document.getElementById('machine-data').textContent);
  var templates = JSON.parse(document.getElementById('template-data').textContent);
  var cases = JSON.parse(document.getElementById('case-data').textContent);
  var modal = document.getElementById('modal');
  var mTitle = document.getElementById('modal-title');
  var mBody = document.getElementById('modal-body');
  var closeBtn = modal.querySelector('.close');
  var sheet = modal.querySelector('.sheet');
  var lastFocus = null;
  var lastScroll = 0;
  function openModal(title, html, wide){
    if (modal.hidden) { lastFocus = document.activeElement; lastScroll = window.scrollY; }
    mTitle.textContent = title; mBody.innerHTML = html;
    sheet.classList.toggle('wide', !!wide);
    modal.hidden = false; app.inert = true; document.documentElement.classList.add('modal-open');
    sheet.scrollTop = 0; closeBtn.focus();
  }
  function openLabel(name){ var l = labels[name]; if (l) openModal(name, l.html); }
  function openMachine(id){ var m = machines[id]; if (m) openModal(m.title, m.html); }
  function openTemplate(p){ var x = templates[p]; if (x) openModal(x.title, x.html, true); }
  function openCase(slug){ var c = cases[slug]; if (c) openModal(c.title, c.html); }
  function closeModal(restore){
    modal.hidden = true; app.inert = false; document.documentElement.classList.remove('modal-open');
    if (restore) { window.scrollTo(0, lastScroll); if (lastFocus) lastFocus.focus({ preventScroll: true }); }
  }
  var rules = Array.prototype.slice.call(document.querySelectorAll('.rule'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.rule-section'));
  var filters = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
  function setFilter(kind){
    rules.forEach(function(r){ r.hidden = !(kind === 'all' || r.getAttribute('data-kind') === kind); });
    sections.forEach(function(s){ s.hidden = !s.querySelector('.rule:not([hidden])'); });
    filters.forEach(function(f){ var on = f.getAttribute('data-filter') === kind; f.classList.toggle('is-on', on); f.setAttribute('aria-pressed', String(on)); });
  }
  function reveal(el){
    var box = el.closest('details'); if (box) box.open = true;
    if (el.hidden || (el.closest('.rule-section') || el).hidden) setFilter('all');
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function land(el){
    reveal(el);
    el.focus({ preventScroll: true });
  }
  function goTo(id){
    var el = document.getElementById(id); if (!el) return;
    var page = el.closest('[data-page]');
    if (page && current !== pageName(page)) { pending = el; location.hash = pageName(page); return; }
    land(el);
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    var chip = t.closest('[data-label]'); if (chip) { openLabel(chip.getAttribute('data-label')); return; }
    var mach = t.closest('[data-machine]'); if (mach) { openMachine(mach.getAttribute('data-machine')); return; }
    var tp = t.closest('[data-template]'); if (tp) { openTemplate(tp.getAttribute('data-template')); return; }
    var cs = t.closest('[data-case]'); if (cs) { e.preventDefault(); openCase(cs.getAttribute('data-case')); return; }
    var go = t.closest('[data-goto]'); if (go) { e.preventDefault(); closeModal(false); goTo(go.getAttribute('data-goto')); return; }
    var f = t.closest('[data-filter]'); if (f) { setFilter(f.getAttribute('data-filter')); return; }
    var j = t.closest('[data-jump]'); if (j) { var s = document.getElementById(j.getAttribute('data-jump')); if (s) reveal(s); return; }
    if (t === modal || t.closest('.close')) closeModal(true);
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !modal.hidden) closeModal(true); });
  var first = spot(); if (first) land(first);
})();
`;

function readText(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`讀不到 ${rel}：說明書不產生`);
  return fs.readFileSync(file, 'utf8');
}

function readSources(root) {
  const read = (rel) => readText(root, rel);
  return {
    rules: JSON.parse(read('rules.json')),
    machines: read('MACHINES.md'),
    glossary: read('GLOSSARY.md'),
    tools: readTools(root),
    tests: readTests(root),
    templates: readTemplates(root),
    settingsTemplate: read('tests/helpers/unfilled-settings.json'),
    readme: read('README.md'),
    cases: readCases(root),
    plain: read(PLAIN_FILE),
    handbook: read(HANDBOOK_FILE),
  };
}

/** 回傳網頁內容（照私人網頁連結的格式：不含 doctype／html／body，發布時會自動包上）與幾個數字。 */
function build(sources, { stamp } = {}) {
  const problems = rulesBook.validate(sources.rules);
  if (problems.length) throw new Error(`規則資料不合資料契約，說明書不產生：\n- ${problems.join('\n- ')}`);
  const labels = parseLabels(sources.machines);
  const legend = parseLegend(sources.glossary);
  const ruleIds = sources.rules.sections.flatMap((s) => s.rules.map((r) => `${s.letter}${r.n}`));
  const table = parseMachineRows(sources.machines, ruleIds);
  const files = sources.templates.map((t) => t.path);
  const tpl = parseTemplates(sources.machines, files, ruleIds);
  // 每一條規矩寫到它的範本（照「範本」那一節的順序）；parseTemplates 已經擋掉同一份列兩次、一則裡的條號也不重複，所以不會重複
  const tplByRule = new Map();
  for (const item of tpl.items) {
    for (const id of item.rules) {
      const list = tplByRule.get(id) || [];
      list.push(...item.paths);
      tplByRule.set(id, list);
    }
  }
  const popups = templatePopups(sources.templates, tpl.items);
  const rules = rulesPage(sources.rules, labels, legend, table.rows, tplByRule);
  const machines = machinesPage(parseMachinesTitle(sources.machines), labels, table, ruleIds);
  const tools = toolsPage(sources.tools, table.rows);
  const tests = testsPage(sources.tests, table.rows);
  const templates = templatesPage(tpl, files, table.rows, popups.laidOut);
  const settings = renderSettings(settingsMarkdown(sources.settingsTemplate));
  const adoptSections = parseAdopt(sources.readme);
  const adopt = adoptPage(adoptSections);
  const glossary = renderGlossary(sources.glossary, ruleIds, { md: sources.handbook, rules: sources.rules, labels });
  const casebook = parseCases(sources.cases, ruleIds);
  const cases = casesPage(casebook);
  const plain = parsePlain(sources.plain);
  const pageHtml = { overview: overviewPage(plain, ruleIds), rules: rules.html, machines: machines.html, tools, tests, templates, settings, adopt, glossary: glossary.html, cases: cases.html };
  const main = PAGES.map((p) => withPlain(pageHtml[p.id], p, plain.pages.get(p.name), ruleIds)).join('\n');
  const nav = PAGES.map((p) => `<a href="#${p.id}" data-route="${p.id}"><span>${esc(p.name)}</span></a>`).join('');
  const labelJson = JSON.stringify(rules.labelData).replace(/</gu, '\\u003c');
  const machineJson = JSON.stringify(machines.machineData).replace(/</gu, '\\u003c');
  const templateJson = JSON.stringify(popups.data).replace(/</gu, '\\u003c');
  const caseJson = JSON.stringify(cases.caseData).replace(/</gu, '\\u003c');
  const html = `<title>協作套件說明書</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;700&display=swap">
<style>${CSS}</style>
<div class="app">
<aside class="side">
<div class="brand">協作套件<small>說明書</small></div>
<nav aria-label="說明書的 ${PAGES.length} 頁">${nav}</nav>
${stamp ? `<p class="stamp">產生自套件 ${esc(stamp)}</p>` : ''}
</aside>
<main>
${main}
</main>
</div>
<div class="modal" id="modal" hidden role="dialog" aria-modal="true" aria-labelledby="modal-title">
<div class="sheet"><header><h2 id="modal-title"></h2><button type="button" class="close" aria-label="關閉">×</button></header><div id="modal-body"></div></div>
</div>
<script type="application/json" id="label-data">${labelJson}</script>
<script type="application/json" id="machine-data">${machineJson}</script>
<script type="application/json" id="template-data">${templateJson}</script>
<script type="application/json" id="case-data">${caseJson}</script>
<script>${JS}</script>
`;
  return {
    html,
    counts: rules.counts,
    pages: PAGES.length,
    labels: labels.length,
    machineRows: table.rows.length,
    tools: sources.tools.length,
    tests: sources.tests.length,
    templates: sources.templates.length,
    templateItems: tpl.items.length,
    templatesLaidOut: popups.laidOut,
    adoptSections: adoptSections.length,
    glossaryTerms: glossary.terms,
    handbookEntries: glossary.handbook,
    cases: casebook.cases.length,
    plainPages: plain.pages.size,
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--out') throw new Error('產生器不自己存檔：把輸出導到套件倉庫外的檔，例如 node manual/build.js > <倉庫外的檔>');
    if (flag === '--handbook-codes') {
      out.handbookCodes = true;
      continue;
    }
    if (flag !== '--stamp') throw new Error(`不認得的參數：${flag}（只有 --stamp、--handbook-codes）`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} 後面要接值`);
    out.stamp = value;
    i += 1;
  }
  if (out.handbookCodes && out.stamp !== undefined) throw new Error('--handbook-codes 只印核對碼、不產生網頁，不跟 --stamp 一起用');
  return out;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.handbookCodes) {
      process.stdout.write(handbookCodeLines(readText(ROOT, HANDBOOK_FILE), JSON.parse(readText(ROOT, 'rules.json'))));
    } else {
      const result = build(readSources(ROOT), { stamp: args.stamp });
      process.stdout.write(result.html);
      const c = result.counts;
      process.stderr.write(`產好說明書：${result.pages} 頁（規矩 ${c.total} 條：${KIND_TEXT.machine} ${c.machine}、${KIND_TEXT.mixed} ${c.mixed}、${KIND_TEXT.self} ${c.self}；機器表 ${result.machineRows} 列；工具 ${result.tools} 支；考題 ${result.tests} 支；範本 ${result.templates} 份、${result.templateItems} 則說明、跳窗排版 ${result.templatesLaidOut} 份；套用 ${result.adoptSections} 節；名詞 ${result.glossaryTerms} 個；白話手冊 ${result.handbookEntries} 節；案例 ${result.cases} 則；白話說明 ${result.plainPages} 頁）\n`);
    }
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { parsePlain, withPlain, PLAIN_FILE, PLAIN_LISTS, parseHandbook, checkHandbook, handbookCode, handbookCodeLines, HANDBOOK_FILE, build, readSources, readTools, readTests, readTemplates, firstSentence, parseTemplates, parseSettingsDoc, renderSettings, templateView, LayoutError, parseAdopt, renderAdopt, ADOPT_HEADINGS, readCases, parseCases, renderCases, CASE_FIELDS, parseGlossary, renderGlossary, settingsInline, tableCells, NON_RULE_KEYS, parseArgs, parseLabels, parseLegend, parseMachineRows, parseMachinesTitle, splitTag, mdInline, esc, PAGES, KIND_TEXT, MACHINE_FIELDS, ROOT };
