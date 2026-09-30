'use strict';
// 說明書網頁產生器的考題（manual/build.js；只在套件倉庫、不在共用路徑裡）。
// 守的：規矩頁的每一條（主句、子點的順序與層級與編號、把關那一行整行）、節標題、頁面上的數字、
// 跳窗資料、版面約定逐條、檔頭原文，以及來源形狀不對時停下不產生。
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
  for (let i = at + 2; lines[i] && lines[i].startsWith('|'); i += 1) {
    const [name, meaning, limits] = lines[i].split('|').slice(1, 4).map((c) => c.trim());
    rows.push({ name, meaning, limits });
  }
  return rows;
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
  const { html, counts } = manual.build(src);
  const roles = src.rules.roles;
  const names = ownLabels(src.machines).map((l) => l.name);
  const ids = src.rules.sections.flatMap((s) => s.rules.map((r) => `${s.letter}${r.n}`));
  assert.equal(counts.total, ids.length);
  for (const id of Object.keys(TAG_SAMPLES)) assert.ok(ids.includes(id), `寫死的樣本 ${id} 已經不在規則裡：樣本要跟著規則改`);
  assert.equal((html.match(/<article class="rule" /gu) || []).length, ids.length, '卡的張數要等於規則條數');
  assert.ok(ids.length >= rulesBook.MIN_RULES, '規則條數少於規則書產生器的下限：來源可能讀錯了');
  for (const section of src.rules.sections) {
    for (const rule of section.rules) {
      const id = `${section.letter}${rule.n}`;
      const c = card(html, id);
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
  const names = labels.map((l) => l.name);
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
  const names = ownLabels(src.machines).map((l) => l.name);
  const tally = { machine: 0, mixed: 0, self: 0 };
  for (const s of src.rules.sections) for (const r of s.rules) tally[kindOfTag(r.tag, names)] += 1;
  const total = tally.machine + tally.mixed + tally.self;
  const { counts, html } = manual.build(src);
  assert.deepEqual(counts, { total, ...tally });
  const nums = [...html.matchAll(/data-filter="(\w+)"[^>]*>[\s\S]*?<span class="num">(\d+)<\/span>/gu)].map((m) => [m[1], Number(m[2])]);
  assert.deepEqual(nums, [['all', total], ['machine', tally.machine], ['mixed', tally.mixed], ['self', tally.self]]);
  assert.ok(html.includes(`<p class="page-sum">${total} 條，分 ${src.rules.sections.length} 節`), '頁首的總條數或節數不對');
  assert.deepEqual(manual.KIND_TEXT, KIND, '分類的字改了：要連這一題與 PR 說明一起改');
  assert.ok(html.includes('這三類只照每一條「把關」那一行列了哪些名字來分，不代表整條都有人守住'), '頁上講分類的那句不見了');
  for (const s of src.rules.sections) {
    assert.ok(html.includes(`<span class="sec-letter">${s.letter}</span>${manual.esc(s.title)}<span class="sec-count">${s.rules.length} 條</span>`), `${s.letter} 節的標題或條數不對`);
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
  const own = ownLabels(src.machines);
  assert.ok(own.length >= 9, '考題自己讀到的標籤太少：對照讀錯了');
  assert.deepEqual(labels, own, '產生器讀到的標籤表跟考題自己讀的不一樣');
  assert.deepEqual(Object.keys(data).sort(), own.map((l) => l.name).sort());
  for (const l of own) {
    const dd = [...data[l.name].html.matchAll(/<dt>([^<]+)<\/dt><dd>([\s\S]*?)<\/dd>/gu)].map((m) => [m[1], strip(m[2])]);
    assert.deepEqual(dd, [['意思', proseText(l.meaning)], ['守不到的', proseText(l.limits)]], `「${l.name}」的意思／守不到的不是原文`);
  }
  assert.deepEqual(manual.parseLabels('| 標籤 | 意思 | 守不到的 |\n|---|---|---|\n| 甲 | 甲的意思 | 甲守不到 |\n| 靠自覺 | 沒有機器 | 全部 |\n'),
    [{ name: '甲', meaning: '甲的意思', limits: '甲守不到' }, { name: '靠自覺', meaning: '沒有機器', limits: '全部' }]);
  const want = new Set();
  for (const s of src.rules.sections) {
    for (const r of s.rules) for (const n of ownTagNames(r.tag, own.map((l) => l.name))) want.add(`${n}:${s.letter}${r.n}`);
  }
  assert.ok(want.has('合併閘:A2') && want.has('雲端:A2'), '對照裡 A2 要同時有雲端與合併閘');
  const got = [];
  for (const [name, entry] of Object.entries(data)) {
    const links = [...entry.html.matchAll(/data-goto="rule-([A-K]\d+)"/gu)].map((m) => m[1]);
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
  const withLegend = (body) => g.split(legendBody).join(body);
  const firstBullet = legendBody.match(/^- .*$/mu)[0];
  const cases = [
    ['表頭改名', { machines: m.replace('| 標籤 | 意思 | 守不到的 |', '| 名字 | 意思 | 守不到的 |') }, /找不到「\| 標籤/u],
    ['少分隔列', { machines: m.replace('| 標籤 | 意思 | 守不到的 |\n|---|---|---|', '| 標籤 | 意思 | 守不到的 |') }, /應該是分隔列/u],
    ['空格', { machines: m.replace(/^(\| 考題 \| )[^|]+\|/mu, '$1 |') }, /每格都有字/u],
    ['重複登記', { machines: m.replace(/^(\| 考題 \|.*)$/mu, '$1\n$1') }, /登記了兩次/u],
    ['沒有靠自覺', { machines: m.replace(/^\| 靠自覺 \|.*$/mu, '') }, /標籤表裡沒有「靠自覺」/u],
    ['版面約定不見', { glossary: g.replace('## 版面約定', '## 別的') }, /找不到「## 版面約定」/u],
    ['開頭區縮排', { glossary: withLegend(`  縮排的一行\n${legendBody}`) }, /縮排行/u],
    ['沒有開頭那一段', { glossary: withLegend(legendBody.split('\n').filter((l) => l.startsWith('- ') || !l.trim()).join('\n')) }, /沒有開頭那一段/u],
    ['多一格沒結尾', { machines: m.replace(/^\| 靠自覺 \| 沒有機器 \| 全部 \|$/mu, '| 靠自覺 | 沒有機器 | 全部 | 多的一格') }, /頭尾都有/u],
    ['條列後段落', { glossary: withLegend(`${legendBody}\n條列後面的一段`) }, /條列後面又有段落/u],
    ['別種條列', { glossary: withLegend(legendBody.replace(firstBullet, `* ${firstBullet.slice(2)}`)) }, /只收開頭一段與「- 」條列/u],
    ['沒有條列', { glossary: withLegend(legendBody.replace(/^- .*$/gmu, '')) }, /沒有條列/u],
  ];
  for (const [name, patch, pattern] of cases) {
    const key = Object.keys(patch)[0];
    assert.notEqual(patch[key], src[key], `「${name}」這一發沒有改到來源`);
    assert.throws(() => manual.build({ ...src, ...patch }), pattern, `「${name}」應該停下`);
  }
});

test('⑥ 跳脫與原文：尖括號以文字出現；版面約定逐條與開頭那句、規則書檔頭都照原文出現', () => {
  const src = sources();
  const { html } = manual.build(src);
  assert.ok(html.includes('<code>未執行：&lt;原因&gt;</code>'), '版面約定那個灰底框沒有照字面出現');
  const own = ownLegend(src.glossary);
  assert.ok(own.lead && own.bullets.length >= 3, '考題自己讀到的版面約定太少：對照讀錯了');
  assert.deepEqual(manual.parseLegend(src.glossary), own, '產生器讀到的版面約定跟考題自己讀的不一樣');
  const box = html.match(/<details class="legend">([\s\S]*?)<\/details>/u)[1];
  const lis = [...box.matchAll(/<li>([\s\S]*?)<\/li>/gu)].map((x) => strip(x[1]));
  assert.deepEqual(lis, own.bullets.map(proseText), '版面約定的條列跟原文不一樣（少一條、多一條或換了字）');
  const leadP = box.match(/<p>([\s\S]*?)<\/p>/u);
  assert.ok(leadP, '版面約定開頭那句不見了');
  assert.equal(strip(leadP[1]), proseText(own.lead), '版面約定開頭那句不是原文');
  assert.deepEqual(manual.parseLegend('## 版面約定\n\n開頭。\n\n- 一\n- 二\n\n## 下一節\n'), { lead: '開頭。', bullets: ['一', '二'] });
  assert.ok(html.includes(`規則書檔頭原文：${manual.esc(src.rules.preamble)}`), '規則書檔頭原文不見了');
  assert.equal(manual.mdInline('a <b> **粗** `<c>`'), 'a &lt;b&gt; <strong>粗</strong> <code>&lt;c&gt;</code>');
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
  const out = run(['--out', 'x.html']);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /產生器不自己存檔/u);
  assert.equal(out.stdout, '');
  assert.equal(run(['--stamp']).status, 1);
  assert.match(run(['--nope', 'x']).stderr, /不認得的參數：--nope/u);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-cli-'));
  try {
    // 來源壞掉：在複本裡把版面約定拿掉再跑
    const kit = path.join(dir, 'kit');
    for (const rel of ['manual/build.js', 'tools/build-rules.js', 'rules.json', 'MACHINES.md', 'GLOSSARY.md']) {
      fs.mkdirSync(path.dirname(path.join(kit, rel)), { recursive: true });
      fs.copyFileSync(path.join(manual.ROOT, rel), path.join(kit, rel));
    }
    fs.writeFileSync(path.join(kit, 'GLOSSARY.md'), '# 空的\n');
    const bad = run([], path.join(kit, 'manual/build.js'));
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /找不到「## 版面約定」/u);
    assert.equal(bad.stdout, '', '來源壞掉時標準輸出不可以印出任何網頁內容');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
