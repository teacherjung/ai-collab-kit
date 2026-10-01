'use strict';
// 說明書網頁產生器的考題（manual/build.js；只在套件倉庫、不在共用路徑裡）。
// 守的：規矩頁的每一條（主句、子點的順序與層級與編號、把關那一行整行、機器表連結）、節標題、頁面上的數字、
// 跳窗資料、版面約定逐條、檔頭原文；機器頁（標籤定義、那張表每一列的條號、移植狀態、跳窗四欄、重名列的完整標題）、
// 工具頁與考題頁（每一支的檔頭第一句、寫到它的機器表列）、範本頁（每則說明、說明裡的條號、寫到它的機器表列）；
// 讀來源那一步讀到的原文跟磁碟上的一模一樣；以及來源形狀不對時停下不產生。
// 預期值一律由考題自己直接讀磁碟上的正本（disk）、自己解析；產生器的 readSources() 讀到的只拿來餵產生器（#26 r1 R1）。
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
 * （前面可以有 #! 那一行與 'use strict'），去掉「//」接起來，到第一個空註解行為止，再取到第一個「。」。
 */
function ownHeader(text) {
  const block = text.match(/^(?:#!.*\n)?(?:'use strict';\n)?((?:\/\/.*\n)+)/u)[1];
  const para = block.split(/\n\/\/\s*\n/u)[0].replace(/^\/\/ ?/gmu, '').split('\n').map((l) => l.trim()).join('');
  return { line: para.match(/^[^。]*。/u)[0], para };
}

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
const TEMPLATE_RULE_SAMPLES = { 'templates/pr-body.md': ['D3', 'E1', 'F7', 'G3', 'H6'], 'templates/hook-claude.json': ['B1'], 'templates/ci-github.yml': ['E3', 'E1'], 'templates/ruling-record.md': ['I1', 'I3'] };

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
  for (const p of [manual.ROOT, os.homedir(), os.tmpdir(), '/Users/', '/private/', '/home/']) assert.ok(!html.includes(p), `產出裡有這台機器的路徑：${p}`);
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
  assert.match(ok.stderr, new RegExp(`考題 ${ownTests().length} 支；範本 ${fs.readdirSync(path.join(manual.ROOT, 'templates')).length} 份`, 'u'));
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
    for (const rel of ['manual/build.js', 'rules.json', 'MACHINES.md', 'GLOSSARY.md']) {
      fs.mkdirSync(path.dirname(path.join(kit, rel)), { recursive: true });
      fs.copyFileSync(path.join(manual.ROOT, rel), path.join(kit, rel));
    }
    for (const dir of ['tools', 'tests', 'templates']) fs.cpSync(path.join(manual.ROOT, dir), path.join(kit, dir), { recursive: true });
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
    if (!want.length) assert.ok(x[3].includes('沒有直接寫到它'), `${tools[i].path} 沒有對應列時要寫明`);
  });
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

test('⑫ 讀來源那一步：readSources() 讀到的每一份原文都跟磁碟上的一模一樣（規則資料、MACHINES.md、GLOSSARY.md、工具、考題、範本檔名）', () => {
  const src = sources();
  const o = own();
  assert.deepEqual(Object.keys(src).sort(), ['glossary', 'machines', 'rules', 'templates', 'tests', 'tools'], 'readSources 多讀或少讀了一份來源：要連這一題一起改');
  assert.deepEqual(src.rules, o.rules, 'rules.json 讀進來跟磁碟上的不一樣');
  assert.equal(src.machines, o.machines, 'MACHINES.md 讀進來跟磁碟上的不一樣（漏列、改字都會在這裡紅）');
  assert.equal(src.glossary, o.glossary, 'GLOSSARY.md 讀進來跟磁碟上的不一樣');
  assert.deepEqual(src.tools, ownTools().map((t) => ({ path: t.path, text: t.text })), '工具的清單、順序或原文跟磁碟上的不一樣');
  assert.deepEqual(src.tests, ownTests().map((t) => ({ path: t.path, text: t.text })), '考題的清單、順序或原文跟磁碟上的不一樣');
  const files = fs.readdirSync(path.join(manual.ROOT, 'templates')).map((f) => `templates/${f}`).sort();
  assert.ok(files.length >= 15, '考題自己列到的範本太少');
  assert.deepEqual(src.templates, files, '範本檔名跟磁碟上的不一樣');
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
    if (!want.length) assert.ok(x[3].includes('沒有直接寫到它'), `${tests[i].path} 沒有對應列時要寫明`);
  });
  const settings = items.find((x) => x[1] === 'tests/settings.test.js');
  assert.ok(settings && settings[3].includes('>H1：tests/settings.test.js 那一列<'), 'settings 那支考題要連到「H1：tests/settings.test.js」那一列（寫死的樣本）');
  assert.ok(page.includes(`${tests.length} 支考題檔（照 tests/manifest.json 的清單與順序）`), '考題頁頁首的支數不對');
  assert.ok(page.includes(`<span class="sec-count">${tests.length} 支</span>`), '考題那一塊的支數不對');
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
    assert.deepEqual(manual.readTests(dir), [{ path: 'tests/a.test.js', text: '// 甲。\n' }], '對照組：清單、helpers/、manifest.json、package.json 都在時照收');
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

test('⑭ 範本頁：MACHINES.md「範本」那一節每一則一張卡、照原文順序；檔名、說明、說明裡的條號、寫到它的機器表列都對；每一份範本剛好出現一次；形狀不對就停', () => {
  const src = sources();
  const o = own();
  const { html } = manual.build(src);
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
  const cards = [...page.matchAll(/<article class="tool"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p>\n<p class="rule-mach"><span class="tag-lead">規矩<\/span>([\s\S]*?)<\/p><p class="rule-mach"><span class="tag-lead">機器表<\/span>([\s\S]*?)<\/p><\/article>/gu)];
  assert.equal(cards.length, items.length, '卡的張數要等於「範本」那一節的則數');
  cards.forEach((c, i) => {
    const item = items[i];
    const where = item.paths.join('、');
    assert.equal(c[1], item.paths.map((p) => `<code>${escT(p)}</code>`).join('、'), `${where}：卡上的檔名或順序不對`);
    assert.equal(strip(c[2]), proseText(item.desc), `${where}：說明不是原文`);
    const ruleBtns = [...c[3].matchAll(/<button type="button" class="rule-link" data-goto="rule-([A-K]\d+)">([^<]*)<\/button>/gu)].map((x) => [x[1], x[2]]);
    assert.deepEqual(ruleBtns, item.rules.map((r) => [r, r]), `${where}：條號鈕跟說明裡寫到的條號不一樣`);
    for (const r of item.rules) assert.ok(ids.includes(r) && html.includes(`<article class="rule" id="rule-${r}"`), `${where}：條號 ${r} 要是規矩頁上有的那一條`);
    if (!item.rules.length) assert.ok(c[3].includes('說明裡沒有寫到條號'), `${where}：沒有條號時要寫明`);
    const want = rows.map((r, k) => [r, k]).filter(([r]) => item.paths.some((p) => r.fields[0].includes(`\`${p}\``))).map(([, k]) => k);
    const got = [...c[4].matchAll(/data-machine="(m\d+)">([^<]*)<\/button>/gu)];
    assert.deepEqual(got.map((g) => g[1]), want.map((k) => `m${k + 1}`), `${where}：列出的機器表列不對（用列的內容比）`);
    got.forEach((g, j) => assert.equal(g[2], `${escT(labels[want[j]])} 那一列`, `${where}：鈕上的字不是考題自己算的那一列標題`));
    if (!want.length) assert.match(c[4], item.paths.length > 1 ? /沒有直接寫到這幾份/u : /沒有直接寫到它/u, `${where}：沒有對應列時要寫明`);
  });
  assert.ok(page.includes(`${files.length} 份範本、${items.length} 則說明`), '範本頁頁首的數字不對');
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
    ['templates/ 有卻沒列', { templates: [...src.templates, 'templates/extra.md'].sort() }, /templates\/extra\.md 不在 MACHINES\.md「範本」那一節/u],
    ['說明裡的條號打錯', { machines: m.replace(first, first.replace(/（[^（）]*）/u, '（K99）')) }, /說明裡的條號 K99 不在規則裡/u],
  ];
  for (const [name, patch, pattern] of cases) {
    const key = Object.keys(patch)[0];
    assert.notDeepEqual(patch[key], src[key], `「${name}」這一發沒有改到來源`);
    assert.throws(() => manual.build({ ...src, ...patch }), pattern, `「${name}」應該停下`);
  }
  // 對照組：templates/ 多一份、那一節也補一行＝照收（灰底框裡像條號的字、前後黏著英數字的不算條號）
  const extra = manual.build({ ...src, templates: [...src.templates, 'templates/extra.md'].sort(), machines: m.replace(first, `${first}\n- \`templates/extra.md\`：新範本，看 \`K99\` 那一格；AB1、B1x 不是條號`) }).html;
  const card = extra.match(/<article class="tool"><h3><code>templates\/extra\.md<\/code><\/h3>([\s\S]*?)<\/article>/u);
  assert.ok(card && card[1].includes('說明裡沒有寫到條號') && card[1].includes('沒有直接寫到它'), '新補的那一則要照收、沒有條號也沒有機器表列');
  // 一則講兩份：都沒有機器表列＝寫「這幾份」；只有第二份被機器表第一列寫到＝也要列出那一列（不能只看第一份）
  const pair = (machines) => manual.build({ ...src, templates: [...src.templates, 'templates/extra.md', 'templates/extra2.md'].sort(), machines: machines.replace(first, `${first}\n- \`templates/extra.md\`、\`templates/extra2.md\`：一則兩份`) }).html
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
    assert.deepEqual(manual.readTemplates(dir), ['templates/a.md'], '對照組：只有一層的檔時照收');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
