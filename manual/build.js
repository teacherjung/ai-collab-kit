'use strict';
// 套件說明書網頁的產生器。擁有者 2026-09-27 裁：內容從套件本身自動產生，只有「白話說明」與「優缺點」手寫；
// 2026-09-30 裁：做成九頁、可以有跳窗、發成私人網頁連結（留痕在套件 #24）。
// 只給套件倉庫自己用：不在共用路徑裡（tools/kit-lock.js 的 SHARED_PATHS），不會被搬進使用專案。
// 產生器不自己存檔（擁有者 2026-09-30 裁 a）：網頁印到標準輸出、摘要印到標準錯誤，存到哪裡由跑的人指定；
// 產出不進版控＝跑的人要存到套件倉庫外（沒有機器擋，靠自覺）；合併後由實作者跑一次、發到同一個私人連結。
// 下面檢查到的來源形狀不對就丟例外、標準輸出什麼都不印：半套的說明書比沒有更糟（讀的人以為那就是全部）。
//
//   node manual/build.js [--stamp <頁尾註記，例如版本碼與日期>] > <套件倉庫外的檔>

const fs = require('node:fs');
const path = require('node:path');
const rulesBook = require('../tools/build-rules.js');

const ROOT = path.join(__dirname, '..');

// 擁有者列的九頁與順序（2026-09-30）；built＝這一支起有內容，其餘先放「準備中」。
const PAGES = [
  { id: 'rules', name: '規矩', built: true },
  { id: 'machines', name: '機器', next: '每一條規矩由哪台機器把關、把關不到什麼（機器登記表）' },
  { id: 'tools', name: '工具', next: '套件裡每一支程式，一句話說它做什麼' },
  { id: 'tests', name: '考題', next: '考題清單：每一支考題檔守什麼' },
  { id: 'templates', name: '範本', next: '每一份範本是什麼、什麼時候用' },
  { id: 'settings', name: '設定', next: '空白設定的每一欄是什麼意思、怎麼填' },
  { id: 'adopt', name: '套用', next: '怎麼把套件搬進一個專案；專案裡改到套件的檔要怎麼辦' },
  { id: 'glossary', name: '名詞', next: '用語對照表，名詞白話手冊併進來' },
  { id: 'cases', name: '案例', next: '每一則裁示背後發生過的事（案例簿）' },
];

const LABEL_HEADER = /^\| 標籤 \| 意思 \| 守不到的 \|$/u;
const TABLE_RULE = /^\|(\s*:?-+:?\s*\|){3}$/u;
const SELF = '靠自覺';
// 分類只說「標籤裡列了哪種把關」，不說守到多少：機器守到哪裡寫在標籤冒號後面，守不到的寫在 MACHINES.md。
const KIND_TEXT = { machine: '只列機器', mixed: '機器＋靠自覺', self: '只有靠自覺' };

function esc(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/** MACHINES.md、GLOSSARY.md 那種散文的行內記號：`框` 與 **粗體**，其餘一律跳脫。 */
function mdInline(value) {
  return String(value)
    .split(/(`[^`]+`)/u)
    .map((part) => {
      if (/^`[^`]+`$/u.test(part)) return `<code>${esc(part.slice(1, -1))}</code>`;
      return esc(part).replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>');
    })
    .join('');
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

function rulesPage(data, labels, legend) {
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
        .map((part) => `<button type="button" class="chip chip-${part.name === SELF ? 'self' : 'machine'}" data-label="${esc(part.name)}">${esc(part.name)}</button>${part.html}`)
        .join('；');
      return `<article class="rule" id="rule-${id}" data-kind="${kind}" tabindex="-1">
<div class="rule-head"><span class="rule-no">${id}</span><span class="rule-kind kind-${kind}">${KIND_TEXT[kind]}</span></div>
<p class="rule-text">${rich(rule.text, roles, `${id} 的主句`)}</p>${itemsHtml(rule.items || [], roles, id)}
<p class="rule-tag"><span class="tag-lead">把關</span>${tag}</p>
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
  const html = `<section class="page" id="rules" data-page>
<header class="page-head">
<p class="eyebrow">規矩本文</p>
<h1>${esc(data.title)}</h1>
<p class="page-sum">${total} 條，分 ${data.sections.length} 節（${esc(data.sections[0].letter)}〜${esc(data.sections[data.sections.length - 1].letter)}）。每一條最後一行「把關」寫這條由誰把關；點標籤看它的意思、它守不到什麼。</p>
</header>
<div class="overview">
<div class="bar" role="img" aria-label="${esc(`${KIND_TEXT.machine} ${count('machine')} 條、${KIND_TEXT.mixed} ${count('mixed')} 條、${KIND_TEXT.self} ${count('self')} 條`)}">${bar}</div>
<div class="filters" role="group" aria-label="依標籤篩選">${filters}</div>
<p class="overview-note">這三類只照每一條「把關」那一行列了哪些名字來分，不代表整條都有人守住：機器守到哪裡，看標籤冒號後面那一句；守不到什麼，點標籤看。規則書檔頭原文：${esc(data.preamble)}</p>
</div>
<nav class="jumps" aria-label="跳到某一節">${jumps}</nav>
<details class="legend"><summary>規則書原文（RULES.md）的版面約定</summary><p class="muted">這個網頁上：條號不帶【】、放在每一條的左上角；標籤在「把關」那一行。</p><p>${mdInline(legend.lead)}</p><ul>${legend.bullets.map((b) => `<li>${mdInline(b)}</li>`).join('')}</ul></details>
${sections.join('\n')}
<p class="source-note">來源：套件的規則資料 rules.json（產生規則書的同一份）、MACHINES.md 的標籤表、GLOSSARY.md 的版面約定。</p>
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

function placeholderPage(page, index) {
  return `<section class="page" id="${page.id}" data-page hidden>
<header class="page-head"><p class="eyebrow">第 ${index + 1} 頁</p><h1>${esc(page.name)}</h1></header>
<div class="pending"><p class="pending-tag">準備中</p><p>這一頁會放：${esc(page.next)}。</p><p class="muted">說明書分幾支做，每支合併後更新這個連結。</p></div>
</section>`;
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
.soon{font-size:11px;color:var(--muted);letter-spacing:.06em}
.stamp{margin:22px 10px 0;font-size:12px;color:var(--muted);line-height:1.6}
main{min-width:0;padding-inline:clamp(16px,5vw,56px);padding-block:36px 96px}
.page{max-width:780px}
.page-head{display:grid;gap:6px;margin-bottom:22px}
.eyebrow{margin:0;font-size:13px;letter-spacing:.14em;color:var(--accent)}
h1{margin:0;font-family:var(--display);font-size:clamp(28px,4vw,36px);line-height:1.3;text-wrap:balance}
.page-sum{margin:0;color:var(--muted);max-width:62ch}
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
.pending{border:1px dashed var(--line);border-radius:8px;padding:20px;background:var(--surface)}
.pending p{margin:4px 0}
.pending-tag{font-size:13px;letter-spacing:.12em;color:var(--self)}
.muted{color:var(--muted);font-size:15px}
.modal{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:16px;background:var(--scrim)}
.sheet{width:min(560px,100%);max-height:85vh;overflow:auto;background:var(--surface);color:var(--ink);border-radius:10px;border:1px solid var(--line);padding:18px 20px 22px}
.sheet header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.sheet h2{margin:0;font-family:var(--display);font-size:22px}
.close{border:1px solid var(--line);background:transparent;border-radius:6px;width:36px;height:36px;cursor:pointer;font-size:20px;line-height:1}
.def{margin:0}
.def dt{font-size:13px;letter-spacing:.1em;color:var(--muted);margin-top:10px}
.def dd{margin:2px 0 0}
.used{margin:16px 0 0;font-size:15px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.rule-link{border:1px solid var(--line);background:var(--bg);border-radius:4px;padding:0 8px;cursor:pointer;font-family:var(--display);font-weight:700}
@media (max-width:760px){
  .app{grid-template-columns:minmax(0,1fr);background:none}
  .side{z-index:10;max-height:none;padding:10px 0 0;background:var(--surface);border-bottom:1px solid var(--line)}
  .brand{padding:0 16px 6px;font-size:18px}
  .brand small{display:inline;margin-left:8px}
  .side nav{flex-direction:row;overflow-x:auto;gap:4px;padding:0 12px 8px}
  .side nav a{flex:0 0 auto;padding:6px 12px}
  .soon,.stamp{display:none}
  main{padding-block:24px 72px}
  .rule,.rule-section{scroll-margin-top:120px}
}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

const JS = `
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var app = document.querySelector('.app');
  var pages = Array.prototype.slice.call(document.querySelectorAll('[data-page]'));
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-route]'));
  var current = null;
  function show(id){
    if (!pages.some(function(p){ return p.id === id; })) id = 'rules';
    var changed = id !== current;
    current = id;
    pages.forEach(function(p){ p.hidden = p.id !== id; });
    links.forEach(function(a){
      if (a.getAttribute('data-route') === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    return changed;
  }
  window.addEventListener('hashchange', function(){
    if (show((location.hash || '').slice(1) || 'rules')) window.scrollTo(0, 0);
  });
  show((location.hash || '').slice(1) || 'rules');

  var labels = JSON.parse(document.getElementById('label-data').textContent);
  var modal = document.getElementById('modal');
  var mTitle = document.getElementById('modal-title');
  var mBody = document.getElementById('modal-body');
  var closeBtn = modal.querySelector('.close');
  var lastFocus = null;
  function openLabel(name){
    var l = labels[name]; if (!l) return;
    lastFocus = document.activeElement;
    mTitle.textContent = name; mBody.innerHTML = l.html;
    modal.hidden = false; app.inert = true; closeBtn.focus();
  }
  function closeModal(restore){
    modal.hidden = true; app.inert = false;
    if (restore && lastFocus) lastFocus.focus();
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
    if (el.hidden || (el.closest('.rule-section') || el).hidden) setFilter('all');
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function goTo(id){
    var el = document.getElementById(id); if (!el) return;
    if (current !== 'rules') { history.replaceState(null, '', '#rules'); show('rules'); }
    reveal(el);
    el.focus({ preventScroll: true });
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    var chip = t.closest('[data-label]'); if (chip) { openLabel(chip.getAttribute('data-label')); return; }
    var go = t.closest('[data-goto]'); if (go) { closeModal(false); goTo(go.getAttribute('data-goto')); return; }
    var f = t.closest('[data-filter]'); if (f) { setFilter(f.getAttribute('data-filter')); return; }
    var j = t.closest('[data-jump]'); if (j) { var s = document.getElementById(j.getAttribute('data-jump')); if (s) reveal(s); return; }
    if (t === modal || t.closest('.close')) closeModal(true);
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !modal.hidden) closeModal(true); });
})();
`;

function readSources(root) {
  const read = (rel) => {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) throw new Error(`讀不到 ${rel}：說明書不產生`);
    return fs.readFileSync(file, 'utf8');
  };
  return { rules: JSON.parse(read('rules.json')), machines: read('MACHINES.md'), glossary: read('GLOSSARY.md') };
}

/** 回傳網頁內容（照私人網頁連結的格式：不含 doctype／html／body，發布時會自動包上）與幾個數字。 */
function build(sources, { stamp } = {}) {
  const problems = rulesBook.validate(sources.rules);
  if (problems.length) throw new Error(`規則資料不合資料契約，說明書不產生：\n- ${problems.join('\n- ')}`);
  const labels = parseLabels(sources.machines);
  const legend = parseLegend(sources.glossary);
  const rules = rulesPage(sources.rules, labels, legend);
  const nav = PAGES.map((p) => `<a href="#${p.id}" data-route="${p.id}"><span>${esc(p.name)}</span>${p.built ? '' : '<span class="soon">準備中</span>'}</a>`).join('');
  const others = PAGES.map((p, i) => (p.built ? null : placeholderPage(p, i))).filter(Boolean);
  const labelJson = JSON.stringify(rules.labelData).replace(/</gu, '\\u003c');
  const html = `<title>協作套件說明書</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;700&display=swap">
<style>${CSS}</style>
<div class="app">
<aside class="side">
<div class="brand">協作套件<small>說明書</small></div>
<nav aria-label="說明書的九頁">${nav}</nav>
${stamp ? `<p class="stamp">產生自套件 ${esc(stamp)}</p>` : ''}
</aside>
<main>
${rules.html}
${others.join('\n')}
</main>
</div>
<div class="modal" id="modal" hidden role="dialog" aria-modal="true" aria-labelledby="modal-title">
<div class="sheet"><header><h2 id="modal-title"></h2><button type="button" class="close" aria-label="關閉">×</button></header><div id="modal-body"></div></div>
</div>
<script type="application/json" id="label-data">${labelJson}</script>
<script>${JS}</script>
`;
  return { html, counts: rules.counts, pages: PAGES.length, labels: labels.length };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--out') throw new Error('產生器不自己存檔：把輸出導到套件倉庫外的檔，例如 node manual/build.js > <倉庫外的檔>');
    if (flag !== '--stamp') throw new Error(`不認得的參數：${flag}（只有 --stamp）`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} 後面要接值`);
    out.stamp = value;
    i += 1;
  }
  return out;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = build(readSources(ROOT), { stamp: args.stamp });
    process.stdout.write(result.html);
    const c = result.counts;
    process.stderr.write(`產好說明書：${result.pages} 頁（規矩頁 ${c.total} 條：${KIND_TEXT.machine} ${c.machine}、${KIND_TEXT.mixed} ${c.mixed}、${KIND_TEXT.self} ${c.self}）\n`);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { build, readSources, parseArgs, parseLabels, parseLegend, splitTag, mdInline, esc, PAGES, KIND_TEXT, ROOT };
