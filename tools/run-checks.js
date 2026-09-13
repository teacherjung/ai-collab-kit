#!/usr/bin/env node
// 三關執行器（規矩 E2、E3）：照專案設定登記的順序跑三關，任一非零就停。推送前鉤子與雲端範本都呼叫它。
//
// 為什麼要有一支：鉤子（sh）與雲端（yml）各自寫一遍三關，兩份就會漂。三關命令的正本只有一份（settings.json
// 的 checks.commands），這支讀它、兩邊都呼叫這支。
//
// 兩件事夾在三關前後（原專案的裸倉庫事故）：跑之前與跑完之後各驗一次「這棵樹還是不是工作樹」——
// 考題各跑各的子行程、順序不保證，某一題把倉庫弄成裸倉庫這件事只有跑完再驗一次才抓得到。
// 所有外部指令的環境先清掉 GIT_ 那一族（規矩 E4）。
//
// 退出碼：0＝全綠／1＝有一關紅（或跑完樹壞了）／2＝三關沒登記、不在工作樹裡、指令起不來。
'use strict';
const { spawnSync } = require('node:child_process');
const { read: readSettings } = require('./settings-data.js');
const { gitEnv } = require('./git-env.js');

const UNSET = '未設定';

function runCommand(argv, cwd) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', env: gitEnv(), stdio: ['ignore', 'inherit', 'inherit'] });
  return { status: r.error ? null : r.status, error: r.error ? r.error.message : '' };
}

/** 這棵樹還是工作樹嗎？回 'ok'／'bare'／'not-a-repo'。 */
function treeState(run, cwd) {
  const r = spawnSync('git', ['rev-parse', '--is-bare-repository'], { cwd, encoding: 'utf8', env: gitEnv() });
  if (r.error || r.status !== 0) return 'not-a-repo';
  return r.stdout.trim() === 'false' ? 'ok' : 'bare';
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
  if (before !== 'ok') return { code: 2, lines: [before === 'bare' ? '這棵樹在跑三關之前就已經是裸倉庫了：先還原再推。' : '這裡不是版本控制的工作樹。'] };
  for (const [i, cmd] of cmds.entries()) {
    lines.push(`第 ${i + 1} 關：${cmd.join(' ')}`);
    const r = run(cmd, cwd);
    if (r.status === null) return { code: 2, lines: [...lines, `第 ${i + 1} 關起不來（${r.error || '沒有退出碼'}）：拿不到判決，不放行。`] };
    if (r.status !== 0) return { code: 1, lines: [...lines, `第 ${i + 1} 關紅了（退出碼 ${r.status}）。修好再推。`] };
  }
  const after = tree(run, cwd);
  if (after !== 'ok') return { code: 1, lines: [...lines, '三關跑完之後這棵樹不是工作樹了（跑之前是好的）：有一題把倉庫弄壞了，先還原、再查是哪一題。'] };
  return { code: 0, lines: [...lines, `三關全綠（${cmds.length} 關）。`] };
}

if (require.main === module) {
  let result;
  try { result = runChecks(); } catch (e) { result = { code: 2, lines: [`三關執行器：沒預期到的錯誤（${(e && e.code) || (e && e.message) || '不明'}）——不放行。`] }; }
  process.stdout.write(`${result.lines.join('\n')}\n`);
  process.exit(result.code);
}

module.exports = { runChecks, runCommand, treeState };
