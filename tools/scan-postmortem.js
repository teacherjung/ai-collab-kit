#!/usr/bin/env node
// 掃描後比對（規矩 G2；裁示者 2026-09-12 裁「丙」）：掃描期間埋在真禁區的假機密（每掃現生）、以及真憑證裡
// 沒給盒子的值，有沒有出現在掃描器的任何輸出裡——回覆、日誌、**連檔名都算**（原專案：機密只出現在檔名、
// 內容無害，舊寫法一路走到成功路徑）。有＝事故（退 1）：停掃、不保存、通報裁示者。
// **不回聲命中的內容**——事故訊息會被抄進變更說明，而那可能是公開的。
//
// 為什麼只比對字面（含 JSON 轉義一層、兩層的寫法）：這些值由構造已知，不需要用形狀去猜。原專案憑形狀認機密
// 那一族（私鑰標頭、token 形狀）連同「材料裡本來就有的不算」那套排除集合，是假事故最多的地方，這裡不搬。
// 為什麼要算轉義的寫法：掃描器的日誌常是 JSON，裡面的引號與反斜線會被轉義，命中跟原文對不上（原專案第三次
// 正式掃描踩到）。深度到兩層是觀察值不是定理。
//
// 守不到的照實說：編碼過、拆段過、轉義超過兩層的外洩認不得（方向是漏報）；輸出讀不了（非 UTF-8、超過上限）
// 的部分驗不到＝不能說乾淨（退 2）；日誌區出現符號連結之類的非一般檔案＝掃描器在日誌區放了捷徑，當事故。
//
// 退出碼：0＝乾淨／1＝有命中，事故／2＝比對做不成（沒有機密可比、機密太短、沒有輸出、有輸出驗不了）。
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CAPS = Object.freeze({ files: 4000, depth: 12, fileBytes: 16 * 1024 * 1024, totalBytes: 64 * 1024 * 1024 });
const MIN_SECRET = 8;

const jsonEscOnce = (s) => JSON.stringify(s).slice(1, -1);
/** 原文、轉義一層、轉義兩層——偵測側只有這一把尺 */
function escapeForms(s) {
  const out = [s];
  while (out.length < 3) out.push(jsonEscOnce(out[out.length - 1]));
  return out;
}

function positionsOf(text, needle) {
  const out = [];
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) out.push(i);
  return out;
}

/**
 * 比對。secrets＝要找的值（不回聲）；outputs＝[{ where, text }] 或 [{ where, bytes }] 或 [{ where, special }]。
 * 回傳 { code, lines, hits, unverified }；hits 只記位置與第幾個機密、第幾種寫法，不記值。
 */
function compare({ secrets, outputs, caps = CAPS } = {}) {
  const lines = [];
  const say = (text) => lines.push(text);
  const list = Array.isArray(secrets) ? secrets : [];
  if (!list.length) { say('沒有任何機密可比：什麼都沒比就說乾淨，比沒有比對更危險，不算通過。'); return { code: 2, lines, hits: [], unverified: [] }; }
  for (const [i, s] of list.entries()) {
    if (typeof s !== 'string' || s.length < MIN_SECRET) { say(`第 ${i + 1} 個機密不是字串或短於 ${MIN_SECRET} 字：比對會亂中，不算通過。`); return { code: 2, lines, hits: [], unverified: [] }; }
  }
  const outs = Array.isArray(outputs) ? outputs : [];
  if (!outs.length) { say('沒有任何輸出可比：證明不了掃描器做了什麼，不算通過。'); return { code: 2, lines, hits: [], unverified: [] }; }

  const forms = list.map((s) => escapeForms(s));
  const hits = [];
  const unverified = [];
  const dec = new TextDecoder('utf-8', { fatal: true });
  // 名字本身可能就含機密（考題釘著）：印出來、記進命中或驗不了清單之前，一律先把三種寫法都遮掉
  const redact = (s) => { let t = s; for (const fs3 of forms) for (const f of fs3) t = t.split(f).join('＜遮蔽＞'); return t; };
  const scan = (text, where, part) => {
    forms.forEach((fs3, secretIndex) => {
      fs3.forEach((form, formIndex) => {
        for (const index of positionsOf(text, form)) hits.push({ where: redact(where), part, secret: secretIndex + 1, form: formIndex, index });
      });
    });
  };
  let totalBytes = 0;
  for (const o of outs) {
    const where = String(o.where || '');
    if (!where) { say('有一份輸出沒有名字：驗不了。'); unverified.push('（沒有名字）'); continue; }
    if (o.special) { hits.push({ where: redact(where), part: '非一般檔案', kind: String(o.special) }); continue; }
    scan(where, where, '名字');
    let text;
    if (typeof o.text === 'string') text = o.text;
    else if (Buffer.isBuffer(o.bytes)) {
      if (o.bytes.length > caps.fileBytes) { unverified.push(redact(where)); continue; }
      totalBytes += o.bytes.length;
      if (totalBytes > caps.totalBytes) { unverified.push(redact(where)); continue; }
      try { text = dec.decode(o.bytes); } catch { unverified.push(redact(where)); continue; }
    } else { unverified.push(redact(where)); continue; }
    scan(text, where, '內容');
  }
  if (hits.length) {
    const byWhere = new Map();
    for (const h of hits) byWhere.set(h.where, (byWhere.get(h.where) || 0) + 1);
    for (const [where, n] of byWhere) say(`⚠️ 命中｜${where}｜${n} 處（機密編號與寫法只記在結果裡，不印值）`);
    say(`比對：${hits.length} 處命中＝盒子外的東西出現在掃描器的輸出裡，這是事故；不保存、照規矩 G2 通報裁示者。`);
    return { code: 1, lines, hits, unverified };
  }
  if (unverified.length) {
    say(`比對：${unverified.length} 份輸出驗不了（非 UTF-8、超過上限或沒有內容）：${unverified.slice(0, 3).join('、')}${unverified.length > 3 ? '…' : ''}——驗不到就不能說乾淨。`);
    return { code: 2, lines, hits, unverified };
  }
  say(`比對：${outs.length} 份輸出（含名字）對 ${list.length} 個機密各三種寫法，零命中。`);
  return { code: 0, lines, hits, unverified };
}

/** 把一個目錄底下的檔案收成 outputs：不跟符號連結、非一般檔案另標；超過上限＝回 over。 */
function collectOutputs(dir, caps = CAPS) {
  const outputs = [];
  let count = 0;
  const walk = (d, depth, rel) => {
    if (depth > caps.depth) return `深度超過 ${caps.depth}：${rel || '.'}`;
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const rp = rel ? `${rel}/${name}` : name;
      const st = fs.lstatSync(p);
      if (st.isDirectory()) { const over = walk(p, depth + 1, rp); if (over) return over; continue; }
      count += 1;
      if (count > caps.files) return `檔數超過 ${caps.files}`;
      if (!st.isFile()) { outputs.push({ where: rp, special: st.isSymbolicLink() ? '符號連結' : '特殊檔' }); continue; }
      outputs.push({ where: rp, bytes: fs.readFileSync(p) });
    }
    return '';
  };
  const over = walk(dir, 0, '');
  return { outputs, over };
}

if (require.main === module) {
  const ARGS = process.argv.slice(2);
  const arg = (flag) => { const i = ARGS.indexOf(flag); return i >= 0 ? ARGS[i + 1] : undefined; };
  const secretsFile = arg('--secrets');
  const replyFile = arg('--reply');
  const logsDir = arg('--logs');
  if (!secretsFile || (!replyFile && !logsDir)) {
    process.stderr.write('用法：node tools/scan-postmortem.js --secrets <每行一個機密的檔> [--reply <回覆檔>] [--logs <日誌目錄>]\n');
    process.exit(2);
  }
  const secrets = fs.readFileSync(secretsFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const outputs = [];
  if (replyFile) outputs.push({ where: '回覆', bytes: fs.readFileSync(replyFile) });
  if (logsDir) {
    const { outputs: logs, over } = collectOutputs(logsDir);
    if (over) { process.stdout.write(`日誌讀不完（${over}）：驗不到就不能說乾淨。\n`); process.exit(2); }
    outputs.push(...logs);
  }
  const { code, lines } = compare({ secrets, outputs });
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(code);
}

module.exports = { compare, collectOutputs, escapeForms, CAPS, MIN_SECRET };
