// 守檔名與文字檔內容控制字元（規矩 E6）及共用工具／考題正規式靜態檢查：
// 1. 版本控制追蹤的每一個路徑，只用英文字母、數字、半形符號（例外名單只出不進，本倉庫是空的）。
// 2. 已追蹤的每一個文字檔（照副檔名判，不靠 git 自動判二進位，以免含空字元的原始碼被跳過），整檔逐字不放控制字元（C0/C1，\t、\n、\r 除外）。
// 3. tools/ 與 tests/ 的 .js 正規式字面量不寫連續兩個空白（no-regex-spaces）或控制字元跳脫（no-control-regex，#71、#77）。
//
// 為什麼：原專案的中文檔名讓掃描者跳過過整個檔（套件倉庫的案例簿 scanner-skipped-non-ascii-paths）；
// 路徑一有非 ASCII 或文字檔混入控制字元，工具鏈裡每一環都可能各自出錯；正規式混入連續空白或控制字元跳脫則會在同步進使用專案時被 ESLint 擋下。
// ⚠️ 守不到的：未追蹤的檔；名字對不對得起內容；new RegExp(...) 動態拼出的字串。列檔走清過 GIT_ 的環境（規矩 E4）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitEnv } = require('../tools/git-env.js');
const { readSettings } = require('../tools/settings-data.js');

const ROOT = path.join(__dirname, '..');
/** 既有的路徑例外，只出不進（本倉庫沒有）。 */
const FROZEN_EXCEPTIONS = [];
/** 預設二進位副檔名允許清單（規矩 E6、E7；若 settings.json 另設 binaryExtensions 陣列則優先採用）。 */
const DEFAULT_BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.zip', '.gz'];
const VISIBLE_ASCII = /^[\x21-\x7e]+$/u;
const CONTROL_ESCAPE_AT = /^\\(?:x[01][0-9a-fA-F]|u00[01][0-9a-fA-F]|u\{0*(?:[0-9a-fA-F]|1[0-9a-fA-F])\})/u;
const REGEX_START_KEYWORDS = new Set(['return', 'throw', 'case', 'typeof', 'delete', 'void', 'in', 'of', 'instanceof', 'new', 'yield', 'await', 'else', 'do']);
const BLOCK_START_KEYWORDS = new Set(['else', 'do', 'try', 'finally', 'export']);
const CTRL_PAREN_KEYWORDS = new Set(['if', 'while', 'for', 'with', 'switch']);

function binaryExtensions() {
  try {
    const s = readSettings();
    if (Array.isArray(s.binaryExtensions)) return s.binaryExtensions;
  } catch { /* fallback to default list */ }
  return DEFAULT_BINARY_EXTENSIONS;
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

function scanControlChars({ extraFiles = [], binaryExts = binaryExtensions(), transform = (_f, text) => text } = {}) {
  const all = [
    ...trackedFiles().map((f) => ({ name: f, read: () => fs.readFileSync(path.join(ROOT, f), 'utf8') })),
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

/** 取出 JS 原始碼裡所有正規式字面量的 { pattern, flags }（跳過註解與字串，掃描模板字串 ${...} 內嵌表達式）。 */
function extractRegexLiterals(src) {
  const out = [];
  let i = 0;
  let canStartRegex = true;
  let stmtStart = true;
  let pendingDeclBody = false;
  let lastWord = '';
  let afterDot = false;
  const parenStack = [];
  const braceStack = [];

  function readTemplateText() {
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '`') {
        i++;
        canStartRegex = false;
        stmtStart = false;
        lastWord = '';
        afterDot = false;
        return;
      }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        braceStack.push({ afterCanStartRegex: false, isTemplate: true });
        canStartRegex = true;
        stmtStart = false;
        lastWord = '';
        afterDot = false;
        return;
      }
      i++;
    }
  }

  while (i < src.length) {
    const ch = src[i];
    if (/\s/u.test(ch)) { i++; continue; }
    if (ch === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      const q = ch;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i += 2;
        else i++;
      }
      i++;
      canStartRegex = false;
      stmtStart = false;
      lastWord = '';
      afterDot = false;
      continue;
    }
    if (ch === '`') {
      i++;
      readTemplateText();
      continue;
    }
    if (ch === '/' && canStartRegex) {
      let j = i + 1;
      let inClass = false;
      let valid = true;
      while (j < src.length) {
        const c = src[j];
        if (c === '\n' || c === '\r') { valid = false; break; }
        if (c === '\\') { j += 2; continue; }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        j++;
      }
      if (valid && j < src.length && src[j] === '/') {
        const pattern = src.slice(i + 1, j);
        j++;
        const flagStart = j;
        while (j < src.length && /[dgimsuvy]/u.test(src[j])) j++;
        out.push({ pattern, flags: src.slice(flagStart, j) });
        i = j;
        canStartRegex = false;
        stmtStart = false;
        lastWord = '';
        afterDot = false;
        continue;
      }
    }
    if (/[A-Za-z_$]/u.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[0-9A-Za-z_$]/u.test(src[j])) j++;
      const word = src.slice(i, j);
      if (!afterDot) {
        if ((word === 'function' || word === 'class') && (stmtStart || lastWord === 'async' || lastWord === 'export')) {
          pendingDeclBody = true;
        }
        canStartRegex = REGEX_START_KEYWORDS.has(word);
        stmtStart = BLOCK_START_KEYWORDS.has(word);
        lastWord = word;
      } else {
        canStartRegex = false;
        stmtStart = false;
        lastWord = '';
      }
      afterDot = false;
      i = j;
      continue;
    }
    if (/[0-9]/u.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[0-9A-Za-z_.]/u.test(src[j])) j++;
      canStartRegex = false;
      stmtStart = false;
      lastWord = '';
      afterDot = false;
      i = j;
      continue;
    }
    if (ch === '(') {
      parenStack.push({ isCtrl: CTRL_PAREN_KEYWORDS.has(lastWord) });
      canStartRegex = true;
      stmtStart = false;
      lastWord = '';
      afterDot = false;
      i++;
      continue;
    }
    if (ch === ')') {
      const top = parenStack.pop();
      const isCtrl = Boolean(top && top.isCtrl);
      canStartRegex = isCtrl;
      stmtStart = isCtrl;
      lastWord = '';
      afterDot = false;
      i++;
      continue;
    }
    if (ch === '{') {
      const afterCanStartRegex = stmtStart || pendingDeclBody;
      pendingDeclBody = false;
      braceStack.push({ afterCanStartRegex, isTemplate: false });
      canStartRegex = true;
      stmtStart = true;
      lastWord = '';
      afterDot = false;
      i++;
      continue;
    }
    if (ch === '}') {
      const top = braceStack.pop();
      if (top && top.isTemplate) {
        i++;
        readTemplateText();
        continue;
      }
      const afterOk = top ? top.afterCanStartRegex : true;
      canStartRegex = afterOk;
      stmtStart = afterOk;
      lastWord = '';
      afterDot = false;
      i++;
      continue;
    }
    if (ch === ';') {
      canStartRegex = true;
      stmtStart = true;
      pendingDeclBody = false;
      lastWord = '';
      afterDot = false;
      i++;
      continue;
    }
    if (ch === '.') {
      canStartRegex = false;
      stmtStart = false;
      lastWord = '';
      afterDot = true;
      i++;
      continue;
    }
    if ((ch === '+' && src[i + 1] === '+') || (ch === '-' && src[i + 1] === '-')) {
      canStartRegex = false;
      stmtStart = false;
      lastWord = '';
      afterDot = false;
      i += 2;
      continue;
    }
    if (ch === ']' || ch === ')') {
      canStartRegex = false;
      stmtStart = false;
    } else if (/[,:[!&|?~+*%^<>=-]/u.test(ch)) {
      canStartRegex = true;
      stmtStart = ch === ':';
    } else {
      canStartRegex = false;
      stmtStart = false;
    }
    lastWord = '';
    afterDot = false;
    i++;
  }
  return out;
}

/** 逐字走過正規式 pattern：跳過已跳脫字元（避免 \\x00 誤報），並忽略字元集 [...] 內部的連續空白（對齊 ESLint no-regex-spaces 與 no-control-regex）。 */
function analyzeRegexPattern(pattern, flags = '') {
  let classDepth = 0;
  let hasDoubleSpace = false;
  let hasControlEscape = false;
  const vMode = flags.includes('v');
  for (let k = 0; k < pattern.length; k++) {
    const ch = pattern[k];
    if (ch === '\\') {
      if (CONTROL_ESCAPE_AT.test(pattern.slice(k))) hasControlEscape = true;
      k += 1;
      continue;
    }
    if (ch === '[') {
      classDepth = vMode ? classDepth + 1 : 1;
      continue;
    }
    if (ch === ']' && classDepth > 0) {
      classDepth = vMode ? classDepth - 1 : 0;
      continue;
    }
    if (ch === ' ' && pattern[k + 1] === ' ' && classDepth === 0) {
      hasDoubleSpace = true;
    }
  }
  return { hasDoubleSpace, hasControlEscape };
}

function regexLintProblems(src, file) {
  const problems = [];
  for (const { pattern, flags } of extractRegexLiterals(src)) {
    const { hasDoubleSpace, hasControlEscape } = analyzeRegexPattern(pattern, flags);
    if (hasDoubleSpace) problems.push(`${file}：正規式 /${pattern}/${flags} 含連續空白（no-regex-spaces，請改寫成 {2} 或 \\s）`);
    if (hasControlEscape) problems.push(`${file}：正規式 /${pattern}/${flags} 含控制字元跳脫（no-control-regex）`);
  }
  return problems;
}

function scanRepoRegexLint(transform = (_f, text) => text) {
  const jsFiles = trackedFiles().filter((f) => (f.startsWith('tools/') || f.startsWith('tests/')) && f.endsWith('.js'));
  const problems = jsFiles.flatMap((f) => regexLintProblems(transform(f, fs.readFileSync(path.join(ROOT, f), 'utf8')), f));
  return { count: jsFiles.length, problems };
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

  // 二進位副檔名允許清單（如 .png 含 \x1a）依副檔名排除，不誤判為文字檔控制字元（#121 r1 R1）
  const withPng = scanControlChars({
    extraFiles: [{ name: 'assets/review-probe.png', content: '\x89PNG\r\n\x1a\n' }],
  });
  assert.deepEqual(withPng.bad, [], '二進位副檔名（.png）應由副檔名允許清單排除');

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

test('tools/ 與 tests/ 的 .js 正規式字面量不寫連續兩個空白或控制字元跳脫（#71、#77、#121 r1 R2）', () => {
  const clean = scanRepoRegexLint();
  assert.ok(clean.count >= 70, `只掃到 ${clean.count} 支 JS 檔：前提變了`);
  assert.deepEqual(clean.problems, []);

  // 接線誘餌：確認掃描迴圈真的讀取檔案內容送入 regexLintProblems（若讀檔被換成空字串則不會算到原檔加誘餌後的問題）
  const decoy = scanRepoRegexLint((f, raw) => (f === 'tests/file-names.test.js' && raw.includes('extractRegexLiterals') ? `${raw}\nconst _decoy = /a  b/u;\n` : raw));
  assert.equal(decoy.problems.length, 1);

  // 判準本身：抓得到連續空白、控制字元跳脫、奇數反斜線後接控制跳脫、跳脫方括號與 if (...) 後的正規式，且不誤傷跳脫反斜線、字元集內空白或函式表達式後的除法（#121 r1 R2）
  assert.equal(regexLintProblems('const r = /a  b/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const r = /[\\x00-\\x1f]/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const r = /\\u0007/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const r = /\\u{1b}/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const r = /\\\\\\x00/u;', 'x.js').length, 1, '奇數個反斜線後的 \\x00 是控制字元跳脫，要抓');
  assert.equal(regexLintProblems('const r = /\\[  \\]/u;', 'x.js').length, 1, '已跳脫的 \\[ 不是字元集，內含兩個空白要抓');
  assert.equal(regexLintProblems('if (ok) /a  b/u.test(s);', 'x.js').length, 1, 'if (...) 條件後的正規式字面量要掃到');
  assert.equal(regexLintProblems('const s = `${x.replace(/a  b/g, "")}`;', 'x.js').length, 1);
  assert.deepEqual(regexLintProblems('const r = /\\\\x00/u;', 'x.js'), [], '已跳脫的反斜線後接 x00 不是控制字元跳脫，不誤判');
  assert.deepEqual(regexLintProblems('const r = /[  ]/u;', 'x.js'), [], '字元集 [...] 內的連續空白不觸發 ESLint no-regex-spaces，不誤判');
  assert.deepEqual(regexLintProblems('const r = function(){} /  2; const next = 4 / 3;', 'x.js'), [], '函式表達式大括號後的除法不可誤判為正規式');
  assert.deepEqual(regexLintProblems('// /a  b/ in comment\nconst s = "/a  b/ \\\\x00";\nconst ok = /a {2}b/u;', 'x.js'), []);
});
