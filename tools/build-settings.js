#!/usr/bin/env node
// 從 settings.json 產生 PROJECT-SETTINGS.md。**那份說明是產物、不要手改。**
//
// 為什麼也做成產物：每一支機器都要讀專案設定。如果值只寫在那份 Markdown 裡，機器就得去解讀
// 表格；如果兩邊各存一份，就會漂——這份套件的案例簿裡，「同一條規矩寫在六個地方各漏一項」
// 是有代價的實例。所以值只有一份（settings.json），人讀的那份由它產生，考題比逐字元相同。
//
// 契約與字面編碼沿用 build-rules.js 那一套（所有 ASCII 標點一律跳脫，語法只能由範本提供）；
// ⚠️ 代價照實說：這份說明裡的字因此是純文字，不能用粗體或反引號之類的排版。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { literal } = require('./build-rules.js');

const root = path.join(__dirname, '..');
const dataFile = path.join(root, 'settings.json');
const outFile = path.join(root, 'PROJECT-SETTINGS.md');

const LINE_BREAK = /[\n\r\u0085\u2028\u2029\v\f]/u;
const NUL = /\u0000/u;
const STATES = ['未移植', '已安裝未啟用', '已啟用'];

function plain(value, what, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') throw new Error(`${what} 不是字串`);
  if (!allowEmpty && value.trim() === '') throw new Error(`${what} 是空的`);
  if (LINE_BREAK.test(value)) throw new Error(`${what} 裡有換行：它會跑出自己該待的位置`);
  if (NUL.test(value)) throw new Error(`${what} 裡有空字元`);
  return literal(value);
}

function read() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function build(data) {
  const out = [
    '# 專案設定（每個使用這套架構的專案填一份；規矩本文與機器都從這裡取值）',
    '',
    '這是產物：值住在 settings.json，改完跑 node tools/build-settings.js。搬進專案後把每個「未設定」填掉；沒填的欄位＝那條規矩的機器退化成靠自覺。「填了設定」和「機器已啟用」是兩件事，最後一節逐支登記。',
    '',
    '## 一、參與者識別值',
    '',
    '變更說明的「實作者」「獨立審查者」兩欄、結論標頭與自評的角色格，填的是這裡的識別值，不是職稱。',
    '',
    `值域：${plain(data.identityDomain, '識別值值域')}`,
    '',
    '| 參與者 | 識別值 | 貼文帳號 |',
    '|---|---|---|',
  ];
  for (const p of data.participants) {
    out.push(`| ${plain(p.role, '參與者角色')} | ${plain(p.id, '識別值')} | ${plain(p.account, '貼文帳號')} |`);
  }
  out.push('', `貼文帳號資格：${plain(data.accountRule, '貼文帳號資格')}`, '');
  out.push('## 二、來源字串標準表（結論標頭的來源欄；寫作義務：跨輪次一字不改、不含會變的東西）', '');
  out.push('| 審查工具或工作階段 | 逐字來源字串 |', '|---|---|');
  for (const s of data.sources) {
    out.push(`| ${plain(s.tool, '審查工具')} | ${plain(s.string, '來源字串')} |`);
  }
  out.push('', '## 三、清單與正本的位置', '');
  out.push('| 項目 | 規矩 | 位置 |', '|---|---|---|');
  for (const l of data.locations) {
    out.push(`| ${plain(l.item, '項目')} | ${plain(l.rules, '規矩條號')} | ${plain(l.where, '位置')} |`);
  }
  out.push('', `主幹分支名（原閘寫死 main，規矩 H2、H3、H4）：${plain(data.mainBranch, '主幹分支名')}`, '');
  out.push('## 四、掃描發射者（規矩 A1、G4）', '');
  out.push(`- 掃描器：${plain(data.scanner.tool, '掃描器')}（沒有掃描器＝每支的掃描紀錄寫「未執行：本專案無掃描器」，由下面指定的那一方記錄並轉正式）`);
  out.push(`- 誰指派、登記在哪：${plain(data.scanner.assignedBy, '掃描發射者的指派方式')}`);
  out.push(`- 兩方都起得了時：${plain(data.scanner.tieBreak, '平手規則')}`);
  out.push(`- 沒有合格者時，誰記錄未執行、誰轉正式：${plain(data.scanner.fallback, '無合格者時的替代')}`);
  out.push('', '## 五、合併步驟登記（規矩 H1；合併指令照這個順序跑，任一道紅就停）', '');
  out.push('| 順序 | 閘 | 規矩 | 指令 | 狀態 |', '|---|---|---|---|---|');
  (data.gates || []).forEach((gate, i) => {
    if (!STATES.includes(gate.state)) throw new Error(`閘「${gate.name}」的狀態「${gate.state}」不在 ${STATES.join('／')} 裡`);
    const cmd = [gate.command, ...(gate.args || [])].join(' ');
    out.push(
      `| ${i + 1} | ${plain(gate.name, '閘名稱')} | ${plain(gate.rules, '閘對應的規矩')} | ${plain(cmd, '閘的指令')} | ${plain(gate.state, '閘的狀態')} |`,
    );
  });
  const merge = data.mergeCommand || {};
  const mergeCmd = [merge.command, ...(merge.args || [])].join(' ');
  out.push('', `全綠之後執行的合併指令：${plain(mergeCmd, '合併指令')}`, '');
  out.push('⚠️ 沒有任何一道閘登記成「已啟用」時，合併指令不放行：一支什麼都沒檢查就按合併鍵的指令比沒有更危險。', '');
  out.push('## 六、合併預授權（規矩 A5）', '');
  out.push(`${plain(data.mergeAuthorization, '合併預授權')}。預授權不取代 A5 列的其餘條件。`, '');
  out.push('## 六、機器啟用狀態（逐支登記；「已啟用」以外的一律當靠自覺）', '');
  out.push('| 機器 | 規矩 | 狀態 | 驗過的日期 |', '|---|---|---|---|');
  for (const m of data.machines) {
    if (!STATES.includes(m.state)) throw new Error(`機器「${m.name}」的狀態「${m.state}」不在 ${STATES.join('／')} 裡`);
    out.push(
      `| ${plain(m.name, '機器名稱')} | ${plain(m.rules, '機器對應的規矩')} | ${plain(m.state, '啟用狀態')} | ${plain(m.verified, '驗過的日期', { allowEmpty: true })} |`,
    );
  }
  out.push('');
  return out.join('\n');
}

if (require.main === module) {
  const data = read();
  fs.writeFileSync(outFile, build(data), 'utf8');
  process.stdout.write(`寫好 PROJECT-SETTINGS.md：${data.machines.length} 支機器\n`);
}

module.exports = { build, read, dataFile, outFile, STATES };
