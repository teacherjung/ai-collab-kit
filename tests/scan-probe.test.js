// 守掃描前試探（規矩 G2；裁示者 2026-09-12 裁「丙」：隔離不搬、只搬試探與比對）。
//
// 守得到的：
//   ①沒有隔離提供者／前綴沒填／禁區清單空＝退 2、什麼都不跑（什麼都沒試就說有效，比沒有試探更危險）；
//   ②對照組不活（盒外就讀不到假機密）＝退 2；盒內連自己的檔都讀不到＝退 2（「全部失敗」不算擋住）；
//   ③任一禁區從盒內讀得到＝退 1；退出碼非零但輸出裡帶著假機密＝仍算讀得到；
//   ④寫進禁區：檔案真的落地＝退 1，不看退出碼；
//   ⑤探針逾時或被殺＝測不出＝退 2，不算擋住；
//   ⑥用一個真的會拒絕盒外路徑的假隔離跑一遍＝退 0，同一支假隔離開漏水模式＝退 1（證明試探會叫）；
//   ⑦不管哪條路出去，埋的假機密與盒子都清掉；印出來的每一行都不含假機密。
//
// ⚠️ 守不到的：隔離有沒有別的洞（它只試登記的那幾個目錄）；正式的隔離提供者到底有沒有效——那要在每個專案裡真的跑一次。
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { probeRun, isBlocked, expandZone, UNSET, NONE } = require('../tools/scan-probe.js');

const FAKE = path.join(__dirname, 'helpers', 'fake-isolation.js');

function tempZone() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scan-probe-zone-'));
}
function settingsWith(isolation) {
  return { scanner: { isolation } };
}
function honest(zones, extra = {}) {
  return settingsWith({ provider: '專案自建', wrap: [process.execPath, FAKE, '{box}'], boxRoot: UNSET, forbidden: zones, ...extra });
}
const plantedIn = (zone) => fs.readdirSync(zone).filter((n) => n.startsWith('.scan-probe-'));

/** 假執行器：codes 決定每一次回什麼；記下每一次的 argv；能讀到埋的假機密（用來斷言它不會被印出來） */
function fakeRunner(reply) {
  const calls = [];
  return {
    calls,
    run(argv) {
      calls.push(argv);
      return { status: 0, stdout: '', stderr: '', error: '', ...reply(argv, calls.length) };
    },
  };
}
const readSecretFromArgv = (argv) => { const f = argv.find((a) => path.basename(a) === 'fake-secret.txt'); return f ? fs.readFileSync(f, 'utf8').trim() : ''; };

test('沒有隔離提供者、前綴沒填、禁區清單空：都退 2、什麼都不跑', () => {
  for (const iso of [
    undefined,
    { provider: UNSET, wrap: ['x'], forbidden: ['~'] },
    { provider: NONE, wrap: ['x'], forbidden: ['~'] },
    { provider: '專案自建', wrap: [], forbidden: ['~'] },
    { provider: '專案自建', wrap: ['x'], forbidden: [] },
  ]) {
    const { run, calls } = fakeRunner(() => ({}));
    const r = probeRun({ settings: settingsWith(iso), run });
    assert.equal(r.code, 2, JSON.stringify(iso));
    assert.equal(calls.length, 0, '退 2 的時候不該跑任何東西');
  }
});

test('禁區清單的 ~ 代表家目錄', () => {
  assert.equal(expandZone('~', '/h'), '/h');
  assert.equal(expandZone('~/x', '/h'), path.join('/h', 'x'));
  assert.equal(expandZone('/abs', '/h'), '/abs');
});

test('isBlocked：非零退出碼且輸出無假機密才算擋住；null 不算；帶著機密不算', () => {
  assert.equal(isBlocked({ status: 1, stdout: '', stderr: '' }, 'S'), true);
  assert.equal(isBlocked({ status: 0, stdout: '', stderr: '' }, 'S'), false);
  assert.equal(isBlocked({ status: null, stdout: '', stderr: '' }, 'S'), false);
  assert.equal(isBlocked({ status: 1, stdout: 'S', stderr: '' }, 'S'), false);
  assert.equal(isBlocked({ status: 1, stdout: '', stderr: 'xxS' }, 'S'), false);
});

test('對照組不活（盒外就讀不到）：退 2', () => {
  const zone = tempZone();
  try {
    const { run } = fakeRunner(() => ({ status: 1 }));
    const r = probeRun({ settings: honest([zone]), run, home: zone });
    assert.equal(r.code, 2);
    assert.match(r.lines.join('\n'), /對照組不活/u);
  } finally { fs.rmSync(zone, { recursive: true, force: true }); }
});

test('盒內連自己的檔都讀不到：退 2，不算擋住', () => {
  const zone = tempZone();
  try {
    const { run } = fakeRunner((argv) => (argv[0] === process.execPath ? { status: 1 } : { status: 0, stdout: readSecretFromArgv(argv) }));
    const r = probeRun({ settings: honest([zone]), run });
    assert.equal(r.code, 2);
    assert.match(r.lines.join('\n'), /盒內連自己的檔都讀不到/u);
    assert.doesNotMatch(r.lines.join('\n'), /🟢|🔴/u, '沒跑到探針就不該有探針的判定');
  } finally { fs.rmSync(zone, { recursive: true, force: true }); }
});

test('退出碼非零但輸出帶著假機密：仍算讀得到，退 1；印出來的行不含假機密', () => {
  const zone = tempZone();
  let secret = '';
  try {
    const { run } = fakeRunner((argv) => {
      const s = readSecretFromArgv(argv); if (s) secret = s;
      if (argv[0] !== process.execPath) return { status: 0, stdout: s };            // 盒外對照
      if (argv.some((a) => path.basename(a) === 'inside.txt')) return { status: 0, stdout: 'INSIDE-OK' };
      if (argv.some((a) => path.basename(a) === 'fake-secret.txt')) return { status: 1, stderr: `error: ${s}` };   // 看起來擋住、其實漏了
      return { status: 1 };
    });
    const r = probeRun({ settings: honest([zone]), run });
    assert.equal(r.code, 1);
    assert.ok(secret.length > 10, '假執行器應該讀得到埋的假機密');
    assert.ok(!r.lines.join('\n').includes(secret), '假機密不可以被印出來');
    assert.match(r.lines.join('\n'), /讀得到（隔離是假的）/u);
  } finally { fs.rmSync(zone, { recursive: true, force: true }); }
});

test('寫進禁區的檔案真的落地：退 1，不看退出碼', () => {
  const zone = tempZone();
  try {
    const { run } = fakeRunner((argv) => {
      if (argv[0] !== process.execPath) return { status: 0, stdout: readSecretFromArgv(argv) };
      if (argv.some((a) => path.basename(a) === 'inside.txt')) return { status: 0, stdout: 'INSIDE-OK' };
      const target = argv.find((a) => path.basename(a) === 'written-from-inside.txt');
      if (target) { fs.writeFileSync(target, 'x\n'); return { status: 1 }; }   // 說失敗、其實寫進去了
      return { status: 1 };
    });
    const r = probeRun({ settings: honest([zone]), run });
    assert.equal(r.code, 1);
    assert.match(r.lines.join('\n'), /寫得進（隔離是假的）/u);
    assert.deepEqual(plantedIn(zone), [], '埋的東西要清掉');
  } finally { fs.rmSync(zone, { recursive: true, force: true }); }
});

test('探針逾時或被殺：測不出＝退 2，不算擋住', () => {
  const zone = tempZone();
  try {
    const { run } = fakeRunner((argv) => {
      if (argv[0] !== process.execPath) return { status: 0, stdout: readSecretFromArgv(argv) };
      if (argv.some((a) => path.basename(a) === 'inside.txt')) return { status: 0, stdout: 'INSIDE-OK' };
      if (argv.some((a) => path.basename(a) === 'fake-secret.txt')) return { status: null, error: 'ETIMEDOUT' };
      return { status: 1 };
    });
    const r = probeRun({ settings: honest([zone]), run });
    assert.equal(r.code, 2);
    assert.match(r.lines.join('\n'), /測不出/u);
  } finally { fs.rmSync(zone, { recursive: true, force: true }); }
});

test('真的跑一遍：會拒絕盒外路徑的假隔離＝退 0；同一支開漏水模式＝退 1（試探會叫）；兩種都清乾淨', () => {
  const zone = tempZone();
  const boxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-probe-root-'));
  try {
    const ok = probeRun({ settings: honest([zone], { boxRoot }) });
    assert.equal(ok.code, 0, ok.lines.join('\n'));
    assert.match(ok.lines.join('\n'), /可以掃/u);
    assert.deepEqual(plantedIn(zone), []);
    assert.deepEqual(fs.readdirSync(boxRoot), [], '盒子要清掉');

    const leaky = probeRun({ settings: settingsWith({ provider: '專案自建', wrap: [process.execPath, FAKE, '{box}', '--leaky'], boxRoot, forbidden: [zone] }) });
    assert.equal(leaky.code, 1, leaky.lines.join('\n'));
    assert.match(leaky.lines.join('\n'), /讀得到（隔離是假的）/u);
    assert.match(leaky.lines.join('\n'), /寫得進（隔離是假的）/u);
    assert.deepEqual(plantedIn(zone), []);
    assert.deepEqual(fs.readdirSync(boxRoot), []);
  } finally {
    fs.rmSync(zone, { recursive: true, force: true });
    fs.rmSync(boxRoot, { recursive: true, force: true });
  }
});

test('禁區不存在：埋不進去＝退 2', () => {
  const { run } = fakeRunner(() => ({}));
  const r = probeRun({ settings: honest([path.join(os.tmpdir(), 'no-such-zone-' + process.pid)]), run });
  assert.equal(r.code, 2);
  assert.match(r.lines.join('\n'), /埋不進假機密/u);
});

test('寫探針回報成功但檔案沒落地：測不出＝退 2，不當作擋住也不當作寫得進', () => {
  const zone = tempZone();
  try {
    const { run } = fakeRunner((argv) => {
      if (argv[0] !== process.execPath) return { status: 0, stdout: readSecretFromArgv(argv) };
      if (argv.some((a) => path.basename(a) === 'inside.txt')) return { status: 0, stdout: 'INSIDE-OK' };
      if (argv.some((a) => path.basename(a) === 'written-from-inside.txt')) return { status: 0 };   // 說成功、其實沒寫
      return { status: 1 };
    });
    const r = probeRun({ settings: honest([zone]), run });
    assert.equal(r.code, 2);
    assert.match(r.lines.join('\n'), /回報成功但檔案沒落地/u);
  } finally { fs.rmSync(zone, { recursive: true, force: true }); }
});
