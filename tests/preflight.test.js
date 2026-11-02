// 守開工與送審前體檢總表（tools/preflight.js）：
//   ①參數解析：不給編號＝開工前模式（待裁、待辦、下游落後、AI 座位 4 項）；給編號＝送審前模式（加跑舊文字掃描與風險分級共 6 項）；
//     支援 --base、--skip-downstream、--skip-seats；不認得的旗標或多給位置參數＝退 2；
//   ②總退出碼：全部子項目退 0 才退 0；任一子項目退非 0（或拋錯）時總退出碼為 2，但後續子項目仍照常跑完印出；
//   ③AI 座位體檢（checkSeats）：從 reviewers 與 scanner 收集座位、辨識一般指令與 --grok-exec 沙盒指令；
//     只驗執行檔與 Grok 盒外 auth.json 一般檔案存在（連結檔不算），絕不讀取或輸出 auth.json 裡的私密內容；
//   ④真的跑一遍指令（空白設定的複本）：設定未填時退 2；
//   ⑤真 CLI 長輸出經管線與普通檔案 fd 逐位元組一致（避免超過 64 KiB 管線緩衝未排空即截斷尾段），且 EPIPE 退 2。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gitEnv } = require('../tools/git-env.js');
const { run, parseArgs, checkOpenChanges, checkSeats, probeSeats, summarizeProbeFailure, extractCommandSpec, defaultWhich } = require('../tools/preflight.js');
const { runInCopy, unfilled } = require('./helpers/kit-copy.js');

test('① parseArgs 與 extractCommandSpec：合法參數與壞參數分類', () => {
  assert.deepEqual(parseArgs([]), { change: undefined, base: undefined, skipDownstream: false, skipSeats: false });
  assert.deepEqual(parseArgs(['115', '--base', 'origin/main', '--skip-downstream', '--skip-seats']), {
    change: '115',
    base: 'origin/main',
    skipDownstream: true,
    skipSeats: true,
  });
  assert.deepEqual(parseArgs(['--probe']), { change: undefined, base: undefined, skipDownstream: false, skipSeats: false, probe: '*' });
  assert.deepEqual(parseArgs(['--probe', 'Codex']), { change: undefined, base: undefined, skipDownstream: false, skipSeats: false, probe: 'Codex' });
  assert.deepEqual(parseArgs(['134', '--probe=Grok']), { change: '134', base: undefined, skipDownstream: false, skipSeats: false, probe: 'Grok' });
  for (const bad of [['--base'], ['--base', '--skip-seats'], ['--unknown'], ['1', '2'], ['--probe='], ['--probe', '--skip-seats']]) {
    assert.ok(parseArgs(bad).error, `應拒收壞參數：${bad.join(' ')}`);
    assert.equal(run(bad).code, 2);
  }
  assert.deepEqual(extractCommandSpec('codex exec --cd {reviewTree}'), { bin: 'codex', usesGrokExec: false });
  assert.deepEqual(extractCommandSpec('cd {reviewTree} && claude -p --model {model}'), { bin: 'claude', usesGrokExec: false });
  assert.deepEqual(extractCommandSpec('cd {scanTree} && GEMINI_EFFORT={effort} gemini -p -m {model}'), { bin: 'gemini', usesGrokExec: false });
  assert.deepEqual(extractCommandSpec('/custom/dir/gemini -p'), { bin: '/custom/dir/gemini', usesGrokExec: false });
  assert.deepEqual(extractCommandSpec('cd {reviewTree}'), { bin: null, usesGrokExec: false });
  assert.deepEqual(extractCommandSpec('node tools/review-launch.js --grok-exec --mode scan --cwd {scanTree}'), { bin: 'grok', usesGrokExec: true });
  assert.deepEqual(extractCommandSpec('未設定'), { bin: null, usesGrokExec: false });
});

test('② 開工前模式（4 項）與送審前模式（6 項）：串接各子工具，任一項非 0 時總退出碼為 2 但其餘照跑', () => {
  const called = [];
  const fakeRunners = (failId = null) => ({
    pendingRulings: () => { called.push('pending'); return { code: failId === 'pending' ? 2 : 0, lines: ['pending-line'] }; },
    backlogTouch: ({ argv }) => { called.push(`backlog:${argv.join(' ')}`); return { code: 0, lines: ['backlog-line'] }; },
    downstreamLag: () => { called.push('downstream'); return { code: failId === 'downstream' ? 2 : 0, lines: ['downstream-line'] }; },
    staleText: (argv) => { called.push(`stale:${argv.join(' ')}`); return { code: 0, lines: ['stale-line'] }; },
    riskTier: (id) => { called.push(`risk:${id}`); return { code: 0, lines: [`risk-line-${id}`] }; },
    seats: () => { called.push('seats'); return { code: 0, lines: ['seats-line'] }; },
  });

  // (a) 開工前模式：跑 4 項
  const preWork = run(['--base', 'HEAD~1'], { runners: fakeRunners() });
  assert.equal(preWork.code, 0);
  assert.deepEqual(called, ['pending', 'backlog:--base HEAD~1', 'downstream', 'seats']);
  assert.match(preWork.lines.join('\n'), /開工前模式｜共 4 項/u);

  // (b) 送審前模式：跑 6 項
  called.length = 0;
  const preReview = run(['115', '--base', 'HEAD~1'], { runners: fakeRunners() });
  assert.equal(preReview.code, 0);
  assert.deepEqual(called, ['pending', 'backlog:--base HEAD~1', 'downstream', 'stale:--base HEAD~1', 'risk:115', 'seats']);
  assert.match(preReview.lines.join('\n'), /送審前模式（變更 115）｜共 6 項/u);

  // (c) 中途有子工具退 2 時，後面子工具仍照跑，且總退出碼為 2
  called.length = 0;
  const partialFail = run(['--skip-seats'], { runners: fakeRunners('pending') });
  assert.equal(partialFail.code, 2);
  assert.deepEqual(called, ['pending', 'backlog:', 'downstream']);

  // (d) 中途有子工具拋錯時，該節記為退 2、總退出碼為 2，且後面子工具仍照跑（r4 Finding 1）
  called.length = 0;
  const thrownRun = run(['--skip-seats'], {
    runners: {
      ...fakeRunners(),
      pendingRulings: () => { called.push('pending-throw'); throw new Error('子工具炸了'); },
    },
  });
  assert.equal(thrownRun.code, 2);
  assert.equal(thrownRun.sections[0].code, 2);
  assert.match(thrownRun.lines.join('\n'), /未預期錯誤（子工具炸了）——算不出來/u);
  assert.deepEqual(called, ['pending-throw', 'backlog:', 'downstream']);

  // (e) 中途有子工具回傳壞形狀時，該節記為退 2、總退出碼為 2，且後面子工具仍照跑
  called.length = 0;
  const badShapeRun = run(['--skip-seats'], {
    runners: {
      ...fakeRunners(),
      pendingRulings: () => { called.push('pending-null'); return null; },
    },
  });
  assert.equal(badShapeRun.code, 2);
  assert.equal(badShapeRun.sections[0].code, 2);
  assert.match(badShapeRun.lines.join('\n'), /回傳格式不對——算不出來/u);
  assert.deepEqual(called, ['pending-null', 'backlog:', 'downstream']);
});

test('③ checkSeats 與 defaultWhich：4 家 AI 座位檢核、保留明確路徑、同人雙角色命令聯集，且盒外憑證只 lstatSync 絕不讀取或輸出內容', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ack-preflight-test-'));
  try {
    const binDir = path.join(tmp, 'bin');
    fs.mkdirSync(binDir);
    for (const name of ['claude', 'codex', 'gemini', 'grok']) {
      const p = path.join(binDir, name);
      fs.writeFileSync(p, '#!/bin/sh\n', { mode: 0o755 });
    }
    assert.equal(defaultWhich('codex', { env: { PATH: binDir }, homedir: tmp }), path.join(binDir, 'codex'));
    assert.equal(defaultWhich('no-such-cli', { env: { PATH: binDir }, homedir: tmp }), null);
    assert.equal(defaultWhich(path.join(tmp, 'no-such-dir', 'gemini'), { env: { PATH: binDir }, homedir: tmp }), null, '帶明確路徑時只查該路徑，不拿 PATH 同名檔冒充');

    const secretMarker = 'SUPER-SECRET-GROK-BEARER-DO-NOT-READ';
    const grokDir = path.join(tmp, '.grok');
    const grokBinDir = path.join(grokDir, 'bin');
    fs.mkdirSync(grokBinDir, { recursive: true });
    const grokFixedBin = path.join(grokBinDir, 'grok');
    fs.writeFileSync(grokFixedBin, '#!/bin/sh\n', { mode: 0o755 });
    const authFile = path.join(grokDir, 'auth.json');
    fs.writeFileSync(authFile, JSON.stringify({ key: secretMarker }), { mode: 0o600 });

    let lstatCalls = 0;
    let readCalls = 0;
    const denyRead = (target) => {
      if (String(target) === authFile) readCalls += 1;
      throw new Error(`禁止讀取憑證檔內容：${target}`);
    };
    const spyFs = {
      ...fs,
      lstatSync: (p, ...rest) => {
        if (String(p) === authFile) lstatCalls += 1;
        return fs.lstatSync(p, ...rest);
      },
      readFileSync: denyRead,
      readFile: denyRead,
      openSync: denyRead,
      open: denyRead,
      createReadStream: denyRead,
    };

    const settings = {
      defaultDivision: { implementer: 'Gemini', reviewer: 'Codex' },
      reviewers: [
        { participant: 'Claude', source: 'Claude Code', strongest: 'claude-opus-4-7', maxEffort: 'xhigh', command: 'claude -p' },
        { participant: 'Codex', source: 'Codex CLI', strongest: 'gpt-5.4', maxEffort: 'xhigh', command: 'codex exec' },
        { participant: 'Gemini', source: 'Gemini CLI', strongest: 'gemini-3.1-pro-preview', maxEffort: 'high', command: 'gemini -p' },
        { participant: 'Grok', source: 'Grok CLI', strongest: 'grok-4.7', maxEffort: 'xhigh', command: 'node tools/review-launch.js --grok-exec --mode review' },
      ],
      scanner: {
        participant: 'Grok',
        tool: 'Grok CLI',
        source: 'Grok CLI',
        strongest: 'grok-4.7',
        maxEffort: 'xhigh',
        command: 'node tools/review-launch.js --grok-exec --mode scan',
      },
    };

    const okRes = checkSeats(settings, {
      which: (b) => defaultWhich(b, { env: { PATH: binDir }, homedir: tmp, fsImpl: spyFs }),
      authFile,
      fsImpl: spyFs,
    });
    assert.equal(okRes.code, 0);
    assert.equal(okRes.seats.length, 4);
    assert.ok(okRes.seats.every((s) => s.ok), '4 家 CLI 與 Grok auth.json 皆就緒');
    assert.equal(okRes.seats.find((s) => s.participant === 'Grok').binPath, grokFixedBin, '--grok-exec 座位對應 ~/.grok/bin/grok 固定執行檔');
    assert.ok(lstatCalls > 0, '有執行 lstatSync 檢查狀態');
    assert.equal(readCalls, 0, '絕不呼叫任何檔案讀取 API 讀取 auth.json 內容');
    assert.equal(okRes.lines.join('\n').includes(secretMarker), false, '絕不可讀取或印出 auth.json 內的憑證內容');

    // --grok-exec 座位固定走 ~/.grok/bin/grok：即使 PATH 有同名 grok，固定執行檔缺席仍必須報未就緒（r2 Finding 1）
    const missingFixedGrokBinRes = checkSeats(settings, {
      which: (b) => defaultWhich(b, { env: { PATH: binDir }, homedir: tmp }),
      authFile,
      grokBin: path.join(tmp, 'missing-grok-home', '.grok', 'bin', 'grok'),
    });
    const missingFixedGrokSeat = missingFixedGrokBinRes.seats.find((s) => s.participant === 'Grok');
    assert.equal(missingFixedGrokSeat.binPath, null, '~/.grok/bin/grok 不存在時不可被 PATH 同名 grok 假綠');
    assert.equal(missingFixedGrokSeat.ok, false);

    // 指定了不存在的絕對路徑時，即使 PATH 有同名 gemini 也必須報未就緒（Finding 2）
    const badPathRes = checkSeats({
      ...settings,
      reviewers: [
        { participant: 'Gemini', source: 'Gemini CLI', strongest: 'gemini-3.1-pro-preview', maxEffort: 'high', command: `${path.join(tmp, 'no-such-dir', 'gemini')} -p` },
      ],
      scanner: { tool: '無' },
    }, {
      which: (b) => defaultWhich(b, { env: { PATH: binDir }, homedir: tmp }),
      authFile,
    });
    assert.equal(badPathRes.seats[0].ok, false, '明確路徑不存在時不可因 PATH 同名執行檔而報就緒');

    // 同一參與者複審用一般指令（grok -p）、掃描用 --grok-exec 時，仍必須檢查盒外憑證檔（Finding 3）
    const splitRoleRes = checkSeats({
      defaultDivision: { implementer: 'Gemini', reviewer: 'Grok' },
      reviewers: [
        { participant: 'Grok', source: 'Grok CLI', strongest: 'grok-4.7', maxEffort: 'xhigh', command: 'grok -p' },
      ],
      scanner: {
        participant: 'Grok',
        tool: 'Grok CLI',
        source: 'Grok CLI',
        strongest: 'grok-4.7',
        maxEffort: 'xhigh',
        command: 'node tools/review-launch.js --grok-exec --mode scan',
      },
    }, {
      which: (b) => defaultWhich(b, { env: { PATH: binDir }, homedir: tmp }),
      authFile: path.join(tmp, 'missing-auth.json'),
    });
    assert.equal(splitRoleRes.seats[0].usesGrokExec, true, '同名座位其中一角走 --grok-exec 時必須驗憑證檔');
    assert.equal(splitRoleRes.seats[0].authReady, false);
    assert.equal(splitRoleRes.seats[0].ok, false);

    // 符號連結的 auth.json 不算一般檔案
    const linkAuth = path.join(tmp, 'link-auth.json');
    fs.symlinkSync(authFile, linkAuth);
    const linkRes = checkSeats(settings, {
      which: (b) => defaultWhich(b, { env: { PATH: binDir }, homedir: tmp }),
      authFile: linkAuth,
    });
    const grokSeat = linkRes.seats.find((s) => s.participant === 'Grok');
    assert.equal(grokSeat.authReady, false);
    assert.equal(grokSeat.ok, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('④ 真的跑一遍指令（空白設定的複本）：設定未填，退 2', () => {
  assert.equal(runInCopy('tools/preflight.js', ['--skip-downstream', '--skip-seats']).status, 2);
});

test('⑤ 真 CLI 長輸出經管線與普通檔案 fd 逐位元組一致；成功退 0、管線寫入錯誤（EPIPE）退 2', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-pipe-'));
  try {
    const kitRoot = path.join(__dirname, '..');
    fs.cpSync(path.join(kitRoot, 'tools'), path.join(dir, 'tools'), { recursive: true });
    fs.copyFileSync(path.join(kitRoot, 'rules.json'), path.join(dir, 'rules.json'));
    const env = gitEnv();
    delete env.NODE_TEST_CONTEXT;
    spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir, env });
    spawnSync('git', ['config', 'user.email', 't@e.st'], { cwd: dir, env });
    spawnSync('git', ['config', 'user.name', 'T'], { cwd: dir, env });
    fs.writeFileSync(path.join(dir, 'BACKLOG.md'), '# 待辦\n\n- 哨兵待辦項目（TAIL_BACKLOG_SENTINEL_9999）｜settings.json｜當動到設定時\n');
    spawnSync('git', ['add', 'BACKLOG.md', 'tools/preflight.js'], { cwd: dir, env });
    spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, env });
    spawnSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: dir, env });

    const comments = Array.from({ length: 1200 }, (_, i) => ({
      id: String(100000 + i),
      author: 'ai-acct',
      createdAt: new Date(Date.UTC(2026, 8, 13, 0, Math.floor(i / 60), i % 60)).toISOString(),
      change: String((i % 20) + 1),
      body: `## ❓ 待裁（2026-09-13）：體檢總表長輸出管線完整性第 ${String(i + 1).padStart(4, '0')} 題（避免超過 64 KiB 管線緩衝未排空即 process.exit 截斷尾段）\n選項：甲／乙\n建議：甲`,
    }));
    fs.writeFileSync(path.join(dir, 'comments.json'), JSON.stringify(comments));
    fs.writeFileSync(path.join(dir, 'dump-comments.js'), "const fs = require('node:fs'); process.stdout.write(fs.readFileSync('comments.json'));\n");
    const baseSettings = unfilled();
    const settings = {
      ...baseSettings,
      owner: 'Boss',
      participants: [
        { role: '裁示者（人）', id: 'Boss', account: 'boss-acct' },
        { role: 'AI 甲', id: 'Alpha', account: 'ai-acct' },
      ],
      mainBranch: 'main',
      backlog: { file: 'BACKLOG.md', section: '# 待辦' },
      platform: {
        ...baseSettings.platform,
        name: 'Fake',
        project: 'fake/repo',
        clearEnv: [],
        operations: {
          ...baseSettings.platform.operations,
          allComments: [process.execPath, 'dump-comments.js'],
        },
      },
    };
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings));
    const cli = path.join(dir, 'tools/preflight.js');
    const cliArgs = ['--skip-downstream', '--skip-seats'];

    // 1. 普通檔案 fd 對照組
    const outFile = path.join(dir, 'out.txt');
    const fd = fs.openSync(outFile, 'w');
    let fileRes;
    try {
      fileRes = spawnSync(process.execPath, [cli, ...cliArgs], { cwd: dir, env, stdio: ['ignore', fd, 'pipe'] });
    } finally {
      fs.closeSync(fd);
    }
    assert.equal(fileRes.status, 0, fileRes.stderr && fileRes.stderr.toString('utf8'));
    const fileBytes = fs.readFileSync(outFile);
    assert.ok(fileBytes.length > 65536 * 2, `合成輸出需明顯大於 64 KiB 管線緩衝（實際 ${fileBytes.length} 位元組）`);
    const fileText = fileBytes.toString('utf8');
    assert.match(fileText, /體檢總表長輸出管線完整性第 1200 題/u);
    assert.match(fileText, /=== \[2\/2\] 開工印待辦（F6） ===/u, '檔案輸出尾端需含最後一節開工印待辦');
    assert.match(fileText, /TAIL_BACKLOG_SENTINEL_9999/u, '檔案輸出尾端需含待辦哨兵');

    // 2. 管線（pipe）輸出：必須與普通檔案 fd 逐位元組完全一致，不可在 65,536 位元組處截斷尾段
    const pipeRes = spawnSync(process.execPath, [cli, ...cliArgs], {
      cwd: dir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    assert.equal(pipeRes.status, 0, pipeRes.stderr && pipeRes.stderr.toString('utf8'));
    assert.equal(pipeRes.stdout.length, fileBytes.length, `管線輸出位元組數（${pipeRes.stdout.length}）與檔案 fd（${fileBytes.length}）不一致`);
    assert.equal(Buffer.compare(pipeRes.stdout, fileBytes), 0, '管線輸出與檔案 fd 必須逐位元組完全相同');
    assert.match(pipeRes.stdout.toString('utf8'), /=== \[2\/2\] 開工印待辦（F6） ===/u, '管線輸出不得丟失末尾待辦節');
    assert.match(pipeRes.stdout.toString('utf8'), /TAIL_BACKLOG_SENTINEL_9999/u, '管線輸出不得丟失末尾待辦哨兵');

    // 3. 下游提早關閉管線（EPIPE）：必須退 2，不可假綠退 0 或未處理錯誤退 1
    const epipeExit = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...cliArgs], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let errOut = '';
      child.stderr.on('data', (chunk) => { errOut += chunk.toString('utf8'); });
      child.stdout.once('data', () => { child.stdout.destroy(); });
      child.on('error', reject);
      child.on('close', (code, signal) => resolve({ code, signal, errOut }));
    });
    assert.equal(epipeExit.signal, null);
    assert.equal(epipeExit.code, 2, `下游提早關閉管線（EPIPE）應退 2（實際 code=${epipeExit.code}, stderr=${epipeExit.errOut}）`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('⑥ C1 開啟支數提醒（checkOpenChanges）與 AI 座位十秒點火試跑（probeSeats / --probe）', async () => {
  // 1. checkOpenChanges：0 支、1 支（未達上限）、>=2 支（含草稿印 C1 黃燈提醒，只列不擋退 0）、平台失敗退 2，且呼叫簽章為 ask('openChanges', {}, { settings })
  let askCall = null;
  const fakeSettings = { platform: { project: 'fake/repo' } };
  const zeroOpen = checkOpenChanges({
    settings: fakeSettings,
    platform: {
      ask: (opName, args, opts) => {
        askCall = { opName, args, opts };
        return [];
      },
    },
  });
  assert.equal(zeroOpen.code, 0);
  assert.equal(askCall.opName, 'openChanges');
  assert.deepEqual(askCall.args, {});
  assert.equal(askCall.opts.settings, fakeSettings);
  assert.match(zeroOpen.lines[0], /目前開啟 0 支（未達 2 支上限；只列不擋）/u);

  const oneOpen = checkOpenChanges({ platform: { ask: () => [{ id: '134', isDraft: true }] } });
  assert.equal(oneOpen.code, 0);
  assert.match(oneOpen.lines[0], /目前開啟 1 支（#134（草稿））（未達 2 支上限；只列不擋）/u);

  const twoOpen = checkOpenChanges({
    platform: { ask: () => [{ id: '134', isDraft: false }, { id: '135', isDraft: true }] },
  });
  assert.equal(twoOpen.code, 0);
  assert.match(twoOpen.lines[0], /⚠️ 目前已開啟 2 支（#134、#135（草稿）），已達或超過 C1/u);

  const errOpen = checkOpenChanges({ platform: { ask: () => { throw new Error('網路斷線'); } } });
  assert.equal(errOpen.code, 2);
  assert.match(errOpen.lines[0], /問不到平台開啟中變更清單（網路斷線）——算不出來/u);

  // 2. probeSeats：成功輸出經 prepareVerdict 核驗通過、失敗輸出固定白名單分類且不洩漏短權杖或個資、指定未知座位退 2
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ack-probe-unit-'));
  try {
    const binDir = path.join(tmp, 'bin');
    fs.mkdirSync(binDir);
    for (const name of ['codex', 'claude']) {
      fs.writeFileSync(path.join(binDir, name), '#!/bin/sh\n', { mode: 0o755 });
    }
    const settings = {
      participants: [
        { role: '裁示者（人）', id: 'Boss', account: 'boss' },
        { role: 'AI 甲', id: 'Codex', account: 'ai' },
        { role: 'AI 乙', id: 'Claude', account: 'ai' },
      ],
      defaultDivision: { implementer: 'Claude', reviewer: 'Codex' },
      platform: { project: 'fake/repo' },
      reviewers: [
        {
          participant: 'Codex',
          source: 'codex CLI',
          strongest: 'gpt-6-astra',
          maxEffort: 'max',
          command: 'codex exec -m {model} -c model_reasoning_effort=\'"max"\' -C {reviewTree} -o {outFile} - < {promptFile}',
        },
        {
          participant: 'Claude',
          source: 'Claude CLI',
          strongest: 'claude-fable-5-1',
          maxEffort: 'max',
          command: 'cd {reviewTree} && claude -p "$(cat {promptFile})" --model {model} --effort {effort} --verbose --output-format json > {outFile}',
        },
      ],
      scanner: { tool: '無' },
    };

    const which = (b) => defaultWhich(b, { env: { PATH: binDir }, homedir: tmp });

    // (a) 指定不存在的座位應退 2
    const unknownSeat = probeSeats(settings, { seatFilter: 'NoSuchAI', which });
    assert.equal(unknownSeat.code, 2);
    assert.match(unknownSeat.lines[0], /找不到已登記的座位「NoSuchAI」/u);

    // (b) Codex 點火通過（提取 prompt 內的標準標頭寫入 outFile）、Claude 點火失敗（含 email 與短敏感值，確認白名單摘要完全不回顯原始敏感值，N4）
    const probeRes = probeSeats(settings, {
      seatFilter: '*',
      which,
      spawnSyncImpl: (_bin, args) => {
        const cmdStr = args[1];
        const outMatch = /-o\s+([^\s]+)\s+-|(?:>\s*([^\s]+)$)/u.exec(cmdStr);
        const promptMatch = /<\s*([^\s]+)$|\$\(cat\s+([^)]+)\)/u.exec(cmdStr);
        const outFile = outMatch && (outMatch[1] || outMatch[2]);
        const promptFile = promptMatch && (promptMatch[1] || promptMatch[2]);
        if (cmdStr.includes('codex exec')) {
          const promptLines = fs.readFileSync(promptFile, 'utf8').split('\n').slice(1);
          fs.writeFileSync(outFile, promptLines.join('\n'));
          return { status: 0, stdout: '', stderr: '' };
        }
        fs.writeFileSync(outFile, JSON.stringify([
          { type: 'system', subtype: 'init' },
          {
            type: 'result',
            is_error: true,
            result: 'OAuth session expired for privateperson@example.invalid; refresh_token=private123',
          },
        ]));
        return { status: 1, stdout: '', stderr: '' };
      },
    });
    assert.equal(probeRes.code, 0);
    assert.equal(probeRes.probes.length, 2);
    assert.equal(probeRes.probes[0].participant, 'Codex');
    assert.equal(probeRes.probes[0].ok, true);
    assert.equal(probeRes.probes[1].participant, 'Claude');
    assert.equal(probeRes.probes[1].ok, false);
    const joinedLines = probeRes.lines.join('\n');
    assert.match(joinedLines, /Codex.*🟢 點火通過.*prepareVerdict/u);
    assert.match(joinedLines, /Claude.*🔴 點火失敗.*認證失敗（OAuth 或權杖已過期/u);
    assert.equal(joinedLines.includes('privateperson@example.invalid'), false, '白名單診斷摘要不得洩漏 email');
    assert.equal(joinedLines.includes('private123'), false, '白名單診斷摘要不得洩漏短權杖');
    assert.equal(probeRes.probes[1].reason.includes('privateperson@example.invalid'), false);
    assert.equal(probeRes.probes[1].reason.includes('private123'), false);
    assert.match(
      summarizeProbeFailure({ status: 1, stdout: '', stderr: '_ApiError [Error]: {\n  "message": "Your prepayment credits are depleted. account=secret999"\n}' }, '', null),
      /API 額度或預付餘額不足（HTTP 402/u,
    );
    assert.equal(
      summarizeProbeFailure({ status: 1, stdout: '', stderr: 'unexpected raw secret=my_short_pw_99' }, '', null).includes('my_short_pw_99'),
      false,
      '未知錯誤亦不得回顯原始 stderr',
    );

    // (c) N3：僅登記為掃描者（scanner-only）的座位，點火應準備合法 40-hex scan.json、送出 🔍 提示並以 prepareScan 核驗通過
    let observedScanMeta = null;
    const grokDir = path.join(tmp, '.grok');
    const grokBinDir = path.join(grokDir, 'bin');
    fs.mkdirSync(grokBinDir, { recursive: true });
    const fakeGrokBin = path.join(grokBinDir, 'grok');
    const fakeAuthFile = path.join(grokDir, 'auth.json');
    fs.writeFileSync(fakeGrokBin, '#!/bin/sh\n', { mode: 0o755 });
    fs.writeFileSync(fakeAuthFile, '{"key":"dummy"}');
    const scannerOnlySettings = {
      participants: [
        { role: '裁示者（人）', id: 'Boss', account: 'boss' },
        { role: 'AI 掃描', id: 'Grok', account: 'ai' },
      ],
      defaultDivision: { implementer: 'Boss', reviewer: 'Boss' },
      platform: { project: 'fake/repo' },
      reviewers: [],
      scanner: {
        participant: 'Grok',
        tool: 'Grok 4.7',
        source: 'Grok CLI',
        strongest: 'grok-4.7',
        maxEffort: 'xhigh',
        command: 'node tools/review-launch.js --grok-exec --mode scan --cwd {scanTree} --prompt-file {promptFile} --out-file {outFile} --model {model} --effort {effort}',
      },
    };
    const scanProbeRes = probeSeats(scannerOnlySettings, {
      seatFilter: 'Grok',
      env: { PATH: process.env.PATH },
      homedir: tmp,
      authFile: fakeAuthFile,
      grokBin: fakeGrokBin,
      spawnSyncImpl: (_bin, args) => {
        const cmdStr = args[1];
        const outFile = /--out-file\s+([^\s]+)/u.exec(cmdStr)[1];
        const promptFile = /--prompt-file\s+([^\s]+)/u.exec(cmdStr)[1];
        const scanJsonPath = path.join(path.dirname(outFile), 'scan.json');
        observedScanMeta = JSON.parse(fs.readFileSync(scanJsonPath, 'utf8'));
        const promptLines = fs.readFileSync(promptFile, 'utf8').split('\n').slice(1);
        fs.writeFileSync(outFile, promptLines.join('\n'));
        return { status: 0, stdout: '', stderr: '' };
      },
    });
    assert.equal(scanProbeRes.code, 0);
    assert.ok(observedScanMeta && /^[0-9a-f]{40}$/u.test(observedScanMeta.base) && observedScanMeta.base === observedScanMeta.head, 'scanner-only 點火必須寫入含 40-hex base/head 的 scan.json');
    assert.equal(scanProbeRes.probes[0].ok, true);
    assert.match(scanProbeRes.lines.join('\n'), /Grok.*🟢 點火通過.*prepareScan/u);

    // (d) N2：現有 PATH 優先於後備目錄（.local/bin），靜態體檢 checkSeats 與動態點火 probeSeats 必須命中同一支 CLI
    const pathFrontDir = path.join(tmp, 'path-front');
    const fallbackLocalBin = path.join(tmp, '.local', 'bin');
    fs.mkdirSync(pathFrontDir, { recursive: true });
    fs.mkdirSync(fallbackLocalBin, { recursive: true });
    const markerPath = path.join(tmp, 'which-cli-ran.txt');
    const frontCli = path.join(pathFrontDir, 'codex');
    const fallbackCli = path.join(fallbackLocalBin, 'codex');
    // 前置 CLI：寫入 front 並把標準通過內容寫進 -o 指定檔案
    fs.writeFileSync(
      frontCli,
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(markerPath)}, 'front');
const outIdx = process.argv.indexOf('-o');
const outFile = process.argv[outIdx + 1];
const prompt = fs.readFileSync(0, 'utf8').split('\\n').slice(1).join('\\n');
fs.writeFileSync(outFile, prompt);
`,
      { mode: 0o755 },
    );
    fs.writeFileSync(
      fallbackCli,
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(markerPath)}, 'fallback');
process.exit(1);
`,
      { mode: 0o755 },
    );
    const customEnv = { ...process.env, PATH: `${pathFrontDir}${path.delimiter}${process.env.PATH || ''}` };
    const singleCodexSettings = {
      ...settings,
      reviewers: [settings.reviewers[0]],
    };
    const staticOrderCheck = checkSeats(singleCodexSettings, { env: customEnv, homedir: tmp });
    assert.equal(staticOrderCheck.seats[0].binPath, frontCli, 'checkSeats 應優先選中現有 PATH 最前面的 CLI');
    const realOrderProbe = probeSeats(singleCodexSettings, {
      seatFilter: 'Codex',
      env: customEnv,
      homedir: tmp,
    });
    assert.equal(realOrderProbe.probes[0].ok, true);
    assert.equal(fs.readFileSync(markerPath, 'utf8'), 'front', 'probeSeats 實際執行的必須與 checkSeats 同一支前置 CLI');

    // (e) N1：點火逾時必須一併終止 /bin/sh 底下的子程序群組，回傳「執行逾時」後子程序不得繼續存活寫入標記
    const timeoutMarker = path.join(tmp, 'late-write-after-timeout.txt');
    fs.writeFileSync(
      frontCli,
      `#!/usr/bin/env node
const fs = require('node:fs');
setTimeout(() => {
  fs.writeFileSync(${JSON.stringify(timeoutMarker)}, 'escaped');
  process.exit(0);
}, 600);
`,
      { mode: 0o755 },
    );
    const timeoutProbe = probeSeats(singleCodexSettings, {
      seatFilter: 'Codex',
      env: customEnv,
      homedir: tmp,
      timeoutMs: 120,
    });
    assert.equal(timeoutProbe.probes[0].ok, false);
    assert.equal(timeoutProbe.probes[0].reason, '執行逾時');
    await new Promise((r) => setTimeout(r, 750));
    assert.equal(fs.existsSync(timeoutMarker), false, '逾時收尾後子程序群組必須已被終止，不得在函式回傳後繼續寫檔');

    // (f) N1（續）：巢狀 runGrokChild（忽略 SIGTERM 的內層 detached 程序群組）於逾時收尾時必須一併終止，回傳後不得繼續存活或寫入標記
    const nestedTicks = path.join(tmp, 'nested-grok.ticks');
    const nestedPidFile = path.join(tmp, 'nested-grok.pid');
    const nestedChildScript = path.join(tmp, 'nested-grok-child.cjs');
    const nestedWrapperScript = path.join(tmp, 'nested-grok-wrapper.cjs');
    const reviewLaunchPath = path.join(__dirname, '..', 'tools', 'review-launch.js');
    fs.writeFileSync(
      nestedChildScript,
      [
        "const fs = require('node:fs');",
        `fs.writeFileSync(${JSON.stringify(nestedPidFile)}, String(process.pid));`,
        "process.on('SIGTERM', () => {});",
        `setInterval(() => fs.appendFileSync(${JSON.stringify(nestedTicks)}, Date.now() + '\\n'), 30);`,
        'setTimeout(() => process.exit(0), 6000);',
      ].join('\n'),
    );
    fs.writeFileSync(
      nestedWrapperScript,
      [
        `const { runGrokChild } = require(${JSON.stringify(reviewLaunchPath)});`,
        `runGrokChild(process.execPath, [${JSON.stringify(nestedChildScript)}], { env: process.env }, { wallMs: 5000 }).then((r) => { process.exitCode = r.status; });`,
      ].join('\n'),
    );
    fs.writeFileSync(
      frontCli,
      `#!/bin/sh\nexec "${process.execPath}" "${nestedWrapperScript}"\n`,
      { mode: 0o755 },
    );
    const countLines = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).length : 0);
    const nestedTimeoutProbe = probeSeats(singleCodexSettings, {
      seatFilter: 'Codex',
      env: customEnv,
      homedir: tmp,
      timeoutMs: 350,
    });
    const ticksAtReturn = countLines(nestedTicks);
    const nestedPid = fs.existsSync(nestedPidFile) ? Number(fs.readFileSync(nestedPidFile, 'utf8')) : null;
    await new Promise((r) => setTimeout(r, 350));
    const ticksAfterWait = countLines(nestedTicks);
    let nestedStillAlive = false;
    if (nestedPid) {
      try { process.kill(nestedPid, 0); nestedStillAlive = true; } catch { /* expected ESRCH */ }
      try { process.kill(-nestedPid, 'SIGKILL'); } catch { /* cleanup if needed */ }
    }
    assert.equal(nestedTimeoutProbe.probes[0].ok, false);
    assert.equal(nestedTimeoutProbe.probes[0].reason, '執行逾時');
    assert.equal(nestedStillAlive, false, '巢狀 runGrokChild 內層程序在 probeSeats 回傳時必須已終止');
    assert.equal(ticksAfterWait, ticksAtReturn, 'probeSeats 回傳後巢狀內層程序不得再新增任何標記');

    // (g) N1（續）：外層點火程序群組收到 SIGTERM 取消時，必須先終止已 detached 的 CLI 子程序才結束
    const cancelTicks = path.join(tmp, 'cancel-cli.ticks');
    const cancelPidFile = path.join(tmp, 'cancel-cli.pid');
    const cancelOuterScript = path.join(tmp, 'cancel-outer.cjs');
    const preflightPath = path.join(__dirname, '..', 'tools', 'preflight.js');
    fs.writeFileSync(
      frontCli,
      [
        '#!/usr/bin/env node',
        "const fs = require('node:fs');",
        `fs.writeFileSync(${JSON.stringify(cancelPidFile)}, String(process.pid));`,
        `setInterval(() => fs.appendFileSync(${JSON.stringify(cancelTicks)}, Date.now() + '\\n'), 30);`,
        'setTimeout(() => process.exit(0), 6000);',
      ].join('\n'),
      { mode: 0o755 },
    );
    fs.writeFileSync(
      cancelOuterScript,
      [
        `const { probeSeats } = require(${JSON.stringify(preflightPath)});`,
        `const settings = ${JSON.stringify(singleCodexSettings)};`,
        `probeSeats(settings, { seatFilter: 'Codex', env: ${JSON.stringify(customEnv)}, homedir: ${JSON.stringify(tmp)}, timeoutMs: 2000 });`,
      ].join('\n'),
    );
    const { spawn: spawnAsync } = require('node:child_process');
    const cancelJob = spawnAsync(process.execPath, [cancelOuterScript], {
      env: customEnv,
      detached: true,
      stdio: 'ignore',
    });
    const cancelJobExit = new Promise((r) => cancelJob.once('exit', (code, signal) => r({ code, signal })));
    for (let i = 0; i < 150 && !fs.existsSync(cancelPidFile); i += 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(fs.existsSync(cancelPidFile), true, '合成 CLI 應已啟動並寫出 PID');
    process.kill(-cancelJob.pid, 'SIGTERM');
    await cancelJobExit;
    const cancelTicksBefore = countLines(cancelTicks);
    await new Promise((r) => setTimeout(r, 400));
    const cancelTicksAfter = countLines(cancelTicks);
    const cancelChildPid = Number(fs.readFileSync(cancelPidFile, 'utf8'));
    let cancelChildAlive = false;
    try { process.kill(cancelChildPid, 0); cancelChildAlive = true; } catch { /* expected ESRCH */ }
    try { process.kill(cancelChildPid, 'SIGKILL'); } catch { /* cleanup */ }
    assert.equal(cancelChildAlive, false, '外層點火收到 SIGTERM 結束時，detached CLI 子程序必須已一併終止');
    assert.equal(cancelTicksAfter, cancelTicksBefore, '外層點火結束後 CLI 子程序不得繼續寫入標記');

    // (h) N6：點火必須清掉 GIT_* 選倉環境變數與 platform.clearEnv，使 CLI 內部 Git 指向隔離點火樹而非外部 GIT_DIR
    const decoyRepo = path.join(tmp, 'decoy-git-repo');
    fs.mkdirSync(decoyRepo, { recursive: true });
    const { spawnSync: realSpawnSync } = require('node:child_process');
    const { gitEnv } = require('../tools/git-env.js');
    realSpawnSync('git', ['init', '-q', decoyRepo], { env: gitEnv(), encoding: 'utf8' });
    const observedEnvFile = path.join(tmp, 'observed-git-env.json');
    fs.writeFileSync(
      frontCli,
      [
        '#!/usr/bin/env node',
        "const fs = require('node:fs');",
        "const { spawnSync } = require('node:child_process');",
        'const args = process.argv.slice(2);',
        "const cwd = args[args.indexOf('-C') + 1];",
        "const outFile = args[args.indexOf('-o') + 1];",
        "const r = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd, env: process.env, encoding: 'utf8' });",
        `fs.writeFileSync(${JSON.stringify(observedEnvFile)}, JSON.stringify({ cwd, gitDir: (r.stdout || '').trim(), ghRepo: process.env.GH_REPO || null }));`,
        "const prompt = fs.readFileSync(0, 'utf8').split('\\n').slice(1).join('\\n');",
        'fs.writeFileSync(outFile, prompt);',
      ].join('\n'),
      { mode: 0o755 },
    );
    const envWithPoison = {
      ...customEnv,
      GIT_DIR: path.join(decoyRepo, '.git'),
      GIT_WORK_TREE: decoyRepo,
      GH_REPO: 'poison/repo',
    };
    const envProbeRes = probeSeats(
      { ...singleCodexSettings, platform: { clearEnv: ['GH_REPO'] } },
      { seatFilter: 'Codex', env: envWithPoison, homedir: tmp },
    );
    assert.equal(envProbeRes.probes[0].ok, true);
    const observedEnv = JSON.parse(fs.readFileSync(observedEnvFile, 'utf8'));
    assert.equal(observedEnv.gitDir, path.join(observedEnv.cwd, '.git'), 'CLI 內部 Git 必須指向隔離點火樹的 .git，不得受繼承 GIT_DIR 影響');
    assert.equal(observedEnv.ghRepo, null, 'platform.clearEnv 指定的環境變數必須在點火時清除');

    // (i) N7：臨時提交停用簽名（不受全域 commit.gpgsign=true 阻擋），且當 Git 建樹失敗時不啟動 CLI、直接回報固定建樹診斷
    const fakeGitDir = path.join(tmp, 'fake-git-bin');
    fs.mkdirSync(fakeGitDir, { recursive: true });
    const realGitPath = realSpawnSync('/usr/bin/which', ['git'], { encoding: 'utf8' }).stdout.trim() || '/usr/bin/git';
    const cliRanMarker = path.join(tmp, 'n7-cli-ran.txt');
    fs.writeFileSync(
      frontCli,
      [
        '#!/usr/bin/env node',
        "const fs = require('node:fs');",
        `fs.writeFileSync(${JSON.stringify(cliRanMarker)}, 'ran');`,
        'const args = process.argv.slice(2);',
        "const outFile = args[args.indexOf('-o') + 1];",
        "const prompt = fs.readFileSync(0, 'utf8').split('\\n').slice(1).join('\\n');",
        'fs.writeFileSync(outFile, prompt);',
      ].join('\n'),
      { mode: 0o755 },
    );
    const fakeGitBin = path.join(fakeGitDir, 'git');
    fs.writeFileSync(
      fakeGitBin,
      [
        `#!${process.execPath}`,
        "const { spawnSync } = require('node:child_process');",
        'const args = process.argv.slice(2);',
        "if (process.env.FAKE_GIT_MODE === 'fail') process.exit(127);",
        "const actual = args[0] === 'commit' ? ['-c', 'commit.gpgsign=true', '-c', 'gpg.program=/usr/bin/false', ...args] : args;",
        `const r = spawnSync(${JSON.stringify(realGitPath)}, actual, { env: process.env, encoding: 'utf8' });`,
        "process.stdout.write(r.stdout || '');",
        "process.stderr.write(r.stderr || '');",
        'process.exit(r.status === null ? 1 : r.status);',
      ].join('\n'),
      { mode: 0o755 },
    );
    const signingEnv = {
      ...customEnv,
      PATH: `${fakeGitDir}${path.delimiter}${customEnv.PATH}`,
      FAKE_GIT_MODE: 'signing',
    };
    try { fs.unlinkSync(cliRanMarker); } catch { /* ignore */ }
    const signingProbe = probeSeats(singleCodexSettings, {
      seatFilter: 'Codex',
      env: signingEnv,
      homedir: tmp,
    });
    assert.equal(signingProbe.probes[0].ok, true, '停用臨時提交簽名後，即使全域設了 commit.gpgsign=true 亦應建樹成功並通過點火');
    assert.equal(fs.existsSync(cliRanMarker), true);

    try { fs.unlinkSync(cliRanMarker); } catch { /* ignore */ }
    const failGitEnv = {
      ...signingEnv,
      FAKE_GIT_MODE: 'fail',
    };
    const failGitProbe = probeSeats(singleCodexSettings, {
      seatFilter: 'Codex',
      env: failGitEnv,
      homedir: tmp,
    });
    assert.equal(failGitProbe.probes[0].ok, false, 'Git 建樹失敗時必須判為點火失敗');
    assert.match(failGitProbe.probes[0].reason, /建立隔離點火 Git 樹失敗/u);
    assert.equal(fs.existsSync(cliRanMarker), false, 'Git 建樹失敗時絕不可啟動 CLI');

    // (j) run(['--probe', 'Codex']) 串接 checkOpenChanges 與 probeSeats
    const fullProbeRun = run(['--skip-downstream', '--probe', 'Codex'], {
      runners: {
        pendingRulings: () => ({ code: 0, lines: ['pending-ok'] }),
        openChanges: () => ({ code: 0, lines: ['進行中變更（C1）：⚠️ 目前已開啟 2 支'] }),
        backlogTouch: () => ({ code: 0, lines: ['backlog-ok'] }),
        seats: () => ({ code: 0, lines: ['seats-static-ok'], seats: [{ participant: 'Codex', ok: true }] }),
        probeSeats: (_s, { seatFilter }) => ({ code: 0, lines: [`probe-ran:${seatFilter}`], probes: [{ participant: 'Codex', ok: true }] }),
      },
    });
    assert.equal(fullProbeRun.code, 0);
    assert.match(fullProbeRun.lines.join('\n'), /進行中變更（C1）：⚠️ 目前已開啟 2 支/u);
    assert.match(fullProbeRun.lines.join('\n'), /probe-ran:Codex/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
