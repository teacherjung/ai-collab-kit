#!/usr/bin/env node
// 合併指令：依序跑完登記的每一道閘，任一道紅就停，全綠才按合併鍵。
//
// 裁示者 2026-09-12 裁「丙′」：閘照舊在本機跑，但包成這一支指令。理由（實作者的操作化）：
// 這幾道閘問的是「合併那一刻」的狀態——有沒有未撤銷的阻擋、有沒有別支疊在上面、其他開著的
// 變更合起來會不會撞、必要檢查是不是真的跑過。推送時跑出來的結果到合併那一刻已經過期，
// 所以「推上去就自動跑」不是同一件事；要做對得上平台的合併佇列，那是另一件工程。
//
// 這支指令擋得住什麼、擋不住什麼，照實說：
//   擋得住：忘了跑其中一道、跑了沒看退出碼、紅了還往下走。
//   擋不住：**不用這支指令、直接按平台的合併鍵**。要擋那個只有平台級的分支保護。
//
// ⚠️ 沒有任何一道閘登記成「已啟用」時，這支指令**不放行**（退出碼 2）。
//    一支什麼都沒檢查就按下合併鍵的指令，比沒有這支指令更危險。
'use strict';
const { spawnSync } = require('node:child_process');
const { read: readSettings } = require('./build-settings.js');
const { gitEnv } = require('./git-env.js');

const UNSET = '未設定';
const ENABLED = '已啟用';

/**
 * 預設的執行器：真的去跑那道閘。回傳退出碼與輸出，方便考題換掉。
 * ⚠️ 閘**起不來**（找不到指令、沒有執行權）與**被訊號殺掉／逾時**都回 2，不是 0——
 *    「跑不起來」不等於「檢查過了」。這兩條路 2026-09-13 稽核前零覆蓋：改成回 0，
 *    一道根本不存在的閘會被當成綠燈，一路按下合併鍵（端到端重現過）。
 */
function runCommand(command, args) {
  // 環境先清 GIT_ 那一族（規矩 E4；r1 High①）：閘會叫 git，繼承來的 GIT_DIR 會讓它們查到別棵倉庫
  const result = spawnSync(command, args, { encoding: 'utf8', env: gitEnv() });
  if (result.error) return { code: 2, output: String(result.error.message) };
  return { code: result.status === null ? 2 : result.status, output: `${result.stdout || ''}${result.stderr || ''}` };
}

/**
 * 跑完流程。回傳 { code, lines }；code 0＝已合併，1＝有閘擋下，2＝連判斷都做不到（fail-closed）。
 * settings／run 都可以換掉，考題就不必真的去動平台。
 */
function mergeRun(changeId, { settings = readSettings(), run = runCommand } = {}) {
  const lines = [];
  const say = (text) => lines.push(text);

  if (!changeId) {
    say('用法：node tools/merge.js <變更編號>');
    return { code: 2, lines };
  }
  if (!settings.mainBranch || settings.mainBranch === UNSET) {
    say(`專案設定裡的主幹分支名還是「${UNSET}」：不知道要合併到哪裡，不放行。`);
    return { code: 2, lines };
  }
  const gates = Array.isArray(settings.gates) ? settings.gates : [];
  const enabled = gates.filter((gate) => gate.state === ENABLED);
  if (enabled.length === 0) {
    say(`專案設定裡沒有任何一道閘登記成「${ENABLED}」：一支什麼都沒檢查就按合併鍵的指令比沒有更危險，不放行。`);
    say('要嘛把閘搬進來並登記啟用，要嘛照規矩本文 H1 用人工逐道跑完再自己按鍵。');
    return { code: 2, lines };
  }
  const notEnabled = gates.filter((gate) => gate.state !== ENABLED);
  if (notEnabled.length) {
    say(`⚠️ 這幾道閘還沒啟用、這一趟不會跑：${notEnabled.map((g) => g.name).join('、')}`);
  }

  say(`要合併的變更：${changeId}；主幹：${settings.mainBranch}；要跑 ${enabled.length} 道閘。`);
  for (const [index, gate] of enabled.entries()) {
    const argv = [...gate.args, String(changeId)];
    const { code, output } = run(gate.command, argv);
    say(`第 ${index + 1} 道｜${gate.name}｜退出碼 ${code}`);
    if (code !== 0) {
      const tail = output.trim().split('\n').slice(-5).join('\n');
      if (tail) say(tail);
      say(`這一道擋下來了，停在這裡、沒有按合併鍵。先問「紅的是哪一題」，不要跳過。`);
      return { code: 1, lines };
    }
  }

  const merge = settings.mergeCommand;
  if (!merge || !merge.command || merge.command === UNSET) {
    say(`每一道閘都綠了，但專案設定裡沒有登記合併指令（mergeCommand）：不自己猜平台怎麼合，停在這裡。`);
    return { code: 2, lines };
  }
  const argv = merge.args.map((arg) => arg.replace('{change}', String(changeId)));
  const { code, output } = run(merge.command, argv);
  const tail = output.trim().split('\n').slice(-5).join('\n');
  if (tail) say(tail);
  if (code !== 0) {
    say(`合併指令回了非零（${code}）：先去查那支變更現在的狀態再決定，不要重跑。`);
    return { code: 1, lines };
  }
  // 量詞只能蓋到這一趟真的跑過的那幾道——登記了但沒啟用的閘沒跑，不可以被這句話蓋進去
  // （2026-09-13 稽核抓到原本寫「每一道閘都綠」）。
  const skipped = gates.length - enabled.length;
  say(`這一趟要跑的 ${enabled.length} 道閘都綠、合併已執行${skipped ? `（另有 ${skipped} 道登記了但沒啟用，這一趟沒跑）` : ''}。`
    + '接著照規矩本文 H6 跑分級腳本、照它印的做驗收。');
  return { code: 0, lines };
}

if (require.main === module) {
  const { code, lines } = mergeRun(process.argv[2]);
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(code);
}

module.exports = { mergeRun, runCommand, UNSET, ENABLED };
