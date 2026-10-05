// 考題清單（r1 Medium⑫）：tests/ 裡的考題檔集合要跟 tests/manifest.json 一字不差。
//
// 為什麼要另立一支：原本的金絲雀住在 settings.test.js 裡，它自己被刪掉就沒有人數考題；而沒有同名工具的
// 結構性考題（忽略清單、檔名、路標、資料契約）也不在它的對照表上。這一支跟 settings.test.js 互相盯著：
// 刪掉任何一支考題檔（含這兩支之一）都會紅，除非連清單一起改——那是看得見的改動。
//
// 守得到的：考題檔的集合不漂（多一支、少一支、改名都紅）。
// 另一題守日常考卷不跑說明書（擁有者 2026-10-05：說明書網頁只在他明確要求時更新）：manual/ 底下沒有 node --test 會自動撿到的檔，
//   產生器與專屬考題留著；檔名寫法跟這台機器的 node 實際撿不撿對過一次。
// ⚠️ 守不到的：兩支同時被刪；清單被一起改掉（那是看得見的，由複審者看）；整個 manual/ 被刪掉（那一題就跳過——使用專案本來就沒有 manual/）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('tests/ 裡的考題檔集合跟 manifest.json 一字不差', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const onDisk = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
  assert.deepEqual(onDisk, [...manifest].sort(), '考題檔集合跟清單不一樣：加一支或刪一支都要連 manifest.json 一起改，讓改動看得見');
  assert.ok(manifest.includes('settings.test.js') && manifest.includes('manifest.test.js'), '互相盯著的兩支都要在清單上');
  assert.ok(manifest.length >= 20, `清單只剩 ${manifest.length} 支：這一題自己的前提變了`);
});

// manual/ 只在套件倉庫（不在共用路徑、不會搬進使用專案）：沒有就跳過。
const MANUAL = path.join(__dirname, '..', 'manual');
/** node --test 不給檔名時撿的檔名寫法（Node 文件列的那幾種；Node 26 也撿 .ts 那幾種）。 */
const AUTO_PICKED = /(?:^|\/)(?:test|test-[^/]*|[^/]*[.\-_]test)\.[cm]?[jt]s$|(?:^|\/)test\/.+\.[cm]?[jt]s$/u;

test('日常考卷不跑說明書：manual/ 底下沒有 node --test 會自動撿到的檔；產生器與專屬考題留著', { skip: fs.existsSync(MANUAL) ? false : '這個專案沒有 manual/（只有套件倉庫有）' }, () => {
  const walk = (dir, rel = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`]));
  const files = walk(MANUAL);
  assert.deepEqual(files.filter((p) => AUTO_PICKED.test(p)), [], 'manual/ 底下有 node --test 會自動撿到的檔：推送前、雲端三關、合併閘就會跑說明書——擁有者定說明書網頁只在他要求時更新');
  for (const p of ['build.js', 'build.verify.js']) assert.ok(files.includes(p), `manual/${p} 要留著：要更新網頁時才跑，不是刪掉`);
  // 對照組：檔名寫法跟這台機器的 node 對一次——*.test.js 真的會被撿、*.verify.js 真的不會
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-auto-picked-'));
  try {
    for (const name of ['a.test.js', 'build.verify.js']) fs.writeFileSync(path.join(dir, name), `require('node:fs').writeFileSync(require('node:path').join(__dirname, '${name}.ran'), '');\nrequire('node:test')('x', () => {});\n`);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;   // 不拿掉的話子行程的 node --test 不管紅不紅都退 0
    const r = spawnSync(process.execPath, ['--test'], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual([fs.existsSync(path.join(dir, 'a.test.js.ran')), fs.existsSync(path.join(dir, 'build.verify.js.ran'))], [true, false], '對照組：node --test 要撿 a.test.js、不撿 build.verify.js');
    assert.deepEqual([AUTO_PICKED.test('a.test.js'), AUTO_PICKED.test('build.verify.js')], [true, false], '對照組：上面那串檔名寫法跟 node 實際撿的一樣');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
