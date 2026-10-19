// 套件倉庫自己的 settings.json 釘值題（BACKLOG 2026-09-26 那一條，擁有者 2026-10-08 裁另開一支一起做）。
//
// 為什麼住 kit-only/ 而不是 tests/：tests/ 整批搬進使用專案（README「搬進一個新專案」第 1 步的清單），
// 釘的是套件倉庫自己的值（參與者、主幹、平台、複審者、閘的順序、驗收分級），搬進別的專案就釘到錯的值；
// kit-only/ 不在那張清單上、不搬。node --test 不帶參數會把這裡的 *.test.js 一起撿起來（package.json 的 test 就是這樣跑）。
//
// 守得到的：下面釘住的值一改就紅（改值要連這一支一起改，那是看得見的改動）。
// ⚠️ 守不到的：沒釘的欄位（位置表的字、各工具的指令樣板、忽略清單）；settings.json 整份被換掉但釘的值剛好一樣；
//   使用專案的設定（它們各有自己的釘值題）。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'settings.json'), 'utf8'));
const IN_KIT = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name === 'ai-collab-kit';

test('套件倉庫 settings.json 釘住的值', { skip: IN_KIT ? false : '不是套件倉庫：這一支只釘套件自己的值' }, () => {
  const s = read();
  assert.equal(s.owner, 'William');
  assert.equal(s.mainBranch, 'main');
  assert.deepEqual(s.participants.map((p) => [p.role, p.id, p.account]), [
    ['裁示者（人）', 'William', 'teacherjung'],
    ['AI 甲', 'Claude', 'teacherjung'],
    ['AI 乙', 'Codex', 'teacherjung'],
    ['AI 丙', 'Grok', 'teacherjung'],
    ['AI 丁', 'Gemini', 'teacherjung'],
  ]);
  assert.deepEqual(s.defaultDivision, { implementer: 'Gemini', reviewer: 'Codex' });
  assert.equal(s.platform.name, 'GitHub');
  assert.equal(s.platform.project, 'teacherjung/ai-collab-kit');
  assert.deepEqual(s.platform.clearEnv, ['GH_REPO', 'GH_HOST']);
  assert.deepEqual(s.reviewers.map((r) => [r.participant, r.strongest, r.maxEffort, r.autoMode, r.source]), [
    ['Claude', 'claude-fable-5-1', 'max', 'Ultracode', 'Claude CLI'],
    ['Codex', 'gpt-6-astra', 'max', 'ultra（這一檔會自動派助手）', 'codex CLI'],
    ['Grok', 'grok-4.7', 'xhigh', '自動選模', 'Grok CLI'],
    ['Gemini', 'gemini-3.1-pro', 'high', 'auto-model', 'Gemini CLI'],
  ]);
  assert.deepEqual(s.gates.map((g) => g.name), [
    '待裁（本支貼的 ❓ 都配到 ⚖️ 或 🚫）',
    '複審結論聯集（有沒有未撤銷的阻擋、有沒有對目前版本的通過）',
    '協作欄位（四欄齊全、實作者不等於複審者）',
    '堆疊（底是主幹、上面沒有疊別支）',
    '真考卷（必要檢查最新場次真的跑過且成功）',
    '跨PR試合併（與每支以主幹為底的開著PR真合起來跑三關）',
  ], '六道閘的名字與順序（合併指令照這個順序跑）');
  assert.deepEqual(s.checks.commands, [['node', '--test']]);
  assert.deepEqual(s.acceptance.tiers.map((t) => t.id), ['免驗收']);
  assert.equal(s.acceptance.unknownTier, '免驗收');
  assert.deepEqual(s.acceptance.families, [{ pattern: '^', tier: '免驗收' }]);
  // 掃描：統一由 tools/review-launch.js --scan / --scan-post / --scan-close 管生命週期
  assert.equal(s.scanner.participant, 'Grok');
  assert.equal(s.scanner.strongest, 'grok-4.7');
  assert.equal(s.scanner.maxEffort, 'xhigh');
  assert.equal(s.scanner.source, 'Grok CLI');
  assert.equal(s.scanner.isolation, undefined, '不再設定 scanner.isolation');
  assert.ok(s.scanner.tool.includes('node tools/review-launch.js --scan <編號>'), '掃描入口統一為 review-launch.js --scan');
  assert.ok(s.scanner.command.includes('--model {model} --reasoning-effort {effort}'), '掃描啟動指令帶模型與推理');
  assert.ok(s.scanner.command.includes("--permission-mode plan --sandbox read-only --deny 'Read(~/**)'"), '掃描啟動指令接上原生 plan 權限、read-only 沙盒與家目錄拒絕規則');
  assert.ok(!s.scanner.command.includes('--always-approve'), '掃描啟動指令不使用 --always-approve');
  const grokRev = s.reviewers.find((r) => r.participant === 'Grok');
  assert.ok(grokRev.command.includes("--permission-mode dontAsk --sandbox workspace") && grokRev.command.includes("--deny 'Read(~/**)'") && !grokRev.command.includes('--always-approve'), 'Grok 複審啟動指令接上 dontAsk、workspace 沙盒與家目錄拒絕規則');
  const geminiRev = s.reviewers.find((r) => r.participant === 'Gemini');
  assert.ok(geminiRev.command.startsWith('cd {reviewTree} && '), 'Gemini 複審啟動指令先切換至 {reviewTree}');
  // 機器表：哪些已啟用（名字 → 狀態）；新增或停用一台都要連這裡一起改
  const states = Object.fromEntries(s.machines.map((m) => [m.name.split('（')[0], m.state]));
  assert.deepEqual(states, {
    平台介面: '已啟用', 合併指令: '已啟用', 協作欄位閘: '已啟用', 結論聯集閘: '已啟用', 禁區攔截器: '已安裝未啟用',
    忽略清單一致考題: '已啟用', '推送前鉤子範本＋三關執行器': '已安裝未啟用', 雲端三關與協作欄位閘的範本: '已啟用',
    清版本控制環境變數的共用實作: '已啟用', 閘的退出路徑與進入點行為題: '已啟用', 檔名考題: '已啟用',
    合併閘登記對帳題: '已啟用', 堆疊閘: '已啟用', 真考卷閘: '已啟用', 跨PR試合併閘: '已啟用',
    驗收分級工具: '已啟用', 本文長度考題: '已啟用', '案例簿考題＋索引產生器': '已啟用', 共用檔清單: '未移植', 專案設定產生器: '已啟用',
    範本存在與固定小標考題: '已啟用', 路標考題: '已啟用', 待裁清單工具: '已啟用', 待裁閘: '已啟用', 風險分級工具: '已啟用',
    舊文字掃描: '已啟用', 開工印待辦: '已啟用', 進度摘要檢查: '已啟用', 本週成果產生器: '已啟用', 下游落後: '已啟用',
    整理清單: '已啟用',
  });
  for (const m of s.machines) {
    if (m.state === '已啟用') assert.match(m.verified, /^\d{4}-\d{2}-\d{2}$/u, `已啟用的機器要有驗證日期：${m.name}`);
  }
});

test('套件設定與說明不出現本機路徑', { skip: IN_KIT ? false : '不是套件倉庫' }, () => {
  const readText = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const texts = {
    'settings.json': readText('settings.json'),
    'README.md': readText('README.md'),
    'PROJECT-SETTINGS.md': readText('PROJECT-SETTINGS.md').replace(/\\(.)/gsu, '$1'),
  };
  const LOCAL = /\/Users\/(?!Shared(?:$|[",\s\\、]))|\/home\/|(?:~|\$\{?HOME\}?)\/(?:Desktop|Documents|Downloads)\b|\/var\/folders\/|\/tmp\/claude-\d+\/|\/Volumes\/|[A-Za-z]:(?:\\{1,2}|\/)Users|%USERPROFILE%|\$env:USERPROFILE|（投資理財）/u;
  assert.ok(LOCAL.test('/Users/teacherjung/x') && LOCAL.test('/Users/Shared/x') && !LOCAL.test('"/Users/Shared"'), '對照組：LOCAL 放行 macOS 系統固定目錄 /Users/Shared、仍攔使用者路徑與子路徑');
  for (const [name, text] of Object.entries(texts)) {
    assert.doesNotMatch(text, LOCAL, `${name} 出現了本機路徑（只寫關係、不寫路徑）`);
  }
});

test('快速通道（AI）一律不收的清單，蓋住機器表 B1 那一列點名的每一支 .js（F12：禁區清單、判斷與攔截器的檔不收）', { skip: IN_KIT ? false : '不是套件倉庫：這一支只釘套件自己的值' }, () => {
  // 為什麼：清單是手寫的正規式，B1 那一列加了一支攔截器的考題、清單沒跟上，那一支只改註解就會走輕審（#96 掃描 1-2 抓到 placement 漏了）
  const never = read().fastLane.ai.never.map((p) => new RegExp(p, 'u'));
  const row = fs.readFileSync(path.join(ROOT, 'MACHINES.md'), 'utf8').split('\n').filter((l) => l.startsWith('| B1 |'));
  assert.equal(row.length, 1, '機器表要剛好一列 B1：這一題自己的前提變了');
  const files = [...new Set([...row[0].matchAll(/`((?:tools|tests)\/[^`]+\.js)`/gu)].map((m) => m[1]))];
  assert.ok(files.length >= 5, `B1 那一列只抽到 ${files.length} 支 .js：列的形狀變了`);
  const missed = files.filter((f) => !never.some((re) => re.test(f)));
  assert.deepEqual(missed, [], `這幾支在機器表 B1 那一列、卻沒被 fastLane.ai.never 擋：${missed.join('、')}——改 settings.json 的清單`);
  // 案例簿只收案例檔與它產生的兩份 .md；cases/index.json 是產生器讀的設定（摘要挑哪一則），不是「不是規定的字」（#96 掃描 1-4）
  const files2 = read().fastLane.ai.files.map((p) => new RegExp(p, 'u'));
  for (const f of ['BACKLOG.md', 'cases/README.md', 'cases/DIGEST.md', 'cases/fast-lane-two-lanes.md']) assert.ok(files2.some((re) => re.test(f)), `${f} 應該收`);
  for (const f of ['cases/index.json', 'cases/x.js', 'README.md', 'rules.json']) assert.ok(!files2.some((re) => re.test(f)), `${f} 不該整檔收`);
});
