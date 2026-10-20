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

const ROOT = path.join(__dirname, '..');
/** 既有的路徑例外，只出不進（本倉庫沒有）。 */
const FROZEN_EXCEPTIONS = [];
/** 二進位副檔名允許清單（規矩 E7；本倉庫全部是文字檔，故為空）。 */
const BINARY_EXTENSIONS = [];
const VISIBLE_ASCII = /^[\x21-\x7e]+$/u;
const CONTROL_ESCAPE_IN_REGEX = /\\(?:x[01][0-9a-fA-F]|u00[01][0-9a-fA-F]|u\{0*(?:[0-9a-fA-F]|1[0-9a-fA-F])\})/u;

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

/** 取出 JS 原始碼裡所有正規式字面量的 pattern（跳過註解與字串，但掃描模板字串 ${...} 內嵌表達式）。 */
function extractRegexLiterals(src) {
  const out = [];
  let i = 0;
  let canStartRegex = true;
  const tplBraceStack = [];
  function readTemplateText() {
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '`') { i++; canStartRegex = false; return; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        tplBraceStack.push(0);
        canStartRegex = true;
        return;
      }
      i++;
    }
  }
  while (i < src.length) {
    const ch = src[i];
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
      continue;
    }
    if (ch === '`') {
      i++;
      readTemplateText();
      continue;
    }
    if (tplBraceStack.length > 0) {
      if (ch === '{') tplBraceStack[tplBraceStack.length - 1]++;
      else if (ch === '}') {
        if (tplBraceStack[tplBraceStack.length - 1] === 0) {
          tplBraceStack.pop();
          i++;
          readTemplateText();
          continue;
        }
        tplBraceStack[tplBraceStack.length - 1]--;
      }
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
        out.push(src.slice(i + 1, j));
        j++;
        while (j < src.length && /[dgimsuvy]/u.test(src[j])) j++;
        i = j;
        canStartRegex = false;
        continue;
      }
    }
    if (!/\s/u.test(ch)) {
      if (/[=(,:[!&|?{};~+*%^<>-]/u.test(ch)) canStartRegex = true;
      else if (/[0-9A-Za-z_$)\]]/u.test(ch)) {
        const prev = src.slice(Math.max(0, i - 6), i + 1);
        canStartRegex = /\b(?:return|throw|case|typeof|delete|void|in|of)$/u.test(prev);
      } else {
        canStartRegex = false;
      }
    }
    i++;
  }
  return out;
}

function regexLintProblems(src, file) {
  const problems = [];
  for (const pattern of extractRegexLiterals(src)) {
    if (pattern.includes('  ')) problems.push(`${file}：正規式 /${pattern}/ 含連續空白（no-regex-spaces，請改寫成 {2} 或 \\s）`);
    if (CONTROL_ESCAPE_IN_REGEX.test(pattern)) problems.push(`${file}：正規式 /${pattern}/ 含控制字元跳脫（no-control-regex）`);
  }
  return problems;
}

test('已追蹤的每一個路徑只用英文字母、數字、半形符號（例外名單只出不進）', () => {
  const files = trackedFiles();
  assert.ok(files.length > 20, `只列到 ${files.length} 個檔：這一題自己的前提變了`);
  const bad = files.filter((f) => !VISIBLE_ASCII.test(f) && !FROZEN_EXCEPTIONS.includes(f));
  assert.deepEqual(bad, [], `這些路徑含非 ASCII 或空白：\n${bad.join('\n')}`);
  for (const f of FROZEN_EXCEPTIONS) assert.ok(files.includes(f), `例外名單裡的 ${f} 已經不在了：把它從名單拿掉（只出不進）`);
});

test('已追蹤的每一個文字檔整檔不放控制字元（規矩 E6；含長檔尾端誘餌核對）', () => {
  const files = trackedFiles().filter((f) => !BINARY_EXTENSIONS.some((ext) => f.endsWith(ext)));
  assert.ok(files.length >= 40, `只掃到 ${files.length} 個文字檔：前提變了`);
  const bad = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const hit = findControlChar(text);
    if (hit) bad.push(`${f}（位置 ${hit.index}，U+${hit.code.toString(16).toUpperCase().padStart(4, '0')}）`);
  }
  assert.deepEqual(bad, [], `這些文字檔含控制字元：\n${bad.join('\n')}`);

  // 判準本身：整檔逐字看（超過 16 KiB 之後才出現的空字元與控制字元也要抓到），\t \n \r 放行
  const prefix = `${'正常文字\t\n\r'.repeat(4000)}`;
  assert.equal(findControlChar(prefix), null);
  for (const [ch, code] of [['\u0000', 0x00], ['\u0007', 0x07], ['\u001b', 0x1b], ['\u007f', 0x7f], ['\u0085', 0x85]]) {
    const hit = findControlChar(prefix + ch);
    assert.deepEqual(hit, { index: prefix.length, code });
  }
});

test('tools/ 與 tests/ 的 .js 正規式字面量不寫連續兩個空白或控制字元跳脫（#71、#77）', () => {
  const jsFiles = trackedFiles().filter((f) => (f.startsWith('tools/') || f.startsWith('tests/')) && f.endsWith('.js'));
  assert.ok(jsFiles.length >= 70, `只掃到 ${jsFiles.length} 支 JS 檔：前提變了`);
  const problems = jsFiles.flatMap((f) => regexLintProblems(fs.readFileSync(path.join(ROOT, f), 'utf8'), f));
  assert.deepEqual(problems, []);

  // 判準本身：抓得到連續空白、控制字元跳脫與模板內嵌正規式，不誤傷註解與字串
  assert.equal(regexLintProblems('const r = /a  b/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const r = /[\\x00-\\x1f]/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const r = /\\u0007/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const r = /\\u{1b}/u;', 'x.js').length, 1);
  assert.equal(regexLintProblems('const s = `${x.replace(/a  b/g, "")}`;', 'x.js').length, 1);
  assert.deepEqual(regexLintProblems('// /a  b/ in comment\nconst s = "/a  b/ \\\\x00";\nconst ok = /a {2}b/u;', 'x.js'), []);
});
