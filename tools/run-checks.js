#!/usr/bin/env node
// 三關執行器（規矩 E2、E3）：照專案設定登記的順序跑三關，任一非零就停。推送前鉤子與雲端範本都呼叫它。
//
// 為什麼要有一支：鉤子（sh）與雲端（yml）各自寫一遍三關，兩份就會漂。三關命令的正本只有一份（settings.json
// 的 checks.commands），這支讀它、兩邊都呼叫這支。
//
// 兩件事夾在三關前後（原專案的裸倉庫事故）：跑之前與跑完之後各驗一次「這棵樹還是不是工作樹、根目錄是不是這裡」——
// 考題各跑各的子行程、順序不保證，某一題把倉庫弄成裸倉庫這件事只有跑完再驗一次才抓得到。
// 所有外部指令的環境先清掉 GIT_ 那一族（規矩 E4）。
//
// 退出碼：0＝全綠／1＝有一關紅（或跑完樹壞了）／2＝三關沒登記、不在工作樹裡、指令起不來。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { read: readSettings } = require('./settings-data.js');
const { gitEnv } = require('./git-env.js');

const UNSET = '未設定';

function runCommand(argv, cwd) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', env: gitEnv(), stdio: ['ignore', 'inherit', 'inherit'] });
  return { status: r.error ? null : r.status, error: r.error ? r.error.message : '' };
}

/**
 * 這棵樹還是工作樹嗎？回 'ok'／'bare'／'not-a-repo'／'wrong-tree'／'shared-bare'／'index-unusable'。
 * wrong-tree＝版本控制認的工作樹根目錄不是這裡：樹被指到別處（例如設定裡的 core.worktree），或不在專案根目錄跑。
 * 搬家驗屋 09-13：原本只查裸倉庫；樹被指到別處時照樣回報三關全綠，而依賴版本控制的考題量的是另一棵樹。
 * shared-bare＝開著 extensions.worktreeConfig 時，**共用設定檔**裡 core.bare 不是 false（true 或不是合法布林），
 *   即使這棵樹自己的 config.worktree 把它蓋成 false。開著這個擴充時共用檔的 core.bare 會套到每一棵沒覆寫的樹
 *   （Git 官方文件因此要求把它搬進主工作樹的 config.worktree）；只看生效值會被蓋住：這棵樹看起來健康，
 *   其他沒覆寫的樹（含主目錄）卻全部打不開（原專案 08-09 事故就是這個擴充開著的倉庫）。
 *   **沒開**這個擴充時共用檔的 core.bare 只作用在主工作樹——「裸儲存庫＋連結工作樹」是 Git 支援的正常形狀，不判壞
 *   （搬家前準備 r2 B1）；那時主工作樹自己被弄成裸倉庫，在主工作樹跑就會被上面的 bare 抓到。
 * index-unusable＝倉庫有提交，這棵樹自己的**索引檔卻不存在**，或 git 讀不了索引：索引不見時 git ls-files 不報錯、
 *   只回空清單，靠它掃全樹的考題會掃到零個檔然後回報零違規。**索引存在但是空的**（例如暫存刪除了全部檔案）是合法狀態，
 *   不判壞（搬家前準備 r2 B2）。
 * ⚠️ 守不到的：索引檔在、但只壞一部分；別棵樹自己的 config.worktree 被寫壞（只有在那棵樹裡跑才看得到）；
 *   沒開擴充時主工作樹被弄成裸倉庫、而檢查是在連結工作樹裡跑（這棵樹沒事，主工作樹要在主工作樹跑才看得到）。
 */
function treeState(run, cwd) {
  const git = (...args) => spawnSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() });
  const bare = git('rev-parse', '--is-bare-repository');
  if (bare.error || bare.status !== 0) return 'not-a-repo';
  if (bare.stdout.trim() !== 'false') return 'bare';
  const top = git('rev-parse', '--show-toplevel');
  if (top.error || top.status !== 0) return 'not-a-repo';
  // 兩邊都解開符號連結再比（暫存目錄常經過一層連結）；根目錄不存在＝被指到不存在的地方
  let here;
  let root;
  try { here = fs.realpathSync(cwd); } catch { return 'not-a-repo'; }
  try { root = fs.realpathSync(top.stdout.trim()); } catch { return 'wrong-tree'; }
  if (root !== here) return 'wrong-tree';
  // 共用設定檔指名直讀（不吃生效值）；只在開著 extensions.worktreeConfig 時才要求它是 false
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  if (common.status !== 0) return 'not-a-repo';
  const sharedFile = path.join(common.stdout.trim(), 'config');
  const readShared = (key) => spawnSync('git', ['config', '--file', sharedFile, '--type=bool', '--get-all', key], { encoding: 'utf8', env: gitEnv() });
  const wtc = readShared('extensions.worktreeConfig');
  if (wtc.status === 0 && wtc.stdout.split('\n').some((v) => v.trim() === 'true')) {
    const shared = readShared('core.bare');
    if (shared.status === 0 && shared.stdout.split('\n').some((v) => v.trim() === 'true')) return 'shared-bare';
    if (shared.status !== 0 && shared.status !== 1) return 'shared-bare';   // 1＝沒有這個鍵；其他非零＝值不是合法布林
  }
  // 有提交才要求這棵樹自己的索引檔存在、而且 git 讀得了（剛 init、還沒提交的倉庫本來就沒有索引；空索引是合法的）
  if (git('rev-parse', '--verify', '-q', 'HEAD').status === 0) {
    const indexPath = git('rev-parse', '--path-format=absolute', '--git-path', 'index');
    if (indexPath.status !== 0 || !fs.existsSync(indexPath.stdout.trim()) || git('ls-files').status !== 0) return 'index-unusable';
  }
  return 'ok';
}

function runChecks({ settings = readSettings(), run = runCommand, cwd = process.cwd(), tree = treeState } = {}) {
  const lines = [];
  const raw = settings.checks && settings.checks.commands;
  if (!Array.isArray(raw) || !raw.length) return { code: 2, lines: ['專案設定裡沒有登記三關指令：什麼都沒跑就放行，比不跑更危險。'] };
  // 逐筆驗、不濾掉（r1 Medium⑪）：登記裡有一條是「未設定」、空陣列或形狀錯，代表有一關還沒接好——
  // 靜靜濾掉等於讓那一關消失。要停用某一關就把它從登記拿掉，不要用壞資料代表停用。
  const badAt = raw.findIndex((x) => !Array.isArray(x) || !x.length || x.some((a) => typeof a !== 'string' || !a) || x[0] === UNSET);
  if (badAt !== -1) return { code: 2, lines: [`三關登記的第 ${badAt + 1} 條是「未設定」、空的或形狀不對：有一關還沒接好，不放行（要停用就從登記拿掉）。`] };
  const cmds = raw;
  const before = tree(run, cwd);
  const BEFORE = {
    bare: '這棵樹在跑三關之前就已經是裸倉庫了：先還原再推。',
    'wrong-tree': '版本控制認的工作樹根目錄不是這裡（樹被指到別處，或不是在專案根目錄跑）：三關量到的會是別棵樹，不放行。',
    'shared-bare': '開著 extensions.worktreeConfig 的倉庫，共用設定裡 core.bare 不是 false——這棵樹自己的設定蓋住了它，但其他沒有覆寫的樹（含主目錄）都打不開：先還原共用設定再推。',
    'index-unusable': '倉庫有提交，這棵樹的索引檔卻不見了或 git 讀不了：靠它掃全樹的考題會掃到零個檔然後回報零違規，不放行。索引檔不見時用 git read-tree HEAD 重建（索引在但壞了，先備份再處理）。',
  };
  if (before !== 'ok') return { code: 2, lines: [BEFORE[before] || '這裡不是版本控制的工作樹。'] };
  for (const [i, cmd] of cmds.entries()) {
    lines.push(`第 ${i + 1} 關：${cmd.join(' ')}`);
    const r = run(cmd, cwd);
    if (r.status === null) return { code: 2, lines: [...lines, `第 ${i + 1} 關起不來（${r.error || '沒有退出碼'}）：拿不到判決，不放行。`] };
    if (r.status !== 0) return { code: 1, lines: [...lines, `第 ${i + 1} 關紅了（退出碼 ${r.status}）。修好再推。`] };
  }
  const after = tree(run, cwd);
  const AFTER = {
    'wrong-tree': '三關跑完之後這棵樹被指到別處了（跑之前是好的）：有一題改了倉庫設定，先還原、再查是哪一題。',
    'shared-bare': '三關跑完之後共用的倉庫設定被寫成裸倉庫了（跑之前是好的）：其他樹都會打不開，先還原共用設定、再查是哪一題。',
    'index-unusable': '三關跑完之後這棵樹的索引檔不見了或讀不了（跑之前是好的）：有一題弄壞了索引，先重建、再查是哪一題。',
  };
  if (after !== 'ok') return { code: 1, lines: [...lines, AFTER[after] || '三關跑完之後這棵樹不是工作樹了（跑之前是好的）：有一題把倉庫弄壞了，先還原、再查是哪一題。'] };
  return { code: 0, lines: [...lines, `三關全綠（${cmds.length} 關）。`] };
}

if (require.main === module) {
  let result;
  try { result = runChecks(); } catch (e) { result = { code: 2, lines: [`三關執行器：沒預期到的錯誤（${(e && e.code) || (e && e.message) || '不明'}）——不放行。`] }; }
  process.stdout.write(`${result.lines.join('\n')}\n`);
  process.exit(result.code);
}

module.exports = { runChecks, runCommand, treeState };
