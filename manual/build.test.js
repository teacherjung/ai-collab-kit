'use strict';
// 說明書網頁產生器的考題（manual/build.js；只在套件倉庫、不在共用路徑裡）。
// 守的：規矩頁的每一條（主句、子點的順序與層級與編號、把關那一行整行、機器表連結）、節標題、頁面上的數字、
// 跳窗資料、版面約定逐條、檔頭原文；機器頁（標籤定義、那張表每一列的條號、移植狀態、跳窗四欄、重名列的完整標題）、
// 工具頁與考題頁（每一支的檔頭第一句、寫到它的機器表列）、範本頁（每則說明、說明裡的條號、寫到它的機器表列）、
// 設定頁（設定說明產生器對空白範本的產出：每一節、段落、表格每一格、清單與子項）、範本全文跳窗（排得了的照設定頁那一套排、
// 其餘照原始檔；規矩卡與範本頁的鈕對到哪一份）、套用頁（README 那兩節：每一節、每一段、編號清單每一步與底下的程式碼框、清單每一項）、
// 案例頁（cases/ 每一則：索引表的順序、日期、標題、條號，跳窗的每一欄與行內記號、指到別則的連結，索引的說明與末尾小節）；
// 讀來源那一步讀到的原文跟磁碟上的一模一樣；以及來源形狀不對時停下不產生。
// 頁面內容的預期值由考題自己直接讀磁碟上的正本（disk）、自己解析（#26 r1 R1）；產生器 readSources() 讀到的只拿來餵產生器，⑫ 另外核它跟磁碟一模一樣。
// 守不到的：網頁上的互動（切頁、跳窗開關、篩選、跳到某一條）沒有考題——雲端考卷沒有瀏覽器；
// 實作者每一支用無畫面瀏覽器量一次、寫在 PR 說明。tests/filled-settings.test.js 與 git-env 的巢狀那兩輪
// 不帶 manual/：這一支只在根目錄那一輪跑；它若開始讀 settings.json 或叫 git，要先把 manual/ 加進那兩輪。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const manual = require('./build.js');
const rulesBook = require('../tools/build-rules.js');

const sources = () => manual.readSources(manual.ROOT);
/** 考題自己讀磁碟上的正本（不經過產生器的 readSources）：預期值都從這裡算。 */
const disk = (rel) => fs.readFileSync(path.join(manual.ROOT, rel), 'utf8');
const own = () => ({ rules: JSON.parse(disk('rules.json')), machines: disk('MACHINES.md'), glossary: disk('GLOSSARY.md') });
const plainOf = (value, roles) => rulesBook.tokenize(value, roles, '', []).map((seg) => seg.value).join('');
const strip = (html) => html.replace(/<[^>]+>/gu, '');
const escT = (v) => String(v).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
// 分類的字寫死在這裡，不拿產生器的 KIND_TEXT 當答案（2026-09-30 自審：原本叫「機器把關」講得比標籤大）
const KIND = { machine: '只列機器', mixed: '機器＋靠自覺', self: '只有靠自覺' };

/** 考題自己的對照：照規則資料的切法（規則書產生器的 tokenize＝資料契約）換成預期的 HTML。 */
function expectHtml(value, roles) {
  return rulesBook.tokenize(value, roles, '', [])
    .map((seg) => (seg.kind === 'role' ? `<strong class="role">${escT(seg.value)}</strong>` : seg.kind === 'code' ? `<code>${escT(seg.value)}</code>` : escT(seg.value)))
    .join('');
}

/** 散文的行內記號去掉之後的字（`框`、**粗體**），用來核跳窗與版面約定，不經過產生器的 mdInline。 */
const proseText = (v) => escT(String(v).replace(/`([^`]+)`/gu, '$1').replace(/\*\*([^*]+)\*\*/gu, '$1'));

/** 考題自己讀 MACHINES.md 標籤表（不用產生器的 parseLabels）。 */
function ownLabels(text) {
  const lines = text.split('\n');
  const at = lines.indexOf('| 標籤 | 意思 | 守不到的 |');
  const rows = [];
  for (let i = at + 2; lines[i] && lines[i].trim(); i += 1) {
    const [name, meaning, limits] = lines[i].split('|').slice(1, 4).map((c) => c.trim());
    rows.push({ name, meaning, limits });
  }
  return rows;
}

/** 考題自己讀 MACHINES.md「本文條目 → 機器」那張表（不用產生器的 parseMachineRows）。 */
function ownMachineRows(text) {
  const lines = text.split('\n');
  const at = lines.indexOf('| 本文 | 原專案的實作 | 違反時會紅的條件 | 守不到的 | 啟用前提 | 移植狀態 |');
  const rows = [];
  for (let i = at + 2; lines[i] && lines[i].trim(); i += 1) {
    const c = lines[i].split('|').slice(1, 7).map((x) => x.trim());
    rows.push({ keys: c[0].split('、'), fields: c.slice(1, 5), status: c[5] });
  }
  return rows;
}

/**
 * 考題自己算機器表每一列的鈕與跳窗標題（不用產生器的 label）：第一格的條號用「、」接；第一格一樣的列不只一列時，
 * 後面補「：」＋「原專案的實作」裡第一個灰底框（沒有灰底框就補 m＋列號）。另有寫死的樣本（ROW_LABEL_SAMPLES）對照。
 */
function ownRowLabels(rows) {
  return rows.map((row, k) => {
    const base = row.keys.join('、');
    const twins = rows.filter((r) => r.keys.join('、') === base).length;
    if (twins === 1) return base;
    const first = row.fields[0].split('`')[1];
    return `${base}：${first || `m${k + 1}`}`;
  });
}
const ROW_LABEL_SAMPLES = ['H1：tests/settings.test.js', 'H1：tools/merge.js', 'A2、D3、E1', 'B1'];

/**
 * 考題自己取一支檔的檔頭第一句（不用產生器的 firstSentence）：用正規式抓開頭那一塊註解
 * （前面可以有 #! 那一行與 'use strict'），去掉「//」，到第一個空註解行為止，再取到第一個「。」。
 * 接行：接縫兩邊有一邊是半形英數字、而且兩邊都不在 U+3000〜303F、U+FF00〜FFEF 這兩段才補空格。另有寫死的樣本（HEADER_SAMPLES）。
 */
function ownHeader(text) {
  const block = text.match(/^(?:#!.*\n)?(?:'use strict';\n)?((?:\/\/.*\n)+)/u)[1];
  const lines = block.split(/\n\/\/\s*\n/u)[0].replace(/^\/\/ ?/gmu, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const alnum = (c) => { const n = c.charCodeAt(0); return (n >= 48 && n <= 57) || (n >= 65 && n <= 90) || (n >= 97 && n <= 122); };
  const wide = (c) => { const n = c.charCodeAt(0); return (n >= 0x3000 && n <= 0x303f) || (n >= 0xff00 && n <= 0xffef); };
  let para = lines[0];
  for (const l of lines.slice(1)) {
    const a = para[para.length - 1];
    const b = l[0];
    para += ((alnum(a) || alnum(b)) && !wide(a) && !wide(b) ? ' ' : '') + l;
  }
  return { line: para.match(/^[^。]*。/u)[0], para };
}
const HEADER_SAMPLES = { 'tests/forbidden-defaults.test.js': '包含空白範本 tests/helpers/unfilled-settings.json 的同名清單', 'tests/kit-lock.test.js': '清單的豁免；K1：每條', 'tools/gates/check-review-verdicts.js': '；放行只認' };

/** 考題自己列 tools/ 與 tools/gates/ 的 .js（不用產生器的 readTools）。 */
function ownTools() {
  const out = [];
  for (const dir of ['tools', 'tools/gates']) {
    for (const f of fs.readdirSync(path.join(manual.ROOT, dir)).filter((x) => x.endsWith('.js')).sort()) {
      const text = disk(`${dir}/${f}`);
      out.push({ path: `${dir}/${f}`, text, ...ownHeader(text) });
    }
  }
  return out;
}

/** 考題自己照 tests/manifest.json 列考題檔（不用產生器的 readTests）。 */
function ownTests() {
  return JSON.parse(disk('tests/manifest.json')).map((f) => {
    const text = disk(`tests/${f}`);
    return { path: `tests/${f}`, text, ...ownHeader(text) };
  });
}

/**
 * 考題自己讀 MACHINES.md「範本」那一節（不用產生器的 parseTemplates）：「- 」開頭的行在第一個全形冒號切開，
 * 前半的灰底框是檔名、後半是說明；條號＝說明拿掉灰底框之後，用非英數字切開、剛好是 A〜K 加數字的片段（去重、照出現順序）。
 */
function ownTemplates(text) {
  const body = text.split('\n## 範本（本文指到「範本」的地方）\n')[1].split('\n## ')[0];
  return body.split('\n').filter((l) => l.startsWith('- ')).map((l) => {
    const cut = l.indexOf('：');
    const head = l.slice(2, cut);
    const desc = l.slice(cut + 1);
    const rules = [];
    for (const piece of desc.replace(/`[^`]*`/gu, ' ').split(/[^A-Za-z0-9]+/u)) if (/^[A-K][0-9]+$/u.test(piece) && !rules.includes(piece)) rules.push(piece);
    return { paths: head.split('`').filter((x) => x.startsWith('templates/')), desc, rules };
  });
}
const TEMPLATE_RULE_SAMPLES = { 'templates/pr-body.md': ['D3', 'D4', 'E1', 'F7', 'G3', 'H6'], 'templates/hook-claude.json': ['B1'], 'templates/ci-github.yml': ['E3', 'E1'], 'templates/ruling-record.md': ['I1', 'I3'] };

// 套用頁取的 README 兩節（寫死，不拿產生器的 ADOPT_HEADINGS 當答案）
const ADOPT_HEADS = ['搬進一個專案', '專案裡改到套件的檔'];
/**
 * 考題自己讀 README.md 的一節（不用產生器的 parseAdopt／parseDoc）：標題剛好是那幾個字、或後面接「（」的那一行起，到下一個「## 」為止，
 * 一行一行看——空行只把「- 」清單、表格切開；「N. 」＝編號項（前一塊是編號清單就接進去）；前一塊是編號清單時，縮排的三個反引號＝那一項底下的
 * 程式碼框，讀到同樣縮排的三個反引號為止（框裡每一行去掉那個寬度）；「  N. 」＝上一個清單項的子項；「- 」＝清單項；「|」＝表格（第二行是分隔列）；
 * 其餘＝一行一段。找不到那一節回 null。
 */
function ownReadmeSection(readme, head) {
  const lines = readme.split('\n');
  const at = lines.findIndex((l) => l === `## ${head}` || l.startsWith(`## ${head}（`));
  if (at < 0) return null;
  const next = lines.findIndex((l, i) => i > at && l.startsWith('## '));
  const end = next < 0 ? lines.length : next;
  const cellsOf = (r) => r.slice(1, -1).split(/(?<!\\)\|/u).map((c) => c.replace(/^ +| +$/gu, '').split('\\|').join('|'));
  const sec = { title: lines[at].slice(3), blocks: [] };
  let last = null;
  let gap = true;
  for (let i = at + 1; i < end; i += 1) {
    const l = lines[i];
    if (l === '') {
      gap = true;
      continue;
    }
    const fence = l.match(/^( +)```/u);
    if (fence && last && last.kind === 'olist') {
      const code = [];
      for (i += 1; i < end && lines[i] !== `${fence[1]}\`\`\``; i += 1) code.push(lines[i].slice(fence[1].length));
      last.items[last.items.length - 1].code.push(code);
    } else if (/^\d+\. /u.test(l)) {
      const item = { text: l.replace(/^\d+\. /u, ''), code: [] };
      if (last && last.kind === 'olist') last.items.push(item);
      else sec.blocks.push((last = { kind: 'olist', items: [item] }));
    } else if (/^ {2}\d+\. /u.test(l)) {
      const [, num, text] = l.match(/^ {2}(\d+)\. (.*)$/u);
      last.items[last.items.length - 1].sub.push([Number(num), text]);
    } else if (l.startsWith('- ')) {
      const item = { text: l.slice(2), sub: [] };
      if (last && last.kind === 'list' && !gap) last.items.push(item);
      else sec.blocks.push((last = { kind: 'list', items: [item] }));
    } else if (l.startsWith('|')) {
      if (last && last.kind === 'table' && !gap) last.rows.push(cellsOf(l));
      else {
        sec.blocks.push((last = { kind: 'table', head: cellsOf(l), rows: [] }));
        i += 1;
      }
    } else {
      sec.blocks.push((last = { kind: 'p', text: l }));
    }
    gap = false;
  }
  return sec;
}

/** 考題自己讀 GLOSSARY.md 的版面約定（不用產生器的 parseLegend）。 */
function ownLegend(text) {
  const body = text.split('## 版面約定\n')[1].split('\n## ')[0].split('\n').filter((l) => l.trim());
  return { lead: body.filter((l) => !l.startsWith('- ')).join(' '), bullets: body.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)) };
}

/** 一張規則卡的 HTML（從 id 開始到它的 </article>）。 */
function card(html, id) {
  const at = html.indexOf(`<article class="rule" id="rule-${id}"`);
  assert.ok(at >= 0, `找不到 ${id} 那張卡`);
  return html.slice(at, html.indexOf('</article>', at));
}

/** 位置 p 之前還沒關的清單標籤（由外到內）。 */
function openLists(html, p) {
  const stack = [];
  for (const m of html.slice(0, p).matchAll(/<(\/?)(ol|ul)\b/gu)) {
    if (m[1]) stack.pop();
    else stack.push(m[2]);
  }
  return stack;
}

/**
 * 考題自己算每一條標籤列了哪些名字（不用產生器的 splitTag）：先把灰底框整段換掉、拿掉粗體記號，
 * 再在全形「；」切，一段剛好是登記名或以「登記名：」開頭才算。另有一張寫死的樣本（TAG_SAMPLES）對照。
 */
function ownTagNames(tag, names) {
  const text = tag.replace(/`[^`]*`/gu, '框').replace(/\*\*/gu, '');
  return text.split('；').map((seg) => names.find((n) => seg === n || seg.startsWith(`${n}：`))).filter(Boolean);
}
const TAG_SAMPLES = { A2: ['雲端', '合併閘'], B1: ['攔截', '靠自覺'], D1: ['清單腳本', '靠自覺'], E1: ['雲端'], F4: ['合併閘'], G2: ['掃描自檢', '靠自覺'], H5: ['靠自覺'], H6: ['分級腳本', '靠自覺'] };

function kindOfTag(tag, names) {
  const got = ownTagNames(tag, names);
  const m = got.some((n) => n !== '靠自覺');
  const s = got.some((n) => n === '靠自覺');
  return m && s ? 'mixed' : m ? 'machine' : 'self';
}

test('① 規矩頁逐條：主句、子點（順序、第幾層、編號或圓點）、把關那一行整行，都照規則資料', () => {
  const src = sources();
  const o = own();
  const { html, counts } = manual.build(src);
  const roles = o.rules.roles;
  const names = ownLabels(o.machines).map((l) => l.name);
  const ids = o.rules.sections.flatMap((s) => s.rules.map((r) => `${s.letter}${r.n}`));
  assert.equal(counts.total, ids.length);
  for (const id of Object.keys(TAG_SAMPLES)) assert.ok(ids.includes(id), `寫死的樣本 ${id} 已經不在規則裡：樣本要跟著規則改`);
  assert.equal((html.match(/<article class="rule" /gu) || []).length, ids.length, '卡的張數要等於規則條數');
  assert.ok(ids.length >= rulesBook.MIN_RULES, '規則條數少於規則書產生器的下限：來源可能讀錯了');
  for (const section of o.rules.sections) {
    for (const rule of section.rules) {
      const id = `${section.letter}${rule.n}`;
      const c = card(html, id);
      assert.equal(c.match(/<span class="rule-no">([^<]*)<\/span>/u)[1], id, `${id} 卡上顯示的條號不對`);
      const text = c.match(/<p class="rule-text">([\s\S]*?)<\/p>/u);
      assert.equal(text[1], expectHtml(rule.text, roles), `${id} 的主句不一樣（含角色粗體與灰底框）`);
      const lis = [...c.matchAll(/<li>/gu)].map((m) => m.index);
      assert.equal(lis.length, (rule.items || []).length, `${id} 的子點個數不一樣`);
      (rule.items || []).forEach((item, i) => {
        const p = lis[i];
        const own = c.slice(p + 4).split(/<\/li>|<ol|<ul/u)[0];
        assert.equal(own, expectHtml(item.text, roles), `${id} 第 ${i + 1} 個子點的字、記號或順序不對`);
        const lists = openLists(c, p);
        assert.equal(lists.length, item.level || 1, `${id} 第 ${i + 1} 個子點的層級不對`);
        assert.equal(lists[lists.length - 1], item.numbered ? 'ol' : 'ul', `${id} 第 ${i + 1} 個子點的編號／圓點不對`);
      });
      const tag = c.match(/<p class="rule-tag">([\s\S]*?)<\/p>/u);
      assert.equal(strip(tag[1]), `把關${escT(plainOf(rule.tag, roles))}`, `${id} 的把關那一行不一樣`);
      const segs = rulesBook.tokenize(rule.tag, roles, '', []);
      assert.equal((tag[1].match(/<strong class="role">/gu) || []).length, segs.filter((x) => x.kind === 'role').length, `${id} 把關那一行的角色粗體數不對`);
      assert.equal((tag[1].match(/<code>/gu) || []).length, segs.filter((x) => x.kind === 'code').length, `${id} 把關那一行的灰底框數不對`);
      const chips = [...tag[1].matchAll(/<button type="button" class="chip [^"]+" data-label="([^"]+)">([^<]+)<\/button>/gu)];
      for (const [, target, label] of chips) assert.equal(target, label, `${id} 標籤鈕上的字「${label}」跟它打開的「${target}」不一樣`);
      assert.deepEqual(chips.map((x) => x[1]), ownTagNames(rule.tag, names), `${id} 的標籤鈕跟標籤列的名字不一樣`);
      if (TAG_SAMPLES[id]) assert.deepEqual(chips.map((x) => x[1]), TAG_SAMPLES[id], `${id} 的標籤鈕跟寫死的樣本不一樣`);
    }
  }
});

test('② 標籤切段：剛好是登記名或「登記名：」開頭才算新的一段；續句接回上一段；對不到或半形分號＝丟例外', () => {
  const labels = manual.parseLabels(sources().machines);
  const names = ownLabels(disk('MACHINES.md')).map((l) => l.name);
  const pick = (parts) => parts.map((p) => ({ name: p.name, rest: p.rest }));
  assert.deepEqual(pick(manual.splitTag('雲端：只驗四欄有填；角色那兩欄要填登記過的名字', labels)), [{ name: '雲端', rest: '：只驗四欄有填；角色那兩欄要填登記過的名字' }]);
  assert.deepEqual(pick(manual.splitTag('靠自覺；考題卷由人出、機器不看', labels)), [{ name: '靠自覺', rest: '；考題卷由人出、機器不看' }], '以登記名的字開頭、後面沒有冒號的續句要接回上一段');
  assert.deepEqual(pick(manual.splitTag('考題：只守忽略清單；靠自覺：其餘', labels)).map((p) => p.name), ['考題', '靠自覺']);
  assert.deepEqual(pick(manual.splitTag('靠自覺；經「合併指令」合併會自動寫', labels)), [{ name: '靠自覺', rest: '；經「合併指令」合併會自動寫' }]);
  assert.throws(() => manual.splitTag('沒登記的名字：隨便', labels), /不是以登記的名字開頭/u);
  assert.throws(() => manual.splitTag('雲端：只驗這一欄有填;靠自覺：其餘', labels), /半形「;」/u);
  assert.deepEqual(pick(manual.splitTag('考題：範例 `甲；靠自覺：乙`', labels)).map((p) => p.name), ['考題'], '灰底框裡的「；」不切');
  const { html } = manual.build(sources());
  for (const m of html.matchAll(/data-label="([^"]+)"/gu)) assert.ok(names.includes(m[1]), `標籤鈕「${m[1]}」不在 MACHINES.md 的標籤表`);
});

test('③ 頁面上的數字：篩選鈕、頁首總數、各節條數、卡片徽章，都跟逐條重算的一樣', () => {
  const src = sources();
  const o = own();
  const names = ownLabels(o.machines).map((l) => l.name);
  const tally = { machine: 0, mixed: 0, self: 0 };
  for (const s of o.rules.sections) for (const r of s.rules) tally[kindOfTag(r.tag, names)] += 1;
  const total = tally.machine + tally.mixed + tally.self;
  const { counts, html } = manual.build(src);
  assert.deepEqual(counts, { total, ...tally });
  const nums = [...html.matchAll(/data-filter="(\w+)"[^>]*>[\s\S]*?<span class="num">(\d+)<\/span>/gu)].map((m) => [m[1], Number(m[2])]);
  assert.deepEqual(nums, [['all', total], ['machine', tally.machine], ['mixed', tally.mixed], ['self', tally.self]]);
  const bar = [...html.matchAll(/class="bar-seg seg-(\w+)" style="flex-grow:(\d+)"/gu)].map((m) => [m[1], Number(m[2])]);
  assert.deepEqual(bar, [['machine', tally.machine], ['mixed', tally.mixed], ['self', tally.self]], '比例條三段的長短要等於三類的條數');
  assert.ok(html.includes(`<p class="page-sum">${total} 條，分 ${o.rules.sections.length} 節`), '頁首的總條數或節數不對');
  assert.equal(html.match(/<section class="page" id="page-rules" data-page="rules">[\s\S]*?<h1>([^<]*)<\/h1>/u)[1], escT(o.rules.title), '規矩頁的大標題要是規則資料的標題');
  assert.deepEqual(manual.KIND_TEXT, KIND, '分類的字改了：要連這一題與 PR 說明一起改');
  assert.ok(html.includes('這三類只照每一條「把關」那一行列了哪些名字來分，不代表整條都有人守住'), '頁上講分類的那句不見了');
  for (const s of o.rules.sections) {
    assert.ok(html.includes(`<span class="sec-letter">${s.letter}</span>${escT(s.title)}<span class="sec-count">${s.rules.length} 條</span>`), `${s.letter} 節的標題或條數不對`);
    for (const r of s.rules) {
      const want = kindOfTag(r.tag, names);
      const c = card(html, `${s.letter}${r.n}`);
      assert.ok(c.includes(`data-kind="${want}"`), `${s.letter}${r.n} 的分類不對`);
      assert.ok(c.includes(`<span class="rule-kind kind-${want}">${KIND[want]}</span>`), `${s.letter}${r.n} 的徽章跟分類對不上`);
    }
  }
});

test('④ 跳窗資料：每個標籤一筆、意思與守不到的照原文；「用到它的規矩」＝每一條規矩的每個標籤（同一條只記一次），寫的條數＝列出的條號數', () => {
  const src = sources();
  const labels = manual.parseLabels(src.machines);
  const { html } = manual.build(src);
  const json = html.match(/<script type="application\/json" id="label-data">([\s\S]*?)<\/script>/u);
  assert.ok(json, '找不到跳窗資料');
  assert.ok(!json[1].includes('<'), '跳窗資料放在 <script> 裡，不能有原始的「<」（要寫成 \\u003c），否則內容裡的 </script> 會提早結束那一段');
  const data = JSON.parse(json[1]);
  const o = own();
  const ownL = ownLabels(o.machines);
  assert.ok(ownL.length >= 9, '考題自己讀到的標籤太少：對照讀錯了');
  assert.deepEqual(labels, ownL, '產生器讀到的標籤表跟考題自己讀的不一樣');
  assert.deepEqual(Object.keys(data).sort(), ownL.map((l) => l.name).sort());
  for (const l of ownL) {
    const dd = [...data[l.name].html.matchAll(/<dt>([^<]+)<\/dt><dd>([\s\S]*?)<\/dd>/gu)].map((m) => [m[1], strip(m[2])]);
    assert.deepEqual(dd, [['意思', proseText(l.meaning)], ['守不到的', proseText(l.limits)]], `「${l.name}」的意思／守不到的不是原文`);
  }
  assert.deepEqual(manual.parseLabels('| 標籤 | 意思 | 守不到的 |\n|---|---|---|\n| 甲 | 甲的意思 | 甲守不到 |\n| 靠自覺 | 沒有機器 | 全部 |\n'),
    [{ name: '甲', meaning: '甲的意思', limits: '甲守不到' }, { name: '靠自覺', meaning: '沒有機器', limits: '全部' }]);
  const want = new Set();
  for (const s of o.rules.sections) {
    for (const r of s.rules) for (const n of ownTagNames(r.tag, ownL.map((l) => l.name))) want.add(`${n}:${s.letter}${r.n}`);
  }
  assert.ok(want.has('合併閘:A2') && want.has('雲端:A2'), '對照裡 A2 要同時有雲端與合併閘');
  const got = [];
  for (const [name, entry] of Object.entries(data)) {
    const pairs = [...entry.html.matchAll(/data-goto="rule-([A-K]\d+)">([^<]*)<\/button>/gu)];
    for (const [, target, text] of pairs) assert.equal(text, target, `「${name}」跳窗裡按鈕上寫 ${text}、卻跳到 ${target}`);
    const links = pairs.map((x) => x[1]);
    for (const id of links) got.push(`${name}:${id}`);
    const shown = entry.html.match(/用到它的規矩（(\d+) 條）/u);
    if (links.length) assert.equal(Number(shown && shown[1]), links.length, `「${name}」跳窗寫的條數跟列出來的條號數不一樣`);
    else assert.ok(entry.html.includes('目前沒有規矩用到它。'), `「${name}」沒有條號時要寫沒有`);
  }
  assert.deepEqual(got.sort(), [...want].sort());
  const dup = JSON.parse(JSON.stringify(src.rules));
  dup.sections[0].rules[0].tag = '靠自覺：一；靠自覺：二';
  const dupData = JSON.parse(manual.build({ ...src, rules: dup }).html.match(/id="label-data">([\s\S]*?)<\/script>/u)[1]);
  assert.equal((dupData['靠自覺'].html.match(/data-goto="rule-A1"/gu) || []).length, 1, '同一條規矩的標籤裡同一個名字出現兩次，只記一次');
});

test('⑤ 抽不到就停：少一個來源、規則資料不合契約、標籤表或版面約定的形狀不對，都丟例外', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-src-'));
  try {
    fs.copyFileSync(path.join(manual.ROOT, 'rules.json'), path.join(dir, 'rules.json'));
    fs.copyFileSync(path.join(manual.ROOT, 'MACHINES.md'), path.join(dir, 'MACHINES.md'));
    assert.throws(() => manual.readSources(dir), /讀不到 GLOSSARY\.md/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const src = sources();
  const broken = JSON.parse(JSON.stringify(src.rules));
  broken.sections[0].rules[0].n = 99;
  assert.throws(() => manual.build({ ...src, rules: broken }), /不合資料契約/u, '條號跳號只有資料契約擋得住');
  const m = src.machines;
  const g = src.glossary;
  const legendBody = g.match(/## 版面約定\n([\s\S]*?)\n## /u)[1];
  const SELF_ROW = m.match(/^\| 靠自覺 \|.*\|$/mu)[0];
  const machLines = m.split('\n');
  const machAt = machLines.indexOf('| 本文 | 原專案的實作 | 違反時會紅的條件 | 守不到的 | 啟用前提 | 移植狀態 |');
  const MACH_ROW = machLines[machAt + 2];
  const MACH_LAST = machLines[machLines.slice(machAt + 2).findIndex((l) => !l.trim()) + machAt + 1];
  const MACH_INTRO = machLines.slice(machLines.indexOf('## 本文條目 → 機器') + 1, machAt).find((l) => l.trim());
  const withLegend = (body) => g.split(legendBody).join(body);
  const firstBullet = legendBody.match(/^- .*$/mu)[0];
  const cases = [
    ['表頭改名', { machines: m.replace('| 標籤 | 意思 | 守不到的 |', '| 名字 | 意思 | 守不到的 |') }, /找不到「\| 標籤/u],
    ['少分隔列', { machines: m.replace('| 標籤 | 意思 | 守不到的 |\n|---|---|---|', '| 標籤 | 意思 | 守不到的 |') }, /應該是分隔列/u],
    ['空格', { machines: m.replace(/^(\| 考題 \| )[^|]+\|/mu, '$1 |') }, /每格都有字/u],
    ['重複登記', { machines: m.replace(/^(\| 考題 \|.*)$/mu, '$1\n$1') }, /登記了兩次/u],
    ['沒有靠自覺', { machines: m.replace(/^\| 靠自覺 \|.*$/mu, '') }, /標籤表裡沒有「靠自覺」/u],
    ['版面約定不見', { glossary: g.replace('## 版面約定', '## 別的') }, /找不到「## 版面約定」/u],
    ['開頭那行縮排', { glossary: withLegend(legendBody.replace(legendBody.split('\n').find((l) => l.trim()), (l) => `  ${l}`)) }, /縮排行/u],
    ['沒有開頭那一段', { glossary: withLegend(legendBody.split('\n').filter((l) => l.startsWith('- ') || !l.trim()).join('\n')) }, /沒有開頭那一段/u],
    ['多一格沒結尾', { machines: m.replace(/^\| 靠自覺 \| 沒有機器 \| 全部 \|$/mu, '| 靠自覺 | 沒有機器 | 全部 | 多的一格') }, /頭尾都有/u],
    ['條列後段落', { glossary: withLegend(`${legendBody}\n條列後面的一段`) }, /條列後面又有段落/u],
    ['別種條列', { glossary: withLegend(legendBody.replace(firstBullet, `* ${firstBullet.slice(2)}`)) }, /只收開頭一段與「- 」條列/u],
    ['沒有條列', { glossary: withLegend(legendBody.replace(/^- .*$/gmu, '')) }, /沒有條列/u],
    ['表格後緊接缺開頭豎線的列', { machines: m.replace(SELF_ROW, `${SELF_ROW}\n 新增標籤 | 新的意思 | 新的守不到 |`) }, /要剛好三格/u],
    ['表格後緊接多一個前導空白的列', { machines: m.replace(SELF_ROW, `${SELF_ROW}\n | 新增標籤 | 新的意思 | 新的守不到 |`) }, /要剛好三格/u],
    ['空一行後又冒出一列', { machines: m.replace(SELF_ROW, `${SELF_ROW}\n\n| 新增標籤 | 新的意思 | 新的守不到 |`) }, /接的不是下一節的標題/u],
    ['開頭第二段', { glossary: withLegend(legendBody.replace(firstBullet, `第二段開頭\n\n${firstBullet}`)) }, /開頭有第二段/u],
    ['機器表大標題不見', { machines: m.replace(/^# .*\n/u, '\n') }, /大標題/u],
    ['機器大表的表頭改名', { machines: m.replace('| 本文 | 原專案的實作 |', '| 條號 | 原專案的實作 |') }, /找不到「\| 本文/u],
    ['機器大表少說明段', { machines: m.replace(MACH_INTRO, '') }, /沒有說明段落/u],
    ['機器大表少一格', { machines: m.replace(MACH_ROW, MACH_ROW.replace(/\| [^|]+ \|$/u, '|')) }, /要剛好六格/u],
    ['機器大表條號不存在', { machines: m.replace(MACH_ROW, MACH_ROW.replace(/^\| [^|]+ \|/u, '| K99 |')) }, /條號 K99 不在規則裡/u],
    ['機器大表後面不是標題', { machines: m.replace(MACH_LAST, `${MACH_LAST}\n\n補一句說明`) }, /那張表之後接的不是下一節的標題/u],
    ['第一格逗號分隔', { machines: m.replace('| E5、H1 |', '| E5,H1 |') }, /「E5,H1」不是規則裡的條號/u],
    ['第一格範圍寫法', { machines: m.replace('| D1、I3 |', '| D1、I1〜I3 |') }, /「I1〜I3」不是規則裡的條號/u],
    ['第一格小寫', { machines: m.replace('| K3 |', '| k3 |') }, /「k3」不是規則裡的條號/u],
    ['第一格空條號', { machines: m.replace('| A2、D3、E1 |', '| A2、、E1 |') }, /第一格有空的條號/u],
    ['某一格只有空白', { machines: m.replace(MACH_ROW, MACH_ROW.replace(/\| [^|]+ \|$/u, '|   |')) }, /要剛好六格/u],
    ['七格沒結尾', { machines: m.replace(MACH_ROW, `${MACH_ROW} 多 |多`) }, /要剛好六格/u],
    ['分隔列五欄', { machines: m.replace('|---|---|---|---|---|---|', '|---|---|---|---|---|') }, /六欄的分隔列/u],
    ['說明段第二段', { machines: m.replace(MACH_INTRO, `${MACH_INTRO}\n\n第二段`) }, /說明有第二段/u],
    ['說明段有條列', { machines: m.replace(MACH_INTRO, `${MACH_INTRO}\n- 條列`) }, /只收一段說明/u],
    ['說明段有 HTML 註解', { machines: m.replace(MACH_INTRO, `${MACH_INTRO}\n<!-- 註解 -->`) }, /只收一段說明/u],
    ['說明段夾表格列', { machines: m.replace(MACH_INTRO, `${MACH_INTRO}\n| x |`) }, /只收一段說明/u],
    ['零列', { machines: m.split('\n').filter((l, k) => !(k >= machAt + 2 && k <= machLines.indexOf(MACH_LAST))).join('\n') }, /沒有任何一列/u],
    ['機器大表尾端緊接缺開頭豎線的列', { machines: m.replace(MACH_LAST, `${MACH_LAST}\n K1 | 甲 | 乙 | 丙 | 丁 | 戊 |`) }, /要剛好六格/u],
    ['機器大表尾端緊接多一個前導空白的列', { machines: m.replace(MACH_LAST, `${MACH_LAST}\n | K1 | 甲 | 乙 | 丙 | 丁 | 戊 |`) }, /要剛好六格/u],
  ];
  for (const [name, patch, pattern] of cases) {
    const key = Object.keys(patch)[0];
    assert.notEqual(patch[key], src[key], `「${name}」這一發沒有改到來源`);
    assert.throws(() => manual.build({ ...src, ...patch }), pattern, `「${name}」應該停下`);
  }
  // 工具檔頭沒有說明就停（用注入的來源，不動真的檔）
  assert.throws(() => manual.build({ ...src, tools: [...src.tools, { path: 'tools/no-header.js', text: "'use strict';\nmodule.exports = {};\n" }] }), /tools\/no-header\.js 的前三行沒有/u);
  assert.throws(() => manual.build({ ...src, tools: [...src.tools, { path: 'tools/late.js', text: "'use strict';\n\n\n// 第四行才說明。\n" }] }), /tools\/late\.js 的前三行沒有/u);
  assert.throws(() => manual.build({ ...src, tools: [...src.tools, { path: 'tools/empty.js', text: "// \nmodule.exports = {};\n" }] }), /tools\/empty\.js 檔頭的第一段沒有「。」/u);
  assert.throws(() => manual.build({ ...src, tools: [...src.tools, { path: 'tools/noperiod.js', text: "// 沒有句號的說明\n//\n// 第二段才有。\n" }] }), /tools\/noperiod\.js 檔頭的第一段沒有「。」/u);
  // 對照組：表格尾端多一列格式正確的新標籤，照收（多一筆、跳窗寫沒有規矩用到它）；開頭那一段換行不算兩段
  const ok = manual.build({ ...src, machines: m.replace(SELF_ROW, `${SELF_ROW}\n| 新增標籤 | 新的意思 | 新的守不到 |`) });
  const okData = JSON.parse(ok.html.match(/id="label-data">([\s\S]*?)<\/script>/u)[1]);
  assert.equal(Object.keys(okData).length, ownLabels(disk('MACHINES.md')).length + 1);
  assert.ok(okData['新增標籤'].html.includes('目前沒有規矩用到它。'));
  const leadLine = legendBody.split('\n').find((l) => l.trim());
  const cont = manual.build({ ...src, glossary: withLegend(legendBody.replace(leadLine, `${leadLine}\n開頭的續行`)) });
  assert.ok(cont.html.includes('開頭的續行'), '開頭那一段裡換行不是第二段，要照收');
});

test('⑥ 跳脫與原文：尖括號以文字出現；版面約定逐條與開頭那句、規則書檔頭都照原文出現', () => {
  const src = sources();
  const { html } = manual.build(src);
  assert.ok(html.includes('<code>未執行：&lt;原因&gt;</code>'), '版面約定那個灰底框沒有照字面出現');
  const o = own();
  const legend = ownLegend(o.glossary);
  assert.ok(legend.lead && legend.bullets.length >= 3, '考題自己讀到的版面約定太少：對照讀錯了');
  assert.deepEqual(manual.parseLegend(src.glossary), legend, '產生器讀到的版面約定跟考題自己讀的不一樣');
  const box = html.match(/<details class="legend">([\s\S]*?)<\/details>/u)[1];
  const lis = [...box.matchAll(/<li>([\s\S]*?)<\/li>/gu)].map((x) => strip(x[1]));
  assert.deepEqual(lis, legend.bullets.map(proseText), '版面約定的條列跟原文不一樣（少一條、多一條或換了字）');
  const leadP = box.match(/<p>([\s\S]*?)<\/p>/u);
  assert.ok(leadP, '版面約定開頭那句不見了');
  assert.equal(strip(leadP[1]), proseText(legend.lead), '版面約定開頭那句不是原文');
  assert.deepEqual(manual.parseLegend('## 版面約定\n\n開頭。\n\n- 一\n- 二\n\n## 下一節\n'), { lead: '開頭。', bullets: ['一', '二'] });
  assert.ok(html.includes(`規則書檔頭原文：${escT(o.rules.preamble)}`), '規則書檔頭原文不見了');
  assert.equal(manual.mdInline('a <b> **粗** `<c>`'), 'a &lt;b&gt; <strong>粗</strong> <code>&lt;c&gt;</code>');
  assert.equal(manual.mdInline('**包著 `框` 的粗體**'), '<strong>包著 <code>框</code> 的粗體</strong>', '粗體可以包住灰底框');
  const shown = strip(html.replace(/<script[\s\S]*?<\/script>/gu, '').replace(/<style>[\s\S]*?<\/style>/u, '').replace(/<code>[\s\S]*?<\/code>/gu, ''));
  assert.ok(!shown.includes('**'), '網頁上顯示的字裡有沒處理掉的「**」');
  const popups = [...Object.values(JSON.parse(html.match(/id="label-data">([\s\S]*?)<\/script>/u)[1])), ...Object.values(JSON.parse(html.match(/id="machine-data">([\s\S]*?)<\/script>/u)[1]))];
  for (const e of popups) assert.ok(!strip(e.html.replace(/<code>[\s\S]*?<\/code>/gu, '')).includes('**'), '跳窗裡有沒處理掉的「**」');
  assert.equal(manual.esc('"&<>'), '&quot;&amp;&lt;&gt;');
});

test('⑦ 網頁格式：<title> 在前 8KB、不自帶 doctype／html／body、[hidden] 一定藏得住、顏色都有深色版、九頁照擁有者列的順序', () => {
  const { html } = manual.build(sources(), { stamp: '測試' });
  assert.match(html.slice(0, 8192), /<title>[^<]+<\/title>/u);
  assert.doesNotMatch(html, /<!doctype|<html[\s>]|<body[\s>]/iu);
  assert.ok(html.includes('[hidden]{display:none!important}'), '跳窗與各頁用 hidden 開關，自己的 display 會蓋過瀏覽器預設，要有這一條');
  const css = html.match(/<style>([\s\S]*?)<\/style>/u)[1];
  const tokens = (block) => new Set([...block.matchAll(/(--[a-z-]+):/gu)].map((x) => x[1]));
  const light = [...tokens(css.match(/:root\{([\s\S]*?)\}/u)[1])].filter((t) => !['--display', '--body', '--mono'].includes(t));
  const darkMedia = tokens(css.match(/:root:not\(\[data-theme="light"\]\)\{([\s\S]*?)\}/u)[1]);
  const darkAttr = tokens(css.match(/:root\[data-theme="dark"\]\{([\s\S]*?)\}/u)[1]);
  assert.ok(light.length >= 10, '淺色的顏色變數讀到太少：正規式可能沒對到');
  assert.match(css, /(^|\n)body\{background:var\(--bg\);/u, 'body 要有明確的背景色（外面那層會畫它自己的底色）');
  for (const t of light) assert.ok(darkMedia.has(t) && darkAttr.has(t), `顏色 ${t} 沒有深色版`);
  assert.doesNotMatch(css.replace(/:root[^{]*\{[^}]*\}/gu, ''), /#[0-9a-f]{3,8}\b|rgba?\(/iu, '元件的顏色要用變數，不寫死');
  const routes = [...html.matchAll(/data-route="([a-z]+)"/gu)].map((x) => x[1]);
  assert.deepEqual(routes, ['rules', 'machines', 'tools', 'tests', 'templates', 'settings', 'adopt', 'glossary', 'cases']);
  assert.deepEqual(manual.PAGES.map((p) => p.name), ['規矩', '機器', '工具', '考題', '範本', '設定', '套用', '名詞', '案例']);
  for (const p of [manual.ROOT, os.homedir(), os.tmpdir()]) assert.ok(!html.includes(p), `產出裡有這台機器的路徑：${p}`);
  // 家目錄前綴的形狀：範本跳窗資料以外一個都不准有；範本跳窗資料的每一筆（鍵與所有欄位）出現的次數要跟那份範本檔一樣（公開檢查清單本來就拿這幾個前綴當例子）
  const tplJson = html.match(/id="template-data">([\s\S]*?)<\/script>/u)[1];
  for (const p of ['/Users/', '/private/', '/home/']) {
    assert.ok(!html.replace(tplJson, '').includes(p), `跳窗以外的產出裡有家目錄前綴：${p}`);
    for (const [file, e] of Object.entries(JSON.parse(tplJson))) assert.equal(JSON.stringify([file, e]).split(p).length, disk(file).split(p).length, `${file} 的跳窗資料裡「${p}」出現的次數跟範本檔不一樣`);
  }
  assert.ok(html.includes('產生自套件 測試'));
  assert.ok(manual.build(sources(), { stamp: '<b>x</b>' }).html.includes('產生自套件 &lt;b&gt;x&lt;/b&gt;'), '頁尾註記要跳脫');
});

test('⑧ 命令列：網頁印到標準輸出、摘要印到標準錯誤；不自己存檔（--out 退 1）；不認得的參數、缺值都退 1；來源壞掉退 1 且標準輸出什麼都不印', () => {
  const script = path.join(__dirname, 'build.js');
  const run = (args, s = script) => spawnSync(process.execPath, [s, ...args], { encoding: 'utf8' });
  const ok = run(['--stamp', '測試']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout, manual.build(sources(), { stamp: '測試' }).html, '標準輸出要剛好是整份網頁、沒有別的字');
  assert.match(ok.stderr, /產好說明書：9 頁/u);
  const laidOut = Object.values(JSON.parse(ok.stdout.match(/id="template-data">([\s\S]*?)<\/script>/u)[1])).filter((e) => e.html.includes('<div class="tpl-body">')).length;
  assert.match(ok.stderr, new RegExp(`考題 ${ownTests().length} 支；範本 ${fs.readdirSync(path.join(manual.ROOT, 'templates')).length} 份、${ownTemplates(disk('MACHINES.md')).length} 則說明、跳窗排版 ${laidOut} 份；套用 ${ADOPT_HEADS.filter((h) => ownReadmeSection(disk('README.md'), h)).length} 節；案例 ${ownCaseSources().files.length} 則）\n$`, 'u'));
  const out = run(['--out', 'x.html']);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /產生器不自己存檔/u);
  assert.equal(out.stdout, '');
  assert.equal(run(['--stamp']).status, 1);
  const nope = run(['--nope', 'x']);
  assert.equal(nope.status, 1);
  assert.equal(nope.stdout, '');
  assert.match(nope.stderr, /不認得的參數：--nope/u);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-cli-'));
  try {
    // 來源壞掉：在複本裡把版面約定拿掉再跑
    const kit = path.join(dir, 'kit');
    for (const rel of ['manual/build.js', 'rules.json', 'MACHINES.md', 'GLOSSARY.md', 'README.md']) {
      fs.mkdirSync(path.dirname(path.join(kit, rel)), { recursive: true });
      fs.copyFileSync(path.join(manual.ROOT, rel), path.join(kit, rel));
    }
    for (const dir of ['tools', 'tests', 'templates', 'cases']) fs.cpSync(path.join(manual.ROOT, dir), path.join(kit, dir), { recursive: true });
    assert.equal(run([], path.join(kit, 'manual/build.js')).status, 0, '複本本身要先能產生（對照組）');
    fs.writeFileSync(path.join(kit, 'tools', 'notes.md'), '不認得的檔\n');
    const odd = run([], path.join(kit, 'manual/build.js'));
    assert.equal(odd.status, 1);
    assert.match(odd.stderr, /tools\/notes\.md：工具頁不知道它歸哪一組/u);
    assert.equal(odd.stdout, '');
    fs.rmSync(path.join(kit, 'tools', 'notes.md'));
    fs.mkdirSync(path.join(kit, 'tools', 'extra'));
    assert.match(run([], path.join(kit, 'manual/build.js')).stderr, /tools\/extra：工具頁不知道它歸哪一組/u);
    fs.rmSync(path.join(kit, 'tools', 'extra'), { recursive: true });
    fs.writeFileSync(path.join(kit, 'tests', 'helpers', 'test-extra.js'), "require('node:test')('x', () => {});\n");
    const helper = run([], path.join(kit, 'manual/build.js'));
    assert.equal(helper.status, 1);
    assert.match(helper.stderr, /tests\/helpers\/test-extra\.js：考題頁不知道它算不算考題/u);
    assert.equal(helper.stdout, '', 'helpers 底下冒出像考題的檔時，標準輸出不可以印出任何網頁內容');
    fs.rmSync(path.join(kit, 'tests', 'helpers', 'test-extra.js'));
    fs.writeFileSync(path.join(kit, 'GLOSSARY.md'), '# 空的\n');
    const bad = run([], path.join(kit, 'manual/build.js'));
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /找不到「## 版面約定」/u);
    assert.equal(bad.stdout, '', '來源壞掉時標準輸出不可以印出任何網頁內容');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('⑨ 機器頁：每一列一張卡，條號、移植狀態照原文；跳窗的四欄與移植狀態照原文、順序固定；標籤定義每一種都在', () => {
  const src = sources();
  const o = own();
  const { html } = manual.build(src);
  const rows = ownMachineRows(o.machines);
  const labels = ownRowLabels(rows);
  const ids = o.rules.sections.flatMap((s) => s.rules.map((r) => `${s.letter}${r.n}`));
  for (const sample of ROW_LABEL_SAMPLES) assert.ok(labels.includes(sample), `寫死的樣本「${sample}」不在考題自己算的標題裡：樣本要跟著 MACHINES.md 改`);
  assert.equal(new Set(labels).size, labels.length, '考題自己算的標題有重複：重名的規則沒算對');
  assert.ok(rows.length >= 20, '考題自己讀到的機器表太少：對照讀錯了');
  const NON_RULE = ['案例簿'];
  assert.deepEqual(manual.NON_RULE_KEYS, NON_RULE, '機器表第一格允許的字面值改了：要連這一題一起改');
  const page = html.match(/<section class="page" id="page-machines" data-page="machines" hidden>([\s\S]*?)\n<\/section>\n<section class="page" id="page-tools"/u)[1];
  assert.equal(page.match(/<h1>([^<]*)<\/h1>/u)[1], escT(o.machines.split('\n')[0].slice(2).trim()), '機器頁大標題要是 MACHINES.md 的大標題');
  const cards = [...page.matchAll(/<article class="mrow" id="mach-(m\d+)"[^>]*>([\s\S]*?)<\/article>/gu)];
  assert.equal(cards.length, rows.length, '卡的張數要等於機器表的列數');
  const data = JSON.parse(html.match(/<script type="application\/json" id="machine-data">([\s\S]*?)<\/script>/u)[1]);
  assert.ok(!html.match(/id="machine-data">([\s\S]*?)<\/script>/u)[1].includes('<'), '機器跳窗資料不能有原始的「<」');
  rows.forEach((row, i) => {
    const [, mid, body] = cards[i];
    const keys = [...body.matchAll(/<(?:button type="button" class="rule-link" data-goto="rule-([A-K]\d+)"|span class="key-plain")>([^<]*)<\/(?:button|span)>/gu)].map((x) => [x[1] || null, x[2]]);
    for (const k of row.keys) assert.ok(ids.includes(k) || NON_RULE.includes(k), `第 ${i + 1} 列第一格的「${k}」不是條號、也不是考題登記的字面值`);
    assert.deepEqual(keys, row.keys.map((k) => [ids.includes(k) ? k : null, k]), `第 ${i + 1} 列的條號不對`);
    const firstCode = (row.fields[0].match(/`([^`]+)`/u) || [])[1];
    if (firstCode) assert.ok(body.includes(`<code class="mrow-sub">${escT(firstCode)}</code>`), `第 ${i + 1} 列卡上沒有顯示它的第一個實作檔`);
    const popupRules = [...data[mid].html.matchAll(/data-goto="rule-([A-K]\d+)">([^<]*)<\/button>/gu)].map((x) => [x[1], x[2]]);
    assert.deepEqual(popupRules, row.keys.filter((k) => ids.includes(k)).map((k) => [k, k]), `第 ${i + 1} 列跳窗裡的條號鈕不對`);
    assert.equal(strip(body.match(/<p class="mrow-status">([\s\S]*?)<\/p>/u)[1]), `移植狀態${proseText(row.status)}`, `第 ${i + 1} 列的移植狀態不對`);
    assert.ok(body.includes(`<button type="button" class="more" data-machine="${mid}" aria-label="看 ${escT(labels[i])} 這台機器怎麼守">`), `第 ${i + 1} 列開跳窗的鈕不對（要寫「看 ${labels[i]} 這台機器怎麼守」）`);
    const entry = data[mid];
    assert.equal(entry.title, `${labels[i]} 的機器`, `第 ${i + 1} 列跳窗標題不對`);
    const dd = [...entry.html.matchAll(/<dt>([^<]+)<\/dt><dd>([\s\S]*?)<\/dd>/gu)].map((x) => [x[1], strip(x[2])]);
    assert.deepEqual(dd, [['原專案的實作', proseText(row.fields[0])], ['違反時會紅的條件', proseText(row.fields[1])], ['守不到的', proseText(row.fields[2])], ['啟用前提', proseText(row.fields[3])], ['移植狀態', proseText(row.status)]], `第 ${i + 1} 列跳窗的內容不是原文`);
  });
  const defs = [...page.matchAll(/<div class="label-def"><button type="button" class="chip [^"]+" data-label="([^"]+)">[^<]*<\/button><dl class="def"><dt>意思<\/dt><dd>([\s\S]*?)<\/dd><dt>守不到的<\/dt><dd>([\s\S]*?)<\/dd><\/dl><\/div>/gu)].map((x) => [x[1], strip(x[2]), strip(x[3])]);
  assert.deepEqual(defs, ownLabels(o.machines).map((l) => [escT(l.name), proseText(l.meaning), proseText(l.limits)]), '機器頁的標籤定義跟標籤表不一樣（少一種、順序或內容不對）');
  const machLines = o.machines.split('\n');
  const introLines = machLines.slice(machLines.indexOf('## 本文條目 → 機器') + 1, machLines.indexOf('| 本文 | 原專案的實作 | 違反時會紅的條件 | 守不到的 | 啟用前提 | 移植狀態 |')).filter((l) => l.trim());
  assert.ok(page.includes(`<h2>規矩對到哪台機器</h2><p class="muted">`), '機器頁少了那張表的小標');
  assert.ok(page.includes('<h2>標籤</h2><p class="muted">規矩每一條「把關」那一行用的名字，定義在這裡。</p>'), '機器頁「標籤」那一節的說明不對（「把關」不一定是卡上最後一行）');
  assert.equal(strip(page.match(/<h2>規矩對到哪台機器<\/h2><p class="muted">([\s\S]*?)<\/p>/u)[1]), proseText(introLines.map((l) => l.trim()).join(' ')), '那張表上面的說明段不是原文');
  assert.ok(page.includes(`標籤 ${ownLabels(o.machines).length} 種；規矩對到機器的表 ${rows.length} 列`), '機器頁頁首的數字不對');
});

test('⑩ 工具頁：tools/ 與 tools/gates/ 每一支一則、照檔名排；說明是檔頭第一句；列出的機器表列＝「原專案的實作」欄寫到它的列', () => {
  const src = sources();
  const { html } = manual.build(src);
  const tools = ownTools();
  const rows = ownMachineRows(disk('MACHINES.md'));
  const labels = ownRowLabels(rows);
  assert.ok(tools.length >= 20, '考題自己列到的工具太少');
  const page = html.match(/<section class="page" id="page-tools" data-page="tools" hidden>([\s\S]*?)<p class="source-note">來源：tools\//u)[1];
  const items = [...page.matchAll(/<article class="tool"><h3><code>([^<]*)<\/code><\/h3><p>([\s\S]*?)<\/p><p class="rule-mach">([\s\S]*?)<\/p><\/article>/gu)];
  assert.deepEqual(items.map((x) => x[1]), tools.map((t) => t.path), '工具的清單或順序不對');
  items.forEach((x, i) => {
    const shown = strip(x[2]);
    assert.equal(shown, proseText(tools[i].line), `${tools[i].path} 的說明不是檔頭第一句`);
    assert.ok(shown.endsWith('。') && shown.indexOf('。') === shown.length - 1, `${tools[i].path} 的說明要剛好一句、以「。」結尾`);
    assert.ok(tools[i].para.startsWith(tools[i].line), `${tools[i].path} 的第一句要是檔頭第一段的開頭`);
    const want = rows.map((r, k) => [r, k]).filter(([r]) => r.fields[0].includes(`\`${tools[i].path}\``)).map(([, k]) => `m${k + 1}`);
    const got = [...x[3].matchAll(/data-machine="(m\d+)">([^<]*)<\/button>/gu)];
    assert.deepEqual(got.map((g) => g[1]), want, `${tools[i].path} 列出的機器表列不對（用列的內容比，不用標題比）`);
    for (const [, mid, label] of got) assert.equal(label, `${escT(labels[Number(mid.slice(1)) - 1])} 那一列`, `${tools[i].path} 的鈕上的字不是考題自己算的那一列標題`);
    if (!want.length) assert.equal(x[3], '<span class="tag-lead">機器表</span><span class="muted">機器表的「原專案的實作」那一欄沒有直接寫到它</span>', `${tools[i].path} 沒有對應列時要寫明（整句照寫死的字）`);
  });
  for (const [file, piece] of Object.entries(HEADER_SAMPLES)) {
    const it = items.find((x) => x[1] === file);
    if (it) assert.ok(strip(it[2]).includes(piece), `${file} 跨行接起來的那一句不對（寫死的樣本：${piece}）`);
  }
  // 機器表那一欄用別的寫法提到工具路徑（沒有框、兩個路徑放同一個框）＝停；較長路徑裡含它不算
  const mLines = src.machines.split('\n');
  const b1 = mLines.find((l) => l.startsWith('| B1 |'));
  assert.ok(b1 && b1.split('|')[2].includes('`tools/forbidden-tools.js`＋`tests/forbidden-tools.test.js`'), '前提：機器表 B1 那一列的「原專案的實作」照現在的寫法');
  for (const [from, to] of [['`tools/forbidden-tools.js`', 'tools/forbidden-tools.js'], ['`tools/forbidden-tools.js`＋`tests/forbidden-tools.test.js`', '`tools/forbidden-tools.js＋tests/forbidden-tools.test.js`']]) {
    assert.throws(() => manual.build({ ...src, machines: src.machines.replace(b1, b1.replace(from, to)) }), /B1」那一列的「原專案的實作」提到 tools\/forbidden-tools\.js，但不是一個灰底框剛好放這一個路徑/u, `工具路徑寫成「${to}」應該停下`);
  }
  assert.doesNotThrow(() => manual.build({ ...src, machines: src.machines.replace(b1, b1.replace('`tools/forbidden-tools.js`', '`tools/forbidden-tools.js`（另見 `tools/forbidden-tools.js.orig`）')) }), '對照組：較長的路徑裡含它不算');
  const checkReview = items.find((x) => x[1] === 'tools/gates/check-review-verdicts.js');
  assert.ok(checkReview && strip(checkReview[2]).includes('放行只認'), '跨兩行的第一句要接起來（check-review-verdicts 的後半「放行只認…」）');
  assert.ok(page.includes(`${tools.length} 支程式`), '工具頁頁首的支數不對');
  const groups = [...page.matchAll(/<span class="sec-count">(\d+) 支<\/span>/gu)].map((g) => Number(g[1]));
  assert.deepEqual(groups, [tools.filter((t) => t.path.split('/').length === 2).length, tools.filter((t) => t.path.startsWith('tools/gates/')).length]);
});

test('⑪ 規矩頁的「機器表」連結：每一條列出的列＝機器表第一格寫到它的那幾列，點了打開的就是那一列', () => {
  const src = sources();
  const o = own();
  const { html } = manual.build(src);
  const rows = ownMachineRows(o.machines);
  const labels = ownRowLabels(rows);
  const data = JSON.parse(html.match(/id="machine-data">([\s\S]*?)<\/script>/u)[1]);
  let linked = 0;
  for (const s of o.rules.sections) {
    for (const r of s.rules) {
      const id = `${s.letter}${r.n}`;
      const c = card(html, id);
      const want = rows.map((row, k) => [row, k]).filter(([row]) => row.keys.includes(id)).map(([, k]) => `m${k + 1}`);
      const got = [...c.matchAll(/class="mach-link" data-machine="(m\d+)">([^<]*)<\/button>/gu)];
      assert.deepEqual(got.map((g) => g[1]), want, `${id} 的機器表連結不對（用列的內容比）`);
      assert.equal(new Set(got.map((g) => g[2])).size, got.length, `${id} 有兩顆字一樣的機器表鈕，分不出是哪一列`);
      for (const [, mid, label] of got) assert.equal(label, `${escT(labels[Number(mid.slice(1)) - 1])} 那一列`, `${id} 機器表鈕上的字不是考題自己算的那一列標題`);
      if (want.length) linked += 1;
      else assert.ok(!c.includes('class="rule-mach"'), `${id} 沒有對應列時不該有機器表那一行`);
    }
  }
  assert.ok(linked >= 20, '有機器表連結的規矩太少：對照讀錯了');
  const titles = Object.values(data).map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length, '兩列機器的跳窗標題一樣，分不出是哪一列');
});

test('⑫ 讀來源那一步：readSources() 讀到的每一份原文都跟磁碟上的一模一樣（規則資料、MACHINES.md、GLOSSARY.md、工具、考題、範本的檔名與原文、空白設定範本、README.md、案例簿）', () => {
  const src = sources();
  const o = own();
  assert.deepEqual(Object.keys(src).sort(), ['cases', 'glossary', 'machines', 'readme', 'rules', 'settingsTemplate', 'templates', 'tests', 'tools'], 'readSources 多讀或少讀了一份來源：要連這一題一起改');
  const ownCases = ownCaseSources();
  assert.ok(ownCases.files.length >= 100, '考題自己列到的案例太少');
  assert.deepEqual(src.cases, ownCases, '案例簿（index.json、每一則的檔名、順序、原文）讀進來跟磁碟上的不一樣');
  assert.equal(src.readme, disk('README.md'), 'README.md 讀進來跟磁碟上的不一樣');
  assert.equal(src.settingsTemplate, disk('tests/helpers/unfilled-settings.json'), '空白設定範本讀進來跟磁碟上的不一樣');
  assert.deepEqual(src.rules, o.rules, 'rules.json 讀進來跟磁碟上的不一樣');
  assert.equal(src.machines, o.machines, 'MACHINES.md 讀進來跟磁碟上的不一樣（漏列、改字都會在這裡紅）');
  assert.equal(src.glossary, o.glossary, 'GLOSSARY.md 讀進來跟磁碟上的不一樣');
  assert.deepEqual(src.tools, ownTools().map((t) => ({ path: t.path, text: t.text })), '工具的清單、順序或原文跟磁碟上的不一樣');
  assert.deepEqual(src.tests, ownTests().map((t) => ({ path: t.path, text: t.text })), '考題的清單、順序或原文跟磁碟上的不一樣');
  const files = fs.readdirSync(path.join(manual.ROOT, 'templates')).map((f) => `templates/${f}`).sort();
  assert.ok(files.length >= 15, '考題自己列到的範本太少');
  assert.deepEqual(src.templates, files.map((f) => ({ path: f, text: disk(f) })), '範本的檔名、順序或原文跟磁碟上的不一樣');
});

test('⑬ 考題頁：照 tests/manifest.json 的清單與順序每一支一則；說明是檔頭第一句；列出的機器表列＝「原專案的實作」欄寫到它的列；清單跟資料夾對不上就停', () => {
  const src = sources();
  const { html } = manual.build(src);
  const tests = ownTests();
  const rows = ownMachineRows(disk('MACHINES.md'));
  const labels = ownRowLabels(rows);
  assert.ok(tests.length >= 25, '考題自己列到的考題檔太少');
  const page = html.match(/<section class="page" id="page-tests" data-page="tests" hidden>([\s\S]*?)<p class="source-note">來源：tests\/manifest\.json/u)[1];
  const items = [...page.matchAll(/<article class="tool"><h3><code>([^<]*)<\/code><\/h3><p>([\s\S]*?)<\/p><p class="rule-mach">([\s\S]*?)<\/p><\/article>/gu)];
  assert.deepEqual(items.map((x) => x[1]), tests.map((t) => t.path), '考題的清單或順序不對');
  items.forEach((x, i) => {
    const shown = strip(x[2]);
    assert.equal(shown, proseText(tests[i].line), `${tests[i].path} 的說明不是檔頭第一句`);
    assert.ok(shown.endsWith('。') && shown.indexOf('。') === shown.length - 1, `${tests[i].path} 的說明要剛好一句、以「。」結尾`);
    assert.ok(tests[i].para.startsWith(tests[i].line), `${tests[i].path} 的第一句要是檔頭第一段的開頭`);
    const want = rows.map((r, k) => [r, k]).filter(([r]) => r.fields[0].includes(`\`${tests[i].path}\``)).map(([, k]) => k);
    const got = [...x[3].matchAll(/data-machine="(m\d+)">([^<]*)<\/button>/gu)];
    assert.deepEqual(got.map((g) => g[1]), want.map((k) => `m${k + 1}`), `${tests[i].path} 列出的機器表列不對（用列的內容比）`);
    got.forEach((g, j) => assert.equal(g[2], `${escT(labels[want[j]])} 那一列`, `${tests[i].path} 的鈕上的字不是考題自己算的那一列標題`));
    if (!want.length) assert.equal(x[3], '<span class="tag-lead">機器表</span><span class="muted">機器表的「原專案的實作」那一欄沒有直接寫到它</span>', `${tests[i].path} 沒有對應列時要寫明（整句照寫死的字）`);
  });
  for (const [file, piece] of Object.entries(HEADER_SAMPLES)) {
    const it = items.find((x) => x[1] === file);
    if (it) assert.ok(strip(it[2]).includes(piece), `${file} 跨行接起來的那一句不對（寫死的樣本：${piece}）`);
  }
  assert.ok(items.some((x) => x[1] === 'tests/forbidden-defaults.test.js') && items.some((x) => x[1] === 'tests/kit-lock.test.js'), '寫死的接行樣本已經不在考題清單上：樣本要跟著改');
  const settings = items.find((x) => x[1] === 'tests/settings.test.js');
  assert.ok(settings && settings[3].includes('>H1：tests/settings.test.js 那一列<'), 'settings 那支考題要連到「H1：tests/settings.test.js」那一列（寫死的樣本）');
  assert.ok(page.includes(`<p class="page-sum">${tests.length} 支考題檔（照 tests/manifest.json 的清單與順序），每支一句話（取自它檔頭的第一句）；後面列出機器表「原專案的實作」那一欄寫到它的列，點了看那台機器怎麼守。</p>`), '考題頁頁首那一句不對（數字或字）');
  assert.ok(html.includes('<p class="source-note">來源：tests/manifest.json 的清單、每一支考題檔的檔頭，以及 MACHINES.md「本文條目 → 機器」那張表的「原專案的實作」欄。tests/helpers/ 底下的檔不列。</p>'), '考題頁的來源註記不對');
  assert.ok(page.includes('<p class="eyebrow">tests/ 底下的考題</p>\n<h1>考題</h1>'), '考題頁的大標題不對');
  assert.ok(page.includes(`<span class="sec-count">${tests.length} 支</span>`), '考題那一塊的支數不對');
  // 機器表那一欄用別的寫法提到考題檔（兩個路徑放同一個框、沒有框）＝停，不說「沒有直接寫到它」
  const mm = src.machines;
  assert.ok(mm.includes('`tests/scan-probe.test.js`、`tests/scan-postmortem.test.js`') && mm.includes('`tests/file-names.test.js`'), '前提：機器表 G2、E6 兩列照現在的寫法');
  assert.throws(() => manual.build({ ...src, machines: mm.replace('`tests/scan-probe.test.js`、`tests/scan-postmortem.test.js`', '`tests/scan-probe.test.js、tests/scan-postmortem.test.js`') }), /G2」那一列的「原專案的實作」提到 tests\/scan-(probe|postmortem)\.test\.js，但不是一個灰底框剛好放這一個路徑/u);
  assert.throws(() => manual.build({ ...src, machines: mm.replace('`tests/file-names.test.js`', 'tests/file-names.test.js') }), /E6」那一列的「原專案的實作」提到 tests\/file-names\.test\.js/u);
  assert.doesNotThrow(() => manual.build({ ...src, machines: mm.replace('`tests/file-names.test.js`', '`tests/file-names.test.js`（另見 `tests/file-names.test.js.bak` 與 x/tests/file-names.test.js）') }), '對照組：較長的路徑裡含它不算');
  // 檔頭沒有說明就停（用注入的來源，不動真的檔）
  assert.throws(() => manual.build({ ...src, tests: [...src.tests, { path: 'tests/no-header.test.js', text: "'use strict';\nconst x = 1;\n" }] }), /tests\/no-header\.test\.js 的前三行沒有「\/\/ 」開頭的說明，考題頁不知道它做什麼/u);
  assert.throws(() => manual.build({ ...src, tests: [...src.tests, { path: 'tests/noperiod.test.js', text: '// 沒有句號\n' }] }), /tests\/noperiod\.test\.js 檔頭的第一段沒有「。」，考題頁取不到完整的第一句/u);
  // 清單跟資料夾：在暫存資料夾裡自己擺一份小的
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-tests-'));
  try {
    const t = path.join(dir, 'tests');
    const reset = () => {
      fs.rmSync(t, { recursive: true, force: true });
      fs.mkdirSync(path.join(t, 'helpers'), { recursive: true });
      fs.writeFileSync(path.join(t, 'manifest.json'), '["a.test.js"]');
      fs.writeFileSync(path.join(t, 'package.json'), '{}');
      fs.writeFileSync(path.join(t, 'a.test.js'), '// 甲。\n');
    };
    reset();
    for (const f of ['kit-copy.js', 'helper.mjs', 'blank.json', 'data-test.json', 'notes.md']) fs.writeFileSync(path.join(t, 'helpers', f), 'x');
    assert.deepEqual(manual.readTests(dir), [{ path: 'tests/a.test.js', text: '// 甲。\n' }], '對照組：helpers/ 底下放檔名不含 test 的程式檔、資料檔（檔名含 test 的 .json 也算）、其他檔，照收');
    const cases = [
      ['清單列了沒有的檔', () => fs.writeFileSync(path.join(t, 'manifest.json'), '["a.test.js","b.test.js"]'), /列了 b\.test\.js，但 tests\/ 底下沒有這個檔/u],
      ['資料夾多一支沒列', () => fs.writeFileSync(path.join(t, 'c.test.js'), '// 丙。\n'), /tests\/c\.test\.js 不在 tests\/manifest\.json 的清單上/u],
      ['清單重複', () => fs.writeFileSync(path.join(t, 'manifest.json'), '["a.test.js","a.test.js"]'), /有重複的檔名/u],
      ['清單是空的', () => fs.writeFileSync(path.join(t, 'manifest.json'), '[]'), /要是一串考題檔名/u],
      ['清單不是陣列', () => fs.writeFileSync(path.join(t, 'manifest.json'), '{"a":1}'), /要是一串考題檔名/u],
      ['清單有不像考題的名字', () => fs.writeFileSync(path.join(t, 'manifest.json'), '["a.test.js","../x.test.js"]'), /要是一串考題檔名/u],
      ['清單不是 JSON', () => fs.writeFileSync(path.join(t, 'manifest.json'), '["a.test.js",'), /tests\/manifest\.json 不是合法的 JSON/u],
      ['沒有清單', () => fs.rmSync(path.join(t, 'manifest.json')), /讀不到 tests\/manifest\.json/u],
      ['不認得的檔', () => fs.writeFileSync(path.join(t, 'notes.md'), 'x'), /tests\/notes\.md：考題頁不知道它算不算考題/u],
      ['不認得的資料夾', () => fs.mkdirSync(path.join(t, 'fixtures')), /tests\/fixtures：考題頁不知道它算不算考題/u],
      ['helpers 是檔不是資料夾', () => { fs.rmSync(path.join(t, 'helpers'), { recursive: true }); fs.writeFileSync(path.join(t, 'helpers'), 'x'); }, /tests\/helpers：考題頁不知道它算不算考題/u],
      ['叫 .test.js 的資料夾', () => fs.mkdirSync(path.join(t, 'd.test.js')), /tests\/d\.test\.js：考題頁不知道它算不算考題/u],
      ['package.json 是資料夾', () => { fs.rmSync(path.join(t, 'package.json')); fs.mkdirSync(path.join(t, 'package.json')); }, /tests\/package\.json：考題頁不知道它算不算考題/u],
      ['helpers 底下有 .test.js', () => fs.writeFileSync(path.join(t, 'helpers', 'e.test.js'), '// 戊。\n'), /tests\/helpers\/e\.test\.js：考題頁不知道它算不算考題/u],
      ['helpers 底下有 test- 開頭的 .js（Node 會跑）', () => fs.writeFileSync(path.join(t, 'helpers', 'test-extra.js'), 'x'), /tests\/helpers\/test-extra\.js：考題頁不知道它算不算考題/u],
      ['helpers 底下有 .test.cjs（Node 會跑）', () => fs.writeFileSync(path.join(t, 'helpers', 'extra.test.cjs'), 'x'), /tests\/helpers\/extra\.test\.cjs：考題頁不知道它算不算考題/u],
      ['helpers 底下有 .test.cts', () => fs.writeFileSync(path.join(t, 'helpers', 'x.test.cts'), 'x'), /tests\/helpers\/x\.test\.cts：考題頁不知道它算不算考題/u],
      ['helpers 底下有 .test.mts', () => fs.writeFileSync(path.join(t, 'helpers', 'x.test.mts'), 'x'), /tests\/helpers\/x\.test\.mts：考題頁不知道它算不算考題/u],
      ['helpers 底下有 _test.mjs', () => fs.writeFileSync(path.join(t, 'helpers', 'x_test.mjs'), 'x'), /tests\/helpers\/x_test\.mjs：考題頁不知道它算不算考題/u],
      ['helpers 底下有大寫 Test 的 .ts', () => fs.writeFileSync(path.join(t, 'helpers', 'Test-y.ts'), 'x'), /tests\/helpers\/Test-y\.ts：考題頁不知道它算不算考題/u],
      ['helpers 底下檔名含 test 的程式檔（寧可多停）', () => fs.writeFileSync(path.join(t, 'helpers', 'latest.js'), 'x'), /tests\/helpers\/latest\.js：考題頁不知道它算不算考題/u],
      ['helpers 底下有資料夾', () => fs.mkdirSync(path.join(t, 'helpers', 'deep')), /tests\/helpers\/deep：考題頁不知道它算不算考題/u],
      ['helpers 底下有叫 test 的資料夾', () => fs.mkdirSync(path.join(t, 'helpers', 'test')), /tests\/helpers\/test：考題頁不知道它算不算考題/u],
    ];
    for (const [name, mutate, pattern] of cases) {
      reset();
      mutate();
      assert.throws(() => manual.readTests(dir), pattern, `「${name}」應該停下`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('⑭ 範本頁：MACHINES.md「範本」那一節每一則一張卡、照原文順序；檔名、說明、看全文的鈕、說明裡的條號、寫到它的機器表列都對；每一份範本剛好出現一次；形狀不對就停', () => {
  const src = sources();
  const o = own();
  const { html } = manual.build(src);
  const withTemplates = (...extra) => [...src.templates, ...extra.map((p) => ({ path: p, text: `${p}\n` }))].sort((a, b) => (a.path < b.path ? -1 : 1));
  const items = ownTemplates(o.machines);
  const rows = ownMachineRows(o.machines);
  const labels = ownRowLabels(rows);
  const ids = o.rules.sections.flatMap((s) => s.rules.map((r) => `${s.letter}${r.n}`));
  const files = fs.readdirSync(path.join(manual.ROOT, 'templates')).map((f) => `templates/${f}`).sort();
  assert.ok(items.length >= 10, '考題自己讀到的範本說明太少：對照讀錯了');
  assert.deepEqual(items.flatMap((x) => x.paths).sort(), files, '考題自己讀到的範本跟 templates/ 對不上（讀錯了，或 MACHINES.md 那一節漏列）');
  for (const [file, want] of Object.entries(TEMPLATE_RULE_SAMPLES)) {
    assert.deepEqual(items.find((x) => x.paths.includes(file)).rules, want, `${file} 的條號跟寫死的樣本不一樣（樣本要跟著 MACHINES.md 改）`);
  }
  const page = html.match(/<section class="page" id="page-templates" data-page="templates" hidden>([\s\S]*?)<p class="source-note">來源：templates\//u)[1];
  const cards = [...page.matchAll(/<article class="tool"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p>\n<p class="rule-tpl"><span class="tag-lead">全文<\/span>([\s\S]*?)<\/p><p class="rule-mach"><span class="tag-lead">規矩<\/span>([\s\S]*?)<\/p><p class="rule-mach"><span class="tag-lead">機器表<\/span>([\s\S]*?)<\/p><\/article>/gu)];
  assert.equal(cards.length, items.length, '卡的張數要等於「範本」那一節的則數');
  cards.forEach((c, i) => {
    const item = items[i];
    const where = item.paths.join('、');
    assert.equal(c[1], item.paths.map((p) => `<code>${escT(p)}</code>`).join('、'), `${where}：卡上的檔名或順序不對`);
    assert.equal(strip(c[2]), proseText(item.desc), `${where}：說明不是原文`);
    assert.equal(c[3], item.paths.map((p) => `<button type="button" class="tpl-link" data-template="${escT(p)}">${escT(p.slice('templates/'.length))}</button>`).join(''), `${where}：看全文的鈕要每一份一顆、照順序、字是檔名`);
    const ruleBtns = [...c[4].matchAll(/<button type="button" class="rule-link" data-goto="rule-([A-K]\d+)">([^<]*)<\/button>/gu)].map((x) => [x[1], x[2]]);
    assert.deepEqual(ruleBtns, item.rules.map((r) => [r, r]), `${where}：條號鈕跟說明裡寫到的條號不一樣`);
    for (const r of item.rules) assert.ok(ids.includes(r) && html.includes(`<article class="rule" id="rule-${r}"`), `${where}：條號 ${r} 要是規矩頁上有的那一條`);
    if (!item.rules.length) assert.ok(c[4].includes('說明裡沒有寫到條號'), `${where}：沒有條號時要寫明`);
    const want = rows.map((r, k) => [r, k]).filter(([r]) => item.paths.some((p) => r.fields[0].includes(`\`${p}\``))).map(([, k]) => k);
    const got = [...c[5].matchAll(/data-machine="(m\d+)">([^<]*)<\/button>/gu)];
    assert.deepEqual(got.map((g) => g[1]), want.map((k) => `m${k + 1}`), `${where}：列出的機器表列不對（用列的內容比）`);
    got.forEach((g, j) => assert.equal(g[2], `${escT(labels[want[j]])} 那一列`, `${where}：鈕上的字不是考題自己算的那一列標題`));
    if (!want.length) assert.equal(c[5], `<span class="muted">機器表的「原專案的實作」那一欄沒有直接寫到${item.paths.length > 1 ? '這幾份' : '它'}</span>`, `${where}：沒有對應列時要寫明（整句照寫死的字）`);
  });
  const laidOut = Object.values(JSON.parse(html.match(/id="template-data">([\s\S]*?)<\/script>/u)[1])).filter((e) => e.html.includes('<div class="tpl-body">')).length;
  assert.ok(page.includes(`<p class="page-sum">${files.length} 份範本、${items.length} 則說明（取自 MACHINES.md「範本」那一節，一則可以講好幾份）。每則後面列出說明裡寫到的條號（點了跳到那一條規矩），以及機器表「原專案的實作」那一欄寫到這幾份的列。「全文」那一行點檔名看範本全文：說明書排得了的照它的排法顯示（現在 ${laidOut} 份），其餘照原始檔顯示。</p>`), '範本頁頁首那一句不對（數字或字）');
  assert.ok(html.includes('<p class="source-note">來源：templates/ 底下的檔（檔名與全文）、MACHINES.md「範本」那一節（說明與條號；條號只認灰底框以外、A〜K 加數字的寫法）與「本文條目 → 機器」那張表的「原專案的實作」欄。</p>'), '範本頁的來源註記不對');
  assert.ok(page.includes('<p class="eyebrow">templates/ 底下的範本</p>\n<h1>範本</h1>'), '範本頁的大標題不對');
  for (const item of items) {
    assert.ok(item.desc.trim(), `${item.paths.join('、')}：說明是空的`);
    // 考題自己的分法：用「、，,；;。」切成段，每一段裡最多一個條號（兩個條號擠在同一段＝分不出兩條還是範圍）
    for (const seg of item.desc.replace(/`[^`]*`/gu, ' ').split(/[、，,；;。]/u)) {
      const ids = seg.split(/[^A-Za-z0-9]+/u).filter((x) => /^[A-K][0-9]+$/u.test(x));
      assert.ok(ids.length <= 1, `${item.paths.join('、')}：說明裡「${seg}」這一段有兩個條號、中間沒有分隔`);
    }
  }
  assert.ok(page.includes(`<h2>範本（本文指到「範本」的地方）<span class="sec-count">${items.length} 則</span></h2>`), '範本那一塊的小標或則數不對');
  // 停下：用注入的來源（不動真的檔）
  const m = src.machines;
  const HEAD = '## 範本（本文指到「範本」的地方）';
  const lines = m.split('\n');
  const first = lines[lines.indexOf(HEAD) + 1 + lines.slice(lines.indexOf(HEAD) + 1).findIndex((l) => l.startsWith('- '))];
  const cases = [
    ['小標改名', { machines: m.replace(HEAD, '## 範本') }, /找不到「## 範本（本文指到「範本」的地方）」/u],
    ['夾一段散文', { machines: m.replace(first, `${first}\n補一句說明`) }, /只收「- `templates\/…`：說明」這種條列/u],
    ['縮排續行', { machines: m.replace(first, `${first}\n  續行`) }, /只收「- `templates\/…`：說明」這種條列/u],
    ['別種條列', { machines: m.replace(first, `* ${first.slice(2)}`) }, /只收「- `templates\/…`：說明」這種條列/u],
    ['檔名後面沒有全形冒號', { machines: m.replace(first, first.replace('`：', '`:')) }, /只收「- `templates\/…`：說明」這種條列/u],
    ['檔名不是 templates/ 開頭', { machines: m.replace(first, first.replace('`templates/', '`tools/')) }, /只收「- `templates\/…`：說明」這種條列/u],
    ['同一份列兩次', { machines: m.replace(first, `${first}\n${first}`) }, /列了兩次/u],
    ['列了不存在的檔', { machines: m.replace(first, `${first}\n- \`templates/nope.md\`：沒有這個檔`) }, /列了 templates\/nope\.md，但 templates\/ 底下沒有這個檔/u],
    ['templates/ 有卻沒列', { templates: withTemplates('templates/extra.md') }, /templates\/extra\.md 不在 MACHINES\.md「範本」那一節/u],
    ['說明裡的條號打錯', { machines: m.replace(first, first.replace(/（[^（）]*）/u, '（K99）')) }, /說明裡的條號 K99 不在規則裡/u],
    ...[['全形波浪', 'G1〜G3'], ['粗體夾著', '**G1**〜**G3**'], ['半形', 'I1 ~ I3'], ['連字號', 'G1-G3'], ['到', 'G1 到 G3'], ['與', 'G1 與 G3'], ['數學波浪號', 'G1\u223cG3'], ['灰底框', 'G1 `~` G3']]
      .map(([how, text]) => [`相鄰條號沒有分隔（${how}）`, { machines: m.replace(first, first.replace(/（[^（）]*）/u, `（${text}）`)) }, new RegExp(`條號 ${text.match(/[A-K]\d+/gu)[0]} 與 ${text.match(/[A-K]\d+/gu)[1]} 之間沒有「、」「，」「；」「。」`, 'u')]),
    ['相鄰條號沒有分隔（前面另有用「、」分開的條號）', { machines: m.replace(first, first.replace(/（[^（）]*）/u, '（D3、G1〜G3）')) }, /條號 G1 與 G3 之間沒有「、」「，」「；」「。」/u],
    ['說明是空白', { machines: m.replace(first, first.replace(/：.*$/u, '：  ')) }, /這一則沒有說明/u],
  ];
  for (const [name, patch, pattern] of cases) {
    const key = Object.keys(patch)[0];
    assert.notDeepEqual(patch[key], src[key], `「${name}」這一發沒有改到來源`);
    assert.throws(() => manual.build({ ...src, ...patch }), pattern, `「${name}」應該停下`);
  }
  // 對照組：templates/ 多一份、那一節也補一行＝照收（灰底框裡像條號的字、前後黏著英數字的不算條號）
  const extra = manual.build({ ...src, templates: withTemplates('templates/extra.md'), machines: m.replace(first, `${first}\n- \`templates/extra.md\`：新範本，看 \`K99\` 那一格；AB1、B1x 不是條號`) }).html;
  const card = extra.match(/<article class="tool"><h3><code>templates\/extra\.md<\/code><\/h3>([\s\S]*?)<\/article>/u);
  assert.ok(card && card[1].includes('說明裡沒有寫到條號') && card[1].includes('沒有直接寫到它'), '新補的那一則要照收、沒有條號也沒有機器表列');
  // 對照組：六種合法分隔逐一照收成兩顆鈕（鈕的目標與字都核），粗體條號用「、」分開也照收
  for (const text of ['G1、G3', 'G1，G3', 'G1,G3', 'G1；G3', 'G1;G3', 'G1。G3', '**G1**、**G3**']) {
    const out = manual.build({ ...src, machines: m.replace(first, first.replace(/（[^（）]*）/u, `（${text}）`)) }).html;
    const firstCard = out.match(/<section class="page" id="page-templates"[\s\S]*?<article class="tool">([\s\S]*?)<\/article>/u)[1];
    assert.deepEqual([...firstCard.matchAll(/data-goto="rule-([A-K]\d+)">([^<]*)<\/button>/gu)].map((x) => [x[1], x[2]]), [['G1', 'G1'], ['G3', 'G3']], `「${text}」要照收成兩顆鈕`);
  }
  // 機器表那一欄用別的寫法提到範本路徑（沒有框、跟別的字放同一個框）＝停；較長路徑裡含它不算
  const b1 = lines.find((l) => l.startsWith('| B1 |'));
  assert.ok(b1 && b1.split('|')[2].includes('`templates/hook-claude.json`'), '前提：機器表 B1 那一列的「原專案的實作」用灰底框寫了 templates/hook-claude.json');
  for (const to of ['templates/hook-claude.json', '`templates/hook-claude.json 與活讀裝法`']) {
    assert.throws(() => manual.build({ ...src, machines: m.replace(b1, b1.replace('`templates/hook-claude.json`', to)) }), /B1」那一列的「原專案的實作」提到 templates\/hook-claude\.json，但不是一個灰底框剛好放這一個路徑/u, `範本路徑寫成「${to}」應該停下`);
  }
  assert.doesNotThrow(() => manual.build({ ...src, machines: m.replace(b1, b1.replace('`templates/hook-claude.json`', '`templates/hook-claude.json`（另見 x/templates/hook-claude.json）')) }), '對照組：較長的路徑裡含它不算');
  // 一則講兩份：都沒有機器表列＝寫「這幾份」；只有第二份被機器表第一列寫到＝也要列出那一列（不能只看第一份）
  const pair = (machines) => manual.build({ ...src, templates: withTemplates('templates/extra.md', 'templates/extra2.md'), machines: machines.replace(first, `${first}\n- \`templates/extra.md\`、\`templates/extra2.md\`：一則兩份`) }).html
    .match(/<article class="tool"><h3><code>templates\/extra\.md<\/code>、<code>templates\/extra2\.md<\/code><\/h3>([\s\S]*?)<\/article>/u)[1];
  assert.ok(pair(m).includes('沒有直接寫到這幾份'), '一則兩份、都沒有機器表列時要寫「這幾份」');
  const firstRow = m.split('\n')[m.split('\n').indexOf('| 本文 | 原專案的實作 | 違反時會紅的條件 | 守不到的 | 啟用前提 | 移植狀態 |') + 2];
  const cited = pair(m.replace(firstRow, firstRow.replace(/^(\| [^|]+ \| )/u, '$1`templates/extra2.md`＋')));
  assert.deepEqual([...cited.matchAll(/data-machine="(m\d+)"/gu)].map((x) => x[1]), ['m1'], '只有第二份被寫到時，那一列也要列出來');
  assert.ok(lines.slice(lines.indexOf(HEAD) + 1).every((l) => !l.startsWith('## ')), '前提：「範本」那一節現在是 MACHINES.md 的最後一節（最上面那次產生就是「接到檔案結尾也照收」的對照）');
  // templates/ 裡有資料夾就停
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-tpl-'));
  try {
    fs.mkdirSync(path.join(dir, 'templates', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'templates', 'a.md'), 'x');
    assert.throws(() => manual.readTemplates(dir), /templates\/sub：範本頁只認 templates\/ 第一層的檔/u);
    fs.rmSync(path.join(dir, 'templates', 'sub'), { recursive: true });
    assert.deepEqual(manual.readTemplates(dir), [{ path: 'templates/a.md', text: 'x' }], '對照組：只有一層的檔時照收');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * 考題自己讀設定說明（不用產生器的 parseSettingsDoc）：先用空行把整份切成塊，再看每塊的第一行——
 * 「# 」大標題、「## 」節標題、「|」表格（第二行是分隔列）、「- 」清單（「  N. 」是上一項的子項），其餘是段落。
 */
function ownSettingsDoc(md) {
  const chunks = md.replace(/\n+$/u, '').split(/\n\n+/u);
  const doc = { title: chunks[0].replace(/^# /u, ''), intro: [], sections: [] };
  let blocks = doc.intro;
  for (const chunk of chunks.slice(1)) {
    const rows = chunk.split('\n');
    if (rows[0].startsWith('## ')) {
      const sec = { title: rows[0].slice(3), blocks: [] };
      doc.sections.push(sec);
      blocks = sec.blocks;
    } else if (rows[0].startsWith('|')) {
      const cellsOf = (r) => r.slice(1, -1).split(/(?<!\\)\|/u).map((c) => c.replace(/^ +| +$/gu, '').split('\\|').join('|'));
      blocks.push({ kind: 'table', head: cellsOf(rows[0]), rows: rows.slice(2).map(cellsOf) });
    } else if (rows[0].startsWith('- ')) {
      const items = [];
      for (const r of rows) {
        const sub = r.match(/^ {2}(\d+)\. (.*)$/u);
        if (sub) items[items.length - 1].sub.push([Number(sub[1]), sub[2]]);
        else items.push({ text: r.slice(2), sub: [] });
      }
      blocks.push({ kind: 'list', items });
    } else {
      blocks.push({ kind: 'p', text: chunk });
    }
  }
  return doc;
}
/**
 * 設定說明看得到的字（另一種寫法）：先把字串切成「灰底框裡」與「框外」，框裡照字面，
 * 框外拿掉 **、再把「\」＋半形標點一次換回那個標點（GitHub 也是框裡不解跳脫）。
 */
const ownSettingsVisible = (v) => escT(v.split(/(`[^`]*`)/u).map((part, k) => (k % 2 ? part.slice(1, -1) : part.replace(/\*\*/gu, '').replace(/\\([!-/:-@[-`{-~])/gu, '$1'))).join(''));
const SETTINGS_JUMPS = ['一、參與者識別值', '二、來源字串標準表', '三、清單與正本的位置', '四、掃描發射者', '五、平台介面', '六、三關', '七、禁區', '八、合併後驗收分級', '九、風險分級', '十、複審與掃描分級', '十一、複審者的模型與怎麼起', '十二、忽略清單登記', '十三、合併步驟登記', '十四、機器啟用狀態'];
/**
 * 考題自己切行內記號（不用產生器的 settingsInline）：「\」＋半形標點＝那個標點、一對反引號＝灰底框（框裡照字面）、
 * 一對 **＝粗體（裡面可以再有灰底框），其餘照字面。回傳 [['t', 字] | ['code', 字] | ['strong', [...]]]，相鄰的字併成一段。
 */
function ownInline(src) {
  const out = [];
  const push = (tok) => {
    const last = out[out.length - 1];
    if (tok[0] === 't' && last && last[0] === 't') last[1] += tok[1];
    else out.push(tok);
  };
  for (let i = 0; i < src.length;) {
    if (src[i] === '\\' && /^[!-/:-@[-`{-~]$/u.test(src[i + 1] || '')) {
      push(['t', src[i + 1]]);
      i += 2;
    } else if (src[i] === '`') {
      const j = src.indexOf('`', i + 1);
      push(['code', src.slice(i + 1, j)]);
      i = j + 1;
    } else if (src.startsWith('**', i)) {
      const j = src.indexOf('**', i + 2);
      push(['strong', ownInline(src.slice(i + 2, j))]);
      i = j + 2;
    } else {
      push(['t', src[i]]);
      i += 1;
    }
  }
  return out;
}
const unescT = (v) => v.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&amp;/gu, '&');
/** 排好的行內 HTML 切回同樣的形狀：<strong>…</strong>、<code>…</code>、其餘的字（&amp; &lt; &gt; &quot; 換回原字）；有別的標籤就停。 */
function htmlInline(html, where) {
  assert.ok(!/<(?!\/?(?:strong|code)>)/u.test(html), `${where}：行內出現 <strong>、<code> 以外的標籤`);
  const root = [];
  const stack = [root];
  let code = null;
  const push = (tok) => {
    const cur = stack[stack.length - 1];
    const last = cur[cur.length - 1];
    if (tok[0] === 't' && last && last[0] === 't') last[1] += tok[1];
    else cur.push(tok);
  };
  for (const part of html.split(/(<\/?(?:strong|code)>)/u)) {
    if (part === '<strong>') {
      const kids = [];
      push(['strong', kids]);
      stack.push(kids);
    } else if (part === '</strong>') {
      stack.pop();
    } else if (part === '<code>') {
      code = '';
    } else if (part === '</code>') {
      push(['code', code]);
      code = null;
    } else if (code !== null) {
      code += unescT(part);
    } else if (part) {
      push(['t', unescT(part)]);
    }
  }
  return root;
}
/** 考題自己數一段字裡有幾個粗體、幾個灰底框（照 ownInline 切出來的形狀數，灰底框裡的 ** 與跳脫的記號都不算）。 */
function inlineCounts(src) {
  const walk = (toks) => toks.reduce((n, [kind, v]) => {
    if (kind === 'code') return { strong: n.strong, code: n.code + 1 };
    if (kind !== 'strong') return n;
    const inner = walk(v);
    return { strong: n.strong + 1 + inner.strong, code: n.code + inner.code };
  }, { strong: 0, code: 0 });
  return walk(ownInline(src));
}
const sumCounts = (texts) => texts.map(inlineCounts).reduce((a, b) => ({ strong: a.strong + b.strong, code: a.code + b.code }), { strong: 0, code: 0 });
/** 一格（段落、表頭、格子、清單項、子項）的兩種比法：看得到的字，以及粗體、灰底框包住哪些字（#29 r1 N1）。 */
function checkInline(html, src, where) {
  assert.equal(strip(html), ownSettingsVisible(src), `${where}的字不是原文`);
  assert.deepEqual(htmlInline(html, where), ownInline(src), `${where}的粗體、灰底框包住的字不對`);
}
/** 排好的 HTML 切成一塊一塊（段落、表格、清單、編號清單），給 checkBlocks 逐塊比。 */
const blocksOf = (part) => [...part.matchAll(/<p>([\s\S]*?)<\/p>|<div class="table-wrap">([\s\S]*?)<\/div>|<ul class="items">([\s\S]*?)<\/ul>|<ol class="items">([\s\S]*?)<\/ol>/gu)];
/** 逐塊比：段落、表格的表頭與每一格（列數、格數）、清單項與子項、編號清單每一項與它底下的程式碼框，字與行內記號都要跟考題自己讀的一樣。 */
const checkBlocks = (got, want, where) => {
  assert.equal(got.length, want.length, `${where}的塊數不對`);
  want.forEach((w, k) => {
    const g = got[k];
    const at = `${where}第 ${k + 1} 塊`;
    if (w.kind === 'p') {
      assert.ok(g[1] !== undefined, `${at}應該是段落`);
      checkInline(g[1], w.text, `${at}的段落`);
    } else if (w.kind === 'table') {
      assert.ok(g[2] !== undefined, `${at}應該是表格`);
      assert.match(g[2], /^<table class="grid"><thead><tr>(<th>[\s\S]*?<\/th>)+<\/tr><\/thead><tbody>(<tr>(<td>[\s\S]*?<\/td>)+<\/tr>)*<\/tbody><\/table>$/u, `${at}的表格結構不對（表頭要在 thead、資料列在 tbody）`);
      const th = [...g[2].matchAll(/<th>([\s\S]*?)<\/th>/gu)].map((x) => x[1]);
      assert.deepEqual(th.map(strip), w.head.map(ownSettingsVisible), `${at}的表頭不是原文`);
      th.forEach((cell, c) => checkInline(cell, w.head[c], `${at}表頭第 ${c + 1} 格`));
      const trs = [...g[2].matchAll(/<tr>([\s\S]*?)<\/tr>/gu)].slice(1).map((x) => [...x[1].matchAll(/<td>([\s\S]*?)<\/td>/gu)].map((y) => y[1]));
      assert.deepEqual(trs.map((r) => r.map(strip)), w.rows.map((r) => r.map(ownSettingsVisible)), `${at}的表格內容不是原文（列數、格數或字）`);
      trs.forEach((r, n) => r.forEach((cell, c) => checkInline(cell, w.rows[n][c], `${at}第 ${n + 1} 列第 ${c + 1} 格`)));
    } else if (w.kind === 'olist') {
      assert.ok(g[4] !== undefined, `${at}應該是編號清單`);
      const items = [...g[4].matchAll(/<li>((?:(?!<pre |<\/li>)[\s\S])*)((?:<pre class="code-box"><code>[\s\S]*?<\/code><\/pre>)*)<\/li>/gu)];
      assert.equal(items.length, w.items.length, `${at}的編號清單項數不對`);
      items.forEach((x, n) => {
        checkInline(x[1], w.items[n].text, `${at}第 ${n + 1} 項`);
        const boxes = [...x[2].matchAll(/<pre class="code-box"><code>([\s\S]*?)<\/code><\/pre>/gu)].map((y) => unescT(y[1]));
        assert.deepEqual(boxes, w.items[n].code.map((c) => c.join('\n')), `${at}第 ${n + 1} 項底下的程式碼框不是原文（個數或內容）`);
      });
    } else {
      assert.ok(g[3] !== undefined, `${at}應該是清單`);
      const items = [...g[3].matchAll(/<li>((?:(?!<ol>|<\/li>)[\s\S])*)(?:<ol>((?:<li>[\s\S]*?<\/li>)+)<\/ol>)?<\/li>/gu)];
      assert.deepEqual(items.map((x) => strip(x[1])), w.items.map((it) => ownSettingsVisible(it.text)), `${at}的清單項不是原文`);
      items.forEach((x, n) => {
        checkInline(x[1], w.items[n].text, `${at}第 ${n + 1} 項`);
        const sub = x[2] ? [...x[2].matchAll(/<li>([\s\S]*?)<\/li>/gu)].map((y) => y[1]) : [];
        assert.deepEqual(w.items[n].sub.map(([num]) => num), w.items[n].sub.map((z, q) => q + 1), `${at}第 ${n + 1} 項的子項在原文裡不是從 1 連號（前提）`);
        assert.deepEqual(sub.map(strip), w.items[n].sub.map(([, t]) => ownSettingsVisible(t)), `${at}第 ${n + 1} 項的子項不是原文`);
        sub.forEach((y, q) => checkInline(y, w.items[n].sub[q][1], `${at}第 ${n + 1} 項第 ${q + 1} 個子項`));
      });
    }
  });
};
/** 一塊裡看得到的字（照順序）：段落、表頭與每一格、清單項與子項。 */
const blockText = (b) => (b.kind === 'p' ? [b.text] : b.kind === 'table' ? [...b.head, ...b.rows.flat()] : b.items.flatMap((it) => [it.text, ...it.sub.map(([, t]) => t)]));
/** 一份文件整份看得到的字（去掉空白）：大標題、開頭、每一節的標題與各塊照順序接起來。 */
const docVisibleText = (doc) => [doc.title, ...doc.intro.flatMap(blockText), ...doc.sections.flatMap((sec) => [sec.title, ...sec.blocks.flatMap(blockText)])].map(ownSettingsVisible).join('').replace(/\s+/gu, '');
/** 排好的 HTML 裡各種標籤的個數（節的標籤各頁不同，各題自己另外數）。 */
function docTagCounts(body) {
  const count = (re) => (body.match(re) || []).length;
  return { p: count(/<p[ >]/gu), table: count(/<table /gu), thead: count(/<thead>/gu), tbody: count(/<tbody>/gu), tr: count(/<tr>/gu), th: count(/<th>/gu), td: count(/<td>/gu), ul: count(/<ul /gu), ol: count(/<ol>/gu), li: count(/<li>/gu), strong: count(/<strong>/gu), code: count(/<code>/gu) };
}
/** 考題自己數：一份讀好的文件排出來應該有幾個各種標籤（大標題那一段也算一個 <p>）。 */
function ownDocCounts(doc) {
  const all = [...doc.intro, ...doc.sections.flatMap((sec) => sec.blocks)];
  const tables = all.filter((b) => b.kind === 'table');
  const lists = all.filter((b) => b.kind === 'list');
  const inl = sumCounts([doc.title, ...doc.sections.map((sec) => sec.title), ...all.flatMap(blockText)]);
  return {
    p: 1 + all.filter((b) => b.kind === 'p').length,
    table: tables.length, thead: tables.length, tbody: tables.length,
    tr: tables.reduce((n, t) => n + 1 + t.rows.length, 0),
    th: tables.reduce((n, t) => n + t.head.length, 0),
    td: tables.reduce((n, t) => n + t.rows.flat().length, 0),
    ul: lists.length,
    ol: lists.reduce((n, l) => n + l.items.filter((it) => it.sub.length).length, 0),
    li: lists.reduce((n, l) => n + l.items.length + l.items.reduce((m, it) => m + it.sub.length, 0), 0),
    strong: inl.strong,
    code: inl.code,
  };
}

test('⑮ 設定頁：設定說明產生器對空白範本的產出，每一節、每一段、表格每一格、清單與子項都照原文（跳脫的標點還原），整頁不多不少；認不得的形狀就停', () => {
  const src = sources();
  const { html } = manual.build(src);
  const md = require('../tools/build-settings.js').build(JSON.parse(disk('tests/helpers/unfilled-settings.json')));
  const doc = ownSettingsDoc(md);
  assert.equal(doc.sections.length, SETTINGS_JUMPS.length, '考題自己讀到的節數跟寫死的樣本不一樣（樣本要跟著設定說明產生器改）');
  const page = html.match(/<section class="page" id="page-settings" data-page="settings" hidden>([\s\S]*?)<p class="source-note">來源：tests\/helpers\/unfilled-settings\.json/u)[1];
  assert.ok(page.includes('<p class="eyebrow">空白設定範本</p>\n<h1>設定</h1>'), '設定頁的大標題不對');
  assert.ok(page.includes(`<p class="page-sum">新專案的設定從空白範本 tests/helpers/unfilled-settings.json 開始。下面是 tools/build-settings.js 用那份範本產生的設定說明（跟每個專案的 PROJECT-SETTINGS.md 同一個產生器），共 ${doc.sections.length} 節。</p>`), '設定頁頁首那一句不對（數字或字）');
  assert.ok(html.includes('<p class="source-note">來源：tests/helpers/unfilled-settings.json（空白範本）經 tools/build-settings.js 產生的說明。這一頁不照 GitHub 的畫法：只排標題、段落、表格、清單、灰底框、粗體，其他字照原文顯示（只有寫在符號前面、讓符號不被當成排版記號的「\\」不顯示；GitHub 會把表情代碼變成圖示、網址變成連結，這裡照字面）。說明書認不得的行，以及一部分 GitHub 可能另作排版的行內記號（例如會變成斜體、HTML 的寫法），會讓整份停下不產生。</p>'), '設定頁的來源註記不對');
  const jumps = [...page.matchAll(/<button type="button" class="jump" data-jump="(set-\d+)">([^<]*)<\/button>/gu)];
  assert.deepEqual(jumps.map((j) => j[2]), SETTINGS_JUMPS, '跳到某一節的鈕跟寫死的節名不一樣');
  jumps.forEach((j, i) => assert.equal(j[1], `set-${i + 1}`, `第 ${i + 1} 顆跳節鈕的目標不對`));
  const body = page.match(/<div class="settings-body">\n([\s\S]*)\n<\/div>\n$/u)[1];
  assert.equal(strip(body.match(/^<p class="doc-title">([\s\S]*?)<\/p>/u)[1]), ownSettingsVisible(doc.title), '設定說明的大標題不是原文');
  checkBlocks(blocksOf(body.slice(0, body.indexOf('<section class="block"')).replace(/^<p class="doc-title">[\s\S]*?<\/p>/u, '')), doc.intro, '設定說明開頭');
  const secs = [...body.matchAll(/<section class="block" id="set-(\d+)" tabindex="-1">\n<h2>([\s\S]*?)<\/h2>\n([\s\S]*?)\n<\/section>/gu)];
  assert.equal(secs.length, doc.sections.length, '設定頁的節數不對');
  secs.forEach((x, i) => {
    assert.equal(x[1], String(i + 1), `第 ${i + 1} 節的 id 不對`);
    assert.equal(strip(x[2]), ownSettingsVisible(doc.sections[i].title), `第 ${i + 1} 節的標題不是原文`);
    checkBlocks(blocksOf(x[3]), doc.sections[i].blocks, `「${doc.sections[i].title}」那一節`);
  });
  // 整頁不多不少：看得到的字（去掉空白）＝大標題＋開頭＋每一節的標題與各塊照順序接起來；每一種標籤的個數也照考題自己數的
  assert.equal(strip(body).replace(/\s+/gu, ''), docVisibleText(doc), '設定頁看得到的字跟原文對不上（多了、少了或順序不對）');
  const count = (re) => (body.match(re) || []).length;
  assert.deepEqual(
    { ...docTagCounts(body), section: count(/<section /gu), h2: count(/<h2>/gu) },
    { ...ownDocCounts(doc), section: doc.sections.length, h2: doc.sections.length },
    '設定頁各種標籤的個數跟考題自己數的不一樣（多了空的清單、表頭跑到資料列……）',
  );
  // 寫死的樣本：表頭、跳脫還原（含反斜線本身）、粗體與灰底框、空的日期格、子項個數
  assert.ok(page.includes('<th>參與者</th><th>識別值</th><th>貼文帳號</th>'), '參與者那張表的表頭不對');
  assert.ok(strip(page).includes('(^|_)(transfer|withdraw(al)?|') && strip(page).includes('_\\w*?('), '跳脫的標點沒有還原（禁區那幾條樣式）');
  assert.ok(page.includes('<strong>展示</strong>') && page.includes('<code>docs/money-guard-two-pattern-tables.md</code>'), '粗體或灰底框沒排出來');
  assert.ok(page.includes('<td></td>'), '還沒驗過的日期那一格應該是空的格子');
  assert.equal(count(/<ol>/gu), 2, '寫死的樣本：子項清單有兩串（掃描那條鏈、三關指令）');
  // 停下：認不得的形狀與行內記號（直接餵整條排版流程，原因要對；最前面是合法的對照組）
  const OK = '# 標題\n\n開頭一段。\n\n## 一、甲\n\n| 欄 | 值 |\n|---|---|\n| a \\| b |  |\n\n- 一項\n  1. 子項\n- 二項\n';
  assert.ok(manual.renderSettings(OK).includes('<td>a | b</td><td></td>'), '對照組要照收：跳脫的「|」不分格、空格照收');
  for (const ok of ['開頭用 mcp__ 後面接空白、下一個 __ 前面。', '（~ 代表家目錄）、<清單檔>、a\\nb、\\.gitignore、SHARED_PATHS、2026-09-13 改的。', '一段 **粗體** 與 `灰底框\\_x`。']) {
    assert.doesNotThrow(() => manual.renderSettings(OK.replace('開頭一段。', ok)), `對照組「${ok}」要照收`);
  }
  assert.ok(manual.renderSettings(OK.replace('開頭一段。', '一段 `灰底框\\_x`。')).includes('<code>灰底框\\_x</code>'), '灰底框裡的反斜線照字面');
  const literal = manual.renderSettings(OK.replace('開頭一段。', '範例 A \\:smile\\: B、聯絡 123@example.com、網址 https://example.com 照字面。'));
  assert.ok(literal.includes('<p>範例 A :smile: B、聯絡 123@example.com、網址 https://example.com 照字面。</p>'), '表情代碼、信箱、網址照原文的字顯示（擁有者 2026-10-02 裁 a：不照 GitHub 的畫法）');
  const pipeInCode = manual.renderSettings(OK.replace('| a \\| b |  |', '| `a\\|b` | c |'));
  assert.ok(pipeInCode.includes('<td><code>a|b</code></td><td>c</td>'), '表格灰底框裡的「\\|」照 GitHub 表格的規則還原成「|」');
  // #28 r2 N1：表頭格也照同一條規則；格子灰底框裡的兩個反斜線照字面留兩個（預期直接寫死）
  assert.ok(manual.renderSettings(OK.replace('| 欄 | 值 |', '| `a\\|b` | 值 |')).includes('<th><code>a|b</code></th><th>值</th>'), '表頭格灰底框裡的「\\|」也要還原成「|」');
  assert.ok(manual.renderSettings(OK.replace('| a \\| b |  |', '| `a\\\\b` | c |')).includes('<td><code>a\\\\b</code></td><td>c</td>'), '資料格灰底框裡的兩個反斜線要照字面留兩個');
  assert.ok(manual.renderSettings(OK.replace('| a \\| b |  |', '|\u3000a | \u00a0b |')).includes('<td>\u3000a</td><td>\u00a0b</td>'), '格子頭尾只去半形空白：全形空白、不換行空白是字，照留');
  const boldTitle = manual.renderSettings(OK.replace('## 一、甲', '## 一、**甲**（說明）'));
  assert.ok(boldTitle.includes('<button type="button" class="jump" data-jump="set-1">一、甲</button>') && boldTitle.includes('<h2>一、<strong>甲</strong>（說明）</h2>'), '節標題有粗體時，跳節鈕的字要是去掉排版、「（」之前的字');
  const bad = [
    ['沒有大標題', OK.replace('# 標題\n\n', ''), /第一行應該是「# 」開頭的大標題/u],
    ['大標題是空的', OK.replace('# 標題', '#  '), /大標題：字是空的、或頭尾有空白/u],
    ['縮排行', OK.replace('開頭一段。', '   縮排'), /字是空的、或頭尾有空白/u],
    ['引用', OK.replace('開頭一段。', '> 引用'), /開頭是沒跳脫的半形標點（>）/u],
    ['小標', OK.replace('開頭一段。', '### 小標'), /開頭是沒跳脫的半形標點（#）/u],
    ['別種清單 *', OK.replace('開頭一段。', '* 別種清單'), /開頭是沒跳脫的半形標點（\*）/u],
    ['別種清單 +', OK.replace('開頭一段。', '+ 加號清單'), /開頭是沒跳脫的半形標點（\+）/u],
    ['清單記號後面是 tab', OK.replace('開頭一段。', '-\t項'), /tab 或 \\r/u],
    ['只有清單記號', OK.replace('開頭一段。', '-'), /開頭是沒跳脫的半形標點（-）/u],
    ['分隔線 ---', OK.replace('開頭一段。', '---'), /開頭是沒跳脫的半形標點（-）/u],
    ['分隔線 ***', OK.replace('開頭一段。', '***'), /開頭是沒跳脫的半形標點（\*）/u],
    ['分隔線 ___', OK.replace('開頭一段。', '___'), /開頭是沒跳脫的半形標點（_）/u],
    ['分隔線 - - -', OK.replace('開頭一段。', '- - -'), /開頭是沒跳脫的半形標點（-）/u],
    ['程式碼框 ```', OK.replace('開頭一段。', '```'), /開頭是沒跳脫的半形標點（`）/u],
    ['程式碼框 ~~~', OK.replace('開頭一段。', '~~~'), /開頭是沒跳脫的半形標點（~）/u],
    ['HTML 區塊', OK.replace('開頭一段。', '<div>x</div>'), /開頭是沒跳脫的半形標點（<）/u],
    ['頂層編號 1.', OK.replace('開頭一段。', '1. 頂層編號'), /段落的字像編號清單/u],
    ['頂層編號 1)', OK.replace('開頭一段。', '1) 頂層編號'), /段落的字像編號清單/u],
    ['清單項像編號清單', OK.replace('- 二項', '- 1. 二項'), /清單項的字像編號清單/u],
    ['段落連兩行', OK.replace('開頭一段。', '開頭一段。\n第二行'), /段落前面要空一行/u],
    ['段落裡有 \\r', OK.replace('開頭一段。', '開頭一段。\r## 節'), /tab 或 \\r/u],
    ['行尾有空白', OK.replace('開頭一段。', '開頭一段。 '), /結尾有空白/u],
    ['段落後直接接表格', OK.replace('開頭一段。', '開頭一段。\n| x | y |\n|---|---|'), /表格前面要空一行/u],
    ['清單後直接接表格', OK.replace('- 二項', '- 二項\n| x | y |\n|---|---|'), /表格前面要空一行/u],
    ['表格後直接接字', OK.replace('| a \\| b |  |', '| a \\| b |  |\n文字'), /表格後面直接接了別的東西/u],
    ['格數不對', OK.replace('| a \\| b |  |', '| a | b | c |'), /這一列 3 格、表頭 2 格/u],
    ['沒有分隔列', OK.replace('|---|---|\n', ''), /表頭底下應該是一樣格數的分隔列/u],
    ['分隔列格數不對', OK.replace('|---|---|', '|---|'), /表頭底下應該是一樣格數的分隔列/u],
    ['分隔列夾字', OK.replace('|---|---|', '|---|x|'), /表頭底下應該是一樣格數的分隔列/u],
    ['分隔列只有冒號', OK.replace('|---|---|', '|:|:|'), /表頭底下應該是一樣格數的分隔列/u],
    ['分隔列帶冒號', OK.replace('|---|---|', '|:---|---:|'), /表頭底下應該是一樣格數的分隔列/u],
    ['一列沒有「|」結尾', OK.replace('| a \\| b |  |', '| a \\| b |  | 多'), /要「\|」開頭、「\|」結尾/u],
    ['結尾的「|」被跳脫', OK.replace('| a \\| b |  |', '| a | b \\|'), /結尾的「\|」被跳脫了/u],
    ['子項前面不是清單', OK.replace('- 一項\n  1. 子項', '  1. 子項'), /子項前面要是「- 」清單/u],
    ['子項三格縮排', OK.replace('  1. 子項', '   1. 子項'), /清單後面直接接了別的東西/u],
    ['子項六格縮排', OK.replace('  1. 子項', '      1. 子項'), /清單後面直接接了別的東西/u],
    ['子項記號後兩格空白', OK.replace('  1. 子項', '  1.  子項'), /字是空的、或頭尾有空白/u],
    ['子項用 1)', OK.replace('  1. 子項', '  1) 子項'), /清單後面直接接了別的東西/u],
    ['子項不從 1 起', OK.replace('  1. 子項', '  2. 子項'), /子項要從 1 起連號/u],
    ['子項跳號', OK.replace('  1. 子項', '  1. 子項\n  3. 子項'), /子項要從 1 起連號、照寫成 2（這裡寫的是 3）/u],
    ['子項號碼前面補零', OK.replace('  1. 子項', '  01. 子項'), /子項要從 1 起連號、照寫成 1（這裡寫的是 01）/u],
    ['子項號碼超長', OK.replace('  1. 子項', '  0000000001. 子項'), /照寫成 1（這裡寫的是 0000000001）/u],
    ['子項的字像編號清單', OK.replace('  1. 子項', '  1. 1. 子項'), /子項的字像編號清單/u],
    ['節標題前沒空行', OK.replace('開頭一段。\n\n## 一、甲', '開頭一段。\n## 一、甲'), /節標題前面要空一行/u],
    ['大標題後直接接節標題', OK.replace('# 標題\n\n開頭一段。\n\n', '# 標題\n'), /節標題前面要空一行/u],
    ['節標題連著節標題', OK.replace('## 一、甲', '## 零\n## 一、甲'), /節標題前面要空一行/u],
    ['節標題是空的', OK.replace('## 一、甲', '## '), /結尾有空白/u],
    ['節標題開頭有空白', OK.replace('## 一、甲', '##  一、甲'), /字是空的、或頭尾有空白/u],
    ['節標題開頭是半形標點', OK.replace('## 一、甲', '## -甲'), /開頭是沒跳脫的半形標點（-）/u],
    ['節標題結尾是 #', OK.replace('## 一、甲', '## 一、甲 #'), /第 5 行：標題結尾是「#」/u],
    ['大標題結尾是 #', OK.replace('# 標題', '# 標題 #'), /大標題：標題結尾是「#」/u],
    ['清單前沒空行', OK.replace('開頭一段。', '開頭一段。\n- 項'), /清單前面要空一行/u],
    ['清單後直接接段落', OK.replace('- 二項', '- 二項\n一段'), /清單後面直接接了別的東西/u],
    ['兩串清單只隔一個空行', OK.replace('- 二項', '- 二項\n\n- 三項'), /兩串清單之間只隔一個空行/u],
    ['空行裡有空白', OK.replace('開頭一段。\n\n', '開頭一段。\n  \n'), /空行裡有空白字元/u],
    ['沒有任何一節', '# 標題\n\n開頭一段。\n', /沒有任何一節/u],
    ['反引號沒成對（節標題）', OK.replace('## 一、甲', '## 一、`甲'), /反引號沒有成對/u],
    ['反引號沒成對（表頭）', OK.replace('| 欄 | 值 |', '| `欄 | 值 |'), /反引號沒有成對/u],
    ['反引號沒成對（大標題）', OK.replace('# 標題', '# 標`題'), /反引號沒有成對/u],
    ['連續反引號', OK.replace('開頭一段。', '一段 `` 兩個'), /連續的反引號/u],
    ['灰底框頭尾有空白', OK.replace('開頭一段。', '一段 ` x ` 框'), /灰底框是空的、或頭尾有空白/u],
    ['灰底框收尾連著兩個反引號', OK.replace('開頭一段。', '一段 `x`` 框'), /連續的反引號/u],
    ['** 沒成對', OK.replace('開頭一段。', '一段 **粗'), /\*\* 沒有成對/u],
    ['** 旁邊是空白', OK.replace('開頭一段。', '2 ** 3 ** 2'), /粗體的頭尾緊貼空白或標點/u],
    ['** 旁邊是標點', OK.replace('開頭一段。', '一段**（括號）**完'), /粗體的頭尾緊貼空白或標點/u],
    ['單獨的 *', OK.replace('開頭一段。', '一段 *斜* 完'), /單獨的「\*」/u],
    ['_ 可能是斜體', OK.replace('開頭一段。', '一段 _斜_ 完'), /「_」後面緊接著字/u],
    ['~ 可能是刪除線', OK.replace('開頭一段。', '一段 ~刪~ 完'), /「~」後面緊接著字/u],
    ['< 接英文字母', OK.replace('開頭一段。', '一段 <b>粗</b>'), /「<」後面緊接著半形字元/u],
    ['< 接驚嘆號（HTML 註解）', OK.replace('開頭一段。', '一段 <!-- 隱藏字 --> 後文'), /「<」後面緊接著半形字元/u],
    ['< 接數字（信箱連結）', OK.replace('開頭一段。', '一段 <123@example.com> 後文'), /「<」後面緊接著半形字元/u],
    ['& 接 #（數字字元碼）', OK.replace('開頭一段。', '一段 &#65; 後文'), /「&」後面接英文字母或 #/u],
    ['& 接英文字母', OK.replace('開頭一段。', '一段 &amp; 完'), /「&」後面接英文字母或 #/u],
    ['[ 可能是連結', OK.replace('開頭一段。', '一段 [連結](x) 完'), /「\[」GitHub 可能當成連結/u],
    ['跳節鈕的字是空的', OK.replace('## 一、甲', '## （甲）'), /取不出跳節鈕的字/u],
  ];
  for (const [name, text, why] of bad) {
    assert.notEqual(text, OK, `「${name}」這一發沒有改到來源`);
    // 都要是排版認不得的那一種例外（LayoutError）：範本跳窗靠它決定改成照原始檔顯示
    assert.throws(() => manual.renderSettings(text), (err) => err instanceof manual.LayoutError && why.test(err.message), `「${name}」應該停下（LayoutError）、而且原因要對`);
  }
  // 範本不是 JSON、產生器產不出來、讀不到範本，都停
  assert.throws(() => manual.build({ ...src, settingsTemplate: '{' }), /空白設定範本（tests\/helpers\/unfilled-settings\.json）不是合法的 JSON/u);
  assert.throws(() => manual.build({ ...src, settingsTemplate: '{}' }), /空白設定範本產生不出設定說明/u);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-settings-'));
  try {
    for (const rel of ['rules.json', 'MACHINES.md', 'GLOSSARY.md', 'README.md']) fs.copyFileSync(path.join(manual.ROOT, rel), path.join(dir, rel));
    for (const d of ['tools', 'tests', 'templates', 'cases']) fs.cpSync(path.join(manual.ROOT, d), path.join(dir, d), { recursive: true });
    assert.doesNotThrow(() => manual.readSources(dir), '對照組：複本本身要讀得到');
    fs.rmSync(path.join(dir, 'tests', 'helpers', 'unfilled-settings.json'));
    assert.throws(() => manual.readSources(dir), /讀不到 tests\/helpers\/unfilled-settings\.json/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 範本跳窗開頭那一句（照寫，不拿產生器的常數當答案）
const TEMPLATE_NOTES = {
  laid: '這一份照說明書的排法顯示（跟設定頁同一套）：只排標題、段落、表格、清單、灰底框、粗體，其他字照原文、不照 GitHub 的畫法（只有寫在符號前面、讓符號不被當成排版記號的「\\」不顯示）。',
  md: '這一份用到說明書不排的寫法，照原始檔顯示：字跟檔案裡的一樣，只是沒有排版。',
  other: '這一份不是 .md 文件，照原始檔顯示。',
};
// 說明書排得了的範本：寫死的樣本（考題沒有自己的判準決定哪一份該排，所以釘住今天的結果；範本或排版規則一改就紅，確認是要的改變再跟著改）
const TEMPLATE_LAID_OUT = ['templates/review-fixed-dimensions.md', 'templates/verdict-header.md'];
// 規矩卡上的範本鈕：寫死的樣本（照 MACHINES.md 現在的「範本」那一節）
const TEMPLATE_LINK_SAMPLES = { F2: ['templates/review-fixed-dimensions.md'], G3: ['templates/pr-body.md', 'templates/scan-record.md'], E1: ['templates/pr-body.md', 'templates/ci-github.yml', 'templates/collab-fields-github.yml'] };

/**
 * 排好版的範本（跳窗裡 tpl-body 那一塊）跟考題自己讀的原文逐項比：大標題、開頭各塊、每一節（h3）的標題與各塊、
 * 看得到的字整份不多不少、每一種標籤的個數。
 */
function checkLaidOut(body, md, where) {
  const doc = ownSettingsDoc(md);
  const inner = body.match(/^<div class="tpl-body">\n([\s\S]*)\n<\/div>$/u);
  assert.ok(inner, `${where}：排好版的全文要包在 tpl-body 裡`);
  const b = inner[1];
  const title = b.match(/^<p class="doc-title">([\s\S]*?)<\/p>/u);
  assert.ok(title, `${where}：第一塊要是大標題`);
  assert.equal(strip(title[1]), ownSettingsVisible(doc.title), `${where}：大標題不是原文`);
  const parts = b.slice(title[0].length).split(/\n<h3>([\s\S]*?)<\/h3>/u);
  checkBlocks(blocksOf(parts[0]), doc.intro, `${where} 開頭`);
  assert.equal((parts.length - 1) / 2, doc.sections.length, `${where}：節數不對`);
  doc.sections.forEach((sec, i) => {
    assert.equal(strip(parts[1 + i * 2]), ownSettingsVisible(sec.title), `${where} 第 ${i + 1} 節的標題不是原文`);
    checkBlocks(blocksOf(parts[2 + i * 2]), sec.blocks, `${where}「${sec.title}」那一節`);
  });
  assert.equal(strip(b).replace(/\s+/gu, ''), docVisibleText(doc), `${where}：看得到的字跟原文對不上（多了、少了或順序不對）`);
  assert.deepEqual({ ...docTagCounts(b), h3: (b.match(/<h3>/gu) || []).length }, { ...ownDocCounts(doc), h3: doc.sections.length }, `${where}：各種標籤的個數跟考題自己數的不一樣`);
}

test('⑯ 範本全文跳窗：每一份範本一筆、標題是路徑；排得了的 .md 照設定頁那一套排（逐塊、看得到的字、標籤個數都照原文），其餘照原始檔一字不差；規矩卡的「範本」鈕＝MACHINES.md 寫到那一條的範本；F2 點得到複審必驗清單', () => {
  const src = sources();
  const o = own();
  const built = manual.build(src);
  const { html } = built;
  const files = fs.readdirSync(path.join(manual.ROOT, 'templates')).map((f) => `templates/${f}`).sort();
  const items = ownTemplates(o.machines);
  const json = html.match(/<script type="application\/json" id="template-data">([\s\S]*?)<\/script>/u);
  assert.ok(json, '找不到範本跳窗資料');
  assert.ok(!json[1].includes('<'), '範本跳窗資料放在 <script> 裡，不能有原始的「<」（要寫成 \\u003c）');
  const data = JSON.parse(json[1]);
  assert.deepEqual(Object.keys(data).sort(), files, '每一份範本要剛好一筆跳窗資料（以路徑為鍵）');
  let laid = 0;
  for (const file of files) {
    const text = disk(file);
    const e = data[file];
    assert.equal(e.title, file, `${file}：跳窗標題要是路徑`);
    const m = e.html.match(/^<p class="tpl-desc"><span class="tag-lead">MACHINES\.md 的說明<\/span>([\s\S]*?)<\/p>\n(?:<p class="tpl-shared">([^<]*)<\/p>\n)?<p class="tpl-note">([^<]*)<\/p>\n([\s\S]*)$/u);
    assert.ok(m, `${file}：跳窗的形狀不對（說明、一起講哪幾份、怎麼顯示的那一句、全文）`);
    const [, descHtml, sharedLine, noteLine, body] = m;
    const item = items.find((it) => it.paths.includes(file));
    assert.equal(strip(descHtml), proseText(item.desc), `${file}：跳窗裡的說明不是 MACHINES.md 的原文`);
    assert.equal(sharedLine, item.paths.length > 1 ? `這則說明一起講 ${item.paths.length} 份：${item.paths.map((p) => escT(p.slice('templates/'.length))).join('、')}。` : undefined, `${file}：一則講好幾份時要寫明一起講哪幾份（只講一份就不寫）`);
    const raw = body.match(/^<pre class="tpl-raw"><code>([\s\S]*)<\/code><\/pre>$/u);
    if (raw) {
      assert.equal(raw[1], escT(text), `${file}：照原始檔顯示的全文跟檔案不一樣`);
      assert.equal(noteLine, file.endsWith('.md') ? TEMPLATE_NOTES.md : TEMPLATE_NOTES.other, `${file}：怎麼顯示的那一句不對`);
    } else {
      laid += 1;
      assert.ok(file.endsWith('.md'), `${file}：不是 .md 卻排了版`);
      assert.equal(noteLine, TEMPLATE_NOTES.laid, `${file}：怎麼顯示的那一句不對`);
      checkLaidOut(body, text, file);
      assert.ok(!strip(body.replace(/<code>[\s\S]*?<\/code>/gu, '')).includes('**'), `${file}：排好版的全文裡有沒處理掉的「**」`);
    }
  }
  assert.equal(built.templatesLaidOut, laid, '回傳的「跳窗排版幾份」跟跳窗資料裡排了版的份數不一樣');
  assert.deepEqual(files.filter((f) => data[f].html.includes('<div class="tpl-body">')), TEMPLATE_LAID_OUT, '排版的範本跟寫死的樣本不一樣：範本或排版規則改了（確認是要的改變，例如那份範本多了說明書不排的寫法，再把樣本一起改）');
  // 照原文的字靠樣式撐著：原始檔的換行與縮排、排好版的連續空白都不能被瀏覽器合併
  const css = html.match(/<style>([\s\S]*?)<\/style>/u)[1];
  assert.match(css, /\n\.tpl-raw\{[^}]*white-space:pre-wrap[^}]*\}/u, '照原始檔顯示的那一塊要保留換行與空白（white-space:pre-wrap）');
  assert.ok(css.includes('\n.settings-body :is(p,li,th,td),.tpl-body :is(p,li,th,td){white-space:pre-wrap}\n'), '排好版的段落、清單、表格格子要保留連續空白（white-space:pre-wrap）');
  for (const x of html.matchAll(/data-template="([^"]*)"/gu)) assert.ok(Object.hasOwn(data, x[1]), `「${x[1]}」那顆鈕打不開任何跳窗`);
  // #29 r1 N1 的固定對照：兩份實際範本裡粗體、灰底框包住的字（預期直接寫死；範本改了這幾句，樣本要跟著改）
  assert.ok(data['templates/review-fixed-dimensions.md'].html.includes('不只看 <strong>實作者</strong> 標出的重點'), '複審必驗清單大標題裡的粗體要剛好包住「實作者」（寫死的樣本）');
  assert.ok(data['templates/review-fixed-dimensions.md'].html.includes('的 <code>不會</code>、<code>一律</code>、<code>只有</code>、<code>唯一的改變</code> 這類句子'), '複審必驗清單第 7 項的灰底框要逐一包住那四個詞（寫死的樣本）');
  assert.ok(data['templates/verdict-header.md'].html.includes('<strong>沒有 🤖 記號</strong>的疑似結論'), '結論留言標頭那一句的粗體要剛好包住「沒有 🤖 記號」（寫死的樣本）');
  // F2：擁有者 2026-10-02 問的「複審必驗清單」——F2 那張卡的範本鈕打開的就是它，而且排成表格、項目數照考題自己數的
  const checklistFile = 'templates/review-fixed-dimensions.md';
  assert.deepEqual([...card(html, 'F2').matchAll(/data-template="([^"]*)"/gu)].map((x) => x[1]), [checklistFile], 'F2 的範本鈕要打開複審必驗清單（寫死的樣本）');
  const checklist = data[checklistFile].html;
  assert.ok(checklist.includes('<div class="tpl-body">'), '複審必驗清單要照說明書的排法排成表格，不是照原始檔顯示');
  const doc = ownSettingsDoc(disk(checklistFile));
  const tables = [...doc.intro, ...doc.sections.flatMap((sec) => sec.blocks)].filter((b) => b.kind === 'table');
  assert.ok(tables.length >= 1, '前提：考題自己讀到複審必驗清單裡的表格');
  assert.equal((checklist.match(/<tbody>[\s\S]*?<\/tbody>/gu) || []).join('').split('<tr>').length - 1, tables.reduce((n, t) => n + t.rows.length, 0), '複審必驗清單排出來的項目數跟考題自己數的不一樣');
  // 規矩卡的「範本」那一行：MACHINES.md「範本」那一節說明裡寫到這一條條號的範本（照那一節的順序、不重複），放在卡的最後；沒有就不印
  const byRule = new Map();
  for (const it of items) {
    for (const r of it.rules) {
      const list = byRule.get(r) || [];
      for (const p of it.paths) if (!list.includes(p)) list.push(p);
      byRule.set(r, list);
    }
  }
  for (const [id, want] of Object.entries(TEMPLATE_LINK_SAMPLES)) assert.deepEqual(byRule.get(id), want, `${id} 寫到的範本跟寫死的樣本不一樣（樣本要跟著 MACHINES.md 改）`);
  const btn = (p) => `<button type="button" class="tpl-link" data-template="${escT(p)}">${escT(p.slice('templates/'.length))}</button>`;
  let withTpl = 0;
  for (const s of o.rules.sections) {
    for (const r of s.rules) {
      const id = `${s.letter}${r.n}`;
      const c = card(html, id);
      const want = byRule.get(id) || [];
      if (r.text.includes('範本')) assert.ok(want.length, `${id} 的主句寫到「範本」，MACHINES.md「範本」那一節卻沒有寫到這一條（卡上會點不到範本）`);
      if (!want.length) {
        assert.ok(!c.includes('rule-tpl') && !c.includes('data-template'), `${id}：沒有範本寫到這一條，就不該有範本那一行`);
        continue;
      }
      withTpl += 1;
      const row = c.match(/\n<p class="rule-tpl"><span class="tag-lead">範本<\/span>([\s\S]*?)<\/p>\n$/u);
      assert.ok(row, `${id}：少了範本那一行（要在卡的最後）`);
      assert.equal(row[1], want.map(btn).join(''), `${id}：範本鈕不對（目標、字或順序）`);
    }
  }
  assert.ok(withTpl >= 10, '有範本鈕的規矩太少：對照讀錯了');
  assert.ok(html.includes('。每一條的「把關」那一行寫這條由誰把關；點標籤看它的意思、它守不到什麼。有「範本」那一行的，列的是 MACHINES.md 範本那一節裡說明寫到這一條的範本（一則說明講好幾份的會一起列），點檔名看全文。</p>'), '規矩頁頁首那兩句不對（「把關」不一定是最後一行；範本那一行列的是什麼）');
  assert.ok(html.includes('<p class="source-note">來源：套件的規則資料 rules.json（產生規則書的同一份）、MACHINES.md 的標籤表與「本文條目 → 機器」那張表（每條的機器表連結）、MACHINES.md「範本」那一節（每條的範本連結＝那一節的說明寫到這一條條號的範本）與 templates/ 底下的檔（範本全文）、GLOSSARY.md 的版面約定。</p>'), '規矩頁的來源註記不對');
  // 排得了的寫法（含「## 」節、沒有開頭段、只有大標題）照排；認不得任何一行或行內記號＝整份照原始檔（不會半份排版）
  const OK = '# 標題\n\n開頭一段 **粗** 與 `框`。\n\n## 一、甲\n\n| 欄 | 值 |\n|---|---|\n| a \\| b | c |\n\n- 一項\n  1. 子項\n\n## 二、乙\n\n一段。\n';
  for (const text of [OK, '# 標題\n\n## 一、甲\n\n一段。\n', '# 標題\n']) {
    const v = manual.templateView({ path: 'templates/t.md', text });
    assert.equal(v.laidOut, true, `對照組要排版：${JSON.stringify(text)}`);
    checkLaidOut(v.html, text, `對照組 ${JSON.stringify(text)}`);
  }
  assert.ok(manual.templateView({ path: 'templates/t.md', text: OK }).html.includes('<h3>一、甲</h3>\n<div class="table-wrap"><table class="grid"><thead><tr><th>欄</th><th>值</th></tr></thead><tbody><tr><td>a | b</td><td>c</td></tr></tbody></table></div>'), '對照組：節標題排成 h3、表格照排（寫死的樣本）');
  const spaced = manual.templateView({ path: 'templates/t.md', text: OK.replace('| a \\| b | c |', '|\u3000a | \u00a0b |') });
  assert.ok(spaced.laidOut && spaced.html.includes('<td>\u3000a</td><td>\u00a0b</td>'), '格子頭尾的全形空白、不換行空白是字，排版時照留');
  const rawCases = [
    ['沒有大標題', '一段。\n'],
    ['引用', OK.replace('開頭一段', '> 開頭一段')],
    ['段落連兩行', OK.replace('開頭一段', '開頭\n一段')],
    ['頂層編號清單', OK.replace('- 一項\n  1. 子項', '1. 一項')],
    ['最後一行有單獨的 *', OK.replace('一段。\n', '一段 *斜*。\n')],
    ['行內 HTML', OK.replace('一段。\n', '一段 <b>粗</b>。\n')],
    ['節標題結尾是 #', OK.replace('## 二、乙', '## 二、乙 #')],
    ['有 tab', OK.replace('一段。', '一段\t。')],
  ];
  for (const [name, text] of rawCases) {
    const v = manual.templateView({ path: 'templates/t.md', text });
    assert.equal(v.laidOut, false, `「${name}」要改成照原始檔顯示`);
    assert.equal(v.html, `<pre class="tpl-raw"><code>${escT(text)}</code></pre>`, `「${name}」照原始檔顯示的全文跟原文不一樣`);
  }
  // 不是 .md 的不排：就算寫法排得了也照原始檔
  for (const p of ['templates/t.txt', 'templates/t.MD', 'templates/t.md.bak', 'templates/pre-push']) {
    const v = manual.templateView({ path: p, text: OK });
    assert.deepEqual(v, { laidOut: false, html: `<pre class="tpl-raw"><code>${escT(OK)}</code></pre>` }, `${p} 不是 .md，要照原始檔顯示`);
  }
  // tab 與換行以外的控制字元＝停（照原始檔也顯示不出原文）；不是排版那一種的例外（程式自己的錯）照樣往外丟
  // 逐一試全部 65 個控制字元（U+0000〜U+001F、U+007F〜U+009F），tab 與換行以外都要停；範圍兩邊緊鄰的字照收
  const hex = (c) => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  for (let c = 0; c <= 0x9f; c += 1) {
    if (c > 0x1f && c < 0x7f) continue;
    const view = () => manual.templateView({ path: 'templates/t.json', text: `a${String.fromCharCode(c)}b` });
    if (c === 0x09 || c === 0x0a) assert.doesNotThrow(view, `${hex(c)}（tab、換行）照收`);
    else assert.throws(view, /templates\/t\.json 裡有 tab 與換行以外的控制字元/u, `控制字元 ${hex(c)} 應該停下`);
  }
  for (const c of [0x20, 0x7e, 0xa0, 0x3000]) assert.doesNotThrow(() => manual.templateView({ path: 'templates/t.json', text: `a${String.fromCharCode(c)}b` }), `${hex(c)} 不是控制字元，照收`);
  assert.throws(() => manual.build({ ...src, templates: src.templates.map((t) => (t.path === 'templates/pr-body.md' ? { ...t, text: `${t.text}\r` } : t)) }), /templates\/pr-body\.md 裡有 tab 與換行以外的控制字元/u, '整份產生時有控制字元的範本也要停');
  assert.throws(() => manual.templateView({ path: 'templates/t.md', text: null }), TypeError, '不是 LayoutError 的例外不可以被當成「排不了」吞掉');
  // 一般的 Error 也一樣（日後排版程式裡新寫的 throw new Error 最可能是這一種）：用一份切行時會丟一般 Error 的假原文模擬
  const broken = { toString: () => '# 標題', split: () => { throw new Error('排版程式自己的錯'); } };
  assert.throws(() => manual.templateView({ path: 'templates/t.md', text: broken }), /排版程式自己的錯/u, '一般的 Error 不可以被當成「排不了」吞掉');
  // 讀範本：開頭的 BOM 照留；不是合法 UTF-8 就停
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-tpl-text-'));
  try {
    fs.mkdirSync(path.join(dir, 'templates'));
    fs.writeFileSync(path.join(dir, 'templates', 'bom.md'), '﻿# 標題\n');
    assert.deepEqual(manual.readTemplates(dir), [{ path: 'templates/bom.md', text: '﻿# 標題\n' }], '開頭的 BOM 要照留（照原始檔顯示才跟檔案一樣）');
    fs.writeFileSync(path.join(dir, 'templates', 'bad.md'), Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
    assert.throws(() => manual.readTemplates(dir), /templates\/bad\.md 不是合法的 UTF-8 文字/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * 套用頁跟考題自己讀的 README 兩節逐項比（真的 README 與對照組共用）：跳節鈕、每一節的標題、每一塊（段落、表格、清單與子項、編號清單每一步與底下的程式碼框）
 * 的字與行內記號、看得到的字整份不多不少（程式碼框照字面）、每一種標籤的個數。page＝套用頁那一段 HTML（到來源註記之前）。回傳考題自己讀到的兩節。
 */
function checkAdoptPage(page, readme, where) {
  const secs = ADOPT_HEADS.map((h) => ownReadmeSection(readme, h));
  secs.forEach((sec, k) => assert.ok(sec, `${where}：考題自己在 README 裡找不到「${ADOPT_HEADS[k]}」那一節`));
  const jumps = [...page.matchAll(/<button type="button" class="jump" data-jump="(adopt-\d+)">([^<]*)<\/button>/gu)];
  assert.deepEqual(jumps.map((j) => j[2]), ADOPT_HEADS, `${where}：跳節鈕的字要是兩節的標題（「（」之前）`);
  jumps.forEach((j, i) => assert.equal(j[1], `adopt-${i + 1}`, `${where}：第 ${i + 1} 顆跳節鈕的目標不對`));
  const body = page.match(/<div class="settings-body adopt-body">\n([\s\S]*)\n<\/div>\n/u)[1];
  const got = [...body.matchAll(/<section class="block" id="adopt-(\d+)" tabindex="-1">\n<h2>([\s\S]*?)<\/h2>\n([\s\S]*?)\n<\/section>/gu)];
  assert.equal(got.length, secs.length, `${where}：節數不對`);
  got.forEach((x, i) => {
    assert.equal(x[1], String(i + 1), `${where}：第 ${i + 1} 節的 id 不對`);
    checkInline(x[2], secs[i].title, `${where}第 ${i + 1} 節的標題`);
    checkBlocks(blocksOf(x[3]), secs[i].blocks, `${where}「${ADOPT_HEADS[i]}」那一節`);
  });
  const all = secs.flatMap((sec) => sec.blocks);
  const itemsOf = (kind) => all.filter((b) => b.kind === kind);
  const boxes = itemsOf('olist').flatMap((b) => b.items.flatMap((it) => it.code));
  const inlineTexts = [...secs.map((sec) => sec.title), ...all.flatMap((b) => {
    if (b.kind === 'p') return [b.text];
    if (b.kind === 'table') return [...b.head, ...b.rows.flat()];
    return b.items.flatMap((it) => [it.text, ...(it.sub || []).map(([, t]) => t)]);
  })];
  const blockVisible = (b) => {
    if (b.kind === 'p') return ownSettingsVisible(b.text);
    if (b.kind === 'table') return [...b.head, ...b.rows.flat()].map(ownSettingsVisible).join('');
    return b.items.map((it) => ownSettingsVisible(it.text) + (it.sub || []).map(([, t]) => ownSettingsVisible(t)).join('') + (it.code || []).map((c) => escT(c.join('\n'))).join('')).join('');
  };
  const wantText = secs.map((sec) => ownSettingsVisible(sec.title) + sec.blocks.map(blockVisible).join('')).join('').replace(/\s+/gu, '');
  assert.equal(strip(body).replace(/\s+/gu, ''), wantText, `${where}：看得到的字跟原文對不上（多了、少了或順序不對）`);
  const inl = sumCounts(inlineTexts);
  const tables = itemsOf('table');
  const lists = itemsOf('list');
  const olists = itemsOf('olist');
  const count = (re) => (body.match(re) || []).length;
  assert.deepEqual(
    { section: count(/<section /gu), h2: count(/<h2>/gu), p: count(/<p[ >]/gu), table: count(/<table /gu), tr: count(/<tr>/gu), th: count(/<th>/gu), td: count(/<td>/gu), olItems: count(/<ol class="items">/gu), ulItems: count(/<ul class="items">/gu), olSub: count(/<ol>/gu), li: count(/<li>/gu), pre: count(/<pre /gu), strong: count(/<strong>/gu), code: count(/<code>/gu) },
    {
      section: secs.length, h2: secs.length,
      p: itemsOf('p').length,
      table: tables.length, tr: tables.reduce((n, t) => n + 1 + t.rows.length, 0), th: tables.reduce((n, t) => n + t.head.length, 0), td: tables.reduce((n, t) => n + t.rows.flat().length, 0),
      olItems: olists.length, ulItems: lists.length,
      olSub: lists.reduce((n, l) => n + l.items.filter((it) => it.sub.length).length, 0),
      li: olists.reduce((n, b) => n + b.items.length, 0) + lists.reduce((n, l) => n + l.items.length + l.items.reduce((m, it) => m + it.sub.length, 0), 0),
      pre: boxes.length,
      strong: inl.strong,
      code: inl.code + boxes.length,
    },
    `${where}：各種標籤的個數跟考題自己數的不一樣`,
  );
  return secs;
}

test('⑰ 套用頁：README.md「搬進一個專案」「專案裡改到套件的檔」兩節照說明書的排法排——每一節、每一段、編號清單每一步（含底下的程式碼框）、清單每一項都照原文，粗體與灰底框包住的字也對；整頁不多不少；認不得的形狀就停', () => {
  const src = sources();
  const built = manual.build(src);
  const { html } = built;
  const readme = disk('README.md');
  assert.deepEqual(manual.ADOPT_HEADINGS, ADOPT_HEADS, '套用頁取的節改了：要連這一題一起改');
  const pageOf = (h) => h.match(/<section class="page" id="page-adopt" data-page="adopt" hidden>([\s\S]*?)<p class="source-note">來源：README\.md/u)[1];
  const page = pageOf(html);
  const secs = checkAdoptPage(page, readme, '套用頁');
  assert.equal(built.adoptSections, secs.length, '回傳的套用頁節數不對');
  assert.ok(page.includes('<p class="eyebrow">README 的兩節</p>\n<h1>套用</h1>'), '套用頁的大標題不對');
  assert.ok(page.includes(`<p class="page-sum">怎麼把套件搬進一個專案、專案裡改到套件的檔要怎麼辦：下面是 README.md 的「搬進一個專案」「專案裡改到套件的檔」這 ${secs.length} 節原文，照說明書的排法排。</p>`), '套用頁頁首那一句不對（數字或字）');
  assert.ok(html.includes('<p class="source-note">來源：README.md 的「搬進一個專案」「專案裡改到套件的檔」兩節。這一頁不照 GitHub 的畫法：只排標題、段落、表格、清單（含從 1 連號的編號清單，與編號清單項底下的程式碼框）、灰底框、粗體，其他字照原文顯示（只有寫在符號前面、讓符號不被當成排版記號的「\\」，與程式碼框開頭的語言名不顯示；GitHub 會把表情代碼變成圖示、網址變成連結，這裡照字面）。說明書認不得的行，以及一部分 GitHub 可能另作排版的行內記號（例如會變成斜體、刪除線、HTML 的寫法），會讓整份停下不產生。</p>'), '套用頁的來源註記不對');
  assert.ok(!html.includes('<section class="page" id="page-adopt" data-page="adopt" hidden>\n<header class="page-head"><p class="eyebrow">第 7 頁</p>'), '套用頁不該再是「準備中」');
  // 寫死的樣本：第 2 步底下的程式碼框、第二節開頭是粗體的清單項、第 3 步補了灰底框的家目錄路徑、編號清單至少 5 步
  assert.ok(page.includes("</li><li>專案若有 ESLint、而且把 <code>.js</code> 當 ES 模組：在它的設定補一組（package.json 的宣告管不到 lint）。漏了＝lint 對套件檔報幾百個錯，推送前那道門推不上去。<pre class=\"code-box\"><code>{ files: ['tools/**/*.js', 'tests/**/*.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node } }</code></pre></li>"), '第 2 步與它底下的程式碼框不對（寫死的樣本）');
  assert.ok(page.includes('<ul class="items"><li><strong>預設：套件先改、再同步回專案</strong>——'), '第二節第一項開頭的粗體不對（寫死的樣本）');
  assert.ok(page.includes('例如 <code>~/.local/share/ai-collab-kit/guard/&lt;版本碼前幾碼&gt;</code>）。②'), '第 3 步那一處家目錄路徑要在灰底框裡（寫死的樣本）');
  assert.ok(secs[0].blocks.filter((b) => b.kind === 'olist').reduce((n, b) => n + b.items.length, 0) >= 5, '前提：考題自己讀到的編號清單太少');
  // 照原文靠的樣式：程式碼框保留換行與縮排；編號清單要看得到號碼（整份樣式不准有 list-style）
  const css = html.match(/<style>([\s\S]*?)<\/style>/u)[1];
  assert.match(css, /\n\.code-box\{[^}]*white-space:pre-wrap[^}]*\}/u, '程式碼框要保留換行與縮排（white-space:pre-wrap）');
  assert.ok(!/list-style/u.test(css), '樣式裡不准有 list-style：編號清單要看得到號碼（README 裡有「照第 3 步」這種引用）');

  // 對照組：README 那兩節換成「什麼都有」的寫法（表格、子項、框裡空行與多縮排、一步兩個框、空框、灰底框裡的 **），用同一套比法比一次
  const RICH = ['# 套件', '', '## 搬進一個專案', '', '照順序做，見 `tools/**/*.js` 與 **粗 `框` 體**。', '', '1. 第一步', '', '   ```', '', '   x = 1', '     y = 2', '', '', '   z = 3', '', '   ```', '', '   ```sh', '   echo 2', '   ```', '', '2. 第二步', '', '   ```', '   ```', '', '3. 第三步', '', '## 專案裡改到套件的檔（補充）', '', '- **預設**：先改套件', '  1. 子項一', '  2. 子項二', '- 例外', '', '1. 清單後的第一項', '2. 清單後的第二項', '', '| 欄 | 值 |', '|---|---|', '| `a\\|b` | **c** |', '', '最後一段。', '', '1. 另一串的第一項', '2. 第二項', ''].join('\n');
  const rich = manual.renderAdopt(RICH);
  checkAdoptPage(rich, RICH, '對照組（什麼都有）');
  assert.ok(rich.includes('<li>第一步<pre class="code-box"><code>\nx = 1\n  y = 2\n\n\nz = 3\n</code></pre><pre class="code-box"><code>echo 2</code></pre></li><li>第二步<pre class="code-box"><code></code></pre></li>'), '對照組：框裡的空行（含頭尾、連續）、多出來的縮排照留；一步兩個框各自一個；空框照排（寫死的樣本）');
  assert.ok(rich.includes('<td><code>a|b</code></td><td><strong>c</strong></td>'), '對照組：表格照排（寫死的樣本）');
  assert.ok(rich.includes('<p>最後一段。</p>\n<ol class="items"><li>另一串的第一項</li><li>第二項</li></ol>') && rich.includes('<li>例外</li></ul>\n<ol class="items"><li>清單後的第一項</li><li>清單後的第二項</li></ol>'), '對照組：段落、清單後面空一行再開的編號清單都是新的一串、從 1 起（寫死的樣本）');

  // 合法的小樣本：鬆散與緊密的編號清單、清單項底下的程式碼框（框裡可以有空行、語言名可有可無）、開頭是粗體的字；行號照 README 的
  const OK = ['# 套件', '', '## 搬進一個專案', '', '開頭一段 **粗** 與 `框`。', '', '1. 第一步', '2. **第二步**要做的', '', '   ```js', '   a = <b> & 1', '', '   b = 2', '   ```', '', '3. 第三步', '', '## 專案裡改到套件的檔（補充）', '', '- **預設**：先改套件', '- 例外', '## 下一節', '', '別的。', ''].join('\n');
  const ok = manual.renderAdopt(OK);
  assert.ok(ok.includes('<ol class="items"><li>第一步</li><li><strong>第二步</strong>要做的<pre class="code-box"><code>a = &lt;b&gt; &amp; 1\n\nb = 2</code></pre></li><li>第三步</li></ol>'), '對照組：編號清單、它底下的程式碼框（框裡照字面、要跳脫）、開頭的粗體要照排');
  assert.ok(ok.includes('<ul class="items"><li><strong>預設</strong>：先改套件</li><li>例外</li></ul>') && !ok.includes('別的。'), '對照組：第二節照排（最後一行緊接著下一節的標題也收）、下一節不收');
  const ten = OK.replace('3. 第三步', ['3. 三', '', '4. 四', '', '5. 五', '', '6. 六', '', '7. 七', '', '8. 八', '', '9. 九', '', '10. 十', '', '    ```', '    x', '    ```'].join('\n'));
  assert.ok(manual.renderAdopt(ten).includes('<li>十<pre class="code-box"><code>x</code></pre></li></ol>'), '對照組：第 10 項底下的框縮排 4 格（對齊兩位數號碼後面的字）');
  const lineOf = (text, line) => text.split('\n').indexOf(line) + 1;
  const bad = [
    ['沒有那一節', OK.replace('## 搬進一個專案', '## 搬家'), /標題是「搬進一個專案」的那一節要剛好一節（找到 0 節）：說明書不產生/u],
    ['那一節有兩個', `${OK}\n## 搬進一個專案\n\n再一次。\n`, /標題是「搬進一個專案」的那一節要剛好一節（找到 2 節）/u],
    ['標題後面接的不是「（」', OK.replace('## 專案裡改到套件的檔（補充）', '## 專案裡改到套件的檔案'), /標題是「專案裡改到套件的檔」的那一節要剛好一節（找到 0 節）/u],
    ['那一節裡有控制字元', OK.replace('開頭一段', '開頭\u0007一段'), /README\.md「搬進一個專案」那一節裡有 tab 與換行以外的控制字元/u],
    ['編號清單不從 1 起', OK.replace('1. 第一步\n2. **第二步**要做的', '2. 第一步\n3. **第二步**要做的'), new RegExp(`README\\.md 第 ${lineOf(OK, '1. 第一步')} 行：編號清單要從 1 起（這裡寫的是 2）`, 'u')],
    ['編號跳號', OK.replace('3. 第三步', '4. 第三步'), new RegExp(`README\\.md 第 ${lineOf(OK, '3. 第三步')} 行：編號清單要從 1 起連號、照寫成 3（這裡寫的是 4）`, 'u')],
    ['空行後重新從 1 起', OK.replace('3. 第三步', '1. 第三步'), /照寫成 3（這裡寫的是 1）/u],
    ['號碼補零', OK.replace('3. 第三步', '03. 第三步'), /照寫成 3（這裡寫的是 03）/u],
    ['號碼前面有空白', OK.replace('1. 第一步', ' 1. 第一步'), /字是空的、或頭尾有空白/u],
    ['號碼後面兩格空白', OK.replace('1. 第一步', '1.  第一步'), /字是空的、或頭尾有空白/u],
    ['用 1) 寫', OK.replace('1. 第一步', '1) 第一步'), /段落的字像編號清單/u],
    ['編號項的字又像編號清單', OK.replace('1. 第一步', '1. 2. 第一步'), /編號清單項的字又像編號清單/u],
    ['編號項後直接接段落', OK.replace('3. 第三步', '3. 第三步\n接著一行'), /清單後面直接接了別的東西/u],
    ['段落後直接接編號清單', OK.replace('開頭一段 **粗** 與 `框`。\n\n1. 第一步', '開頭一段 **粗** 與 `框`。\n1. 第一步'), /清單前面要空一行/u],
    ['編號項底下的子項', OK.replace('1. 第一步', '1. 第一步\n  1. 子項'), /子項前面要是「- 」清單/u],
    ['清單後直接接編號清單（第二節，行號也照 README 的）', OK.replace('- 例外', '- 例外\n1. 編號'), new RegExp(`README\\.md 第 ${lineOf(OK, '- 例外') + 1} 行：清單前面要空一行`, 'u')],
    ['編號清單後直接接清單', OK.replace('3. 第三步', '3. 第三步\n- 清單'), /編號清單後面直接接了「- 」清單/u],
    ['程式碼框縮排兩格', OK.replace('   ```js\n   a = <b> & 1\n\n   b = 2\n   ```', '  ```js\n  a = 1\n  ```'), /程式碼框要剛好縮排 3 格（對齊第 2 項的字）/u],
    ['程式碼框縮排四格', OK.replace('   ```js', '    ```js'), /程式碼框要剛好縮排 3 格/u],
    ['第 10 項底下的框只縮 3 格', ten.replace('    ```\n    x\n    ```', '   ```\n   x\n   ```'), /程式碼框要剛好縮排 4 格（對齊第 10 項的字）/u],
    ['語言名夾空白', OK.replace('   ```js', '   ```js x'), /三個反引號後面只准接語言名/u],
    ['語言名有標點', OK.replace('   ```js', '   ```{js}'), /三個反引號後面只准接語言名/u],
    ['框裡少縮排', OK.replace('   b = 2', ' b = 2'), new RegExp(`README\\.md 第 ${lineOf(OK, '   b = 2')} 行：程式碼框裡的每一行都要縮排 3 格`, 'u')],
    ['框裡又有三個反引號', OK.replace('   b = 2', '   ```b'), /程式碼框裡又有三個反引號開頭的行/u],
    ['框裡多縮排的三個反引號', OK.replace('   b = 2', '      ```'), /程式碼框裡又有三個反引號開頭的行/u],
    ['框沒有收尾', OK.replace('3. 第三步\n', '3. 第三步\n\n   ```\n   x\n'), /程式碼框沒有收尾/u],
    ['收尾後沒空行', OK.replace('   ```\n\n3. 第三步', '   ```\n3. 第三步'), /程式碼框後面要空一行/u],
    ['框前面沒空行', OK.replace('2. **第二步**要做的\n\n   ```js', '2. **第二步**要做的\n   ```js'), /清單後面直接接了別的東西/u],
    ['框不在編號清單底下', OK.replace('開頭一段 **粗** 與 `框`。', '開頭一段。\n\n   ```\n   x\n   ```'), /字是空的、或頭尾有空白/u],
    ['清單底下的框', OK.replace('- 例外', '- 例外\n\n   ```\n   x\n   ```'), /字是空的、或頭尾有空白/u],
    ['頂格的程式碼框', OK.replace('開頭一段 **粗** 與 `框`。', '```\nx\n```'), /開頭是沒跳脫的半形標點（`）/u],
    ['框裡有 tab', OK.replace('   a = <b> & 1', '   a\t= 1'), /tab 或 \\r/u],
    ['框裡有行尾空白', OK.replace('   a = <b> & 1', '   a = 1 '), new RegExp(`README\\.md 第 ${lineOf(OK, '   a = <b> & 1')} 行：結尾有空白`, 'u')],
    ['粗體開頭後面是空白', OK.replace('- **預設**：先改套件', '- ** 預設**：先改套件'), /開頭是沒跳脫的半形標點（\*）/u],
    ['開頭三個星號', OK.replace('- **預設**：先改套件', '- ***預設***'), /開頭是沒跳脫的半形標點（\*）/u],
    ['粗體開頭沒成對', OK.replace('- **預設**：先改套件', '- **預設：先改套件'), /\*\* 沒有成對/u],
    ['小節', OK.replace('開頭一段 **粗** 與 `框`。', '### 小節'), /開頭是沒跳脫的半形標點（#）/u],
    ['框外的 ~', OK.replace('開頭一段', '開頭 ~/x 一段'), /「~」後面緊接著字/u],
  ];
  for (const [name, text, why] of bad) {
    assert.notEqual(text, OK, `「${name}」這一發沒有改到來源`);
    assert.throws(() => manual.renderAdopt(text), why, `「${name}」應該停下、而且原因要對`);
  }
  // 這三種只開給套用頁：設定頁與範本跳窗照舊
  assert.throws(() => manual.renderSettings('# 標題\n\n## 一\n\n1. 第一步\n'), /段落的字像編號清單/u, '設定頁仍不收編號清單');
  assert.throws(() => manual.renderSettings('# 標題\n\n## 一\n\n- **粗**體\n'), /開頭是沒跳脫的半形標點（\*）/u, '設定頁仍不收開頭是粗體的字');
  assert.equal(manual.templateView({ path: 'templates/t.md', text: '# 標題\n\n1. 第一步\n' }).laidOut, false, '範本跳窗仍不排編號清單（照原始檔）');
  // 讀來源：讀不到 README.md 就停；整份產生時 README 那兩節認不得、有控制字元也停
  assert.throws(() => manual.build({ ...src, readme: readme.replace('## 搬進一個專案', '## 搬家') }), /標題是「搬進一個專案」的那一節要剛好一節/u);
  assert.throws(() => manual.build({ ...src, readme: readme.replace('照順序做；', '照順序做\u0000；') }), /README\.md「搬進一個專案」那一節裡有 tab 與換行以外的控制字元/u);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-adopt-'));
  try {
    for (const rel of ['rules.json', 'MACHINES.md', 'GLOSSARY.md']) fs.copyFileSync(path.join(manual.ROOT, rel), path.join(dir, rel));
    for (const d of ['tools', 'tests', 'templates', 'cases']) fs.cpSync(path.join(manual.ROOT, d), path.join(dir, d), { recursive: true });
    assert.throws(() => manual.readSources(dir), /讀不到 README\.md/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── 案例頁（⑱）：預期值由考題自己讀 cases/、自己切行內記號；排的順序另外跟 cases/README.md（同一批檔產生的索引）對 ──
const CASE_TEXTS = ['發生什麼', '代價', '教訓', '來源'];
/** 考題自己讀 cases/（不經過產生器的 readCases）：index.json，與 README.md 以外的每一則 .md（照檔名排）。 */
function ownCaseSources(root = manual.ROOT) {
  const dir = path.join(root, 'cases');
  const names = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort();
  return { notes: fs.readFileSync(path.join(dir, 'index.json'), 'utf8'), files: names.map((f) => ({ path: `cases/${f}`, text: fs.readFileSync(path.join(dir, f), 'utf8') })) };
}
/** 考題自己讀一則案例：一行一行對「- 欄名：值」（不用產生器的 parseCases）。 */
function ownCase(file) {
  const lines = file.text.replace(/\n+$/u, '').split('\n');
  const fields = {};
  for (const line of lines.slice(2)) {
    const m = line.match(/^- ([^：]+)：(.*)$/u);
    fields[m[1]] = m[2];
  }
  return { slug: file.path.replace(/^cases\//u, '').replace(/\.md$/u, ''), title: lines[0].replace(/^# /u, ''), date: fields.日期, rules: fields.本文條號.split('、'), fields };
}
/** 考題自己的排法：照日期、同一天照檔名（字碼順序；頁首寫的就是這一句）。 */
const ownCaseOrder = (list) => [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.slug < b.slug ? -1 : 1));
/**
 * 案例欄位的行內記號（考題自己切，不用產生器的 settingsInline）：「\」＋半形標點＝那個標點、一對反引號＝灰底框、一對 **＝粗體（裡面可以再有別的）、
 * [檔名](檔名.md)＝指到那一則的連結、<https://…>＝照字面的字，其餘照字面。回傳 ownInline 那種形狀，多一種 ['case', 檔名]。
 */
function ownCaseInline(src) {
  const out = [];
  const push = (tok) => {
    const last = out[out.length - 1];
    if (tok[0] === 't' && last && last[0] === 't') last[1] += tok[1];
    else out.push(tok);
  };
  for (let i = 0; i < src.length;) {
    const link = src.slice(i).match(/^\[([a-z0-9-]+)\]\(\1\.md\)/u);
    const auto = src.slice(i).match(/^<https:\/\/[^\s<>]+>/u);
    if (src[i] === '\\' && /^[!-/:-@[-`{-~]$/u.test(src[i + 1] || '')) {
      push(['t', src[i + 1]]);
      i += 2;
    } else if (src[i] === '`') {
      const j = src.indexOf('`', i + 1);
      push(['code', src.slice(i + 1, j)]);
      i = j + 1;
    } else if (src.startsWith('**', i)) {
      const j = src.indexOf('**', i + 2);
      push(['strong', ownCaseInline(src.slice(i + 2, j))]);
      i = j + 2;
    } else if (link) {
      push(['case', link[1]]);
      i += link[0].length;
    } else if (auto) {
      push(['t', auto[0]]);
      i += auto[0].length;
    } else {
      push(['t', src[i]]);
      i += 1;
    }
  }
  return out;
}
/** 一串行內形狀看得到的字：連結看得到的是它指到那一則的標題。 */
const caseVisible = (toks, titles) => toks.map(([kind, v]) => (kind === 'strong' ? caseVisible(v, titles) : kind === 'case' ? titles.get(v) : v)).join('');
/** 排好的案例欄位切回同樣的形狀：<strong>、<code>、案例連結（字要是那一則的標題）、其餘的字；有別的標籤就停。 */
function htmlCaseInline(html, where, titles) {
  const LINK = /^<a href="#cases" class="case-link" data-case="([a-z0-9-]+)">([^<]*)<\/a>$/u;
  const PARTS = /(<\/?(?:strong|code)>|<a href="#cases" class="case-link" data-case="[a-z0-9-]+">[^<]*<\/a>)/u;
  const parts = html.split(PARTS);
  assert.ok(!/[<>]/u.test(parts.filter((p, k) => k % 2 === 0).join('')), `${where}：行內出現 <strong>、<code>、案例連結以外的標籤`);
  const root = [];
  const stack = [root];
  let code = null;
  const push = (tok) => {
    const cur = stack[stack.length - 1];
    const last = cur[cur.length - 1];
    if (tok[0] === 't' && last && last[0] === 't') last[1] += tok[1];
    else cur.push(tok);
  };
  for (const part of parts) {
    const link = part.match(LINK);
    if (link) {
      assert.equal(unescT(link[2]), titles.get(link[1]), `${where}：連到 ${link[1]} 的連結，字不是那一則的標題`);
      push(['case', link[1]]);
    } else if (part === '<strong>') {
      const kids = [];
      push(['strong', kids]);
      stack.push(kids);
    } else if (part === '</strong>') {
      stack.pop();
    } else if (part === '<code>') {
      code = '';
    } else if (part === '</code>') {
      push(['code', code]);
      code = null;
    } else if (code !== null) {
      code += unescT(part);
    } else if (part) {
      push(['t', unescT(part)]);
    }
  }
  return root;
}
/** 案例頁整頁與每一則的跳窗，照考題自己讀的 cases 來源比（索引的說明、每一列、末尾小節、跳窗每一欄與行內記號）。回傳考題自己排好的清單。 */
function checkCasesPage({ html, caseData }, cases, where) {
  const notes = JSON.parse(cases.notes);
  const list = ownCaseOrder(cases.files.map(ownCase));
  const titles = new Map(list.map((c) => [c.slug, c.title]));
  const n = list.length;
  const ruleButtons = (ids) => `<span class="case-rules">${ids.map((id) => `<button type="button" class="rule-link" data-goto="rule-${id}">${id}</button>`).join('')}</span>`;
  const page = html.match(/^<section class="page" id="page-cases" data-page="cases" hidden>\n([\s\S]*)\n<p class="source-note">來源：cases\/[^<]*<\/p>\n<\/section>$/u);
  assert.ok(page, `${where}：案例頁的外框不對`);
  const head = `<header class="page-head">\n<p class="eyebrow">cases/ 底下的案例簿</p>\n<h1>案例</h1>\n<p class="page-sum">${n} 則案例，一則一檔，照日期排（同一天照檔名）。點標題看全文：發生什麼、代價、教訓、來源、相關；點條號跳到那一條規矩。</p>\n</header>\n`;
  assert.ok(page[1].startsWith(head), `${where}：頁首不對（數字或字）`);
  const idx = page[1].slice(head.length).match(/^<section class="block"><h2>([^<]*)<span class="sec-count">(\d+) 則<\/span><\/h2>\n((?:<p class="muted">[^<]*<\/p>\n)*)<div class="table-wrap"><table class="grid case-index"><thead><tr><th>日期<\/th><th>案例<\/th><th>本文條號<\/th><\/tr><\/thead><tbody>\n([\s\S]*?)\n<\/tbody><\/table><\/div>\n<\/section>/u);
  assert.ok(idx, `${where}：索引那一塊的形狀不對`);
  assert.equal(unescT(idx[1]), notes.title, `${where}：索引的標題不是 index.json 的`);
  assert.equal(idx[2], String(n), `${where}：索引標題旁的則數不對`);
  assert.equal(idx[3], notes.intro.map((l) => `<p class="muted">${escT(l)}</p>\n`).join(''), `${where}：索引開頭的說明不是 index.json 的原文（照字面）`);
  const rows = idx[4].split('\n');
  assert.equal(rows.length, n, `${where}：索引的列數不對`);
  rows.forEach((row, k) => {
    const c = list[k];
    assert.equal(row, `<tr><td>${escT(c.date)}</td><td><button type="button" class="case-link" data-case="${c.slug}">${escT(c.title)}</button></td><td>${ruleButtons(c.rules)}</td></tr>`, `${where}：索引第 ${k + 1} 列不對（順序、日期、哪一則、標題或條號）`);
  });
  const rest = page[1].slice(head.length + idx[0].length);
  assert.equal(rest, `\n${notes.sections.map((s) => `<section class="block"><h2>${escT(s.title)}</h2>\n${s.lines.map((l) => `<p>${escT(l)}</p>`).join('\n')}\n</section>`).join('\n')}`, `${where}：索引末尾的小節不是 index.json 的原文（照字面）`);
  assert.deepEqual(Object.keys(caseData).sort(), [...titles.keys()].sort(), `${where}：跳窗資料要每一則剛好一筆`);
  for (const c of list) {
    const e = caseData[c.slug];
    const at = `${where}「${c.slug}」的跳窗`;
    assert.deepEqual(Object.keys(e).sort(), ['html', 'title'], `${at}的欄位不對`);
    assert.equal(e.title, c.title, `${at}的標題不對`);
    const dl = e.html.match(/^<dl class="def case-def">([\s\S]*)<\/dl>$/u);
    assert.ok(dl, `${at}：外框不對`);
    const pairs = [...dl[1].matchAll(/<dt>([^<]*)<\/dt><dd>([\s\S]*?)<\/dd>/gu)];
    assert.equal(pairs.map((p) => p[0]).join(''), dl[1], `${at}：dt／dd 以外還有別的東西`);
    assert.deepEqual(pairs.map((p) => p[1]), ['日期', '本文條號', ...CASE_TEXTS, ...(c.fields.相關 === undefined ? [] : ['相關'])], `${at}：欄位的順序或有無不對`);
    assert.equal(pairs[0][2], escT(c.date), `${at}的日期不對`);
    assert.equal(pairs[1][2], ruleButtons(c.rules), `${at}的本文條號不對`);
    for (const [, name, dd] of pairs.slice(2)) {
      const toks = ownCaseInline(c.fields[name]);
      assert.equal(strip(dd), escT(caseVisible(toks, titles)), `${at}「${name}」看得到的字不是原文`);
      assert.deepEqual(htmlCaseInline(dd, `${at}「${name}」`, titles), toks, `${at}「${name}」的粗體、灰底框、連結不對`);
    }
  }
  return list;
}

test('⑱ 案例頁：cases/ 每一則照日期排成索引（日期、標題、條號），點開的跳窗每一欄照原文（灰底框、粗體、指到別則的連結、網址照字面）；索引的說明與末尾小節照原文；順序與標題跟 cases/README.md 一樣；認不得的形狀就停', () => {
  const src = sources();
  const built = manual.build(src);
  const { html } = built;
  const ruleIds = own().rules.sections.flatMap((s) => s.rules.map((r) => `${s.letter}${r.n}`));
  const caseData = JSON.parse(html.match(/<script type="application\/json" id="case-data">([\s\S]*?)<\/script>/u)[1]);
  const pageHtml = html.match(/<section class="page" id="page-cases" data-page="cases" hidden>[\s\S]*?<p class="source-note">來源：cases\/[^<]*<\/p>\n<\/section>/u)[0];
  const list = checkCasesPage({ html: pageHtml, caseData }, ownCaseSources(), '案例頁');
  assert.ok(list.length >= 100, '前提：考題自己讀到的案例太少');
  assert.equal(built.cases, list.length, '回傳的案例則數不對');
  assert.deepEqual(manual.CASE_FIELDS, ['日期', '本文條號', '發生什麼', '代價', '教訓', '來源'], '案例的欄位改了：要連這一題一起改');
  // 順序、日期、標題、條號另外跟 cases/README.md 對：那是案例簿的索引產生器用同一批檔產生的，考題自己讀那張表（標題的半形標點在那裡是跳脫的）
  const index = disk('cases/README.md');
  const rows = [...index.matchAll(/^\| (\d{4}-\d{2}-\d{2}) \| \[(.*)\]\(([a-z0-9-]+)\.md\) \| ([A-Z0-9、]+) \|$/gmu)];
  assert.match(index, new RegExp(`\\n共 ${list.length} 則。\\n`, 'u'), '前提：cases/README.md 的「共 N 則」跟案例檔數一樣');
  assert.deepEqual(rows.map((r) => [r[1], r[2].replace(/\\([!-/:-@[-`{-~])/gu, '$1'), r[3], r[4]]), list.map((c) => [c.date, c.title, c.slug, c.rules.join('、')]), '案例頁的順序、日期、標題或條號跟 cases/README.md 那張索引不一樣');
  assert.ok(list.some((c, k) => k > 0 && list[k - 1].date === c.date), '前提：真的案例裡有同一天的（才驗得到「同一天照檔名」）');
  // 每一顆條號鈕都跳得到規矩頁的那一條；每一顆案例鈕都開得到一筆跳窗
  const all = [pageHtml, ...Object.values(caseData).map((e) => e.html)].join('\n');
  for (const m of all.matchAll(/data-goto="(rule-[A-Z]\d+)"/gu)) assert.ok(html.includes(`<article class="rule" id="${m[1]}"`), `${m[1]} 在規矩頁找不到`);
  for (const m of all.matchAll(/data-case="([a-z0-9-]+)"/gu)) assert.ok(caseData[m[1]], `案例鈕 ${m[1]} 沒有對應的跳窗`);
  assert.ok(html.includes('<a href="#cases" data-route="cases"><span>案例</span></a>'), '目錄上的案例不該再標「準備中」');
  assert.ok(!html.includes('<p class="eyebrow">第 9 頁</p>'), '案例頁不該再是「準備中」');
  assert.ok(html.includes('<p class="source-note">來源：cases/ 底下每一則案例檔（標題、六欄、「相關」）與 cases/index.json（索引的標題、開頭的說明、末尾的小節）；cases/README.md 是用同一批檔產生的索引，這一頁不讀它，自己照日期、同一天照檔名排。案例的字照說明書的排法：只排灰底框、粗體，指到別則案例的連結顯示成那一則的標題、點了打開那一則；其他字照原文顯示（只有寫在符號前面、讓符號不被當成排版記號的「\\」不顯示；GitHub 會把表情代碼變成圖示、網址變成連結，這裡照字面，用尖括號包住的網址也照字面、連尖括號）。索引的說明與小節照原文顯示。說明書認不得的寫法（例如會變成斜體、刪除線、圖片、HTML 的記號），會讓整份停下不產生。</p>'), '案例頁的來源註記不對');
  // 寫死的樣本：索引第一列、網址照字面（連尖括號）、相關排成那幾則的標題、代價裡指到別則的連結、灰底框、粗體、「<」接中文照字面、末尾小節照字面
  assert.ok(pageHtml.includes('<tr><td>2026-07-10</td><td><button type="button" class="case-link" data-case="delete-branch-closed-stacked-pr">合併時刪基底分支，上層兩支被平台關閉</button></td><td><span class="case-rules"><button type="button" class="rule-link" data-goto="rule-H2">H2</button></span></td></tr>'), '索引第一列不對（寫死的樣本）');
  assert.ok(caseData['bare-repo-incident'].html.includes('<dt>來源</dt><dd>PFW #433（2026-08-09）&lt;https://github.com/teacherjung/personal-finance-webapp/pull/433&gt; ；PFW #435（2026-08-10）&lt;https://github.com/teacherjung/personal-finance-webapp/pull/435#issuecomment-5234813685&gt;</dd>'), '來源的網址要照字面、連尖括號（寫死的樣本）');
  assert.ok(caseData['bare-repo-incident'].html.endsWith('<dt>相關</dt><dd><a href="#cases" class="case-link" data-case="my-own-guards-lied">六條備份考題全綠，其中三條弄壞了也不會紅</a>、<a href="#cases" class="case-link" data-case="silent-pass-is-worst">閘沒跑卻回報通過</a>、<a href="#cases" class="case-link" data-case="guard-claims-vs-evidence">護欄的宣稱一直超出證據</a></dd></dl>'), '相關要排成那幾則的標題（寫死的樣本）');
  assert.ok(caseData['absolute-guarantee-invites-blockers'].html.includes('記在 <a href="#cases" class="case-link" data-case="pending-rulings-list-tool">待裁清單工具不是閘</a>，那裡不再重複計'), '代價裡指到別則的連結（寫死的樣本）');
  assert.ok(caseData['grey-box-copy-verbatim'].html.includes('（<code>未執行：&lt;原因&gt;</code>）'), '灰底框（寫死的樣本）');
  assert.ok(caseData['designed-shapes-never-touched-a-real-platform'].html.includes('<strong>每一頁各印一個</strong>'), '粗體（寫死的樣本）');
  assert.ok(caseData['review-verdict-strings'].html.includes('「結論：&lt;你的結論&gt;」'), '「<」接中文照字面（寫死的樣本）');
  assert.ok(pageHtml.includes('<h2>不是事故、但值得記的方法</h2>\n<p>- 用算式重算對方回報的每一個數字：'), '索引末尾的小節照字面（寫死的樣本）');
  // 互動接線（雲端考卷沒有瀏覽器，這裡只釘住程式在、PR 說明另外用瀏覽器量）與樣式
  const caseJson = html.match(/<script type="application\/json" id="case-data">([\s\S]*?)<\/script>/u)[1];
  assert.ok(!caseJson.includes('<') && caseJson.includes('\\u003c'), '案例的跳窗資料裡的「<」要寫成 \\u003c（不然一段字就能結束這個 script）');
  assert.ok(html.includes("var cases = JSON.parse(document.getElementById('case-data').textContent);"), '要讀案例的跳窗資料');
  assert.ok(html.includes("function openCase(slug){ var c = cases[slug]; if (c) openModal(c.title, c.html); }"), '要有開案例跳窗的程式');
  assert.ok(html.includes("var cs = t.closest('[data-case]'); if (cs) { e.preventDefault(); openCase(cs.getAttribute('data-case')); return; }"), '點案例的鈕或連結要開那一則（連結不跳走）');
  assert.ok(html.includes('if (modal.hidden) { lastFocus = document.activeElement; lastScroll = window.scrollY; }'), '從一則案例的跳窗點到另一則，關掉後焦點與捲動要回到最早點開的那一刻');
  assert.ok(html.includes('if (restore) { window.scrollTo(0, lastScroll); if (lastFocus) lastFocus.focus({ preventScroll: true }); }'), '關掉跳窗要捲回原處（不靠焦點：有的瀏覽器點鈕不給焦點）');
  const css = html.match(/<style>([\s\S]*?)<\/style>/u)[1];
  assert.match(css, /\ntable\.case-index td:first-child\{white-space:nowrap;/u, '索引的日期不折行');
  assert.match(css, /\n\.case-link\{[^}]*cursor:pointer[^}]*\}/u, '案例鈕與連結的樣式');
  assert.match(css, /\n\.case-def dd,\[data-page="cases"\] \.block :is\(h2,p\)\{white-space:pre-wrap\}/u, '案例的字與索引的說明要照原文留空白（連續空白不合併）');
  assert.match(css, /@media \(max-width:760px\)\{[^@]*\n {2}table\.case-index th:last-child,table\.case-index td:last-child\{width:1%\}/u, '手機上「本文條號」那一欄收到最窄，標題那一欄才排得開');

  // 對照組：同一套比法跑一份「什麼都有」的案例簿（粗體裡有灰底框與連結、灰底框裡的 < & [ 照字面、跳脫、「<」接中文、
  // 網址裡有 _ 與 &、沒有「相關」、檔尾多個空行、檔尾沒有換行、同一天兩則、檔案順序打亂、兩個小節）
  const at = (lines) => lines.join('\n');
  const RICH = {
    notes: JSON.stringify({ title: '對照組的索引 <一> & "二"', intro: ['一則一檔；每則指回本文條號，**粗** 與 `框` 照字面。','來源欄的 PFW #n ＝原專案的第 n 支PR（<不是連結> & "引號"）。'], sections: [{ title: '方法一 <x>', lines: ['- 照字面，**不排**、`不框`、<b>。'] }, { title: '方法二', lines: ['第一行  兩個空白', '第二行'] }] }),
    files: [
      { path: 'cases/ab.md', text: at(['# 乙：同一天、檔名在後', '', '- 日期：2026-09-01', '- 本文條號：K4', '- 發生什麼：見 [a-b](a-b.md)。', '- 代價：沒有。', '- 教訓：無，\\![a-b](a-b.md) 是連結，A  B 兩個空白照留。', '- 來源：私人紀錄', '', '', '']) },
      { path: 'cases/a-b.md', text: at(['# 甲：同一天、檔名在前', '', '- 日期：2026-09-01', '- 本文條號：E4、K4', '- 發生什麼：見 **粗 `框` 與 [ab](ab.md) 體** 與 `<x> & [y](y.md)`，\\*照字面\\*。', '- 代價：記在 [old](old.md)，那裡不再計。', '- 教訓：「<」接中文照字面：<你的結論>、「>」。', '- 來源：PFW #1（2026-09-01）<https://github.com/o/r/pull/1#issuecomment-2> ；<https://example.com/a_b?c=1&d=2>', '- 相關：[ab](ab.md)、[old](old.md)', '']) },
      { path: 'cases/old.md', text: at(['# 丙：日期最早 <舊> & "引號"', '', '- 日期：2026-07-01', '- 本文條號：A1', '- 發生什麼：甲', '- 代價：乙', '- 教訓：丙', '- 來源：丁']) },
    ],
  };
  const rich = manual.renderCases(RICH, ruleIds);
  assert.deepEqual(checkCasesPage(rich, RICH, '對照組').map((c) => c.slug), ['old', 'a-b', 'ab'], '對照組：照日期、同一天照檔名（「-」排在字母前面）');
  assert.ok(rich.caseData['a-b'].html.includes('<dd>見 <strong>粗 <code>框</code> 與 <a href="#cases" class="case-link" data-case="ab">乙：同一天、檔名在後</a> 體</strong> 與 <code>&lt;x&gt; &amp; [y](y.md)</code>，*照字面*。</dd>'), '對照組：粗體裡的灰底框與連結、灰底框裡照字面、跳脫（寫死的樣本）');
  assert.ok(rich.caseData['a-b'].html.includes('<dd>「&lt;」接中文照字面：&lt;你的結論&gt;、「&gt;」。</dd>') && rich.caseData['a-b'].html.includes('&lt;https://example.com/a_b?c=1&amp;d=2&gt;</dd>'), '對照組：「<」接中文、網址裡的 _ 與 & 照字面（寫死的樣本）');
  assert.ok(rich.caseData.ab.html.endsWith('<dt>來源</dt><dd>私人紀錄</dd></dl>'), '對照組：沒有「相關」的那一則不印那一欄');
  assert.ok(rich.caseData.ab.html.includes('<dd>無，!<a href="#cases" class="case-link" data-case="a-b">甲：同一天、檔名在前</a> 是連結，A  B 兩個空白照留。</dd>'), '對照組：跳脫的「!」照字面、後面的連結照排；連續空白照留（寫死的樣本）');
  assert.ok(rich.html.includes('<p class="muted">一則一檔；每則指回本文條號，**粗** 與 `框` 照字面。</p>'), '對照組：索引的說明照字面，不排粗體與灰底框（寫死的樣本）');
  assert.ok(rich.html.includes('<h2>對照組的索引 &lt;一&gt; &amp; &quot;二&quot;<span class="sec-count">3 則</span></h2>') && rich.html.includes('<td><button type="button" class="case-link" data-case="old">丙：日期最早 &lt;舊&gt; &amp; &quot;引號&quot;</button></td>') && rich.caseData['a-b'].html.includes('記在 <a href="#cases" class="case-link" data-case="old">丙：日期最早 &lt;舊&gt; &amp; &quot;引號&quot;</a>，那裡不再計。') && rich.caseData.old.title === '丙：日期最早 <舊> & "引號"', '對照組：索引標題、索引表與連結裡的案例標題要跳脫，跳窗的標題是原字（寫死的樣本）');
  assert.ok(rich.html.includes('<h2>方法一 &lt;x&gt;</h2>\n<p>- 照字面，**不排**、`不框`、&lt;b&gt;。</p>\n</section>\n<section class="block"><h2>方法二</h2>\n<p>第一行  兩個空白</p>\n<p>第二行</p>\n</section>'), '對照組：末尾的小節照字面、兩個小節照順序（寫死的樣本）');

  // 認不得就停（原因要對，行號照案例檔的）
  const ed = (from, to, p = 'cases/a-b.md') => ({ ...RICH, files: RICH.files.map((f) => (f.path === p ? { ...f, text: f.text.split(from).join(to) } : f)) });
  const notesWith = (patch) => ({ ...RICH, notes: JSON.stringify({ ...JSON.parse(RICH.notes), ...patch }) });
  const BEL = String.fromCharCode(7);
  const LS = String.fromCharCode(0x2028);
  const bad = [
    ['index.json 不是 JSON', { ...RICH, notes: '{' }, /cases\/index\.json 不是合法的 JSON/u],
    ['index.json 多一個鍵', notesWith({ extra: 1 }), /cases\/index\.json 的最外層要剛好有 title、intro、sections 這幾個鍵/u],
    ['index.json 少一個鍵', { ...RICH, notes: JSON.stringify({ title: 'x', intro: [] }) }, /最外層要剛好有 title、intro、sections 這幾個鍵/u],
    ['開頭不是陣列', notesWith({ intro: 'x' }), /cases\/index\.json 的開頭要是陣列/u],
    ['索引標題是空的', notesWith({ title: '' }), /cases\/index\.json 的標題要是一行非空/u],
    ['開頭一行頭有空白', notesWith({ intro: [' x'] }), /cases\/index\.json 的開頭第 1 行要是一行非空/u],
    ['開頭一行不是字', notesWith({ intro: [{ text: '應保留的說明' }] }), /cases\/index\.json 的開頭第 1 行要是一行非空/u],
    ['開頭一行有控制字元', notesWith({ intro: [`A${String.fromCharCode(0)}B`] }), /cases\/index\.json 的開頭第 1 行要是一行非空/u],
    ['開頭一行有換行', notesWith({ intro: ['a\nb'] }), /開頭第 1 行要是一行非空/u],
    ['小節的字有 tab', notesWith({ sections: [{ title: 't', lines: ['a\tb'] }] }), /cases\/index\.json 的第 1 個小節第 1 行要是一行非空/u],
    ['小節的字有 U+2028', notesWith({ sections: [{ title: 't', lines: [`a${LS}b`] }] }), /第 1 個小節第 1 行要是一行非空/u],
    ['小節少了 lines', notesWith({ sections: [{ title: 't' }] }), /cases\/index\.json 的第 1 個小節要剛好有 title、lines 這幾個鍵/u],
    ['小節的內容不是陣列', notesWith({ sections: [{ title: 't', lines: 'x' }] }), /第 1 個小節的內容要是陣列/u],
    ['檔名有大寫', { ...RICH, files: RICH.files.map((f) => (f.path === 'cases/old.md' ? { ...f, path: 'cases/Old.md' } : f)) }, /cases\/Old\.md：檔名要是小寫英數與連字號/u],
    ['控制字元', ed('那裡不再計', `那裡${BEL}不再計`), /cases\/a-b\.md 裡有 tab、控制字元或 U\+2028／U\+2029/u],
    ['tab', ed('那裡不再計', '那裡\t不再計'), /cases\/a-b\.md 裡有 tab、控制字元或 U\+2028／U\+2029/u],
    ['U+2028', ed('那裡不再計', `那裡${LS}不再計`), /cases\/a-b\.md 裡有 tab、控制字元或 U\+2028／U\+2029/u],
    ['少兩行', ed('- 代價：記在 [old](old.md)，那裡不再計。\n- 教訓：「<」接中文照字面：<你的結論>、「>」。\n', ''), /cases\/a-b\.md 有 7 行：案例的固定形狀是標題、空行、6 欄，最多再加一行「相關」/u],
    ['多一行', ed('- 相關：', '- 相關：[ab](ab.md)\n- 相關：'), /cases\/a-b\.md 有 10 行/u],
    ['標題沒有空格', ed('# 甲', '#甲'), /cases\/a-b\.md 第 1 行：要是「# 標題」/u],
    ['標題是空的', ed('# 甲：同一天、檔名在前\n', '# \n'), /cases\/a-b\.md 第 1 行：標題是空的、或頭尾有空白/u],
    ['標題尾端空白', ed('檔名在前\n', '檔名在前 \n'), /cases\/a-b\.md 第 1 行：標題是空的、或頭尾有空白/u],
    ['標題結尾 #', ed('檔名在前\n', '檔名在前 #\n'), /cases\/a-b\.md 第 1 行：標題結尾是「#」/u],
    ['標題有灰底框', ed('檔名在前\n', '檔名在前 `x`\n'), /cases\/a-b\.md 第 1 行：標題裡有排版記號/u],
    ['標題有粗體', ed('檔名在前\n', '檔名**在前**\n'), /cases\/a-b\.md 第 1 行：標題裡有排版記號/u],
    ['標題有跳脫', ed('檔名在前\n', '檔名\\#在前\n'), /cases\/a-b\.md 第 1 行：標題裡有排版記號/u],
    ['標題有連續空白', ed('檔名在前\n', '檔名  在前\n'), /cases\/a-b\.md 第 1 行：標題裡有連續的空白/u],
    ['標題有連結', ed('檔名在前\n', '檔名在前 [ab](ab.md)\n'), /cases\/a-b\.md 第 1 行的標題：「\[」GitHub 可能當成連結/u],
    ['第 2 行不是空的', ed('檔名在前\n\n', '檔名在前\nx\n'), /cases\/a-b\.md 第 2 行：要空著/u],
    ['欄位順序', ed('- 代價：記在 [old](old.md)，那裡不再計。\n- 教訓：「<」接中文照字面：<你的結論>、「>」。', '- 教訓：「<」接中文照字面：<你的結論>、「>」。\n- 代價：記在 [old](old.md)，那裡不再計。'), /cases\/a-b\.md 第 6 行：應該是「- 代價：…」/u],
    ['欄名後是半形冒號', ed('- 日期：', '- 日期:'), /cases\/a-b\.md 第 3 行：應該是「- 日期：…」/u],
    ['欄位是空的', ed('- 代價：記在 [old](old.md)，那裡不再計。', '- 代價：'), /cases\/a-b\.md 第 6 行：「代價」是空的、或頭尾有空白/u],
    ['欄位頭有空白', ed('- 代價：記在', '- 代價： 記在'), /cases\/a-b\.md 第 6 行：「代價」是空的、或頭尾有空白/u],
    ['日期格式', ed('- 日期：2026-09-01', '- 日期：2026-9-1'), /cases\/a-b\.md 第 3 行：日期要寫成 YYYY-MM-DD/u],
    ['條號格式', ed('E4、K4', 'E4,K4'), /cases\/a-b\.md 第 4 行：本文條號要寫成 A1 或 A1、B2/u],
    ['條號不在規則裡', ed('E4、K4', 'E4、K99'), /cases\/a-b\.md 第 4 行：本文條號 K99 不在規則資料裡/u],
    ['條號重複', ed('E4、K4', 'E4、E4'), /cases\/a-b\.md 第 4 行：本文條號有一條寫了兩次/u],
    ['第 9 行不是相關', ed('- 相關：', '- 備註：'), /cases\/a-b\.md 第 9 行：應該是「- 相關：…」/u],
    ['連到不在的案例', ed('記在 [old](old.md)', '記在 [nope](nope.md)'), /cases\/a-b\.md 第 6 行的「代價」：連結指到的 nope\.md 不在 cases\//u],
    ['連結的字跟檔名不一樣', ed('記在 [old](old.md)', '記在 [ab](old.md)'), /cases\/a-b\.md 第 6 行的「代價」：連結的字「ab」跟它指到的 old\.md 不一樣/u],
    ['別種連結', ed('記在 [old](old.md)', '記在 [old](https://x.y)'), /cases\/a-b\.md 第 6 行的「代價」：「\[」GitHub 可能當成連結/u],
    ['認不得的「[」在連結前面', ed('記在 [old](old.md)', '記在 [x] 與 [old](old.md)'), /cases\/a-b\.md 第 6 行的「代價」：「\[」GitHub 可能當成連結/u],
    ['連到別的副檔名', ed('記在 [old](old.md)', '記在 [old](old.txt)'), /cases\/a-b\.md 第 6 行的「代價」：「\[」GitHub 可能當成連結/u],
    ['圖片', ed('記在 [old](old.md)', '記在 ![old](old.md)'), /cases\/a-b\.md 第 6 行的「代價」：「!\[」GitHub 會當成圖片/u],
    ['跳脫的反斜線後面的圖片', ed('記在 [old](old.md)', '記在 \\\\![old](old.md)'), /cases\/a-b\.md 第 6 行的「代價」：「!\[」GitHub 會當成圖片/u],
    ['相關裡連到不在的', ed('、[old](old.md)\n', '、[zz](zz.md)\n'), /cases\/a-b\.md 第 9 行的「相關」：連結指到的 zz\.md 不在 cases\//u],
    ['http 的自動連結', ed('<https://example.com', '<http://example.com'), /cases\/a-b\.md 第 8 行的「來源」：「<」後面緊接著半形字元/u],
    ['自動連結裡有空白', ed('<https://example.com/a_b', '<https://example.com/a b'), /cases\/a-b\.md 第 8 行的「來源」：「<」後面緊接著半形字元/u],
    ['認不得的「<」在自動連結前面', ed('；<https://example.com', '；<b> 與 <https://example.com'), /cases\/a-b\.md 第 8 行的「來源」：「<」後面緊接著半形字元/u],
    ['自動連結沒收尾', ed('c=1&d=2>', 'c=1&d=2'), /cases\/a-b\.md 第 8 行的「來源」：「<」後面緊接著半形字元/u],
    ['HTML', ed('那裡不再計', '那裡<b>不</b>再計'), /cases\/a-b\.md 第 6 行的「代價」：「<」後面緊接著半形字元/u],
    ['單獨的星號', ed('那裡不再計', '那裡*不*再計'), /cases\/a-b\.md 第 6 行的「代價」：單獨的「\*」/u],
    ['底線斜體', ed('那裡不再計', '那裡 _不_ 再計'), /cases\/a-b\.md 第 6 行的「代價」：「_」後面緊接著字/u],
    ['刪除線', ed('那裡不再計', '那裡~~不~~再計'), /cases\/a-b\.md 第 6 行的「代價」：「~」後面緊接著字/u],
    ['字元代碼', ed('那裡不再計', '那裡&amp;再計'), /cases\/a-b\.md 第 6 行的「代價」：「&」後面接英文字母或 #/u],
    ['粗體頭有空白', ed('**粗 `框`', '** 粗 `框`'), /cases\/a-b\.md 第 5 行的「發生什麼」：粗體的頭尾緊貼空白或標點/u],
    ['反引號沒成對', ed('`<x> & [y](y.md)`', '`<x> & [y](y.md)'), /cases\/a-b\.md 第 5 行的「發生什麼」：反引號沒有成對/u],
  ];
  for (const [name, x, why] of bad) {
    assert.notEqual(JSON.stringify(x), JSON.stringify(RICH), `「${name}」這一發沒有改到來源`);
    assert.throws(() => manual.renderCases(x, ruleIds), why, `「${name}」應該停下、而且原因要對`);
  }
  // 整份產生時也停；連結與自動連結只開給案例頁：設定頁、範本跳窗、套用頁照舊
  assert.throws(() => manual.build({ ...src, cases: { ...src.cases, notes: '{' } }), /cases\/index\.json 不是合法的 JSON/u);
  assert.throws(() => manual.build({ ...src, cases: { ...src.cases, files: [...src.cases.files, { path: 'cases/zz.md', text: 'x\n' }] } }), /cases\/zz\.md 有 1 行/u);
  assert.throws(() => manual.renderSettings('# 標題\n\n## 一\n\n見 [a](a.md)。\n'), /「\[」GitHub 可能當成連結/u, '設定頁仍不收連結');
  assert.throws(() => manual.renderSettings('# 標題\n\n## 一\n\n見 <https://x.y>。\n'), /「<」後面緊接著半形字元/u, '設定頁仍不收自動連結');
  assert.equal(manual.templateView({ path: 'templates/t.md', text: '# 標題\n\n見 [a](a.md) 與 <https://x.y>。\n' }).laidOut, false, '範本跳窗仍不排連結與自動連結（照原始檔）');
  assert.throws(() => manual.renderAdopt('# 套件\n\n## 搬進一個專案\n\n見 <https://x.y>。\n\n## 專案裡改到套件的檔\n\n- 例外\n'), /「<」後面緊接著半形字元/u, '套用頁仍不收自動連結');

  // 讀來源：cases/ 或 index.json 不在、多了不是 .md 的檔或子資料夾、不是合法的 UTF-8，都停；README.md 不讀
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-cases-'));
  try {
    const casesDir = path.join(dir, 'cases');
    assert.throws(() => manual.readCases(dir), /讀不到 cases\/：說明書不產生/u);
    fs.mkdirSync(casesDir);
    for (const f of RICH.files) fs.writeFileSync(path.join(dir, f.path), f.text);
    assert.throws(() => manual.readCases(dir), /讀不到 cases\/index\.json/u);
    fs.writeFileSync(path.join(casesDir, 'index.json'), RICH.notes);
    fs.writeFileSync(path.join(casesDir, 'README.md'), '不讀的索引 <b>\n');
    assert.deepEqual(manual.readCases(dir), { notes: RICH.notes, files: [...RICH.files].sort((a, b) => (a.path < b.path ? -1 : 1)) }, '讀到的是 index.json 與每一則案例（照檔名排）、README.md 不算');
    for (const [name, file, make, why] of [
      ['不是 .md 的檔', 'notes.txt', (p) => fs.writeFileSync(p, 'x'), /cases\/notes\.txt：案例頁不知道它算不算案例/u],
      ['子資料夾', 'sub.md', (p) => fs.mkdirSync(p), /cases\/sub\.md：案例頁不知道它算不算案例/u],
      ['不是合法的 UTF-8', 'bad.md', (p) => fs.writeFileSync(p, Buffer.from([0x23, 0x20, 0xff, 0x0a])), /cases\/bad\.md 不是合法的 UTF-8 文字/u],
    ]) {
      const p = path.join(casesDir, file);
      make(p);
      assert.throws(() => manual.readCases(dir), why, `「${name}」應該停下`);
      fs.rmSync(p, { recursive: true, force: true });
    }
    // 檔頭的 BOM 照留（看不見的字），第 1 行就不是「# 標題」，停
    const bom = path.join(casesDir, 'bom.md');
    fs.writeFileSync(bom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(RICH.files[2].text)]));
    assert.throws(() => manual.renderCases(manual.readCases(dir), ruleIds), /cases\/bom\.md 第 1 行：要是「# 標題」/u, '檔頭有 BOM 應該停下');
    fs.rmSync(bom);
    fs.writeFileSync(path.join(casesDir, 'index.json'), Buffer.from([0x7b, 0xff, 0x7d]));
    assert.throws(() => manual.readCases(dir), /cases\/index\.json 不是合法的 UTF-8 文字/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
