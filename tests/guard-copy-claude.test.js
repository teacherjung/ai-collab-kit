// 守 Claude 側釘指紋裝法（規矩 B1；裁示者 2026-09-18 裁）：templates/hook-claude-pinned.json 那兩組，
// 與 tools/guard-copy.js 的 --claude（補複本）、--claude-line（只印）、--retire（退役）。
//
// 為什麼：活讀裝法每次呼叫都讀當下那棵樹的清單——在樹裡把清單改弱、切到弱清單的分支，下一次呼叫就照弱的判。
// 釘指紋那一行只寫指紋，判斷改讀倉庫外、內容定址的固定複本 $HOME/.local/share/ai-collab-kit/guard/<指紋>：
// 樹裡的清單怎麼改都沒有用；這台機器沒有那一行要的那一份複本＝全擋（看得見）。
//
// 守得到的（每一題都真的用 /bin/sh 跑印出來的指令，HOME 一律指到暫存的假家目錄）：
//   ①範本的形狀：PreToolUse 剛好一組（matcher ^mcp__、一條指令）、{files} 與 {fingerprint} 各剛好一個、沒有 {copyDir}、
//     不含任何機器路徑、shasum 與 find 每一次出現都包在清空的環境裡、指紋比對用 case（不用 [ 或 test）；
//     ConfigChange 剛好一組、matcher 逐字＝project_settings、指令逐字＝exit 2（跑起來退 2、兩個輸出都空的）；範本原樣（佔位沒換）＝退 2；
//   ②--claude-line 只讀不寫、不需要 git；它印的指紋＝同一份內容用 --claude 落地的目錄名＝/usr/bin/shasum 自己算的（三方互證）；
//     複本裡 settings.json 的位元組逐字釘住（改寫法＝每台機器現有的複本全部失效）；工作樹沒提交的清單改動會改到它印的指紋、改不到複本；
//   ③--claude 落地：位置、剛好四個唯讀檔、沒有暫存殘留；成功訊息分兩種（新落地＝兩次試跑都過、已經在＝這個家試跑過）；
//     再跑一次＝不寫（位元組與修改時間不變）、照樣試跑；
//     沒合併的版本、家目錄本身是倉庫＝拒絕、什麼都沒寫；試跑沒過（載入就崩、什麼都放、放行時印字、指紋檢查被拿掉）＝不落地、沒有殘留；
//     範本從已合併的版本讀；
//   ④那個名字已經在、但不自洽（改過一個位元組、多一個檔、名字是連結）＝拒絕、不覆寫、不刪；別的工作階段搶先落地＝自洽就算成功；
//   ⑤那一行真的跑一遍（-c 與 -lc、從別的目錄起）：擋、放、四個檔各改一個位元組、少檔、複本改名（總煞車）、HOME 沒設（只跑 -c）、
//     HOME 指到空目錄、HOME 是相對路徑又設了 CDPATH（cd 不可以弄髒標準輸出）、複本裡多一個檔或目錄、PATH 前面有相對項目而複本裡放一支假 node、
//     三種連結、查不了連結、沒有 find、佔位沒換、沒有 node、載入就崩；每一種都有「改回來就恢復」或對照組（多一個檔與假 node 的對照組＝修正前只查連結的寫法真的照用）；
//     指紋對不上那一句一律不印 64 碼十六進位（tests/helpers/guard-rig.js 的 blocks()）；
//   ⑥**核心宣稱：樹裡改清單沒有用**——工作樹把清單改弱、切到弱清單的分支、環境指向清單很鬆的倉庫，那一行都照複本擋
//    （對照組：同樣的情境，活讀那一行真的放行）；
//   ⑦量到的兩個環境變數進不來：NODE_OPTIONS；PERL5OPT 偽造 shasum 的輸出（對照組：拿掉 shasum 外面那層清空環境，被改弱的複本真的過得了指紋檢查而放行）；
//   ⑧--retire：只刪名字是 64 碼、自洽的目錄（唯讀的也刪得掉）；短名字（Codex 全域層那種）、路徑片段、不自洽、名字是連結、不存在＝拒絕、什麼都沒動；
//   ⑨參數入口：四種用法不能混用；
//   ⑩函式換不掉的兩處：匯入名為 [、case 的函式，指紋比對照樣擋（對照組：寫成 [ … ] 時被改弱的複本真的放行）；匯入名為 exit 的函式，設定變更攔截照樣退 2；
//   ⑪**照實的對照（斷言放行）**：SHELLOPTS=noexec、匯入名為 cd 或 echo 的函式、PATH 前面放一支假 node＝那一行放行、設定變更攔截那一條退 0——
//     「鉤子的環境被塞變數這一類在那一行裡關不完」這句話靠它撐著；哪天變成擋得住，這題紅、提醒改文件。
//   ⑬改了清單卻沒重印那一行＝那一行照舊指紋找到舊複本、靜靜照舊清單判（放行、兩個輸出都空的）；同一刻唯一會紅的是等式題；
//     對照組：那一行換了、這台機器還沒補＝全擋，補了＝照新清單擋。
//   ⑫落地之後用這個家再試跑一次：這個家的登入設定往標準輸出印字＝退 1、這一次落地的那一份撤掉（之後那一行全擋、不是半套）；
//     原本就在的、別的工作階段先落地的那一份，試跑沒過也不動；對照組＝登入設定安靜時照常落地。
//   ⑩⑪匯入函式與 SHELLOPTS 那幾段只在 /bin/sh 是 bash 的機器跑，不是就跳過並寫明；⑦的 PERL5OPT 那一段只在 /usr/bin/shasum 是 perl 腳本時跑；
//   ⑫只在這台機器的登入 shell 真的讀假家的 .profile 時跑（先用對照組驗），不是就跳過並寫明。
// ⚠️ 守不到的：真的 Claude 對話有沒有載入那兩組；ConfigChange 在平台上擋不擋——這裡只證明那一條指令退 2；平台的行為 2026-09-18 在
//   2.1.275 量過一次、只量了專案設定檔這個來源；之後沒有任何例行動作重量它（測試鈕只走 PreToolUse 那一行）；
//   鉤子的環境被塞變數這一類（⑪）；這台機器真的家目錄裡有沒有複本（考題一律用假家目錄）；
//   node 本身；檢查與執行之間的極短空檔；複本不是鎖（誰都造得出自洽的一份）；Windows（指令是 sh）。
//   ⚠️ 突變指引：動到那四個檔的突變會先死在指紋檢查（紅的原因不對）——矩陣類的突變要照「改→重新落地→再跑」的順序做。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  COPY_FILES, CLAUDE_BASE, CLAUDE_PLACEHOLDERS, CLAUDE_TEMPLATE_REL, CONFIG_CHANGE_MATCHER,
  fingerprintDir, treeFingerprint, claudeGroups, claudeLine, copyProblem, buildClaude, retire, parseArgs, Refusal,
} = require('../tools/guard-copy.js');
const {
  KIT, FAKE, LOOSE, DENIED, ALLOWED, MISMATCH, STARTUP, base, git, sourceRepo, editFile, fakeHome, hook, tool, denies, allows, blocks, walk, withScratch, snapshot,
} = require('./helpers/guard-rig.js');
const { claudePinStatus } = require('../tools/claude-pin.js');

const SHASUM = '/usr/bin/shasum';
const template = () => JSON.parse(fs.readFileSync(path.join(KIT, CLAUDE_TEMPLATE_REL), 'utf8'));
const templateCommand = () => template().hooks.PreToolUse[0].hooks[0].command;
const baseOf = (home) => path.join(home, ...CLAUDE_BASE);
/** 這份來源專案的那一行（照它工作樹的四個檔與範本）。 */
const lineOf = (src) => claudeLine(src).groups.PreToolUse.hooks[0].command;
/** 落地一份：回 { src, home, fp, copyDir, cmd }。 */
function landed(scratch, srcOpts = {}, buildOpts = {}) {
  const src = sourceRepo(scratch, srcOpts);
  const home = fakeHome(scratch);
  const r = buildClaude({ from: 'HEAD', root: src, home, allowTemp: true, ...buildOpts });
  assert.equal(r.failure, null, r.failure);
  return { src, home, fp: r.fp, copyDir: r.copyDir, cmd: lineOf(src), r };
}
const refuses = (fn, re, why) => assert.throws(fn, (e) => e instanceof Refusal && re.test(e.message), why);
/** 指紋對不上那一條路的結尾（突變與對照組用）。 */
const FP_FAIL = "原句轉給裁示者（補複本的順序在 tools/guard-copy.js 檔頭）' >&2; exit 2;; esac";
/**
 * 那一行裡查「複本裡只有那四個檔與 tools 目錄」的那一道（對照組用：拿掉它、換回修正前只查連結的寫法、吞掉 find 的失敗）。
 * 從那一行裡找出來、不逐字寫死：這一道的條件被改掉時，要紅在行為斷言、不是紅在對照組找不到字。
 */
const oddCheckOf = (command) => {
  const m = command.match(/guard_odd="\$\(\/usr\/bin\/env -i \/usr\/bin\/find .*?\)"(?= && guard_sum=)/u);
  assert.ok(m, '前提：那一行裡有查多出來的檔那一道');
  return m[0];
};
const LINKS_ONLY = 'guard_odd="$(/usr/bin/env -i /usr/bin/find . -type l 2>/dev/null)"';
const PRESERVE = ' --preserve-symlinks --preserve-symlinks-main';
/** 把那一行的某一截換掉；要換的那一截不在＝考題自己壞了（突變了個寂寞），當場紅。 */
const swap = (command, from, to) => {
  assert.equal(command.split(from).length, 2, `前提：那一行裡剛好有一段「${from.slice(0, 60)}…」`);
  return command.replace(from, () => to);
};
/** /bin/sh 是不是 bash：匯入函式（BASH_FUNC_名字%%）、SHELLOPTS 這兩招是 bash 的，別的 sh 上那幾段跳過並寫明。 */
const shIsBash = () => spawnSync('/bin/sh', ['-c', 'printf %s "${BASH_VERSION-}"'], { env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' }).stdout !== '';

test('前提：這台機器有 /bin/sh、/usr/bin/env、/usr/bin/find、/usr/bin/shasum（少一支，釘指紋那一行在這台機器上一律退 2）', () => {
  for (const p of ['/bin/sh', '/usr/bin/env', '/usr/bin/find', SHASUM]) assert.ok(fs.existsSync(p), `沒有 ${p}`);
});

test('①範本的形狀：兩組各剛好一組、佔位各一個、不含機器路徑、shasum 與 find 都包在清空的環境裡；ConfigChange 那一條真的退 2', () => withScratch((scratch) => {
  const doc = template();
  assert.deepEqual(Object.keys(doc.hooks).sort(), ['ConfigChange', 'PreToolUse'], '範本剛好帶兩種鉤子');
  const pre = doc.hooks.PreToolUse;
  assert.equal(pre.length, 1);
  assert.deepEqual([pre[0].matcher, pre[0].hooks.length, pre[0].hooks[0].type], ['^mcp__', 1, 'command']);
  const cmd = pre[0].hooks[0].command;
  for (const ph of CLAUDE_PLACEHOLDERS) assert.equal(cmd.split(ph).length, 2, `${ph} 要剛好一個`);
  assert.ok(!cmd.includes('{copyDir}'), '那一行跨機器共用：不可以有複本路徑的佔位');
  assert.ok(cmd.includes(`"$HOME/${CLAUDE_BASE.join('/')}/$fp"`), '那一行找複本的位置＝工具落地的位置（CLAUDE_BASE）');
  assert.ok(!cmd.includes('${HOME:?'), 'HOME 沒設時 ${HOME:?} 讓整支 shell 退 127，而平台只把退 2 當成擋');
  assert.doesNotMatch(cmd, /\/Users\/|\/home\/|~\//u, '那一行不可以含任何機器路徑');
  for (const bin of ['/usr/bin/find', SHASUM]) {
    const uses = cmd.split(bin).length - 1;
    assert.ok(uses >= 1, `前提：那一行有用到 ${bin}`);
    assert.equal(cmd.split(`/usr/bin/env -i ${bin}`).length - 1, uses, `${bin} 每一次出現都要包在清空的環境裡`);
  }
  assert.ok(cmd.includes('/usr/bin/env -i PATH="$PATH" node --preserve-symlinks --preserve-symlinks-main tools/forbidden-tools.js'), 'node 那一截：清空環境、只留 PATH、兩個旗標');
  assert.match(cmd, /不要手工造複本、不要自己改那一行，原句轉給裁示者/u, '指紋對不上那一句要叫 AI 停手、轉給裁示者');

  const change = doc.hooks.ConfigChange;
  assert.equal(change.length, 1);
  assert.equal(CONFIG_CHANGE_MATCHER, 'project_settings', '只量過這一個來源');
  assert.deepEqual([change[0].matcher, change[0].hooks.length, change[0].hooks[0].type], [CONFIG_CHANGE_MATCHER, 1, 'command'], 'matcher 逐字＝project_settings（local_settings 沒量，刻意不掛）');
  // 只剩 exit 2：擋下時訊息沒有人收得到（量到＋官方文件），而 exit 是特殊內建、匯入的函式換不掉（⑩真的跑）
  assert.equal(change[0].hooks[0].command, 'exit 2', '設定變更攔截那一條只有 exit 2');
  const home = fakeHome(scratch);
  for (const flag of ['-c', '-lc']) {
    const r = spawnSync('/bin/sh', [flag, change[0].hooks[0].command], { cwd: scratch, env: { ...base, HOME: home }, input: '{}', encoding: 'utf8' });
    assert.deepEqual([r.status, r.stdout, r.stderr], [2, '', ''], `${flag}：設定變更攔截那一條要退 2、兩個輸出都空的`);
  }
  // 指紋比對用 case、不用 [ … ]（匯入的函式換得掉 [，換不掉 case：⑩真的跑）
  assert.match(cmd, /case "\$guard_seen" in "\|\$fp {2}-"\) ;;/u, '指紋比對用 case');
  assert.doesNotMatch(cmd, /(^|[\s;&|(])(\[|test)\s/u, '那一行不可以用 [ 或 test（函式換得掉）');
  // 填好的那一行也不含機器路徑：家目錄、暫存目錄、這份套件在哪裡，一個都不可以出現
  const filled = claudeGroups('a'.repeat(64), JSON.stringify(doc));
  assert.deepEqual(filled.ConfigChange, change[0], '設定變更攔截那一組原樣（沒有佔位）');
  for (const p of [os.homedir(), scratch, KIT]) assert.ok(!JSON.stringify(filled).includes(p), `填好的那兩組含機器路徑 ${p}`);
  for (const ph of ['{files}', '{fingerprint}', '{copyDir}']) assert.ok(!filled.PreToolUse.hooks[0].command.includes(ph), `${ph} 沒換掉`);

  // 範本壞了＝拒絕：matcher 被改、多一個佔位、混進複本路徑的佔位、設定變更攔截的 matcher 被換
  const broken = (fn) => { const d = template(); fn(d); return JSON.stringify(d); };
  refuses(() => claudeGroups('a'.repeat(64), broken((d) => { d.hooks.PreToolUse[0].matcher = '^mcp__unrelated__'; })), /形狀不對/u, 'PreToolUse 的 matcher 被改');
  refuses(() => claudeGroups('a'.repeat(64), broken((d) => { d.hooks.ConfigChange[0].matcher = 'local_settings'; })), /形狀不對/u, 'ConfigChange 的 matcher 被換');
  refuses(() => claudeGroups('a'.repeat(64), broken((d) => { delete d.hooks.ConfigChange; })), /找不到那一條指令/u, '少了 ConfigChange 那一組');
  refuses(() => claudeGroups('a'.repeat(64), broken((d) => { d.hooks.PreToolUse[0].hooks[0].command += ' # {fingerprint}'; })), /不是剛好一個/u, '多一個佔位');
  refuses(() => claudeGroups('a'.repeat(64), broken((d) => { d.hooks.PreToolUse[0].hooks[0].command += " # '{copyDir}'"; })), /\{copyDir\}/u, '混進複本路徑的佔位');
  refuses(() => claudeGroups('de1cfb4', JSON.stringify(doc)), /64 碼/u, '指紋不是 64 碼');
}));

test('②--claude-line 只讀不寫、不需要 git；指紋三方互證；複本裡設定檔的位元組逐字釘住；沒提交的清單改動只改得到那一行', () => withScratch((scratch) => {
  const src = sourceRepo(scratch);
  const home = fakeHome(scratch);
  const noGit = fs.mkdtempSync(path.join(scratch, 'empty-path-'));   // PATH 裡什麼都沒有：要 git 的話這裡就起不來
  const before = snapshot(src);
  const cli = tool(src, ['--claude-line'], { home, env: { PATH: noGit } });
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(snapshot(src), before, '--claude-line 不可以在工作樹裡寫任何東西');
  assert.deepEqual(fs.readdirSync(home), [], '--claude-line 不可以在家目錄寫任何東西');
  const fp = treeFingerprint(src);
  const groups = claudeGroups(fp, fs.readFileSync(path.join(src, CLAUDE_TEMPLATE_REL), 'utf8'));
  assert.deepEqual(JSON.parse(cli.stdout), { hooks: { PreToolUse: [groups.PreToolUse], ConfigChange: [groups.ConfigChange] } }, '印出來的＝範本＋這棵樹的指紋');
  assert.match(cli.stderr, new RegExp(`指紋：${fp}`, 'u'));

  // 三方互證：讀工作樹算的＝從已合併版本落地的目錄名＝shasum 自己算的
  const r = buildClaude({ from: 'HEAD', root: src, home, allowTemp: true });
  assert.equal(r.failure, null, r.failure);
  assert.deepEqual([r.fp, path.basename(r.copyDir)], [fp, fp], '兩條路（讀工作樹、抽已合併版本）要算出同一個指紋');
  const sh = spawnSync('/bin/sh', ['-c', `${SHASUM} -a 256 ${COPY_FILES.join(' ')} | ${SHASUM} -a 256`], { cwd: r.copyDir, env: { ...base, HOME: home }, encoding: 'utf8' });
  assert.equal(sh.stdout, `${fp}  -\n`, '指紋要跟 shasum 算的一模一樣');
  // 逐位元組釘住寫法：改它＝每台機器上現有的複本（含 Codex 全域層的）全部對不上
  assert.equal(fs.readFileSync(path.join(r.copyDir, 'settings.json'), 'utf8'), `${JSON.stringify({ forbidden: FAKE }, null, 2)}\n`, '複本裡的設定檔＝只有 forbidden 那一塊、縮排 2、結尾一個換行');

  // 工作樹沒提交的改動：清單以外的欄位不影響指紋；清單改了＝那一行的指紋跟著變，但複本（抽已合併版本）不變
  const settingsFile = path.join(src, 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  fs.writeFileSync(settingsFile, JSON.stringify({ ...settings, mergeAuthorization: '別的欄位' }));
  assert.equal(treeFingerprint(src), fp, '清單以外的欄位（連同整份檔的排版）不進指紋');
  fs.writeFileSync(settingsFile, JSON.stringify({ ...settings, forbidden: LOOSE }, null, 2));
  assert.notEqual(treeFingerprint(src), fp, '工作樹的清單改了，--claude-line 的指紋要跟著變');
  const again = buildClaude({ from: 'HEAD', root: src, home, allowTemp: true });
  assert.deepEqual([again.fp, again.existed], [fp, true], '複本只看已合併的版本：工作樹的改動進不去');
  // 清單沒填＝拒絕（釘上去只會全擋）
  fs.writeFileSync(settingsFile, JSON.stringify({ ...settings, forbidden: { name: '未設定' } }));
  refuses(() => treeFingerprint(src), /還沒填/u, '清單沒填');
  const unfilled = tool(src, ['--claude-line'], { home });
  assert.deepEqual([unfilled.status, unfilled.stdout], [2, ''], '清單沒填：退 2、什麼都不印');
}));

test('③--claude 落地：位置、四個唯讀檔、沒有暫存殘留；再跑＝不寫照樣試跑；沒合併＝拒絕；試跑沒過＝不落地', () => withScratch((scratch) => {
  const { src, home, fp, copyDir } = landed(scratch);
  assert.equal(copyDir, path.join(baseOf(home), fp), '落在 <家目錄>/.local/share/ai-collab-kit/guard/<指紋>');
  assert.deepEqual(fs.readdirSync(baseOf(home)), [fp], '基底目錄裡只有那一份：暫存骨架要清掉');
  const files = walk(copyDir).filter((p) => fs.statSync(p).isFile()).map((p) => path.relative(copyDir, p)).sort();
  assert.deepEqual(files, [...COPY_FILES].sort(), '複本裡只能有指紋蓋到的那幾個檔');
  for (const rel of COPY_FILES) assert.equal(fs.statSync(path.join(copyDir, rel)).mode & 0o222, 0, `${rel} 要唯讀`);
  assert.equal(fingerprintDir(copyDir), fp, '目錄名＝從磁碟重算的指紋');
  assert.equal(copyProblem(copyDir, fp), null);

  // 再跑一次（指令入口、不給 --from＝抽 origin/<主幹>）：不寫、照樣試跑、退 0
  const before = snapshot(baseOf(home));
  const again = tool(src, ['--claude'], { home });
  assert.equal(again.status, 0, again.stderr);
  assert.equal(again.stdout, `${fp}\n`, '標準輸出＝指紋一行');
  assert.match(again.stderr, /原本就在、自洽，沒有動它/u);
  assert.match(again.stderr, /自我試跑：過（HOME 指到這個家，\/bin\/sh -c 與 -lc 各一遍/u, '已經在：試跑用的是這個家');
  assert.match(again.stderr, /這棵樹現在的四個檔：同一個指紋/u);
  assert.deepEqual(snapshot(baseOf(home)), before, '已經在而且自洽：一個位元組、一個修改時間都不可以變');
  // 已經在、但試跑沒過（這裡用一個照清單不擋的 --deny-probe 逼它沒過）：退 1、沒有動它
  const probeFails = tool(src, ['--claude', '--deny-probe', ALLOWED], { home });
  assert.deepEqual([probeFails.status, probeFails.stdout], [1, ''], `給了照清單不擋的 --deny-probe：試跑要沒過、退 1（${probeFails.stderr}）`);
  assert.match(probeFails.stderr, /原本就在，這支沒有動它/u);
  assert.deepEqual(snapshot(baseOf(home)), before);

  // 新落地（指令入口）：兩次試跑都過了才算數，訊息照實分開講
  const firstHome = fakeHome(scratch);
  const first = tool(src, ['--claude'], { home: firstHome });
  assert.deepEqual([first.status, first.stdout], [0, `${fp}\n`], first.stderr);
  assert.match(first.stderr, /（新落地）/u);
  assert.match(first.stderr, /自我試跑：過（兩次，每次 \/bin\/sh -c 與 -lc 各一遍：落地前 HOME 指到暫存骨架、落地後 HOME 指到這個家/u, '新落地：兩次都過');
  assert.deepEqual(fs.readdirSync(baseOf(firstHome)), [fp]);

  // 沒合併的版本：拒絕，家目錄裡什麼都沒有
  const fresh = fakeHome(scratch);
  fs.appendFileSync(path.join(src, 'tools', 'forbidden-tools.js'), '\n// 本機沒推的改動\n');
  assert.equal(git(src, 'commit', '-qam', 'local').status, 0);
  refuses(() => buildClaude({ from: 'HEAD', root: src, home: fresh, allowTemp: true }), /還不在 origin\/main 裡/u, '本機沒推的提交');
  const viaCli = tool(src, ['--claude', '--from', 'HEAD'], { home: fresh });
  assert.deepEqual([viaCli.status, viaCli.stdout], [2, ''], viaCli.stderr);
  assert.deepEqual(fs.readdirSync(fresh), [], '拒絕＝家目錄裡什麼都沒寫');
  refuses(() => buildClaude({ root: sourceRepo(scratch, { mainBranch: '未設定' }), home: fresh, allowTemp: true }), /用 --from 給/u, '不給 --from 又沒填主幹');
  refuses(() => buildClaude({ root: sourceRepo(scratch, { merged: false }), home: fresh, allowTemp: true }), /不是這個倉庫裡的一個版本/u, '不給 --from、本機沒有 origin/<主幹>');
  refuses(() => buildClaude({ from: 'HEAD', root: sourceRepo(scratch, { edit: (dir) => fs.rmSync(path.join(dir, CLAUDE_TEMPLATE_REL)) }), home: fresh, allowTemp: true }), /裡沒有 templates\/hook-claude-pinned\.json/u, '那個版本還沒有這份範本');
  refuses(() => buildClaude({ from: 'HEAD', root: sourceRepo(scratch, editFile(CLAUDE_TEMPLATE_REL, (c) => c.replace('"matcher": "^mcp__"', '"matcher": "^mcp__unrelated__"'))), home: fresh, allowTemp: true }), /形狀不對/u, '那個版本的範本形狀不對（matcher 被改掉）');
  refuses(() => buildClaude({ from: 'HEAD', root: sourceRepo(scratch, { forbidden: { name: '測試禁區', patterns: ['^create_widget$'] } }), home: fresh, allowTemp: true }), /--deny-probe/u, '只靠樣式規則的清單、沒給 --deny-probe');
  refuses(() => buildClaude({ from: 'HEAD', root: src, home: 'relative/home', allowTemp: true }), /家目錄不是絕對路徑/u, '家目錄不是絕對路徑');
  // 暫存區的放行是明寫的旗標：不給就拒絕（考題的假家目錄都在暫存區）
  refuses(() => buildClaude({ from: 'HEAD~1', root: src, home: fresh }), /暫存區/u, '暫存區');
  assert.deepEqual(fs.readdirSync(fresh), [], '以上每一種拒絕都沒有寫東西');
  // 家目錄本身是一個倉庫（把家目錄的設定檔放進版控的做法）：基底目錄在版本控制目錄裡＝拒絕、什麼都沒寫
  const repoHome = fakeHome(scratch);
  assert.equal(git(repoHome, 'init', '-q').status, 0);
  const repoBefore = snapshot(repoHome);
  refuses(() => buildClaude({ from: 'HEAD~1', root: src, home: repoHome, allowTemp: true }), /目的地在版本控制目錄裡/u, '家目錄本身是倉庫');
  assert.deepEqual(snapshot(repoHome), repoBefore, '家目錄是倉庫：什麼都沒寫');
  const repoCli = tool(src, ['--claude', '--from', 'HEAD~1'], { home: repoHome });
  assert.deepEqual([repoCli.status, repoCli.stdout], [2, ''], `家目錄是倉庫：指令入口退 2（${repoCli.stderr}）`);
  assert.deepEqual(snapshot(repoHome), repoBefore);

  // 試跑沒過＝不落地、沒有殘留。四種壞法各自要被抓到：
  const failsWith = (srcOpts, re, why) => {
    const bad = sourceRepo(scratch, srcOpts);
    const badHome = fakeHome(scratch);
    const r = buildClaude({ from: 'HEAD', root: bad, home: badHome, allowTemp: true });
    assert.match(r.failure || '', re, `${why}：${r.failure}`);
    assert.ok(!fs.existsSync(r.copyDir), `${why}：試跑沒過不可以落地`);
    assert.deepEqual(fs.readdirSync(baseOf(badHome)), [], `${why}：暫存骨架要清掉`);
    return { bad, badHome };
  };
  const crash = failsWith(editFile('tools/settings-data.js', () => "'use strict';\nthrow new Error('載入就崩');\n"), /沒有被乾淨地放行[\s\S]*退 2/u, '攔截器載入就崩');
  failsWith(editFile('tools/forbidden-tools.js', (c) => c.replace("return { code: 0, output: d.deny ? hookOutput(d.why, name) : '' };", "return { code: 0, output: '' };")), /沒有一個被擋下/u, '攔截器被改成什麼都放');
  failsWith(editFile('tools/forbidden-tools.js', (c) => c.replace("if (r.output) process.stdout.write(`${r.output}\\n`);", "process.stdout.write(r.output ? `${r.output}\\n` : 'hello\\n');")), /沒有被乾淨地放行/u, '放行時往標準輸出印字');
  failsWith(editFile(CLAUDE_TEMPLATE_REL, (c) => { const out = c.replace(FP_FAIL, FP_FAIL.replace('exit 2', 'exit 0')); assert.notEqual(out, c, '前提：真的改到範本'); return out; }), /指紋檢查沒有作用/u, '範本的指紋檢查被改成不擋（提交進版本）');
  const cliBad = tool(crash.bad, ['--claude'], { home: crash.badHome });
  assert.deepEqual([cliBad.status, cliBad.stdout], [1, ''], `指令入口：試跑沒過＝退 1、標準輸出空的（${cliBad.stderr}）`);
  assert.match(cliBad.stderr, /自我試跑沒過[\s\S]*沒有落地/u);
  assert.deepEqual(fs.readdirSync(baseOf(crash.badHome)), []);

  // 寫到一半出錯（基底目錄的上層不給寫）：退 1、什麼都沒落地
  if (process.getuid && process.getuid() !== 0) {
    const roHome = fakeHome(scratch);
    fs.mkdirSync(path.join(roHome, '.local'), { mode: 0o555 });
    const half = tool(sourceRepo(scratch), ['--claude'], { home: roHome });
    fs.chmodSync(path.join(roHome, '.local'), 0o755);
    assert.deepEqual([half.status, half.stdout], [1, ''], `寫不進去：退 1、標準輸出空的（${half.stderr}）`);
    assert.match(half.stderr, /途中出錯[\s\S]*沒有落地任何東西/u);
    assert.deepEqual(fs.readdirSync(path.join(roHome, '.local')), [], '什麼都沒落地');
  }

  // 範本從已合併的版本讀：工作樹把指紋檢查改成不擋，試跑照提交的那一份＝照常過
  const clean = sourceRepo(scratch);
  const tpl = path.join(clean, CLAUDE_TEMPLATE_REL);
  const loosened = fs.readFileSync(tpl, 'utf8').replace(FP_FAIL, FP_FAIL.replace('exit 2', 'exit 0'));
  assert.notEqual(loosened, fs.readFileSync(tpl, 'utf8'), '前提：真的改到範本');
  fs.writeFileSync(tpl, loosened);
  assert.equal(buildClaude({ from: 'HEAD', root: clean, home: fakeHome(scratch), allowTemp: true }).failure, null, '試跑用的是已合併版本的範本');
}));

test('④那個名字已經在、但不自洽＝拒絕、不覆寫、不刪；別的工作階段搶先落地＝自洽就算成功', () => withScratch((scratch) => {
  const good = landed(scratch);
  const plant = (mutate) => {
    const home = fakeHome(scratch);
    const dir = path.join(baseOf(home), good.fp);
    fs.mkdirSync(baseOf(home), { recursive: true });
    fs.cpSync(good.copyDir, dir, { recursive: true });
    mutate(dir, home);
    return { home, dir, before: snapshot(baseOf(home)) };
  };
  const stays = ({ home, before }, why) => {
    refuses(() => buildClaude({ from: 'HEAD', root: good.src, home, allowTemp: true }), /不是一份自洽的複本/u, why);
    assert.deepEqual(snapshot(baseOf(home)), before, `${why}：不覆寫、不刪、不留暫存骨架`);
    const cli = tool(good.src, ['--claude'], { home });
    assert.deepEqual([cli.status, cli.stdout], [2, ''], `${why}：指令入口退 2（${cli.stderr}）`);
    assert.match(cli.stderr, /原句轉給裁示者/u);
    assert.deepEqual(snapshot(baseOf(home)), before);
  };
  stays(plant((dir) => { fs.chmodSync(path.join(dir, 'settings.json'), 0o644); fs.appendFileSync(path.join(dir, 'settings.json'), ' '); }), '內容改過一個位元組');
  stays(plant((dir) => fs.writeFileSync(path.join(dir, 'package.json'), '{}')), '多一個不在清單上的檔');
  stays(plant((dir) => { fs.chmodSync(path.join(dir, 'tools', 'package.json'), 0o644); fs.rmSync(path.join(dir, 'tools', 'package.json')); }), '少一個檔');
  // 名字是連結、指到別處一份自洽的複本：內容是對的，但那個名字不是這支造出來的樣子＝不認
  const elsewhere = path.join(scratch, 'elsewhere-copy');
  fs.cpSync(good.copyDir, elsewhere, { recursive: true });
  assert.equal(copyProblem(elsewhere, good.fp), null, '前提：連結指到的那一份本身是自洽的');
  stays(plant((dir) => { fs.rmSync(dir, { recursive: true, force: true }); fs.symlinkSync(elsewhere, dir); }), '名字是一個連結');
  assert.equal(copyProblem(elsewhere, good.fp), null, '連結指到的那一份沒有被動到');

  // 兩個工作階段同時補：落地前一刻別人先放了同一份（自洽）＝算成功、不留暫存骨架；放的是不自洽的＝照樣拒絕
  const raceHome = fakeHome(scratch);
  const raced = buildClaude({ from: 'HEAD', root: good.src, home: raceHome, allowTemp: true, beforeLand: (dir) => fs.cpSync(good.copyDir, dir, { recursive: true }) });
  assert.deepEqual([raced.failure, raced.existed, raced.fp], [null, true, good.fp], '別人先落地、而且自洽：照「已經在」那條路走');
  assert.deepEqual(fs.readdirSync(baseOf(raceHome)), [good.fp]);
  const badRaceHome = fakeHome(scratch);
  refuses(() => buildClaude({ from: 'HEAD', root: good.src, home: badRaceHome, allowTemp: true, beforeLand: (dir) => { fs.cpSync(good.copyDir, dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'extra'), 'x'); } }), /不是一份自洽的複本/u, '別人先落地、但不自洽');
  assert.deepEqual(fs.readdirSync(baseOf(badRaceHome)), [good.fp], '不自洽的那一份留著給人看，暫存骨架清掉');
}));

test('⑤那一行真的跑一遍：擋、放、改一個位元組、少檔、總煞車、HOME 沒設或指到空目錄、CDPATH、多一個檔、複本裡的假 node、連結、沒有 find、佔位沒換、沒有 node、載入就崩', () => withScratch((scratch) => {
  const { home, fp, copyDir, cmd } = landed(scratch);
  const elsewhere = fs.mkdtempSync(path.join(scratch, 'elsewhere-'));
  for (const flag of ['-c', '-lc']) {
    denies(hook(cmd, { home, flag, tool: DENIED, cwd: elsewhere }), `${flag}：該擋的擋`);
    allows(hook(cmd, { home, flag, cwd: elsewhere }), `${flag}：該放的放（尾巴不可以把放行變成擋）`);
  }
  for (const rel of COPY_FILES) {
    const file = path.join(copyDir, rel);
    const original = fs.readFileSync(file);
    const flipped = Buffer.from(original);
    flipped[Math.floor(flipped.length / 2)] ^= 0x01;
    fs.chmodSync(file, 0o644);
    fs.writeFileSync(file, flipped);
    blocks(hook(cmd, { home, tool: DENIED }), MISMATCH, `${rel} 改一個位元組`);
    blocks(hook(cmd, { home }), MISMATCH, `${rel} 改一個位元組：本來放行的也擋`);
    fs.writeFileSync(file, original);
    fs.chmodSync(file, 0o444);
    allows(hook(cmd, { home }), `對照組：${rel} 改回來就恢復`);
  }
  const moved = path.join(scratch, 'moved');
  fs.renameSync(path.join(copyDir, 'tools', 'settings-data.js'), moved);
  blocks(hook(cmd, { home }), MISMATCH, '少一個檔');
  fs.renameSync(moved, path.join(copyDir, 'tools', 'settings-data.js'));
  // 總煞車：把複本目錄改名，下一次呼叫就全擋；放回來就恢復
  fs.renameSync(copyDir, `${copyDir}.away`);
  blocks(hook(cmd, { home }), MISMATCH, '複本改名（總煞車）');
  blocks(hook(cmd, { home, tool: DENIED }), MISMATCH, '複本改名：該擋的也是退 2，不是靜靜放行');
  fs.renameSync(`${copyDir}.away`, copyDir);
  allows(hook(cmd, { home }), '對照組：放回來就恢復');
  // HOME：沒設、指到沒有複本的地方＝退 2（不可以退別的碼：平台只把退 2 當成擋）。
  // HOME 沒設只跑 -c：登入 shell 在 HOME 沒設時會照密碼檔找到真的家、去讀那裡的登入設定（考題不碰真的家）
  blocks(hook(cmd, { home: null }), MISMATCH, '-c：HOME 沒設');
  for (const flag of ['-c', '-lc']) {
    blocks(hook(cmd, { home: fakeHome(scratch), flag, tool: DENIED }), MISMATCH, `${flag}：HOME 指到空目錄（這台機器沒補複本）`);
  }
  allows(hook(cmd, { home }), '對照組：HOME 指回有複本的家就恢復');

  // cd 後面的 >/dev/null：HOME 是相對路徑、又設了 CDPATH 時，cd 會往標準輸出印它進去的目錄——拒絕形狀被弄髒＝平台讀不出來＝放行
  const cdpathCwd = fs.mkdtempSync(path.join(scratch, 'cdpath-cwd-'));
  const relHome = { home: path.basename(home), cwd: cdpathCwd, env: { CDPATH: path.dirname(home) }, tool: DENIED };
  denies(hook(cmd, relHome), 'HOME 是相對路徑又設了 CDPATH：標準輸出照樣整段是拒絕形狀');
  const chattyCd = hook(swap(cmd, ' >/dev/null 2>&1 && guard_odd=', ' 2>/dev/null && guard_odd='), relHome);
  assert.ok(chattyCd.stdout.startsWith(path.dirname(home)), `對照組的前提：這樣設定時 cd 真的往標準輸出印字（「${chattyCd.stdout.slice(0, 120)}」）`);
  assert.throws(() => denies(chattyCd, 'x'), '對照組：cd 不吞標準輸出時，拒絕形狀被弄髒');

  // 複本裡多一個檔（跟 --claude 認「自洽」同一個判準）：一律退 2
  const ODD_CHECK = oddCheckOf(cmd);
  const extra = path.join(copyDir, 'extra.txt');
  fs.writeFileSync(extra, 'x');
  assert.equal(fingerprintDir(copyDir), fp, '前提：多一個檔不改四個檔的指紋');
  blocks(hook(cmd, { home }), MISMATCH, '複本裡多一個檔');
  allows(hook(swap(cmd, ODD_CHECK, LINKS_ONLY), { home }), '對照組：修正前只查連結的寫法，多一個檔照用');
  fs.rmSync(extra);
  fs.mkdirSync(path.join(copyDir, 'tools', 'sub'));
  blocks(hook(cmd, { home }), MISMATCH, '複本裡多一個空目錄');
  fs.rmdirSync(path.join(copyDir, 'tools', 'sub'));
  allows(hook(cmd, { home }), '對照組：拿掉就恢復');
  // PATH 有相對項目、複本目錄裡放一支假 node：那一行 cd 進複本之後才找 node，相對項目就是從複本目錄算的
  for (const [rel, entry] of [[path.join('node_modules', '.bin', 'node'), 'node_modules/.bin'], ['node', '.']]) {
    const fake = path.join(copyDir, rel);
    fs.mkdirSync(path.dirname(fake), { recursive: true });
    fs.writeFileSync(fake, '#!/bin/sh\ncat >/dev/null\nexit 0\n', { mode: 0o755 });
    const relPath = { home, tool: DENIED, env: { PATH: `${entry}:${base.PATH}` } };
    blocks(hook(cmd, relPath), MISMATCH, `PATH 前面放 ${entry}＋複本裡的假 node`);
    allows(hook(swap(cmd, ODD_CHECK, LINKS_ONLY), relPath), `對照組：修正前的寫法，PATH 前面放 ${entry}＋複本裡的假 node＝真的被拿來跑而放行`);
    fs.rmSync(path.join(copyDir, rel.split(path.sep)[0]), { recursive: true });
    denies(hook(cmd, relPath), `對照組：假 node 拿掉、PATH 照舊＝照清單擋（擋下假 node 的是查多出來的檔那一道）`);
  }

  // 連結：另一份內容相同、只有清單放寬的複本；把這一份的某一處換成指向它的連結，shasum 跟著連結算出一樣的指紋，
  // node 卻從連結真正的位置找旁邊的檔＝讀到放寬的清單。兩道各自擋得住；對照組＝兩道都拿掉，真的放行
  const loose = path.join(scratch, 'loose-copy');
  fs.cpSync(copyDir, loose, { recursive: true });
  for (const p of walk(loose)) fs.chmodSync(p, 0o755);
  fs.writeFileSync(path.join(loose, 'settings.json'), `${JSON.stringify({ forbidden: LOOSE }, null, 2)}\n`);
  // 原本那一份先搬到複本外面（留在複本裡＝多一個檔，會被查多出來的檔那一道先擋下，量不到連結那一道）
  const savedOf = (rel) => path.join(scratch, `saved-${rel.split(path.sep).join('-')}`);
  const swapToLink = (rel, target) => {
    const at = path.join(copyDir, rel);
    const saved = savedOf(rel);
    fs.chmodSync(path.dirname(at), 0o755);
    fs.renameSync(at, saved);
    fs.symlinkSync(target, at);
    return () => { fs.unlinkSync(at); fs.renameSync(saved, at); };
  };
  const onlyPreserve = swap(cmd, ODD_CHECK, 'guard_odd=');
  const neither = swap(onlyPreserve, PRESERVE, '');
  let restore = swapToLink(path.join('tools', 'forbidden-tools.js'), path.join(loose, 'tools', 'forbidden-tools.js'));
  assert.equal(fingerprintDir(copyDir), fp, '前提：換成內容相同的連結，指紋一樣');
  allows(hook(neither, { home, tool: DENIED }), '對照組：兩道都拿掉時，入口換成連結真的讀到放寬的清單而放行');
  blocks(hook(cmd, { home, tool: DENIED }), MISMATCH, '入口換成連結');
  denies(hook(onlyPreserve, { home, tool: DENIED }), '只剩第②道：照複本自己的清單擋');
  if (process.getuid && process.getuid() !== 0) {
    fs.chmodSync(path.join(copyDir, 'tools'), 0o111);
    const find = spawnSync('/usr/bin/find', ['.', '-type', 'l'], { cwd: copyDir, encoding: 'utf8' });
    try {
      assert.notEqual(find.status, 0, '前提：這樣設定之後 find 真的失敗');
      assert.equal(fingerprintDir(copyDir), fp, '前提：四個檔照樣讀得到、指紋一樣');
      blocks(hook(cmd, { home, tool: DENIED }), MISMATCH, '查不了有沒有連結');
      const swallowed = swap(swap(cmd, ODD_CHECK, ODD_CHECK.replace(' 2>/dev/null)"', ' 2>/dev/null || :)"')), PRESERVE, '');
      allows(hook(swallowed, { home, tool: DENIED }), '對照組：只看輸出空不空（吞掉 find 的失敗）、又不帶旗標的寫法，這個情況真的放行');
    } finally {
      fs.chmodSync(path.join(copyDir, 'tools'), 0o755);
    }
  }
  restore();
  blocks(hook(swap(cmd, '/usr/bin/find', '/nonexistent/find'), { home }), MISMATCH, '找不到 find 也擋');
  restore = swapToLink('tools', path.join(loose, 'tools'));
  blocks(hook(cmd, { home, tool: DENIED }), MISMATCH, 'tools 目錄換成連結');
  restore();
  restore = swapToLink('settings.json', path.join(scratch, 'moved-settings-link-target'));
  fs.copyFileSync(savedOf('settings.json'), path.join(scratch, 'moved-settings-link-target'));
  blocks(hook(cmd, { home }), MISMATCH, '設定檔換成內容相同的連結');
  restore();
  denies(hook(cmd, { home, tool: DENIED }), '對照組：連結都拿掉就恢復');

  // 佔位沒換
  const values = { '{files}': COPY_FILES.join(' '), '{fingerprint}': fp };
  const fill = (skip) => CLAUDE_PLACEHOLDERS.reduce((c, ph) => (ph === skip ? c : c.replace(ph, () => values[ph])), templateCommand());
  blocks(hook(templateCommand(), { home }), MISMATCH, '範本原樣（兩個佔位都沒換）');
  for (const ph of CLAUDE_PLACEHOLDERS) blocks(hook(fill(ph), { home }), MISMATCH, `只有 ${ph} 沒換`);
  assert.equal(fill(null), cmd, '對照組：兩個都換了就是印出來的那一行');

  // 沒有 node：PATH 是一個空目錄（env 寫的是絕對路徑，不靠 PATH）。用 -c（-lc 會照登入設定重建 PATH，模擬不出來）
  const emptyPath = fs.mkdtempSync(path.join(scratch, 'nopath-'));
  const noNode = hook(cmd, { home, env: { PATH: emptyPath } });
  blocks(noNode, STARTUP, '找不到 node');
  assert.doesNotMatch(noNode.stderr, MISMATCH, '沒有 node 的時候指紋照樣驗得過（shasum、find、env 都寫絕對路徑）');

  // 載入就崩、但指紋是對的（不試跑、硬落地一份崩掉的版本）：要被尾巴轉成退 2，而且不是指紋那一句
  const crashed = landed(scratch, editFile('tools/settings-data.js', () => "'use strict';\nthrow new Error('載入就崩');\n"), { runSelfTest: false });
  const r = hook(crashed.cmd, { home: crashed.home });
  blocks(r, STARTUP, '攔截器載入就崩');
  assert.doesNotMatch(r.stderr, MISMATCH, '崩掉那一份的指紋是對的：擋下它的是尾巴，不是指紋檢查');
}));

test('⑥核心宣稱：樹裡改清單沒有用——工作樹改弱、切到弱清單的分支、環境指向鬆的倉庫，那一行都照複本擋（對照組：活讀那一行真的放行）', () => withScratch((scratch) => {
  const { src, home, cmd } = landed(scratch);
  const live = JSON.parse(fs.readFileSync(path.join(KIT, 'templates', 'hook-claude.json'), 'utf8')).hooks.PreToolUse[0].hooks[0].command;
  const inTree = (command, env = {}) => hook(command, { home, tool: DENIED, cwd: path.join(src, 'tools'), env });
  denies(inTree(cmd), '前提：照嚴格清單，那一行擋');
  denies(inTree(live), '前提：照嚴格清單，活讀那一行也擋');

  // (a) 工作樹把清單改弱（沒提交）
  const settingsFile = path.join(src, 'settings.json');
  const strict = fs.readFileSync(settingsFile, 'utf8');
  fs.writeFileSync(settingsFile, JSON.stringify({ ...JSON.parse(strict), forbidden: LOOSE }, null, 2));
  allows(inTree(live), '對照組：工作樹改弱，活讀那一行真的放行');
  denies(inTree(cmd), '工作樹改弱：釘指紋那一行照複本擋');
  // (b) 切到弱清單的分支（提交了的弱清單）
  assert.equal(git(src, 'checkout', '-qb', 'weak').status, 0);
  assert.equal(git(src, 'commit', '-qam', 'weak list').status, 0);
  allows(inTree(live), '對照組：切到弱清單的分支，活讀那一行真的放行');
  denies(inTree(cmd), '切到弱清單的分支：釘指紋那一行照複本擋');
  // 那一行是照「這棵樹現在的四個檔」印的話就不一樣了——那是一行新的指令、要走審查；而且它的複本這台機器沒有＝全擋
  blocks(inTree(lineOf(src)), MISMATCH, '照弱清單重印的那一行：複本不在＝全擋，不是照弱清單放行');
  fs.writeFileSync(settingsFile, strict);

  // (c) 環境指向另一個清單很鬆的倉庫：那一行根本不問 git
  const loose = sourceRepo(scratch, { forbidden: { name: '測試禁區', deny: ['mcp__z__only'] } });
  const looseEnv = { GIT_DIR: path.join(loose, '.git'), GIT_WORK_TREE: loose };
  const withoutClearing = live.replace(/^root="\$\(.*?git rev-parse/u, 'root="$(git rev-parse');
  allows(inTree(withoutClearing, looseEnv), '對照組：會問 git 又不清環境的寫法，真的讀到鬆的清單而放行');
  denies(inTree(cmd, looseEnv), '環境指向別的倉庫：釘指紋那一行照複本擋');
  denies(hook(cmd, { home, tool: DENIED, cwd: loose }), '走進清單很鬆的另一個倉庫：照複本擋');
  allows(hook(cmd, { home, cwd: loose }), '對照組：該放的照樣放');
}));

test('⑦量到的兩個環境變數進不來：NODE_OPTIONS 夾帶程式、PERL5OPT 偽造 shasum 的輸出（這一類沒有關完：⑪）', (t) => withScratch((scratch) => {
  const { home, fp, copyDir, cmd } = landed(scratch);
  const evil = path.join(scratch, 'evil.js');
  fs.writeFileSync(evil, 'process.exit(0);\n');
  const nodeEnv = { NODE_OPTIONS: `--require=${evil}` };
  const withoutClear = cmd.replace('/usr/bin/env -i PATH="$PATH" node ', 'node ');
  assert.notEqual(withoutClear, cmd, '前提：指令裡有清空環境那一截');
  allows(hook(withoutClear, { home, tool: DENIED, env: nodeEnv }), '對照組：不清環境時，夾帶的程式真的把該擋的放行');
  denies(hook(cmd, { home, tool: DENIED, env: nodeEnv }), '清空環境：夾帶的程式進不來');

  // shasum 是 perl 腳本：PERL5OPT 能讓它不算、直接印出指定的字串。把複本的清單改弱、再讓 shasum 印出原本的指紋——
  // 不清環境的話指紋檢查就過了、照弱清單放行。（PERL5OPT 用空白切參數，所以兩個空白寫成 \x20）
  if (!/^#!.*perl/u.test(fs.readFileSync(SHASUM, 'utf8').split('\n')[0])) {
    t.skip('這台機器的 /usr/bin/shasum 不是 perl 腳本：PERL5OPT 這一招不適用，對照組做不出來');
    return;
  }
  const perlEnv = { PERL5OPT: `-Mstrict;print(qq{${fp}\\x20\\x20-\\n});exit` };
  const forged = spawnSync('/bin/sh', ['-c', `echo x | ${SHASUM} -a 256`], { env: { ...base, HOME: home, ...perlEnv }, encoding: 'utf8' });
  assert.equal(forged.stdout, `${fp}  -\n`, '前提：這個環境變數真的讓 shasum 印出指定的字串');
  fs.chmodSync(path.join(copyDir, 'settings.json'), 0o644);
  fs.writeFileSync(path.join(copyDir, 'settings.json'), `${JSON.stringify({ forbidden: LOOSE }, null, 2)}\n`);
  assert.notEqual(fingerprintDir(copyDir), fp, '前提：複本真的被改了');
  const bareShasum = cmd.split(`/usr/bin/env -i ${SHASUM}`).join(SHASUM);
  assert.notEqual(bareShasum, cmd, '前提：指令裡 shasum 外面有清空環境那一層');
  allows(hook(bareShasum, { home, tool: DENIED, env: perlEnv }), '對照組：shasum 不包清空的環境，被改弱的複本真的過得了指紋檢查而放行');
  blocks(hook(cmd, { home, tool: DENIED, env: perlEnv }), MISMATCH, '包了清空的環境：偽造不了，被改過的複本照樣退 2');
}));

test('⑧--retire：只刪名字是 64 碼、自洽的目錄；短名字、路徑片段、不自洽、名字是連結、不存在＝拒絕、什麼都沒動', () => withScratch((scratch) => {
  const { src, home, fp, copyDir } = landed(scratch);
  const base64 = baseOf(home);
  // Codex 全域層那種人取的短名字：內容一模一樣也不碰
  const shortName = path.join(base64, 'de1cfb4');
  fs.cpSync(copyDir, shortName, { recursive: true });
  // 名字是 64 碼、內容不自洽
  const wrongName = 'b'.repeat(64);
  fs.cpSync(copyDir, path.join(base64, wrongName), { recursive: true });
  // 名字是 64 碼的連結，指到基底以外一份自洽的複本
  const outside = path.join(scratch, 'outside', fp);
  fs.mkdirSync(path.dirname(outside));
  fs.cpSync(copyDir, outside, { recursive: true });
  const linkHome = fakeHome(scratch);
  fs.mkdirSync(baseOf(linkHome), { recursive: true });
  fs.symlinkSync(outside, path.join(baseOf(linkHome), fp));

  const before = snapshot(base64);
  const outsideBefore = snapshot(outside);
  refuses(() => retire({ fp: 'de1cfb4', home }), /只收 64 碼/u, '短名字');
  refuses(() => retire({ fp: `../${fp}`, home }), /只收 64 碼/u, '路徑片段');
  refuses(() => retire({ fp: fp.toUpperCase(), home }), /只收 64 碼/u, '大寫（不分大小寫的磁碟上是同一個目錄，照樣不收）');
  refuses(() => retire({ fp: wrongName, home }), /不是一份自洽的複本/u, '名字對、內容重算的指紋不是它');
  refuses(() => retire({ fp: 'c'.repeat(64), home }), /沒有這一份/u, '不存在');
  refuses(() => retire({ fp, home: fakeHome(scratch) }), /沒有 Claude 側複本的基底目錄/u, '這個家根本沒有基底目錄');
  refuses(() => retire({ fp, home: linkHome }), /不是一份自洽的複本[\s\S]*連結/u, '名字是連結');
  assert.deepEqual(snapshot(base64), before, '以上每一種拒絕都什麼都沒動');
  assert.deepEqual(snapshot(outside), outsideBefore, '連結指到的那一份沒有被動到');
  assert.ok(fs.lstatSync(path.join(baseOf(linkHome), fp)).isSymbolicLink(), '連結自己也還在');
  const cliRefused = tool(src, ['--retire', 'de1cfb4'], { home });
  assert.deepEqual([cliRefused.status, cliRefused.stdout], [2, ''], cliRefused.stderr);
  assert.match(cliRefused.stderr, /什麼都沒刪/u);

  // 多一個檔＝不自洽＝不刪；拿掉就刪得掉（檔案是唯讀的也一樣）
  fs.writeFileSync(path.join(copyDir, 'extra'), 'x');
  refuses(() => retire({ fp, home }), /不是一份自洽的複本/u, '多一個不在清單上的檔');
  fs.rmSync(path.join(copyDir, 'extra'));
  const cli = tool(src, ['--retire', fp], { home });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stderr, /已退役/u);
  assert.match(cli.stderr, /這一份就是這棵樹現在四個檔的指紋/u, '退役的正是這棵樹現在要用的那一份：要提醒會全擋');
  assert.ok(!fs.existsSync(copyDir), '自洽的那一份刪掉了');
  assert.deepEqual(fs.readdirSync(base64).sort(), [wrongName, 'de1cfb4'].sort(), '別的目錄都還在');
  blocks(hook(lineOf(src), { home, tool: DENIED }), MISMATCH, '退役之後那一行全擋（看得見），不是靜靜放行');
}));

test('⑨參數入口：四種用法不能混用；舊的 --from／--to 照舊', () => {
  assert.deepEqual(parseArgs(['--from', 'a', '--to', '/b']), { mode: 'codex', from: 'a', to: '/b', denyProbe: undefined });
  assert.deepEqual(parseArgs(['--to', '/b', '--deny-probe', 'mcp__x__y', '--from', 'a']), { mode: 'codex', from: 'a', to: '/b', denyProbe: 'mcp__x__y' });
  assert.deepEqual(parseArgs(['--claude']), { mode: 'claude', from: null, denyProbe: undefined });
  assert.deepEqual(parseArgs(['--claude', '--from', 'a', '--deny-probe', 'mcp__x__y']), { mode: 'claude', from: 'a', denyProbe: 'mcp__x__y' });
  assert.deepEqual(parseArgs(['--claude-line']), { mode: 'claude-line' });
  assert.deepEqual(parseArgs(['--retire', 'abc']), { mode: 'retire', retire: 'abc' });
  for (const bad of [[], ['--from', 'a'], ['--to', '/b'], ['--from', 'a', '--from', 'b', '--to', '/c'], ['--from'], ['--nope', 'x'],
    ['--claude', '--to', '/b'], ['--claude', '--from', 'a', '--to', '/b'], ['--claude', '--claude'], ['--claude', '--claude-line'],
    ['--claude-line', '--from', 'a'], ['--claude-line', 'extra'], ['--retire'], ['--retire', 'abc', '--claude'], ['--retire', 'abc', '--from', 'a'], ['--retire', 'a', '--retire', 'b']]) {
    assert.equal(parseArgs(bad), null, `${JSON.stringify(bad)} 要判成用法錯誤`);
  }
  withScratch((scratch) => {
    const src = sourceRepo(scratch);
    const home = fakeHome(scratch);
    for (const args of [['--claude', '--to', path.join(scratch, 'x')], ['--claude-line', 'extra'], ['--retire']]) {
      const r = tool(src, args, { home });
      assert.deepEqual([r.status, r.stdout], [2, ''], `${args.join(' ')}：用法錯誤`);
      assert.match(r.stderr, /用法/u);
    }
    assert.deepEqual(fs.readdirSync(home), [], '用法錯誤什麼都不寫');
  });
});

test('⑩函式換不掉的兩處：指紋比對用 case、設定變更攔截只剩 exit 2——匯入名為 [、case、exit 的函式照樣擋（對照組：比對寫成 [ … ] 時，被改弱的複本真的放行）', (t) => withScratch((scratch) => {
  if (!shIsBash()) { t.skip('這台機器的 /bin/sh 不是 bash：匯入函式（BASH_FUNC_名字%%）是 bash 的做法，這一題的現象做不出來'); return; }
  const { home, fp, copyDir, cmd } = landed(scratch);
  // 把複本的清單改弱（目錄名不變）：指紋對不上，照理退 2
  fs.chmodSync(path.join(copyDir, 'settings.json'), 0o644);
  fs.writeFileSync(path.join(copyDir, 'settings.json'), `${JSON.stringify({ forbidden: LOOSE }, null, 2)}\n`);
  assert.notEqual(fingerprintDir(copyDir), fp, '前提：複本真的被改弱了');
  const bracket = { 'BASH_FUNC_[%%': '() { return 0; }' };
  for (const flag of ['-c', '-lc']) {
    blocks(hook(cmd, { home, flag, tool: DENIED, env: bracket }), MISMATCH, `${flag}：匯入名為 [ 的函式：指紋比對照樣擋`);
  }
  const oldCompare = swap(swap(cmd, 'case "$guard_seen" in "|$fp  -") ;; *) echo', '[ "$guard_seen" = "|$fp  -" ] || { echo'), "' >&2; exit 2;; esac;", "' >&2; exit 2; };");
  blocks(hook(oldCompare, { home, tool: DENIED }), MISMATCH, '對照組的前提：[ … ] 的寫法在乾淨的環境裡也擋');
  allows(hook(oldCompare, { home, tool: DENIED, env: bracket }), '對照組：匯入名為 [ 的函式，[ … ] 的寫法真的把被改弱的複本放行');
  blocks(hook(cmd, { home, tool: DENIED, env: { 'BASH_FUNC_case%%': '() { return 0; }' } }), MISMATCH, '匯入名為 case 的函式（保留字）：照樣擋');

  const change = template().hooks.ConfigChange[0].hooks[0].command;
  const runChange = (cmdText, env) => spawnSync('/bin/sh', ['-c', cmdText], { env: { ...base, HOME: home, ...env }, input: '{}', encoding: 'utf8' });
  assert.equal(runChange(`true; ${change}`, { 'BASH_FUNC_true%%': '() { exit 0; }' }).status, 0, '對照組：同一個環境裡匯入的函式真的會跑（換掉 true 就在 exit 2 之前退 0）');
  assert.equal(runChange(change, { 'BASH_FUNC_exit%%': '() { return 0; }' }).status, 2, '匯入名為 exit 的函式：設定變更攔截那一條照樣退 2（特殊內建）');
}));

test('⑪照實的對照（守不到的）：SHELLOPTS=noexec、匯入的 shell 函式（cd、echo）、PATH 前面放一支假 node＝那一行放行——這一題斷言「放行」，是為了讓文件那句「這一類在那一行裡關不完」有考題撐著；平台或 shell 改版後變成擋得住，這題會紅，提醒改文件', (t) => withScratch((scratch) => {
  const { home, cmd } = landed(scratch);
  // PATH：指紋蓋不到 PATH 找到哪一支 node（不靠 bash）
  const fakeBin = fs.mkdtempSync(path.join(scratch, 'fakebin-'));
  fs.writeFileSync(path.join(fakeBin, 'node'), '#!/bin/sh\ncat >/dev/null\nexit 0\n', { mode: 0o755 });
  denies(hook(cmd, { home, tool: DENIED }), '前提：乾淨的環境照清單擋');
  allows(hook(cmd, { home, tool: DENIED, env: { PATH: `${fakeBin}:${base.PATH}` } }), 'PATH 前面放一支假 node：指紋對、跑的是假 node＝放行（守不到）');
  if (!shIsBash()) { t.skip('這台機器的 /bin/sh 不是 bash：SHELLOPTS 與匯入函式那幾段做不出來（PATH 那一段照跑了）'); return; }

  const empty = fakeHome(scratch);   // 沒有複本的家：乾淨的環境全擋
  for (const flag of ['-c', '-lc']) {
    blocks(hook(cmd, { home: empty, flag, tool: DENIED }), MISMATCH, `${flag} 前提：沒有複本的家，乾淨的環境全擋`);
    allows(hook(cmd, { home: empty, flag, tool: DENIED, env: { SHELLOPTS: 'noexec' } }), `${flag}：SHELLOPTS=noexec＝整行不執行、退 0（守不到）`);
    for (const fn of ['cd', 'echo']) {
      allows(hook(cmd, { home: empty, flag, tool: DENIED, env: { [`BASH_FUNC_${fn}%%`]: '() { exit 0; }' } }), `${flag}：匯入名為 ${fn} 的函式（換成 exit 0）＝退 0（守不到）`);
    }
  }
  const change = template().hooks.ConfigChange[0].hooks[0].command;
  const runChange = (env) => spawnSync('/bin/sh', ['-c', change], { env: { ...base, HOME: empty, ...env }, input: '{}', encoding: 'utf8' }).status;
  assert.equal(runChange({}), 2, '前提：設定變更攔截那一條在乾淨的環境裡退 2');
  assert.equal(runChange({ SHELLOPTS: 'noexec' }), 0, '設定變更攔截那一條：SHELLOPTS=noexec 一樣退 0（守不到）');
}));

test('⑫落地之後用這個家再試跑一次：這個家的登入設定往標準輸出印字＝退 1、這一次落地的那一份撤掉；原本就在的、別的工作階段先落地的不動', (t) => withScratch((scratch) => {
  const src = sourceRepo(scratch);
  const chatty = (home) => { fs.writeFileSync(path.join(home, '.profile'), 'echo PROFILE-SAYS-HELLO\n'); return home; };
  // 先證明這台機器的登入 shell 真的讀假家的 .profile（對照組），不然這一題證明不了什麼
  const probe = spawnSync('/bin/sh', ['-lc', 'true'], { env: { ...base, HOME: chatty(fakeHome(scratch)) }, encoding: 'utf8' });
  if (!probe.stdout.includes('PROFILE-SAYS-HELLO')) { t.skip('這台機器的登入 shell 不讀假家的 .profile：這一題的現象做不出來'); return; }

  const home = chatty(fakeHome(scratch));
  const r = buildClaude({ from: 'HEAD', root: src, home, allowTemp: true });
  assert.match(r.failure || '', /\/bin\/sh -lc：無害的假名一個都沒有被乾淨地放行[\s\S]*PROFILE-SAYS-HELLO/u, `落地之後在這個家試跑要沒過（${r.failure}）`);
  assert.deepEqual([r.existed, r.landedThenFailed, r.withdrawn], [false, true, true]);
  assert.ok(!fs.existsSync(r.copyDir), '這一次落地的那一份要撤掉');
  assert.deepEqual(fs.readdirSync(baseOf(home)), [], '基底目錄裡什麼都沒留（暫存骨架也清掉）');
  const cli = tool(src, ['--claude'], { home });
  assert.deepEqual([cli.status, cli.stdout], [1, ''], `指令入口：退 1、標準輸出空的（${cli.stderr}）`);
  assert.match(cli.stderr, /在這個人的登入設定下試跑沒過：這一次落地的那一份已經撤掉/u);
  assert.deepEqual(fs.readdirSync(baseOf(home)), []);
  blocks(hook(lineOf(src), { home, tool: DENIED }), MISMATCH, '撤掉之後那一行全擋（看得見），不是半套');

  // 對照組：同一份來源、登入設定安靜的家＝照常落地
  const quiet = fakeHome(scratch);
  assert.equal(buildClaude({ from: 'HEAD', root: src, home: quiet, allowTemp: true }).failure, null, '對照組：登入設定安靜時照常落地');

  // 原本就在的那一份（先在安靜時落地、之後登入設定才開始印字）：試跑沒過、退 1，但那一份不動
  const before = snapshot(baseOf(quiet));
  chatty(quiet);
  const existedRun = buildClaude({ from: 'HEAD', root: src, home: quiet, allowTemp: true });
  assert.deepEqual([Boolean(existedRun.failure), existedRun.existed, Boolean(existedRun.landedThenFailed)], [true, true, false]);
  assert.deepEqual(snapshot(baseOf(quiet)), before, '原本就在的那一份：一個位元組都不動');

  // 別的工作階段搶先落地同一份：照「已經在」那條路，沒過也不刪別人的那一份
  const good = landed(scratch);
  const raceHome = chatty(fakeHome(scratch));
  const raced = buildClaude({ from: 'HEAD', root: good.src, home: raceHome, allowTemp: true, beforeLand: (dir) => fs.cpSync(good.copyDir, dir, { recursive: true }) });
  assert.deepEqual([Boolean(raced.failure), raced.existed, Boolean(raced.landedThenFailed)], [true, true, false]);
  assert.deepEqual(fs.readdirSync(baseOf(raceHome)), [good.fp], '別人先落地的那一份還在');
}));

test('⑬改了清單卻沒重印那一行＝靜靜照舊清單判（放行、兩個輸出都空的）；同一刻唯一會紅的是等式題（對照組：那一行換了、沒補複本＝全擋；補了＝照新清單擋）', () => withScratch((scratch) => {
  const { src, home, cmd } = landed(scratch);   // 照原本的清單落地、那一行照原本的清單印
  const NEWLY = 'mcp__other__newly_denied_tool';
  allows(hook(cmd, { home, tool: NEWLY }), '前提：收緊之前這個名字照清單放行');
  const groups = claudeLine(src).groups;
  fs.mkdirSync(path.join(src, '.claude'));
  fs.writeFileSync(path.join(src, '.claude', 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [groups.PreToolUse], ConfigChange: [groups.ConfigChange] } }, null, 2));
  assert.equal(claudePinStatus(src).state, 'ok', '前提：收緊之前等式成立');

  // 收緊清單（把這個名字加進逐字拒絕清單）、提交、當成已合併；那一行沒重印
  const settingsFile = path.join(src, 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  fs.writeFileSync(settingsFile, JSON.stringify({ ...settings, forbidden: { ...settings.forbidden, deny: [...settings.forbidden.deny, NEWLY] } }, null, 2));
  assert.equal(git(src, 'commit', '-qam', 'tighten').status, 0);
  assert.equal(git(src, 'update-ref', 'refs/remotes/origin/main', 'HEAD').status, 0);
  allows(hook(cmd, { home, tool: NEWLY }), '沒重印那一行：照舊指紋找到舊複本、照舊清單放行，兩個輸出都空的（沒有訊號）');
  assert.equal(claudePinStatus(src).state, 'mismatch', '同一刻唯一會紅的：等式題');

  // 對照組：那一行在同一支變更裡換了——這台機器還沒補那一份＝全擋（看得見）；補了＝照新清單擋
  const reprinted = lineOf(src);
  assert.notEqual(reprinted, cmd, '前提：清單改了，重印的那一行真的不同');
  blocks(hook(reprinted, { home, tool: NEWLY }), MISMATCH, '那一行換了、這台機器還沒補那一份＝全擋');
  assert.equal(buildClaude({ from: 'HEAD', root: src, home, allowTemp: true }).failure, null);
  denies(hook(reprinted, { home, tool: NEWLY }), '補了那一份＝照新清單擋');
}));
