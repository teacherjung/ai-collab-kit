// 守舊文字掃描（規矩 K5）：刪掉或改掉的字串還出現在倉庫哪裡，列出來、不擋。
//
// 守得到的：①三種字串都抓得到（引號框住的、連續 4 個以上的漢字、看得出是程式名字的英數字），一般英文單字不抓；
//   ②同一個字串也出現在新增的行裡＝作者自己留著用，不列；③在真的倉庫裡：刪掉的字還留在別的檔（例如契約）就列出那一處，
//   有命中也退 0（只列不擋）；④基準版本找不到、不在倉庫裡、主幹沒填又沒給 --base、不認得的參數＝退 2；
//   ⑤git 那一族環境變數指向別的倉庫也照樣掃這一個（E4）；⑥字串太多、命中太多都照實印出沒列的數量。
// ⚠️ 守不到的：意思變了但用字沒變、或換了說法的（只抓字面）；列出來的有沒有人去看。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('../tools/git-env.js');
const { run, parseDiff, phrasesOf, looksLikeName, MAX_HITS } = require('../tools/stale-text.js');
const { runInCopy } = require('./helpers/kit-copy.js');

const SETTINGS = { mainBranch: 'main' };

/** 在暫存目錄建一個倉庫：base 一顆、改動一顆。回傳目錄與 base 的版本碼。 */
function repo(baseFiles, headFiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-text-'));
  const g = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, env: gitEnv(), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const write = (files) => {
    for (const [p, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), text);
    }
  };
  g('init', '-q', '-b', 'main');
  write(baseFiles);
  g('add', '-A');
  g('commit', '-q', '-m', 'base');
  const base = g('rev-parse', 'HEAD');
  write(headFiles);
  g('add', '-A');
  g('commit', '-q', '-m', 'head');
  return { dir, base, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('①三種字串都抓得到、一般英文單字不抓；②新增的行裡也有的不列', () => {
  const removed = ['說明寫「整理後說明」在這裡', 'const bankRef = row.note; // 核對請用日期', 'return result; done'];
  const got = phrasesOf(removed, []);
  for (const p of ['整理後說明', 'bankRef', 'row.note', '核對請用日期']) assert.ok(got.includes(p), `要抓到「${p}」：${got.join('、')}`);
  assert.ok(!got.includes('result') && !got.includes('return'), '一般英文單字不抓');
  assert.ok(!got.includes('說明寫'), '不到 4 個字的漢字不單獨抓');
  assert.ok(!phrasesOf(removed, ['新的那一行還是寫「整理後說明」']).includes('整理後說明'), '新增的行裡也有＝作者自己留著用');
  assert.equal(looksLikeName('ready_for_review'), true);
  assert.equal(looksLikeName('camelCase'), true);
  assert.equal(looksLikeName('simple'), false);
  const d = parseDiff('--- a/x\n+++ b/x\n@@ -1 +1 @@\n-舊的\n+新的\n');
  assert.deepEqual(d, { removed: ['舊的'], added: ['新的'] }, '檔頭那兩行不算');
});

test('③在真的倉庫裡：刪掉的字還留在契約就列出那一處；有命中也退 0（只列不擋）', () => {
  const r = repo(
    { 'src/a.js': '// 核對請用日期\nconst x = 1;\n', 'docs/contract.md': '合約：核對請用日期。\n' },
    { 'src/a.js': '// 改成用編號核對\nconst x = 1;\n' },
  );
  try {
    const out = run(['--base', r.base], { settings: SETTINGS, cwd: r.dir });
    assert.equal(out.code, 0, out.lines.join('\n'));
    const text = out.lines.join('\n');
    assert.match(text, /「核對請用日期」還出現在 1 處/u);
    assert.match(text, /docs\/contract\.md:1：合約：核對請用日期。/u);
    assert.match(text, /只列不擋/u);
    // 沒有命中也退 0，並且照實說 0 個
    const clean = repo({ 'a.md': '舊的整句說明文字\n' }, { 'a.md': '新的\n' });
    try {
      const c = run(['--base', clean.base], { settings: SETTINGS, cwd: clean.dir });
      assert.equal(c.code, 0);
      assert.match(c.lines[0], /其中 0 個還出現在倉庫裡/u);
    } finally { clean.cleanup(); }
  } finally { r.cleanup(); }
});

test('④基準版本找不到、不在倉庫裡、主幹沒填又沒給 --base、不認得的參數＝退 2；空白設定的複本裡跑指令入口＝退 2', () => {
  const r = repo({ 'a.md': '一\n' }, { 'a.md': '二\n' });
  try {
    assert.equal(run(['--base', 'no-such-ref'], { settings: SETTINGS, cwd: r.dir }).code, 2);
    assert.equal(run([], { settings: { mainBranch: '未設定' }, cwd: r.dir }).code, 2);
    assert.equal(run(['--what'], { settings: SETTINGS, cwd: r.dir }).code, 2);
    // 預設跟 origin/<主幹> 比：這個倉庫沒有 origin＝找不到基準＝退 2（不猜）
    assert.match(run([], { settings: SETTINGS, cwd: r.dir }).lines[0], /找不到基準版本「origin\/main」/u);
  } finally { r.cleanup(); }
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-text-none-'));
  try { assert.equal(run(['--base', 'HEAD'], { settings: SETTINGS, cwd: outside }).code, 2); } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  const copy = runInCopy('tools/stale-text.js', []);
  assert.equal(copy.status, 2, copy.stdout + copy.stderr);
});

test('⑤git 那一族環境變數指向別的倉庫，也照樣掃這一個（E4）', () => {
  const here = repo({ 'src/a.js': '// 這一句只在這個倉庫\n', 'b.md': '這一句只在這個倉庫\n' }, { 'src/a.js': '// 改掉了\n' });
  const other = repo({ 'x.md': '別的\n' }, { 'x.md': '別的二\n' });
  const saved = process.env.GIT_DIR;
  try {
    process.env.GIT_DIR = path.join(other.dir, '.git');
    const out = run(['--base', here.base], { settings: SETTINGS, cwd: here.dir });
    assert.equal(out.code, 0, out.lines.join('\n'));
    assert.match(out.lines.join('\n'), /b\.md:1/u, '要掃到這個倉庫的檔');
  } finally {
    if (saved === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = saved;
    here.cleanup(); other.cleanup();
  }
});

test('⑥命中太多照實印出沒列的處數', () => {
  const many = Object.fromEntries(Array.from({ length: MAX_HITS + 3 }, (_, i) => [`d/${i}.md`, '重複出現的舊說法\n']));
  const r = repo({ 'a.md': '重複出現的舊說法\n', ...many }, { 'a.md': '新說法\n' });
  try {
    const out = run(['--base', r.base], { settings: SETTINGS, cwd: r.dir });
    assert.match(out.lines.join('\n'), new RegExp(`還出現在 ${MAX_HITS + 3} 處`, 'u'));
    assert.match(out.lines.join('\n'), /…另有 3 處沒列/u);
  } finally { r.cleanup(); }
});
