// 假隔離（只給考題）：模仿一個「盒外的絕對路徑一律拒絕」的沙盒，讓試探能在任何機器上真的跑一遍。
// 用法：node fake-isolation.js <盒子> [--leaky] <指令> [參數…]
//   誠實模式：任一參數是盒外的絕對路徑（依 realpath；/bin、/usr/bin 底下的程式除外）就退 1、不印任何東西；否則照跑。
//   漏水模式（--leaky）：什麼都照跑——用來證明試探真的會叫，不是永遠綠。
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [box, ...rest] = process.argv.slice(2);
const leaky = rest[0] === '--leaky';
const argv = leaky ? rest.slice(1) : rest;
const boxReal = fs.realpathSync(box);
if (!leaky) {
  for (const a of argv.slice(1)) {
    if (!path.isAbsolute(a) || a.startsWith('/bin/') || a.startsWith('/usr/bin/')) continue;
    let real;
    try { real = fs.realpathSync(path.dirname(a)); } catch { real = path.dirname(a); }
    const inside = real === boxReal || real.startsWith(boxReal + path.sep);
    if (!inside) process.exit(1);
  }
}
const r = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit' });
process.exit(r.status === null ? 2 : r.status);
