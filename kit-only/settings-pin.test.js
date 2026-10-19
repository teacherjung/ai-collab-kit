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
  assert.equal(
    s.scanner.command,
    'node tools/review-launch.js --grok-exec --mode scan --cwd {scanTree} --model {model} --reasoning-effort {effort} --prompt-file {promptFile} --out {outFile}',
    '掃描啟動指令統一走 review-launch.js --grok-exec --mode scan',
  );
  const grokRev = s.reviewers.find((r) => r.participant === 'Grok');
  assert.equal(
    grokRev.command,
    'node tools/review-launch.js --grok-exec --mode review --cwd {reviewTree} --mutation-copy {mutationCopy} --model {model} --reasoning-effort {effort} --prompt-file {promptFile} --out {outFile}',
    'Grok 複審啟動指令統一走 review-launch.js --grok-exec --mode review',
  );
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

test('Grok 隔離執行（--grok-exec）：預設拒絕 Seatbelt、受控認證通道、啟動前預檢與 DLP 正反驗證', { skip: IN_KIT ? false : '不是套件倉庫' }, async () => {
  const net = require('node:net');
  const {
    GROK_SEATBELT_PROFILE,
    GROK_PINNED_ISSUER,
    GROK_PINNED_CLIENT_ID,
    verifyGrokSeatbeltProfile,
    canApplySeatbelt,
    runGrokSeatbeltProbe,
    prepareGrokBoxAuth,
    grokRelayRejectReason,
    startGrokRelay,
    runGrokExec,
  } = require('../tools/review-launch.js');

  // 1. 預設拒絕 Seatbelt 規則靜態與突變檢查（不依賴巢狀 sandbox_apply，在 Codex 複審沙盒與 Linux CI 皆必跑）
  assert.deepEqual(verifyGrokSeatbeltProfile(GROK_SEATBELT_PROFILE), { ok: true });
  assert.equal(verifyGrokSeatbeltProfile(GROK_SEATBELT_PROFILE.replace('(deny default)', '(allow default)')).ok, false, '改為 allow default 必須紅');
  assert.equal(verifyGrokSeatbeltProfile(`${GROK_SEATBELT_PROFILE}\n(allow file-read* (literal "/Users/x/.grok/auth.json"))`).ok, false, '放行 auth.json 必須紅');
  assert.equal(verifyGrokSeatbeltProfile(`${GROK_SEATBELT_PROFILE}\n(allow file-read* (subpath "/opt/homebrew/var"))`).ok, false, '放行 /opt/homebrew/var 必須紅');
  assert.equal(verifyGrokSeatbeltProfile(`${GROK_SEATBELT_PROFILE}\n(allow file-read* (subpath "/Library/Application Support"))`).ok, false, '放行 /Library/Application Support 必須紅');
  assert.equal(verifyGrokSeatbeltProfile(GROK_SEATBELT_PROFILE.replace('(deny file-read* process-exec* (subpath "/usr/local"))', '')).ok, false, '拿掉 /usr/local 拒絕規則必須紅');
  assert.equal(verifyGrokSeatbeltProfile(`${GROK_SEATBELT_PROFILE}\n(allow network-outbound (remote tcp "*:*"))`).ok, false, '放寬外網連線必須紅');

  // 2. 真實憑證維持在盒外（prepareGrokBoxAuth 白名單重建、假權杖與 DLP 針提取）
  const baseDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-grok-pin-')));
  try {
    const authFile = path.join(baseDir, 'auth.json');
    const entryKey = `${GROK_PINNED_ISSUER}::${GROK_PINNED_CLIENT_ID}`;
    const futureIso = new Date(Date.now() + 86400 * 1000).toISOString();
    const rawAuth = {
      [entryKey]: {
        auth_mode: 'oidc',
        user_id: '11111111-2222-3333-4444-555555555555',
        create_time: '2026-10-19T00:00:00.000Z',
        expires_at: futureIso,
        oidc_issuer: GROK_PINNED_ISSUER,
        oidc_client_id: GROK_PINNED_CLIENT_ID,
        key: 'SYNTHETIC-REAL-BEARER-SECRET-9999',
        refresh_token: 'SYNTHETIC-REFRESH-TOKEN-SECRET-8888',
        email: 'secret-owner@example.com',
        principal_type: 'user',
      },
    };
    fs.writeFileSync(authFile, JSON.stringify(rawAuth, null, 2), { mode: 0o600 });
    const prepared = await prepareGrokBoxAuth(authFile);
    assert.equal(prepared.realBearer, 'SYNTHETIC-REAL-BEARER-SECRET-9999');
    assert.match(prepared.dummyBearer, /^DUMMY-SCAN-TOKEN-[0-9a-f]{48}$/u);
    const boxCred = prepared.forBox[entryKey];
    assert.equal(boxCred.key, prepared.dummyBearer, '盒內 auth.json 僅含假權杖');
    assert.equal(boxCred.refresh_token, undefined, '盒內 auth.json 不含 refresh_token');
    assert.equal(boxCred.email, undefined, '盒內 auth.json 不含 email');
    assert.ok(prepared.needles.includes('SYNTHETIC-REAL-BEARER-SECRET-9999'), '真實 key 納入 DLP 針');
    assert.ok(prepared.needles.includes('SYNTHETIC-REFRESH-TOKEN-SECRET-8888'), 'refresh_token 納入 DLP 針');
    assert.ok(prepared.needles.includes('secret-owner@example.com'), 'email 納入 DLP 針');

    // 3. 受控認證通道（端點白名單、假權杖驗證與真權杖代換）
    assert.equal(grokRelayRejectReason({ method: 'POST', url: '/v1/responses', headers: { authorization: `Bearer ${prepared.dummyBearer}` } }, prepared.dummyBearer), null);
    assert.equal(grokRelayRejectReason({ method: 'POST', url: '/v1/responses', headers: { authorization: 'Bearer WRONG' } }, prepared.dummyBearer).code, 'auth');
    assert.equal(grokRelayRejectReason({ method: 'POST', url: '/v1/files', headers: { authorization: `Bearer ${prepared.dummyBearer}` } }, prepared.dummyBearer).code, 'shape');
    assert.equal(grokRelayRejectReason({ method: 'GET', url: 'https://evil.example/v1/models', headers: { authorization: `Bearer ${prepared.dummyBearer}` } }, prepared.dummyBearer).code, 'bad-target');

    let seenUpstreamAuth = null;
    let seenUpstreamHost = null;
    const relay = await startGrokRelay({
      realBearer: prepared.realBearer,
      dummyBearer: prepared.dummyBearer,
      requestImpl: (opts, cb) => {
        seenUpstreamAuth = opts.headers.authorization;
        seenUpstreamHost = opts.headers.host;
        const { PassThrough } = require('node:stream');
        const reqStream = new PassThrough();
        const resStream = new PassThrough();
        resStream.statusCode = 200;
        resStream.headers = { 'content-type': 'application/json' };
        process.nextTick(() => {
          cb(resStream);
          resStream.end('{"ok":true}');
        });
        return reqStream;
      },
    });
    try {
      const okRes = await fetch(`http://127.0.0.1:${relay.port}/v1/models`, {
        headers: { authorization: `Bearer ${prepared.dummyBearer}` },
      });
      assert.equal(okRes.status, 200);
      assert.equal(seenUpstreamAuth, 'Bearer SYNTHETIC-REAL-BEARER-SECRET-9999', '轉送器在盒外代換為真實權杖');
      assert.equal(seenUpstreamHost, 'cli-chat-proxy.grok.com');

      const tolRes = await fetch(`http://127.0.0.1:${relay.port}/`);
      assert.equal(tolRes.status, 403);
      assert.equal(relay.toleratedRefusals.length, 1);
      assert.equal(relay.blockingRefusals.length, 0);

      const badRes = await fetch(`http://127.0.0.1:${relay.port}/v1/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${prepared.dummyBearer}` },
      });
      assert.equal(badRes.status, 403);
      assert.equal(relay.blockingRefusals.length, 1, '非白名單端點記入阻擋拒絕');
    } finally {
      await relay.close();
    }

    // 4. 由 settings.json 的 scanner.command 與 Grok.command 實際展開參數送入 runGrokExec，驗預檢失敗拒啟、DLP 攔截、工作樹污染攔截與正常執行
    const { substitute, splitCommandArgs } = require('../tools/review-launch.js');
    const s = read();
    const grokRev = s.reviewers.find((r) => r.participant === 'Grok');
    const treeDir = path.join(baseDir, 'tree');
    const mutDir = path.join(baseDir, 'mutation');
    const promptFile = path.join(baseDir, 'prompt.md');
    const outFile = path.join(baseDir, 'output.log');
    fs.mkdirSync(treeDir);
    fs.mkdirSync(mutDir);
    spawnSync('git', ['init', '-q', treeDir]);
    spawnSync('git', ['-C', treeDir, 'config', 'user.name', 'test']);
    spawnSync('git', ['-C', treeDir, 'config', 'user.email', 'test@localhost']);
    fs.writeFileSync(path.join(treeDir, 'a.txt'), 'hello\n');
    spawnSync('git', ['-C', treeDir, 'add', 'a.txt']);
    spawnSync('git', ['-C', treeDir, 'commit', '-q', '-m', 'init']);
    spawnSync('git', ['clone', '--quiet', treeDir, mutDir]);
    fs.writeFileSync(promptFile, `請檢查 ${treeDir}\n`);

    const scanArgv = splitCommandArgs(substitute(s.scanner.command, {
      scanTree: treeDir,
      model: s.scanner.strongest,
      effort: s.scanner.maxEffort,
      promptFile,
      outFile,
    }, 'scanner.command').text, 'scanner.command');
    assert.deepEqual(scanArgv.slice(0, 3), ['node', 'tools/review-launch.js', '--grok-exec'], 'scanner.command 必須經由 node tools/review-launch.js --grok-exec 啟動');
    const baseArgs = scanArgv.slice(3);

    const revArgv = splitCommandArgs(substitute(grokRev.command, {
      reviewTree: treeDir,
      mutationCopy: mutDir,
      model: grokRev.strongest,
      effort: grokRev.maxEffort,
      promptFile,
      outFile,
    }, 'Grok.command').text, 'Grok.command');
    assert.deepEqual(revArgv.slice(0, 3), ['node', 'tools/review-launch.js', '--grok-exec'], 'Grok.command 必須經由 node tools/review-launch.js --grok-exec 啟動');

    // 4a. 預檢失敗時拒絕啟動（不跑 grok、不寫 outFile）
    let grokCalled = false;
    const failProbeRun = await runGrokExec(baseArgs, {
      authFile,
      probeFn: () => ({ ok: false, reason: '模擬預檢失敗' }),
      spawnGrok: async () => { grokCalled = true; return { status: 0, stdout: '🔍 Grok｜來源：Grok CLI｜掃 `1234567`\n- 零發現\n', stderr: '' }; },
    });
    assert.equal(failProbeRun.code, 2);
    assert.equal(grokCalled, false, '預檢失敗時不可啟動 Grok');
    assert.equal(fs.existsSync(outFile), false);

    // 4b. DLP 攔截（輸出含真實憑證或私密欄位時拒絕寫出）
    const dlpRun = await runGrokExec(baseArgs, {
      authFile,
      probeFn: () => ({ ok: true }),
      spawnGrok: async () => ({ status: 0, stdout: '🔍 Grok｜來源：Grok CLI｜掃 `1234567`\n外流 SYNTHETIC-REFRESH-TOKEN-SECRET-8888\n', stderr: '' }),
    });
    assert.equal(dlpRun.code, 2);
    assert.equal(fs.existsSync(outFile), false, 'DLP 攔截時不可寫出 outFile');

    // 4c. 盒內工作樹被改動時拒絕寫出
    const dirtyRun = await runGrokExec(baseArgs, {
      authFile,
      probeFn: () => ({ ok: true }),
      spawnGrok: async ({ boxWorktree }) => {
        fs.writeFileSync(path.join(boxWorktree, 'dirty.txt'), 'x');
        return { status: 0, stdout: '🔍 Grok｜來源：Grok CLI｜掃 `1234567`\n- 零發現\n', stderr: '' };
      },
    });
    assert.equal(dirtyRun.code, 2);
    assert.equal(fs.existsSync(outFile), false, '盒內工作樹不乾淨時不可寫出 outFile');

    // 4d. 正常隔離執行：盒內 auth.json 無真憑證、boxPromptFile 已改寫為盒內路徑、執行後自動清除 boxDir
    let capturedBoxDir = null;
    const okRun = await runGrokExec(baseArgs, {
      authFile,
      probeFn: () => ({ ok: true }),
      spawnGrok: async ({ boxDir, boxWorktree, boxPromptFile, env }) => {
        capturedBoxDir = boxDir;
        const boxAuthText = fs.readFileSync(path.join( env.HOME, '.grok', 'auth.json'), 'utf8');
        assert.ok(!boxAuthText.includes('SYNTHETIC-REAL-BEARER-SECRET-9999'), '盒內 auth.json 絕不含真實 key');
        assert.ok(!boxAuthText.includes('SYNTHETIC-REFRESH-TOKEN-SECRET-8888'), '盒內 auth.json 絕不含 refresh_token');
        assert.ok(boxAuthText.includes('DUMMY-SCAN-TOKEN-'), '盒內 auth.json 僅含假權杖');
        const boxPrompt = fs.readFileSync(boxPromptFile, 'utf8');
        assert.ok(boxPrompt.includes(boxWorktree) && !boxPrompt.includes(treeDir), '盒內提示檔已改寫為盒內隔離路徑');
        return { status: 0, stdout: '🔍 Grok｜來源：Grok CLI｜掃 `1234567`\n- 零發現\n', stderr: '' };
      },
    });
    assert.equal(okRun.code, 0);
    assert.match(fs.readFileSync(outFile, 'utf8'), /^🔍 Grok｜來源：Grok CLI｜掃 `1234567`/u);
    assert.equal(fs.existsSync(capturedBoxDir), false, '執行結束後自動清除隔離盒目錄');

    // 5. 若當前環境允許套用 Seatbelt（宿主機實跑），額外執行核心層級預檢探針（含阻擋宿主 auth.json、未列名本機路徑與非轉送器連接埠）
    if (canApplySeatbelt()) {
      const dummyServer = net.createServer();
      await new Promise((r) => dummyServer.listen(0, '127.0.0.1', r));
      const unallowedPort = dummyServer.address().port;
      const liveBox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-grok-live-sb-')));
      try {
        const probeRes = runGrokSeatbeltProbe({
          boxDir: liveBox,
          relayPort: unallowedPort + 1 > 65535 ? unallowedPort - 1 : unallowedPort + 1,
          authFile,
          unallowedPort,
        });
        assert.deepEqual(probeRes, { ok: true }, '核心層級 Seatbelt 探針應攔截宿主 auth.json、$HOME、未列名路徑與非轉送器連接埠');
      } finally {
        dummyServer.close();
        fs.rmSync(liveBox, { recursive: true, force: true });
      }
    } else {
      const blockedProbe = runGrokSeatbeltProbe({ boxDir: baseDir, relayPort: 54321, authFile });
      assert.equal(blockedProbe.ok, false, '無法套用 Seatbelt 時預檢必須拒絕啟動');
    }
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
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
