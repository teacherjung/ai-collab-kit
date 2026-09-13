#!/usr/bin/env node
// 「時間點」的契約只有這一份（里程碑 3 r3 High①）：平台給的時間，要**帶時區**才收。
//
// 為什麼：三支工具（真考卷閘、結論聯集閘、待裁清單）都拿平台的時間判先後。「Date.parse 讀得出」不夠——
// 沒有時區的日期時間，語言規格明定照**執行機器的本機時區**解讀，於是同一份資料在 TZ=UTC 放行、
// 在 TZ=Asia/Taipei 擋下；平台回的字串一個字都沒變。
//
// 收件：完整的日期＋時間、秒可省、小數可有，結尾一定是 Z 或明確的 ±HH:MM。其餘（只有日期、沒有時區、
// 亂字）一律回 null，消費端當「查不清楚」退 2。
'use strict';

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

/** 回毫秒數，讀不出或沒帶時區＝null。 */
function parseInstant(value) {
  if (typeof value !== 'string' || !INSTANT.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

module.exports = { parseInstant, INSTANT };
