#!/usr/bin/env node
// 掃描前試探：隔離是不是真的（規矩 G2；裁示者 2026-09-12 裁「丙」）。
//
// 裁「丙」的內容：隔離本身不搬——由專案設定指定誰提供（工具自帶／專案自建），套件只搬兩樣通用的小工具：
// 這一支（掃前試探）與 tools/scan-postmortem.js（掃後比對）。沒有隔離、或試探不過＝不掃，掃描紀錄寫「未執行」。
//
// 它做什麼：在每個登記的禁區各埋一個假機密，從盒內用「確定會嘗試」的程式（cat、sh）去讀、去寫。
// 任一個讀得到或寫得進＝隔離是假的，不掃（退 1）。連試探自己都做不成＝也不掃（退 2）。
// 為什麼隔離是誰提供的都要試探：案例簿 tool-lock-flag-silently-failed——工具自己的限制旗標默默失效，
// 「廠商說有」不等於「真的有」；而掃描器讀的材料是不可信的輸入，模型再乖也擋不住材料裡夾帶的指令。
// 用 cat／sh 而不用掃描器本身去試：掃描器會「選擇」不做，那不是圍欄。
//
// 守得到的與守不到的，照實說：
//   守得到：它埋的那幾個位置，從盒內讀不到、寫不進；盒內讀得到自己的檔（「什麼都失敗」不算擋住）；
//           盒外讀得到假機密（試探程式本身是活的）。
//   守不到：隔離有沒有別的洞（網路、剪貼簿、環境變數、沒登記的目錄）——那些由隔離提供者自己證明；
//           掃描發射本身有沒有把呼叫者的環境變數帶進盒子（這一支自己只帶最少的環境變數）。
//
// 退出碼：0＝全部擋住、可以掃／1＝有禁區碰得到，隔離是假的，不掃／2＝試探做不成（沒有隔離、設定沒填、
//        假機密埋不進去、對照組不活、盒內連自己的檔都讀不到、有探針測不出），同樣不掃。
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { read: readSettings } = require('./build-settings.js');

const UNSET = '未設定';
const NONE = '無';
const READER = '/bin/cat';
const SHELL = '/bin/sh';

/** 預設的執行器：真的去跑。status 為 null＝逾時、被訊號殺掉、或根本起不來。 */
function runCommand(argv, { cwd, env, timeout = 20_000 } = {}) {
  const r = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', cwd, env, timeout });
  return {
    status: r.error ? null : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? r.error.message : (r.signal || ''),
  };
}

/** 盒內只給最少的環境變數：不把呼叫者的 token、家目錄帶進去。 */
function minimalEnv(box) {
  return { PATH: process.env.PATH || '/usr/bin:/bin', HOME: box, TMPDIR: path.join(box, 'tmp'), LANG: 'C' };
}

/** 禁區清單裡的 ~ 代表家目錄。 */
function expandZone(zone, home) {
  if (zone === '~') return home;
  if (zone.startsWith('~/')) return path.join(home, zone.slice(2));
  return zone;
}

/**
 * 「這一次讀取算不算擋住」——唯一的判斷。擋住＝退出碼是非 0 的數字，且輸出裡沒有假機密。
 * status 為 null 不算擋住，那是探針自己壞了（呼叫端另計成「測不出」）。
 */
function isBlocked(r, secret) {
  const leaked = r.stdout.includes(secret) || r.stderr.includes(secret);
  return typeof r.status === 'number' && r.status !== 0 && !leaked;
}

/**
 * 跑完整試探。回傳 { code, lines }；settings／run／home／tmp 都可以換掉，考題不必碰真的家目錄。
 * lines 裡不會出現假機密本身。
 */
function probeRun({ settings = readSettings(), run = runCommand, home = os.homedir(), tmp = os.tmpdir() } = {}) {
  const lines = [];
  const say = (text) => lines.push(text);
  const iso = settings.scanner && settings.scanner.isolation;
  const provider = iso && typeof iso.provider === 'string' ? iso.provider : UNSET;
  if (provider === UNSET || provider === NONE) {
    say(`隔離提供者是「${provider}」：沒有隔離＝不掃，掃描紀錄寫「未執行：無隔離」。`);
    return { code: 2, lines };
  }
  const wrap = Array.isArray(iso.wrap) ? iso.wrap.filter((x) => typeof x === 'string' && x.trim()) : [];
  if (!wrap.length) {
    say('從盒內跑指令的前綴沒填：不知道怎麼從盒內跑東西＝試探不了，不掃。');
    return { code: 2, lines };
  }
  const zones = Array.isArray(iso.forbidden) ? iso.forbidden.filter((x) => typeof x === 'string' && x.trim()) : [];
  if (!zones.length) {
    say('禁區清單是空的：什麼都沒試就說隔離有效，比沒有試探更危險，不掃。');
    return { code: 2, lines };
  }

  const secret = `PROBE-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
  const boxRoot = iso.boxRoot && iso.boxRoot !== UNSET ? expandZone(iso.boxRoot, home) : tmp;
  let box = null;
  const planted = [];
  try {
    try {
      box = fs.realpathSync(fs.mkdtempSync(path.join(boxRoot, 'scan-probe-box-')));
      fs.mkdirSync(path.join(box, 'tmp'));
    } catch (e) {
      say(`盒子建不起來（${boxRoot}：${e.code || e.message}）：試探不了，不掃。`);
      return { code: 2, lines };
    }
    const env = minimalEnv(box);
    const inBox = (argv) => run([...wrap.map((w) => w.split('{box}').join(box)), ...argv], { cwd: box, env });
    const outside = (argv) => run(argv, { cwd: box, env });

    for (const zone of zones) {
      const dir = expandZone(zone, home);
      let plantedDir;
      try {
        plantedDir = fs.mkdtempSync(path.join(dir, '.scan-probe-'));
      } catch (e) {
        say(`禁區「${zone}」埋不進假機密（${e.code || e.message}）：試探不了，不掃。`);
        return { code: 2, lines };
      }
      const file = path.join(plantedDir, 'fake-secret.txt');
      fs.writeFileSync(file, `${secret}\n`);
      planted.push({ zone, dir: plantedDir, file, writeTarget: path.join(plantedDir, 'written-from-inside.txt') });
    }

    // 對照組：盒外讀得到——證明試探程式自己是活的；盒外就讀不到＝什麼都證明不了
    for (const p of planted) {
      const r = outside([READER, p.file]);
      if (r.status !== 0 || !r.stdout.includes(secret)) {
        say(`⛔ 對照組不活｜盒外讀不到「${p.zone}」裡的假機密（status ${r.status}）：試探程式自己壞了，測不出，不掃。`);
        return { code: 2, lines };
      }
    }
    // 正面：盒內讀得到自己的檔——「全部失敗」不算擋住，那是隔離沒套上或整個壞掉
    const insideFile = path.join(box, 'inside.txt');
    fs.writeFileSync(insideFile, 'INSIDE-OK\n');
    {
      const r = inBox([READER, insideFile]);
      if (r.status !== 0 || !r.stdout.includes('INSIDE-OK')) {
        say(`⛔ 盒內連自己的檔都讀不到（status ${r.status}${r.error ? `：${r.error}` : ''}）：隔離沒套上或整個壞掉，不掃。`);
        return { code: 2, lines };
      }
      say('✅ 盒內讀得到自己的檔');
    }

    let dead = 0;
    let unknown = 0;
    for (const p of planted) {
      const r = inBox([READER, p.file]);
      if (r.status === null) { unknown += 1; say(`⛔ 測不出｜讀「${p.zone}」（逾時或被殺${r.error ? `：${r.error}` : ''}）`); }
      else if (isBlocked(r, secret)) say(`🔴 擋住｜讀「${p.zone}」`);
      else { dead += 1; say(`🟢 讀得到（隔離是假的）｜讀「${p.zone}」`); }

      // 寫：退出碼會說謊，所以另外從盒外看檔案有沒有真的落地
      const w = inBox([SHELL, '-c', 'echo x > "$1"', 'scan-probe', p.writeTarget]);
      const landed = fs.existsSync(p.writeTarget);
      if (landed) { dead += 1; say(`🟢 寫得進（隔離是假的）｜寫「${p.zone}」，檔案真的落地了`); }
      else if (w.status === null) { unknown += 1; say(`⛔ 測不出｜寫「${p.zone}」（逾時或被殺）`); }
      else if (w.status === 0) { unknown += 1; say(`⛔ 測不出｜寫「${p.zone}」回報成功但檔案沒落地：隔離的行為看不懂，不當作擋住`); }
      else say(`🔴 擋住｜寫「${p.zone}」`);
    }
    if (dead) {
      say(`試探：${dead} 個探針碰得到禁區＝隔離是假的，不掃；照規矩 G2 通報裁示者。`);
      return { code: 1, lines, dead, unknown };
    }
    if (unknown) {
      say(`試探：${unknown} 個探針測不出＝不能說隔離有效，不掃。`);
      return { code: 2, lines, dead, unknown };
    }
    say(`試探：${planted.length} 個禁區讀不到也寫不進、盒內讀得到自己的檔——可以掃。`);
    return { code: 0, lines, dead, unknown };
  } finally {
    // 不管哪條路出去，埋的東西與盒子都清掉；只刪自己建的目錄
    for (const p of planted) fs.rmSync(p.dir, { recursive: true, force: true });
    if (box) fs.rmSync(box, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const { code, lines } = probeRun();
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(code);
}

module.exports = { probeRun, runCommand, isBlocked, expandZone, minimalEnv, UNSET, NONE };
