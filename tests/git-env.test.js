// 守清 git 環境變數的共用實作（規矩 E4）。原專案：鉤子帶著 GIT_DIR 跑考題，考題裡的 git init
// 把主倉庫寫成裸倉庫，而那題顯示通過。
//
// 守得到的：GIT_ 前綴整族清掉（含會長的那一族）；GITHUB_、PATH、HOME 留著；原本那份不動。
// ⚠️ 守不到的：呼叫點有沒有用它——那由各呼叫點的行為題釘（跨變更試合併閘有一題）；新呼叫點靠自覺。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { gitEnv } = require('../tools/git-env.js');

test('GIT_ 前綴整族清掉，含會長的那一族；GITHUB_ 與 PATH、HOME 留著；原本那份不動', () => {
  const env = {
    GIT_DIR: '/x/.git/worktrees/y', GIT_WORK_TREE: '/x', GIT_INDEX_FILE: '/x/i',
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.excludesFile', GIT_CONFIG_VALUE_0: '/tmp/e',
    GIT_CONFIG_PARAMETERS: "'a=b'", GIT_EXEC_PATH: '/usr/libexec/git-core',
    GITHUB_TOKEN: 'keep-me', PATH: '/usr/bin:/bin', HOME: '/Users/x', LANG: 'C',
  };
  const before = JSON.stringify(env);
  const out = gitEnv(env);
  assert.deepEqual(Object.keys(out).sort(), ['GITHUB_TOKEN', 'HOME', 'LANG', 'PATH']);
  assert.equal(out.GITHUB_TOKEN, 'keep-me', 'GITHUB_ 不是 GIT_ 那一族');
  assert.equal(JSON.stringify(env), before, '原本那份不可以被改');
  assert.ok(!('GIT_DIR' in gitEnv({ ...process.env, GIT_DIR: '/nope' })), '預設吃 process.env 也要清');
});
