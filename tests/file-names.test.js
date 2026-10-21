// 守檔名與文字檔內容控制字元（規矩 E6）：
// 1. 版本控制追蹤的每一個路徑，只用英文字母、數字、半形符號（例外名單只出不進，本倉庫是空的）。
// 2. 已追蹤的每一個文字檔（照副檔名判，不靠 git 自動判二進位，以免含空字元的原始碼被跳過），整檔逐字不放控制字元（C0/C1，\t、\n、\r 除外）。
//
// 為什麼：原專案的中文檔名讓掃描者跳過過整個檔（套件倉庫的案例簿 scanner-skipped-non-ascii-paths）；
// 路徑一有非 ASCII 或文字檔混入控制字元，工具鏈裡每一環都可能各自出錯。
// ⚠️ 守不到的：未追蹤的檔；名字對不對得起內容。列檔走清過 GIT_ 的環境（規矩 E4）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('../tools/git-env.js');
const settingsData = require('../tools/settings-data.js');

const ROOT = path.join(__dirname, '..');
/** 既有的路徑例外，只出不進（本倉庫沒有）。 */
const FROZEN_EXCEPTIONS = [];
/** 預設二進位副檔名允許清單（規矩 E6、E7；若 settings.json 另設 binaryExtensions 陣列則聯集併入）。 */
const DEFAULT_BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.zip', '.gz'];
const VISIBLE_ASCII = /^[\x21-\x7e]+$/u;

function binaryExtensions(readFn = settingsData.read) {
  const s = readFn();
  const custom = s && Array.isArray(s.binaryExtensions)
    ? s.binaryExtensions.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().toLowerCase())
    : [];
  return [...new Set([...DEFAULT_BINARY_EXTENSIONS, ...custom])];
}

function trackedFiles() {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', env: gitEnv() });
  assert.equal(r.status, 0, `列不出追蹤的檔：${r.stderr}`);
  return r.stdout.split('\0').filter(Boolean);
}

/** 整檔逐字找第一個控制字元（C0 0x00–0x1F 除 \t \n \r 外，及 C1 0x7F–0x9F）；不用控制字元正規式以免自身觸發 no-control-regex。 */
function findControlChar(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) || (code >= 0x7f && code <= 0x9f)) {
      return { index: i, code };
    }
  }
  return null;
}

function scanControlChars({ files, extraFiles = [], readFn = settingsData.read, binaryExts = binaryExtensions(readFn), transform = (_f, text) => text } = {}) {
  const baseFiles = Array.isArray(files)
    ? files.map((item) => ({ name: item.name, read: item.read || (() => item.content) }))
    : trackedFiles().map((f) => ({ name: f, read: () => fs.readFileSync(path.join(ROOT, f), 'utf8') }));
  const all = [
    ...baseFiles,
    ...extraFiles.map((item) => ({ name: item.name, read: () => item.content })),
  ];
  const textFiles = all.filter((item) => !binaryExts.some((ext) => item.name.toLowerCase().endsWith(ext)));
  const bad = [];
  for (const item of textFiles) {
    const text = transform(item.name, item.read());
    const hit = findControlChar(text);
    if (hit) bad.push(`${item.name}（位置 ${hit.index}，U+${hit.code.toString(16).toUpperCase().padStart(4, '0')}）`);
  }
  return { count: textFiles.length, bad };
}

test('已追蹤的每一個路徑只用英文字母、數字、半形符號（例外名單只出不進）', () => {
  const files = trackedFiles();
  assert.ok(files.length > 20, `只列到 ${files.length} 個檔：這一題自己的前提變了`);
  const bad = files.filter((f) => !VISIBLE_ASCII.test(f) && !FROZEN_EXCEPTIONS.includes(f));
  assert.deepEqual(bad, [], `這些路徑含非 ASCII 或空白：\n${bad.join('\n')}`);
  for (const f of FROZEN_EXCEPTIONS) assert.ok(files.includes(f), `例外名單裡的 ${f} 已經不在了：把它從名單拿掉（只出不進）`);
});

test('已追蹤的每一個文字檔整檔不放控制字元（規矩 E6；含二進位副檔名排除與長檔尾端誘餌核對）', () => {
  const clean = scanControlChars();
  assert.ok(clean.count >= 40, `只掃到 ${clean.count} 個文字檔：前提變了`);
  assert.deepEqual(clean.bad, [], `這些文字檔含控制字元：\n${clean.bad.join('\n')}`);

  // 隔離檔案集合核對二進位副檔名允許清單：預設排除 .png、未設定時擋 .bmp、設定 binaryExtensions: ['.bmp'] 時同時排除 .png 與 .bmp（#121 r1〜r3 R1）
  const isolatedBoth = [
    { name: 'assets/review-probe.png', content: '\x89PNG\r\n\x1a\n' },
    { name: 'assets/custom.bmp', content: 'BM\u0000\u0000' },
    { name: 'docs/clean.txt', content: 'clean text\n' },
  ];
  const defaultOnly = scanControlChars({
    files: isolatedBoth,
    readFn: () => ({}),
  });
  assert.deepEqual(defaultOnly.bad, ['assets/custom.bmp（位置 2，U+0000）'], '預設清單排除 .png，但未登記的 .bmp 應被攔截');

  const withCustomReadFn = scanControlChars({
    files: isolatedBoth,
    readFn: () => ({ binaryExtensions: ['.bmp'] }),
  });
  assert.deepEqual(withCustomReadFn.bad, [], '自訂 binaryExtensions（.bmp）與預設 .png 聯集後兩者皆應排除');

  const desc = Object.getOwnPropertyDescriptor(settingsData, 'read');
  if (desc && desc.writable) {
    const origRead = settingsData.read;
    let readCalls = 0;
    try {
      settingsData.read = () => {
        readCalls += 1;
        return { ...origRead(), binaryExtensions: ['.bmp'] };
      };
      const withCustomBmp = scanControlChars({
        files: isolatedBoth,
      });
      assert.ok(readCalls >= 1, '預設必須實際呼叫 settingsData.read() 讀取專案設定');
      assert.deepEqual(withCustomBmp.bad, [], 'settings.binaryExtensions 登記的自訂二進位副檔名（.bmp）應生效且保留預設 .png 排除');
    } finally {
      settingsData.read = origRead;
    }
  }

  // 接線與長檔尾端誘餌：將已追蹤文字檔在超過 16 KiB 後附加空字元，掃描迴圈必須抓出檔名、精確位置與字碼
  const realSelf = fs.readFileSync(__filename, 'utf8');
  const decoy = scanControlChars({
    transform: (f, raw) => (f === 'tests/file-names.test.js' ? `${raw}${'x'.repeat(16384)}\u0000` : raw),
  });
  assert.deepEqual(decoy.bad, [`tests/file-names.test.js（位置 ${realSelf.length + 16384}，U+0000）`]);

  // 判準本身：整檔逐字看（超過 16 KiB 之後才出現的空字元與控制字元也要抓到），\t \n \r 放行
  const prefix = `${'正常文字\t\n\r'.repeat(4000)}`;
  assert.equal(findControlChar(prefix), null);
  for (const [ch, code] of [['\u0000', 0x00], ['\u0007', 0x07], ['\u001b', 0x1b], ['\u007f', 0x7f], ['\u0085', 0x85]]) {
    const hit = findControlChar(prefix + ch);
    assert.deepEqual(hit, { index: prefix.length, code });
  }
});
