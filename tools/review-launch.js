#!/usr/bin/env node
// 送審產生器（規矩 F1、F3、F11）：把送審提示的事實格填好、開兩棵固定在受審版本的樹（審查樹、突變副本）、
// 印出整行啟動指令；無憑證／沙盒複審後可用 --post 先核兩棵樹乾淨、HEAD 沒變、標頭與小標合格，再由外殼代貼結論；審完用 --close 先核兩棵樹乾淨、HEAD 沒變，再收掉。
//
// 為什麼：送審提示的事實格（版本碼、輪次、上一輪結論、兩條路徑、三條指令、來源字串）原本每輪手抄，啟動指令要從設定第十一節抄模型與推理；
// 案例簿已有兩起手填出錯（review-prompt-derivation-slip 漏改四處、燒掉一輪；heredoc-eaten-empty-prompt 空提示跑一輪），
// 而 Codex 的推理沒帶就照它自己的設定檔預設跑，從外面看不出來。擁有者 2026-10-07 裁第 2 批的三台提前做，這是其中第二台。
//
// 格子照範本出現的**順序**填（FILL 那張表），不照字面換：同一個尖括號字樣在不同位置意思不同（<識別值> 一處是複審者、一處是實作者）。
// 範本的格子一改，「範本的格子跟產生器的表一一對上」那一題就紅。只留 <三選一> 給複審者填。
// 啟動指令的正本在專案設定（reviewers 每一位的 command），這裡只替換記號；替換進去的值只收不用加引號的字元，
// 路徑有空白就不產生——樣板自己已經寫了引號，這裡再包一層就會壞掉。
// 樹開在系統暫存區（或 --dir 指定的地方）：要放在複審者的沙箱寫得進的地方（README 寫明 Codex 的沙箱准寫暫存區），突變副本放那裡它才改得到。
//
// ⚠️ 守不到的：
//   ①不擋也不驗：印出來之後有沒有照用、提示有沒有再被手改、複審者實際用的模型與推理（只有它自報）都看不到——F1、F3、F11 仍靠自覺；
//   ②印的事實是平台與 git 那一刻給的：之後又推了新版本，印出來的就過期（收樹時核 HEAD 沒變，但不會重新產生）；
//   ③風險級別只印分級腳本照檔案算的那一級；實作者往重調、裁示者改級，要自己改提示的風險級別與本輪範圍兩格（範圍照分級表跟著級別重查）；
//     快速通道（AI）（F12）照分級腳本判的結果把本輪範圍印成只核差異，「這一位連兩輪沒通過」只看平台上這一位貼的結論標頭；
//   ④「相關裁示」只列問在本支、配到的 ⚖️（判斷用待裁清單工具那一份），對話裡講過、沒貼留痕的列不到；
//   ⑤收樹只核兩棵樹（狀態不看被忽略的檔）；複審者在暫存區另建的東西只列出比開樹晚的第一層、不刪，也不保證列齊（別的程式同時寫的也會被列進來）。
// 退出碼：0＝做好了；1＝代貼結論或收樹時核到樹不乾淨、HEAD 變了或上了鎖而沒貼／沒收，或收到一半（要人看）；2＝做不了（設定沒填、平台問不到、git 出錯、路徑不安全、範本對不上、結論格式不對或已貼過、參數不對）。⚠️ 不是閘。
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ask, PlatformError } = require('./platform.js');
const { read: readSettings } = require('./settings-data.js');
const { gitEnv } = require('./git-env.js');
const { parseInstant } = require('./time-point.js');
const { fieldValue, canonicalRole, rolesOf } = require('./gates/check-collab-fields.js');
const { headerOf, missingHeadings, PASS_HEADINGS, evaluate: evaluateVerdicts } = require('./gates/check-review-verdicts.js');
const { evaluate: evaluateRulings, deciderOf, rulingLink } = require('./pending-rulings.js');
const { run: riskRun, gitIn } = require('./risk-tier.js');

const UNSET = '未設定';
const TEMPLATE = path.join(__dirname, '..', 'templates', 'review-request.md');
const SCAN_TEMPLATE = path.join(__dirname, '..', 'templates', 'scan-record.md');
const FILE_SLOT = '<你寫好的結論檔>';
const USAGE = `用法：node tools/review-launch.js <變更編號> --reviewer <複審者識別值> [--dir <放樹的資料夾>]
      node tools/review-launch.js --post <變更編號> [--file <結論檔>] [--dir <放樹的資料夾>]
      node tools/review-launch.js --close <變更編號> [--dir <放樹的資料夾>]
      node tools/review-launch.js --scan <變更編號> [--scanner <掃描者識別值>] [--tier <高|中|低>] [--dir <放樹的資料夾>]
      node tools/review-launch.js --scan-post <變更編號> [--file <回覆檔>] [--dir <放樹的資料夾>]
      node tools/review-launch.js --scan-close <變更編號> [--dir <放樹的資料夾>]`;
const TIER_ORDER = ['高', '中', '低'];

/** 範本裡每一格照出現順序要填什麼；null＝留給複審者。 */
const FILL = [
  ['<倉庫>', 'project'], ['<編號>', 'change'], ['<識別值>', 'reviewer'],
  ['<連結>', 'changeLink'], ['<完整版本碼>', 'head'], ['<短碼>', 'headShort'],
  ['<主幹分支名>', 'baseBranch'], ['<版本碼>', 'base'], ['<輪次>', 'round'],
  ['<高／中／低>', 'tier'], ['<照表算的／實作者調重的，理由一句／裁示者改的，附裁示連結>', 'tierWhy'],
  ['<全審／只核差異>', 'scope'], ['<留言連結；第 1 輪寫「沒有」>', 'previous'], ['<留言連結；沒有寫「沒有」>', 'rulings'],
  ['<路徑>', 'reviewTree'], ['<路徑>', 'mutationCopy'],
  ['<指令；照專案設定「複審者的模型與怎麼起」那一節或專案說明寫的>', 'copyTest'],
  ['<指令>', 'fullDiff'], ['<指令；第 1 輪寫「沒有」>', 'roundDiff'], ['<識別值>', 'implementer'],
  ['<版本碼>', 'base'],
  ['<來源字串>', 'source'], ['<識別值>', 'reviewer'], ['<來源字串>', 'source'], ['<短碼>', 'headShort'],
  ['<輪次>', 'round'], ['<三選一>', null], ['<貼留言的指令>', 'postComment'],
];
/** 掃描範本（templates/scan-record.md 分隔線 --- 之後）每一格照出現順序要填什麼。 */
const SCAN_FILL = [
  ['<倉庫>', 'project'], ['<編號>', 'change'], ['<識別值>', 'scanner'],
  ['<連結>', 'changeLink'], ['<完整版本碼>', 'head'], ['<短碼>', 'headShort'],
  ['<主幹分支名>', 'baseBranch'], ['<版本碼>', 'base'], ['<高／中／低>', 'tier'],
  ['<留言連結>', 'passCommentLink'], ['<路徑>', 'scanTree'], ['<指令>', 'fullDiff'],
  ['<識別值>', 'implementer'], ['<識別值>', 'reviewer'],
  ['<識別值>', 'scanner'], ['<來源字串>', 'source'],
  ['<識別值>', 'scanner'], ['<來源字串>', 'source'], ['<短碼>', 'headShort'],
];
const SLOT = /<[^<>\n]+>/gu;
const TOKEN = /\{([A-Za-z]+)\}/gu;
/** 替換進指令的值只收這些字元（含非 ASCII 字母數字，如中文模型與推理名）：不用加引號、殼也不會拆開或展開它。 */
const SAFE = /^[\p{L}\p{N}._/:@+=,-]+$/u;
const SCAN_HEADER = /^[^\S\n]*(?:\*\*|__)?[^\S\n]*🔍\s*([A-Za-z]+)｜來源：([^｜\n]+)｜掃\s*`?([0-9a-fA-F]{7,40})`?(?:\*\*|__)?\s*$/u;

class LaunchError extends Error {}

/** 範本「以下整段就是送出去的提示」那一段＝第一條整行只有 --- 的分隔線之後。找不到＝null。 */
function promptPart(template) {
  const lines = String(template).replace(/\r\n?/g, '\n').split('\n');
  const i = lines.indexOf('---');
  return i < 0 ? null : lines.slice(i + 1).join('\n').replace(/^\n+/u, '');
}

/** 照 table（預設 FILL）的順序把格子換成值。範本的格子跟表不是一一對上＝不產生（範本改了，產生器要一起改）。 */
function fill(template, values, table = FILL) {
  const part = promptPart(template);
  if (part === null) throw new LaunchError('範本找不到分隔線「---」：不知道哪一段是送出去的提示');
  const slots = part.match(SLOT) || [];
  const expected = table.map(([slot]) => slot);
  const bad = slots.findIndex((s, i) => s !== expected[i]);
  if (slots.length !== expected.length || bad >= 0) {
    const at = bad >= 0 ? bad : Math.min(slots.length, expected.length);
    throw new LaunchError(`範本的格子跟產生器的表對不上（範本 ${slots.length} 格、表 ${expected.length} 格；第 ${at + 1} 格範本是「${slots[at] || '（沒有）'}」、表是「${expected[at] || '（沒有）'}」）：範本改了，產生器要一起改`);
  }
  for (const [slot, key] of table) {
    if (key !== null && (values[key] === undefined || values[key] === null || String(values[key]).trim() === '')) throw new LaunchError(`「${slot}」那一格（${key}）沒有值`);
  }
  let i = 0;
  return part.replace(SLOT, (slot) => { const key = table[i++][1]; return key === null ? slot : String(values[key]); });
}

/** 把樣板裡的 {記號} 換成值；認不得的記號、值裡有不安全的字元＝不產生。 */
function substitute(template, values, what) {
  const used = [...new Set([...String(template).matchAll(TOKEN)].map((m) => m[1]))];
  const unknown = used.filter((t) => !Object.hasOwn(values, t));
  if (unknown.length) throw new LaunchError(`${what}裡有認不得的記號：${unknown.map((t) => `{${t}}`).join('、')}（認得的只有 ${Object.keys(values).map((t) => `{${t}}`).join('、')}）`);
  for (const t of used) {
    if (!SAFE.test(String(values[t]))) throw new LaunchError(`${what}要填進 {${t}} 的值「${values[t]}」有空白或殼會另外解讀的字元：樣板自己寫了引號，這裡不另加，所以不產生（換一個不含這些字元的 --dir）`);
  }
  return { text: String(template).replace(TOKEN, (_, t) => String(values[t])), used };
}

/**
 * 本輪全審還是只核差異（照複審與掃描分級表那一列）。讀不懂那一列、或兩格都中／都不中＝null（不猜）。
 * 上一輪這一位給的是「通過」＝這一輪是通過之後回頭改的那一輪，照 afterPassFix（F2）。
 */
function scopeOf(row, round, previousPassed) {
  if (!row) return null;
  if (previousPassed) return ['全審', '只核差異'].includes(row.afterPassFix) ? row.afterPassFix : null;
  const hit = (cell) => {
    if (cell === '每一輪') return true;
    if (cell === '不適用') return false;
    let m = /^第 (\d+)〜(\d+) 輪$/u.exec(cell);
    if (m) return round >= Number(m[1]) && round <= Number(m[2]);
    m = /^第 (\d+) 輪起$/u.exec(cell);
    if (m) return round >= Number(m[1]);
    return undefined;
  };
  const full = hit(row.full);
  const diff = hit(row.diffOnly);
  if (full === undefined || diff === undefined || full === diff) return null;
  return full ? '全審' : '只核差異';
}

/**
 * 這一位已經在這支貼過的結論：取輪次最大的那則（同輪次取晚貼的）；沒有＝第 1 輪。
 * 同一位＝角色和來源字串都一樣（F5；跟結論閘同一個讀法）：同一個角色換了來源就是另一位，它的輪次與通過不算這一位的（#49 r1 R2）。
 */
function roundsOf(comments, reviewer, source, roles) {
  const time = (c) => { const v = parseInstant(c.createdAt); return v === null ? -Infinity : v; };
  const want = String(source).trim().replace(/\s+/gu, ' ');
  const mine = comments.map((c) => ({ c, h: headerOf(c.body, roles) })).filter((x) => x.h && x.h.role === reviewer && x.h.source === want);
  if (!mine.length) return { round: 1, previous: null };
  const last = mine.reduce((a, b) => ((b.h.round > a.h.round || (b.h.round === a.h.round && time(b.c) > time(a.c))) ? b : a));
  return { round: last.h.round + 1, previous: last };
}

/**
 * 這一位（角色＋來源字串，跟 roundsOf 同一個讀法）在這一支有沒有連續兩輪都沒「通過」（F12：快速通道（AI）連兩輪沒過，改走一般流程）。
 * 每一輪算不算「通過」照結論閘的判法，不另寫一套（Codex #96 r1 R2）：把那一輪這一位貼的結論單獨交給結論閘看——
 * 缺固定小標的「通過」不算、同一輪相反結論或對不同版本各給結論＝衝突、算阻擋；那一輪沒有一則算數的「通過」＝沒過。輪次要相鄰。
 */
function twoMissesInARow(comments, reviewer, source, roles) {
  const want = String(source).trim().replace(/\s+/gu, ' ');
  const rounds = new Map();
  for (const c of comments) {
    const h = headerOf(c.body, roles);
    if (!h || h.role !== reviewer || h.source !== want) continue;
    if (!rounds.has(h.round)) rounds.set(h.round, []);
    rounds.get(h.round).push(c);
  }
  const passedIn = (k) => {
    const state = evaluateVerdicts(rounds.get(k), '', reviewer, roles).reviewers[`${reviewer}（${want}）`];
    return Boolean(state) && !state.blocking;
  };
  return [...rounds.keys()].some((k) => rounds.has(k + 1) && !passedIn(k) && !passedIn(k + 1));
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8' });
  if (r.error) throw new LaunchError(`git 起不來：${r.error.message}`);
  if (r.status !== 0) throw new LaunchError(`git ${args.join(' ')} 退 ${r.status === null ? '（被殺掉）' : r.status}：${(r.stderr || '').trim() || '（沒有訊息）'}`);
  return r.stdout.trim();
}
/** 標頭裡的短碼展開成完整版本碼；本機沒有那一顆就照原樣（差異指令照樣跑得出錯誤，給複審者看見）。 */
const fullSha = (root, short) => (gitOk(root, ['rev-parse', '--verify', '--quiet', `${short}^{commit}`]) ? git(root, ['rev-parse', '--verify', `${short}^{commit}`]) : short);
const gitOk = (cwd, args) => { const r = spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8' }); return !r.error && r.status === 0; };

/** 放樹的資料夾取實體路徑（暫存區常經過連結，例如 /var → /private/var）：印出來的、寫進紀錄的、git 登記的都是同一個字串。 */
function realDir(d) {
  try { return fs.realpathSync(path.resolve(d)); } catch (e) { throw new LaunchError(`放樹的資料夾 ${d} 不在或讀不到（${e.code || e.message}）`); }
}
const filled = (v) => typeof v === 'string' && v.trim() !== '' && v !== UNSET;
const slugOf = (project) => String(project).replace(/[^A-Za-z0-9._-]/gu, '-');
const folderRe = (slug, id) => new RegExp(`^review-${slug.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}-${id}-r(\\d+)$`, 'u');

const scanFolderRe = (slug, id) => new RegExp(`^scan-${slug.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}-${id}$`, 'u');

function askPlatform(platform, settings, op, args) {
  try { return platform.ask(op, args, { settings }); } catch (e) {
    if (e instanceof PlatformError || (e && e.name === 'PlatformError')) throw new LaunchError(`問不到平台（${op}：${e.message}）`);
    throw e;
  }
}

/** 啟動指令樣板認得的記號（launch 裡 tokens 那一張，順序無關）。 */
const COMMAND_TOKENS = ['model', 'effort', 'reviewTree', 'mutationCopy', 'promptFile', 'outFile', 'change', 'project'];
const SCAN_COMMAND_TOKENS = ['model', 'effort', 'scanTree', 'promptFile', 'outFile', 'change', 'project'];
/** 設定裡填了的樣板逐一核：登記了的複審者與掃描者格位都有、記號都認得、啟動指令帶著模型、推理與工作樹路徑。回問題清單；沒登記的不核（新專案還沒填）。 */
function templateProblems(settings) {
  const out = [];
  const tokensOf = (t) => [...String(t).matchAll(TOKEN)].map((m) => m[1]);
  for (const r of Array.isArray(settings.reviewers) ? settings.reviewers : []) {
    if (!r || !filled(r.participant)) continue;
    // 登記了一位複審者，產生器就要得到它的來源字串與啟動樣板（設定形狀那題對陣列只看「是陣列」，少一格看不出來）
    for (const k of ['source', 'command']) if (!filled(r[k])) out.push(`「${r.participant}」的 ${k} 還沒填`);
    if (!filled(r.command)) continue;
    const used = tokensOf(r.command);
    const bad = used.filter((t) => !COMMAND_TOKENS.includes(t));
    if (bad.length) out.push(`「${r.participant}」的啟動指令樣板有認不得的記號：${bad.join('、')}`);
    for (const t of ['model', 'effort', 'reviewTree']) if (!used.includes(t)) out.push(`「${r.participant}」的啟動指令樣板沒帶 {${t}}`);
  }
  const sc = settings.scanner || {};
  if (filled(sc.participant) || (filled(sc.command) && sc.tool !== '無')) {
    for (const k of ['participant', 'strongest', 'maxEffort', 'source', 'command']) {
      if (!filled(sc[k])) out.push(`scanner.${k} 還沒填`);
    }
    if (filled(sc.command)) {
      const used = tokensOf(sc.command);
      const bad = used.filter((t) => !SCAN_COMMAND_TOKENS.includes(t));
      if (bad.length) out.push(`scanner.command 有認不得的記號：${bad.join('、')}`);
      for (const t of ['model', 'effort', 'scanTree']) if (!used.includes(t)) out.push(`scanner.command 沒帶 {${t}}`);
    }
  }
  const rl = settings.reviewLaunch || {};
  const allow = { changeLink: ['project', 'change'], commentLink: ['project', 'change', 'comment'], postComment: ['project', 'change'], copyTest: ['mutationCopy'] };
  for (const [k, ok] of Object.entries(allow)) {
    if (!filled(rl[k])) continue;
    const bad = tokensOf(rl[k]).filter((t) => !ok.includes(t));
    if (bad.length) out.push(`reviewLaunch.${k} 有認不得的記號：${bad.join('、')}（只認 ${ok.join('、')}）`);
  }
  return out;
}

/** 產生：所有平台與設定的事先問完、核完，才動 git 與磁碟（中途失敗不留半套樹）。 */
function launch(changeArg, reviewerArg, { settings = readSettings(), platform = { ask }, cwd = process.cwd(), dir: dirArg = os.tmpdir(), template = null, now = () => new Date() } = {}) {
  const dir = realDir(dirArg);
  const { usable } = rolesOf(settings);
  const reviewer = canonicalRole(reviewerArg, usable);
  if (!reviewer) throw new LaunchError(`--reviewer 給的「${reviewerArg || ''}」不是登記過的參與者（${usable.join('／') || '一個都沒登記'}）`);
  const entry = (Array.isArray(settings.reviewers) ? settings.reviewers : []).find((r) => r && r.participant === reviewer);
  if (!entry) throw new LaunchError(`專案設定的 reviewers 沒有「${reviewer}」那一列：不知道它用什麼模型、怎麼起`);
  for (const k of ['strongest', 'maxEffort', 'autoMode', 'source', 'command']) {
    if (!filled(entry[k])) throw new LaunchError(`專案設定裡「${reviewer}」那一列的 ${k} 還沒填`);
  }
  const rl = settings.reviewLaunch || {};
  for (const k of ['changeLink', 'commentLink', 'postComment', 'copyTest']) {
    if (!filled(rl[k])) throw new LaunchError(`專案設定的 reviewLaunch.${k} 還沒填`);
  }
  const project = settings.platform && settings.platform.project;
  if (!filled(project)) throw new LaunchError('專案設定的 platform.project 還沒填');
  const used = new Set([...entry.command.matchAll(TOKEN)].map((m) => m[1]));
  if (!used.has('model') || !used.has('effort') || !used.has('reviewTree')) throw new LaunchError(`「${reviewer}」的啟動指令樣板沒帶 {model}、{effort} 或 {reviewTree}：漏帶時複審者照預設跑或不在審查樹目錄下執行（F1、F11）`);
  const decider = deciderOf(settings);
  if (!decider) throw new LaunchError('專案設定裡的裁示者識別值或貼文帳號未填或不唯一（也請核對 owner）；修正 settings.json 後重跑：算不出相關裁示');
  const tpl = template === null ? fs.readFileSync(TEMPLATE, 'utf8') : template;

  const change = askPlatform(platform, settings, 'change', { change: String(changeArg) });
  const id = change.id;
  const head = change.headSha;
  const named = canonicalRole(fieldValue(change.body, '複審者'), usable);
  if (named !== reviewer) throw new LaunchError(`PR說明的「複審者」欄是「${named || '讀不出'}」，不是 ${reviewer}：這一輪的通過不會算數（F5 只認說明裡指定的那一位）`);
  const implementer = canonicalRole(fieldValue(change.body, '實作者'), usable);
  if (!implementer) throw new LaunchError('PR說明的「實作者」欄讀不出一位登記過的參與者');
  const base = askPlatform(platform, settings, 'branchSha', { branch: change.baseBranch }).sha;
  const comments = askPlatform(platform, settings, 'comments', { change: id });
  const all = askPlatform(platform, settings, 'allComments', {});
  const rulings = evaluateRulings(all, decider, settings);
  if (rulings.unsure) throw new LaunchError(`相關裁示算不出來（${rulings.unsure}）`);
  // 先 fetch 再算風險：判「快速通道（AI）」要讀本機 git 的主幹與受審版本（F12），沒 fetch 會因為找不到版本而判成不走
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  const fetched = gitOk(root, ['fetch', '--quiet']);
  const risk = riskRun(id, { settings, platform, git: gitIn(root) });
  if (risk.code !== 0) throw new LaunchError(`風險級別算不出來：${risk.lines.join(' ')}`);
  // 風險級別要是受審那一版的：產生提示的這幾秒裡有人推了新版本，算出來的級別與範圍就屬於另一版——拒絕、要求重跑（理財 #672 r3）
  if (risk.result.head !== head) throw new LaunchError(`產生送審提示期間這一支換了版本（受審 ${String(head).slice(0, 12)}，算風險時是 ${String(risk.result.head).slice(0, 12)}）：審查樹與風險範圍會對不上，重跑一次`);
  const tier = risk.result.level;
  const { round, previous } = roundsOf(comments, reviewer, entry.source, usable);
  // 上一輪算不算「通過」照結論閘的判斷，不另寫一套：缺固定小標的通過不算（F7；#49 r1 R3），同一輪相反結論或對不同版本各給結論＝衝突、算阻擋（#49 r2 R1）。
  // 閘合併後這一位最新的有效狀態要正好是最近貼的那一輪、而且不是阻擋，才照「通過後回頭改」那一格縮範圍。
  const verdicts = evaluateVerdicts(comments, head, reviewer, usable);
  if (verdicts.unsure) throw new LaunchError('這一支有結論留言的時間讀不出來：上一輪判不了');
  const state = previous ? verdicts.reviewers[`${reviewer}（${previous.h.source}）`] : null;
  const passed = Boolean(state) && !state.blocking && state.round === previous.h.round;
  // 快速通道（AI）（F12）：第 1 輪起只核差異；這一位連兩輪沒「通過」，這一輪起照這一級走一般流程
  const lane = risk.result.fastLaneAI === true;
  const exhausted = lane && twoMissesInARow(comments, reviewer, entry.source, usable);
  const scope = lane && !exhausted ? '只核差異' : scopeOf((settings.reviewTiers || {})[tier], round, passed);
  if (!scope) throw new LaunchError(`複審與掃描分級表「${tier}」那一列讀不出第 ${round} 輪該全審還是只核差異`);
  const tierWhy = !lane ? '照表算的'
    : exhausted ? '照表算的；這一支原本走快速通道（AI），這一位已經連兩輪沒「通過」，這一輪起照這一級走一般流程（F12）'
      : '照表算的；分級腳本判這一支走快速通道（AI）：第 1 輪起只核差異、不掃描（F12）';
  const commentLink = (changeId, comment) => substitute(rl.commentLink, { project, change: changeId, comment }, '留言網址樣板').text;
  const related = rulings.ruled.filter((x) => String(x.ask.change) === String(id)).map((x) =>
    rulingLink(x.by, commentLink(x.by.change, x.by.id)));

  for (const [what, sha] of [['受審版本', head], ['基底', base]]) {
    if (!gitOk(root, ['cat-file', '-e', `${sha}^{commit}`])) throw new LaunchError(`本機倉庫沒有${what} ${sha}${fetched ? '' : '（git fetch 也沒成功）'}：開不了樹`);
  }
  const folder = path.join(dir, `review-${slugOf(project)}-${id}-r${round}`);
  const tree = path.join(folder, 'tree');
  const mutation = path.join(folder, 'mutation');
  const promptFile = path.join(folder, 'prompt.md');
  const outFile = path.join(folder, 'output.log');
  const tokens = { model: entry.strongest, effort: entry.maxEffort, reviewTree: tree, mutationCopy: mutation, promptFile, outFile, change: id, project };
  if (Object.keys(tokens).sort().join() !== [...COMMAND_TOKENS].sort().join()) throw new Error('COMMAND_TOKENS 跟這一張對不上（程式寫錯）');
  const command = substitute(entry.command, tokens, `「${reviewer}」的啟動指令樣板`).text;
  const values = {
    project, change: id, reviewer, implementer, source: entry.source, head, headShort: head.slice(0, 7), baseBranch: change.baseBranch, base, round,
    changeLink: substitute(rl.changeLink, { project, change: id }, 'PR 網址樣板').text,
    tier, tierWhy, scope,
    previous: previous ? commentLink(id, previous.c.id) : '沒有',
    rulings: related.length ? related.join('、') : '沒有',
    reviewTree: tree, mutationCopy: mutation,
    copyTest: substitute(rl.copyTest, { mutationCopy: mutation }, '副本跑考題指令').text,
    fullDiff: `git diff ${base}...${head}`,
    roundDiff: previous ? `git diff ${fullSha(root, previous.h.sha)}..${head}` : '沒有',
    postComment: substitute(rl.postComment, { project, change: id }, '貼結論的指令').text,
  };
  const prompt = fill(tpl, values);
  if (fs.existsSync(folder)) throw new LaunchError(`${folder} 已經在了：上一次的樹還沒收（先跑 --close ${id}），或這一輪已經送過`);

  const record = { change: id, reviewer, round, head, base, root, tree, mutation, promptFile, outFile, startedAt: now().toISOString() };
  const before = new Set(lockedTrees(root).keys());
  // 排他地建（不帶 recursive：已經在就丟 EEXIST）：上面那一次檢查跟這裡之間，另一個送審可能剛好建好同一輪的資料夾；
  // 帶 recursive 會接受別人的資料夾，下面開樹失敗時再把它整個刪掉（理財 #672 r4 第 1 條）。建成的才是自己的，失敗才收。
  try { fs.mkdirSync(folder); } catch (e) {
    if (e && e.code === 'EEXIST') throw new LaunchError(`${folder} 已經在了：另一個送審剛好在開同一輪，或上一次的樹還沒收（先跑 --close ${id}）`);
    throw e;
  }
  const created = [];
  try {
    git(root, ['worktree', 'add', '--detach', '-q', tree, head]);
    created.push(tree);
    git(root, ['worktree', 'add', '--detach', '-q', mutation, head]);
    created.push(mutation);
    for (const t of [tree, mutation]) {
      const got = git(t, ['rev-parse', 'HEAD']);
      if (got !== head) throw new LaunchError(`${t} 開出來是 ${got}，不是受審版本 ${head}`);
    }
    fs.writeFileSync(promptFile, prompt);
    fs.writeFileSync(path.join(folder, 'launch.json'), `${JSON.stringify(record, null, 1)}\n`);
  } catch (e) {
    // 開到一半失敗：只收這一次自己開的樹與資料夾，不留半套（下一次才不會被「已經在了」或「已登記但不見了」擋住）。
    // 「這一次開的」＝開樹前沒有、現在登記在這個資料夾底下的每一棵：也收得到 git worktree add 已經建好樹、
    // 卻因為掛鉤失敗而退非零的那一棵（#49 r2 R2）；開樹前就登記著的（就算路徑在這底下）不是這一次的，不動。
    // 不用整個倉庫的 git worktree prune：別棵暫時不在原位的樹（例如外接碟沒接上）會被一起清掉登記與索引（#49 r1 R1）
    let registered = created;
    try { registered = [...lockedTrees(root).keys()].filter((t) => t.startsWith(`${folder}${path.sep}`) && !before.has(t)); } catch { /* 讀不到登記就只收確定開成的那幾棵 */ }
    for (const t of new Set([...created, ...registered])) gitOk(root, ['worktree', 'remove', '--force', t]);
    fs.rmSync(folder, { recursive: true, force: true });
    throw e;
  }
  const lines = [
    `送審產生器｜變更 ${id}｜複審者 ${reviewer}（來源 ${entry.source}）｜r${round}｜受審 ${head.slice(0, 7)}｜基底 ${change.baseBranch} 的 ${base.slice(0, 7)}`,
    `  風險級別：${tier}（${lane && !exhausted
      ? '照表算的；這一支走快速通道（AI）：本輪範圍照 F12 只核差異、不照分級表，往重調或裁示者改級只改風險級別那一格'
      : '照表算的；要往重調或裁示者改級，提示的風險級別與本輪範圍兩格要一起照分級表改'}）；本輪範圍：${scope}`,
    lane ? `  快速通道（AI）：${exhausted ? '這一位已經連兩輪沒「通過」，這一輪起照這一級走一般流程（要掃的照 G1 掃）' : '分級腳本判可以，這一輪只核差異、不掃描'}（F12）` : null,
    `  上一輪的結論：${values.previous}；相關裁示：${values.rulings}`,
    `  審查樹：${tree}（HEAD ${head.slice(0, 7)}）`,
    `  突變副本：${mutation}（HEAD ${head.slice(0, 7)}）`,
    `  送審提示：${promptFile}（照 templates/review-request.md 填好，只留 <三選一> 給複審者）`,
    fetched ? null : '  ⚠️ git fetch 沒成功：本機已經有這兩顆版本，照樣開了樹。',
    `啟動指令（模型 ${entry.strongest}、推理 ${entry.maxEffort}；不開的自動模式：${entry.autoMode}）：`,
    command,
    `跑完：退出碼 0 不代表通過、也不代表結論已經貼上去——若複審者只輸出純文字結論（或文末寫「未貼」），跑 node tools/review-launch.js --post ${id}${dir === realDir(os.tmpdir()) ? '' : ` --dir ${dir}`} 先核樹與標頭再代貼；再跑查複審結論的那道閘、看它印的現況（F7）。審完收樹：node tools/review-launch.js --close ${id}${dir === realDir(os.tmpdir()) ? '' : ` --dir ${dir}`}`,
  ].filter((l) => l !== null);
  return { code: 0, lines, record, command, prompt };
}

/** 這個倉庫登記的每一棵樹 → 有沒有上鎖（git worktree list --porcelain；路徑照登記的原字串）。 */
function lockedTrees(root) {
  const out = new Map();
  let cur = null;
  for (const l of git(root, ['worktree', 'list', '--porcelain']).split('\n')) {
    if (l.startsWith('worktree ')) { cur = l.slice(9); out.set(cur, false); } else if (cur && (l === 'locked' || l.startsWith('locked '))) out.set(cur, true);
  }
  return out;
}

/**
 * 暫存區第一層比開樹晚的（只列、不刪），每個暫存區一組、新的排前面。自己那一層與它的上層不算：放樹的資料夾在暫存區裡時，上層的修改時間會跟著變。
 * 分組是因為系統暫存區平常就有別的程式在寫，混成一張表時複審者留在 /tmp 的東西會被擠到收合那一行裡（#49 r1 收樹時看到的）。
 */
function freshEntries(roots, folder, since, re) {
  const seen = new Set();
  const fresh = [];
  const groups = [];
  const unreadable = [];
  const mine = fs.realpathSync(folder);
  for (const r of roots) {
    let real;
    try { real = fs.realpathSync(r); } catch { continue; }
    if (seen.has(real)) continue;
    seen.add(real);
    let names;
    try { names = fs.readdirSync(real); } catch { unreadable.push(real); continue; }
    const group = [];
    for (const n of names) {
      const p = path.join(real, n);
      if (p === mine || mine.startsWith(`${p}${path.sep}`) || re.test(n)) continue;
      try { const t = fs.lstatSync(p).mtimeMs; if (t >= since) group.push({ p, t }); } catch { /* 讀的當下被刪了 */ }
    }
    group.sort((a, b) => b.t - a.t || (a.p < b.p ? -1 : 1));
    if (group.length) groups.push({ root: real, paths: group.map((x) => x.p) });
    fresh.push(...group.map((x) => x.p));
  }
  return { fresh, groups, unreadable };
}

/**
 * 核對純文字結論：去除首尾空行，若最後一行單獨是「未貼」（templates/review-request.md）就剝掉；
 * 核第一行標頭（角色、來源、輪次、受審版本短碼）與「通過」的兩行固定小標（F4、F5、F7；擁有者照 F12 豁免小標）。
 */
function prepareVerdict(raw, { reviewer, source, round, head, usable, ownerRole = null }) {
  const lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (!lines.length) throw new LaunchError('結論檔是空的');
  let strippedUnposted = false;
  if (lines[lines.length - 1].replace(/[ \t]+$/u, '') === '未貼') {
    strippedUnposted = true;
    lines.pop();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  }
  if (!lines.length) throw new LaunchError('結論檔只有「未貼」，沒有結論內容');
  const body = `${lines.join('\n')}\n`;
  const h = headerOf(body, usable);
  if (!h) {
    throw new LaunchError('結論第一行不是合規標頭（照 templates/verdict-header.md：🤖 <識別值>｜來源：<來源字串>｜審 `<短碼>`｜r<輪次>｜結論：<三選一>；標頭前不可有前言或工具雜訊）');
  }
  if (h.role !== reviewer) throw new LaunchError(`結論標頭的角色是「${h.role}」，不是本輪複審者 ${reviewer}`);
  const wantSource = String(source).trim().replace(/\s+/gu, ' ');
  if (h.source !== wantSource) throw new LaunchError(`結論標頭的來源是「${h.source}」，不是設定登記的「${wantSource}」`);
  if (h.round !== round) throw new LaunchError(`結論標頭的輪次是 r${h.round}，不是本輪 r${round}`);
  if (!String(head).toLowerCase().startsWith(h.sha)) {
    throw new LaunchError(`結論標頭審的是 ${h.sha}，對不上本輪受審版本 ${String(head).slice(0, 7)}`);
  }
  if (!h.blocking && h.role !== ownerRole) {
    const miss = missingHeadings(body);
    if (miss.length) throw new LaunchError(`結論是「通過」但少了固定小標：${miss.join('、')}（F7：${PASS_HEADINGS.join('、')} 都要有）`);
  }
  return { body, header: h, strippedUnposted };
}

/**
 * 不開 shell 解析指令字串為參數陣列：支援單引號、雙引號（含 \" 與 \\ 跳脫）及引號外的反斜線跳脫；
 * 引號或跳脫未閉合時丟 LaunchError。
 */
function splitCommandArgs(text) {
  const args = [];
  let cur = '';
  let hasToken = false;
  let quote = null;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else cur += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') {
        quote = null;
      } else if (ch === '\\') {
        if (i + 1 >= s.length) throw new LaunchError('reviewLaunch.postComment 的引號或跳脫字元沒有閉合');
        const next = s[i + 1];
        if (next === '"' || next === '\\' || next === '$' || next === '`') {
          cur += next;
          i += 1;
        } else {
          cur += ch;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasToken = true;
      continue;
    }
    if (ch === '\\') {
      if (i + 1 >= s.length) throw new LaunchError('reviewLaunch.postComment 的引號或跳脫字元沒有閉合');
      cur += s[i + 1];
      hasToken = true;
      i += 1;
      continue;
    }
    if (/\s/u.test(ch)) {
      if (hasToken) {
        args.push(cur);
        cur = '';
        hasToken = false;
      }
      continue;
    }
    cur += ch;
    hasToken = true;
  }
  if (quote !== null) throw new LaunchError('reviewLaunch.postComment 的引號或跳脫字元沒有閉合');
  if (hasToken) args.push(cur);
  return args;
}

/** 原子寫回 JSON 紀錄（先寫同目錄唯一暫存檔再 rename，避免並發讀取看到半套內容）。 */
function writeJsonAtomic(filePath, obj) {
  const tmpFile = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tmpFile, `${JSON.stringify(obj, null, 1)}\n`, { flag: 'wx' });
  fs.renameSync(tmpFile, filePath);
}

/** 每輪排他鎖（post.lock）：同輪並發呼叫 --post 時依序排隊，取得鎖後重讀 launch.json 與平台狀態；遇死程序殘留鎖明確拒絕、不自動刪鎖（避免非原子回收誤刪他程序新鎖）。 */
function withPostLock(folder, fn) {
  const lockFile = path.join(folder, 'post.lock');
  const deadline = Date.now() + 15000;
  let acquired = false;
  while (!acquired) {
    try {
      fs.writeFileSync(lockFile, `${process.pid}\n`, { flag: 'wx' });
      acquired = true;
    } catch (e) {
      if (!e || e.code !== 'EEXIST') throw new LaunchError(`建立代貼鎖失敗：${(e && (e.code || e.message)) || e}`);
      let ownerPid = 0;
      try { ownerPid = Number.parseInt(fs.readFileSync(lockFile, 'utf8').trim(), 10); } catch { /* 剛被釋放 */ }
      if (ownerPid > 0) {
        try { process.kill(ownerPid, 0); } catch (ke) {
          if (ke && ke.code === 'ESRCH') {
            throw new LaunchError(`發現殘留的代貼鎖 ${lockFile}（原持有程序 PID ${ownerPid} 已結束）：請先確認平台上是否已貼出結論，手動移除該鎖檔後再重試`);
          }
        }
      }
      if (Date.now() >= deadline) throw new LaunchError(`另一支代貼程序（PID ${ownerPid || '未知'}）持有 ${lockFile} 逾時，請稍後再試`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    return fn();
  } finally {
    try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
  }
}

/** 執行貼結論指令（不開 shell；清掉 GIT_* 與 platform.clearEnv）。 */
function defaultRunPost(cmd, args, { clearEnv = [] } = {}) {
  const env = gitEnv();
  for (const k of Array.isArray(clearEnv) ? clearEnv : []) delete env[k];
  const r = spawnSync(cmd, args, { env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (r.error) throw new LaunchError(`貼結論指令起不來：${r.error.message}`);
  if (r.status !== 0) {
    const msg = `${r.stderr || ''}\n${r.stdout || ''}`.trim().slice(0, 200);
    throw new LaunchError(`貼結論指令退 ${r.status === null ? '（被殺掉）' : r.status}：${msg || '（沒有訊息）'}`);
  }
}

/**
 * 外殼代貼結論（--post）：任何 AI 複審者只需輸出純文字結論（文末可單獨寫「未貼」），不需在盒內持有平台憑證。
 * 先核審查樹與突變副本都在、乾淨、HEAD 沒變、沒上鎖（不符退 1、不貼），再核結論檔、標頭與小標、平台版本與同輪未重複，通過才代貼並記下 postedAt。
 */
function post(changeArg, { settings = readSettings(), platform = { ask }, dir: dirArg = os.tmpdir(), file: fileArg = null, runPost = defaultRunPost, now = () => new Date() } = {}) {
  const dir = realDir(dirArg);
  const project = settings.platform && settings.platform.project;
  if (!filled(project)) throw new LaunchError('專案設定的 platform.project 還沒填：找不到樹放在哪');
  const rl = settings.reviewLaunch || {};
  if (!filled(rl.postComment)) throw new LaunchError('專案設定的 reviewLaunch.postComment 還沒填：不知道怎麼貼結論');
  const { usable } = rolesOf(settings);
  const ownerRole = canonicalRole(settings && settings.owner, usable);
  const re = folderRe(slugOf(project), String(changeArg).replace(/[^A-Za-z0-9._-]/gu, ''));
  let entries;
  try { entries = fs.readdirSync(dir); } catch (e) { throw new LaunchError(`讀不了 ${dir}（${e.code || e.message}）`); }
  const open = entries.filter((n) => re.test(n)).map((n) => path.join(dir, n)).filter((f) => {
    try { return !JSON.parse(fs.readFileSync(path.join(f, 'launch.json'), 'utf8')).closedAt; } catch { return false; }
  });
  if (!open.length) throw new LaunchError(`在 ${dir} 底下找不到變更 ${changeArg} 還開著的審查樹（review-${slugOf(project)}-${changeArg}-r*）`);
  if (open.length > 1) throw new LaunchError(`在 ${dir} 底下找到 ${open.length} 個還開著的審查資料夾（${open.map((f) => path.basename(f)).join('、')}）：請先整理到只剩本輪一個`);
  const folder = open[0];
  const recFile = path.join(folder, 'launch.json');
  return withPostLock(folder, () => {
    const rec = JSON.parse(fs.readFileSync(recFile, 'utf8'));
    if (String(rec.change) !== String(changeArg)) throw new LaunchError(`launch.json 記的變更編號是 ${rec.change}，不是參數給的 ${changeArg}`);
    if (rec.closedAt) throw new LaunchError(`r${rec.round}（${folder}）已經在 ${rec.closedAt} 收樹，不代貼結論`);
    if (rec.postedAt) throw new LaunchError(`r${rec.round}（${folder}）已經在 ${rec.postedAt} 代貼過結論，不重複貼`);
    const entry = (Array.isArray(settings.reviewers) ? settings.reviewers : []).find((r) => r && r.participant === rec.reviewer);
    if (!entry || !filled(entry.source)) throw new LaunchError(`專案設定的 reviewers 找不到「${rec.reviewer}」或沒填 source`);

    const locks = lockedTrees(rec.root);
    const removed = Array.isArray(rec.removed) ? rec.removed : [];
    const problems = [];
    for (const [what, t] of [['審查樹', rec.tree], ['突變副本', rec.mutation]]) {
      if (removed.includes(t)) { problems.push(`${what}已經收掉了（代貼結論前兩棵樹都要還在、好核對乾淨與 HEAD）`); continue; }
      if (!fs.existsSync(t)) { problems.push(`${what}不見了（${t}）`); continue; }
      if (!locks.has(t)) problems.push(`${what}不在 git worktree 登記裡（${t}）`);
      else if (locks.get(t)) problems.push(`${what}上了鎖`);
      const h = gitOk(t, ['rev-parse', 'HEAD']) ? git(t, ['rev-parse', 'HEAD']) : null;
      if (h !== rec.head) problems.push(`${what}的 HEAD 是 ${h || '讀不出'}，不是受審版本 ${rec.head.slice(0, 7)}`);
      const st = gitOk(t, ['status', '--porcelain']) ? git(t, ['status', '--porcelain']) : null;
      if (st === null) problems.push(`${what}的狀態讀不出`);
      else if (st) problems.push(`${what}不乾淨：${st.split('\n').slice(0, 5).join('；')}${st.split('\n').length > 5 ? '…' : ''}`);
    }
    if (problems.length) {
      return {
        code: 1,
        lines: [
          `沒貼 r${rec.round}（${folder}）：`,
          ...problems.map((p) => `  ・${p}`),
          '  審查樹與突變副本都要在、乾淨、HEAD 沒變、沒上鎖，才代貼結論。',
        ],
      };
    }

    const srcPath = fileArg ? path.resolve(fileArg) : rec.outFile;
    if (!filled(srcPath)) throw new LaunchError('找不到結論檔路徑');
    let st;
    try { st = fs.lstatSync(srcPath); } catch (e) { throw new LaunchError(`讀不到結論檔 ${srcPath}（${e.code || e.message}）`); }
    if (!st.isFile()) throw new LaunchError(`結論檔 ${srcPath} 不是一般檔案（不收連結或資料夾）`);
    const realSrc = fs.realpathSync(srcPath);
    for (const [what, t] of [['審查樹', rec.tree], ['突變副本', rec.mutation]]) {
      let realT;
      try { realT = fs.realpathSync(t); } catch { continue; }
      if (realSrc === realT || realSrc.startsWith(`${realT}${path.sep}`)) {
        throw new LaunchError(`結論檔不可放在${what}裡面（${realSrc}）`);
      }
    }
    const raw = fs.readFileSync(realSrc, 'utf8');
    const prepared = prepareVerdict(raw, { reviewer: rec.reviewer, source: entry.source, round: rec.round, head: rec.head, usable, ownerRole });

    const sub = substitute(rl.postComment, { project, change: rec.change }, '貼結論的指令');
    if (!sub.used.includes('change')) throw new LaunchError('reviewLaunch.postComment 沒帶 {change}：不知道要貼到哪一支');
    const parts = splitCommandArgs(sub.text);
    if (parts.length < 2 || !parts.includes(FILE_SLOT)) {
      throw new LaunchError(`reviewLaunch.postComment 要包含獨立的 ${FILE_SLOT} 佔位（例如 gh pr comment {change} -R {project} --body-file ${FILE_SLOT}）`);
    }

    const change = askPlatform(platform, settings, 'change', { change: String(rec.change) });
    if (change.headSha !== rec.head) {
      throw new LaunchError(`平台目前受審版本是 ${String(change.headSha).slice(0, 7)}，不是開樹時的 ${String(rec.head).slice(0, 7)}：版本已變，不代貼舊版結論`);
    }
    const named = canonicalRole(fieldValue(change.body, '複審者'), usable);
    if (named !== rec.reviewer) {
      throw new LaunchError(`PR說明的「複審者」欄目前是「${named || '讀不出'}」，不是開樹時的 ${rec.reviewer}：不代貼`);
    }
    const comments = askPlatform(platform, settings, 'comments', { change: rec.change });
    const wantSource = String(entry.source).trim().replace(/\s+/gu, ' ');
    const alreadyOnPlatform = comments.some((c) => {
      const h = headerOf(c.body, usable);
      return h && h.role === rec.reviewer && h.source === wantSource && h.round === rec.round;
    });
    if (alreadyOnPlatform) throw new LaunchError(`平台上已經有 ${rec.reviewer}（${wantSource}）的 r${rec.round} 結論留言：不重複貼`);

    const verdictFile = path.join(folder, `verdict-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.md`);
    fs.writeFileSync(verdictFile, prepared.body, { flag: 'wx' });
    const argv = parts.map((p) => (p === FILE_SLOT ? verdictFile : p));
    const clearEnv = Array.isArray(settings.platform && settings.platform.clearEnv) ? settings.platform.clearEnv : [];
    runPost(argv[0], argv.slice(1), { clearEnv });
    rec.postedAt = now().toISOString();
    rec.verdict = prepared.header.verdict;
    rec.verdictFile = verdictFile;
    writeJsonAtomic(recFile, rec);
    return {
      code: 0,
      lines: [
        `已代貼 r${rec.round} 結論｜變更 ${rec.change}｜複審者 ${rec.reviewer}（來源 ${wantSource}）｜審 ${rec.head.slice(0, 7)}｜結論：${prepared.header.verdict}${prepared.strippedUnposted ? '（已剝除文末「未貼」）' : ''}`,
        `  兩棵樹的 HEAD 都還是 ${rec.head.slice(0, 7)}、都乾淨；下一步跑結論閘確認，審完跑：node tools/review-launch.js --close ${rec.change}${dir === realDir(os.tmpdir()) ? '' : ` --dir ${dir}`}`,
      ],
      record: rec,
      header: prepared.header,
      body: prepared.body,
      argv,
    };
  });
}

/**
 * 收樹：還沒收的每一棵都在、HEAD 沒變、狀態乾淨、沒上鎖才動手；有一棵不對就全部留著給人看。
 * 一棵一棵移除，每收好一棵就記進紀錄：收到一半失敗時照實說哪一棵收了、哪一棵沒有，重跑只處理還沒收的（#49 r1 R5）。
 */
/** 移除一棵樹；回 null＝成功，否則回原因。考題換掉它，才考得到「第二棵移除失敗」那一條路。 */
function removeTree(root, t) {
  const r = spawnSync('git', ['worktree', 'remove', t], { cwd: root, env: gitEnv(), encoding: 'utf8' });
  return r.error || r.status !== 0 ? ((r.error && r.error.message) || (r.stderr || '').trim() || `退 ${r.status}`) : null;
}

function close(changeArg, { settings = readSettings(), dir: dirArg = os.tmpdir(), leftoverRoots = [os.tmpdir(), '/tmp'], remove = removeTree } = {}) {
  const dir = realDir(dirArg);
  const project = settings.platform && settings.platform.project;
  if (!filled(project)) throw new LaunchError('專案設定的 platform.project 還沒填：找不到樹放在哪');
  const re = folderRe(slugOf(project), String(changeArg).replace(/[^A-Za-z0-9._-]/gu, ''));
  let entries;
  try { entries = fs.readdirSync(dir); } catch (e) { throw new LaunchError(`讀不了 ${dir}（${e.code || e.message}）`); }
  const open = entries.filter((n) => re.test(n)).map((n) => path.join(dir, n)).filter((f) => {
    try { return !JSON.parse(fs.readFileSync(path.join(f, 'launch.json'), 'utf8')).closedAt; } catch { return false; }
  });
  if (!open.length) throw new LaunchError(`在 ${dir} 底下找不到變更 ${changeArg} 還開著的審查樹（review-${slugOf(project)}-${changeArg}-r*）`);
  const lines = [];
  let refused = false;
  for (const folder of open) {
    const recFile = path.join(folder, 'launch.json');
    const rec = JSON.parse(fs.readFileSync(recFile, 'utf8'));
    const save = () => fs.writeFileSync(recFile, `${JSON.stringify(rec, null, 1)}\n`);
    rec.removed = Array.isArray(rec.removed) ? rec.removed : [];
    const todo = [['審查樹', rec.tree], ['突變副本', rec.mutation]].filter(([, t]) => !rec.removed.includes(t));
    const locks = lockedTrees(rec.root);
    const problems = [];
    for (const [what, t] of todo) {
      if (!fs.existsSync(t)) {
        // 目錄不在、git 也沒登記＝已經有人收過了（照上面的提示手動收的那一棵）；目錄不在但 git 還登記著＝被搬走或刪掉，要人看
        if (!locks.has(t)) { rec.removed.push(t); save(); lines.push(`  r${rec.round} 的${what}已經不在、git 也沒登記：當作收過。`); continue; }
        problems.push(`${what}不見了（${t}），git 還登記著`);
        continue;
      }
      if (locks.get(t)) problems.push(`${what}上了鎖（git worktree unlock 之後再收）`);
      const h = gitOk(t, ['rev-parse', 'HEAD']) ? git(t, ['rev-parse', 'HEAD']) : null;
      if (h !== rec.head) problems.push(`${what}的 HEAD 是 ${h || '讀不出'}，不是受審版本 ${rec.head.slice(0, 7)}`);
      const st = gitOk(t, ['status', '--porcelain']) ? git(t, ['status', '--porcelain']) : null;
      if (st === null) problems.push(`${what}的狀態讀不出`);
      else if (st) problems.push(`${what}不乾淨：${st.split('\n').slice(0, 5).join('；')}${st.split('\n').length > 5 ? '…' : ''}`);
    }
    const already = rec.removed.length ? `（先前已收：${rec.removed.map((t) => (t === rec.tree ? '審查樹' : '突變副本')).join('、')}）` : '';
    if (problems.length) {
      refused = true;
      lines.push(`沒收 r${rec.round}（${folder}）${already}：`, ...problems.map((p) => `  ・${p}`), `  還沒收的${todo.map(([w]) => w).join('、')}都留著；看完要收就自己 git worktree remove（突變副本有改過的檔要加 --force）。`);
      continue;
    }
    let failed = null;
    for (const [what, t] of todo.filter(([, x]) => !rec.removed.includes(x))) {
      const why = remove(rec.root, t);
      if (why) { failed = `${what}移除失敗：${why}`; break; }
      rec.removed.push(t);
      save();
    }
    if (failed) {
      refused = true;
      const done = rec.removed.map((t) => (t === rec.tree ? '審查樹' : '突變副本'));
      lines.push(`收到一半 r${rec.round}（${folder}）：${done.length ? `已收 ${done.join('、')}；` : ''}${failed}。紀錄已記下收了哪幾棵，排除原因後重跑只會收剩下的。`);
      continue;
    }
    rec.closedAt = new Date().toISOString();
    save();
    lines.push(`收好 r${rec.round}${already}：兩棵樹的 HEAD 都還是 ${rec.head.slice(0, 7)}、都乾淨，已移除（提示與輸出檔留在 ${folder}）。`);
    const { groups, unreadable } = freshEntries(leftoverRoots, folder, Date.parse(rec.startedAt), re);
    for (const u of unreadable) lines.push(`  ⚠️ 讀不了 ${u}，那裡比開樹晚的沒列`);
    for (const g of groups) {
      lines.push(`  ${g.root} 第一層比開樹晚的 ${g.paths.length} 筆（新的在前；只列、不刪；可能是複審者另建的，也可能是別的程式同時寫的）：`);
      for (const p of g.paths.slice(0, 10)) lines.push(`    ${p}`);
      if (g.paths.length > 10) lines.push(`    另有 ${g.paths.length - 10} 筆沒列`);
    }
  }
  return { code: refused ? 1 : 0, lines };
}

function scanLaunch(changeArg, { scanner: scannerArg = null, tier: tierArg = null, settings = readSettings(), platform = { ask }, cwd = process.cwd(), dir: dirArg = os.tmpdir(), template = null, now = () => new Date() } = {}) {
  const dir = realDir(dirArg);
  const { usable } = rolesOf(settings);
  const ownerRole = canonicalRole(settings && settings.owner, usable);
  const sc = settings.scanner || {};
  if (sc.tool === '無' || !filled(sc.participant)) {
    throw new LaunchError('本專案沒有設定掃描者（PR說明的「### 複審後掃」下寫「未執行：本專案無掃描者」）');
  }
  const configuredScanner = canonicalRole(sc.participant, usable);
  if (!configuredScanner) throw new LaunchError(`專案設定的 scanner.participant「${sc.participant || ''}」不是登記過的參與者`);
  if (scannerArg !== null && scannerArg !== undefined) {
    const want = canonicalRole(scannerArg, usable);
    if (want !== configuredScanner) throw new LaunchError(`--scanner 給的「${scannerArg}」不是專案設定的掃描者 ${configuredScanner}`);
  }
  if (tierArg !== null && tierArg !== undefined && !TIER_ORDER.includes(tierArg)) {
    throw new LaunchError(`--tier 給的「${tierArg}」不是高／中／低`);
  }
  const scanner = configuredScanner;
  for (const k of ['strongest', 'maxEffort', 'source', 'command']) {
    if (!filled(sc[k])) throw new LaunchError(`專案設定的 scanner.${k} 還沒填`);
  }
  const used = new Set([...sc.command.matchAll(TOKEN)].map((m) => m[1]));
  if (!used.has('model') || !used.has('effort') || !used.has('scanTree')) {
    throw new LaunchError('scanner.command 沒帶 {model}、{effort} 或 {scanTree}：漏帶時掃描者照預設跑或不在掃描樹目錄下執行（G1）');
  }
  const rl = settings.reviewLaunch || {};
  for (const k of ['changeLink', 'commentLink', 'postComment']) {
    if (!filled(rl[k])) throw new LaunchError(`專案設定的 reviewLaunch.${k} 還沒填`);
  }
  const project = settings.platform && settings.platform.project;
  if (!filled(project)) throw new LaunchError('專案設定的 platform.project 還沒填');
  const tpl = template === null ? fs.readFileSync(SCAN_TEMPLATE, 'utf8') : template;

  const change = askPlatform(platform, settings, 'change', { change: String(changeArg) });
  const id = change.id;
  const head = change.headSha;
  const reviewer = canonicalRole(fieldValue(change.body, '複審者'), usable);
  if (!reviewer) throw new LaunchError('PR說明的「複審者」欄讀不出一位登記過的參與者');
  if (ownerRole && reviewer === ownerRole) {
    throw new LaunchError('這一支複審者是擁有者（走快速通道（擁有者）），照 G1、F12 不掃描（PR說明的「### 複審後掃」下寫「未執行：快速通道（擁有者）」）');
  }
  const implementer = canonicalRole(fieldValue(change.body, '實作者'), usable);
  if (!implementer) throw new LaunchError('PR說明的「實作者」欄讀不出一位登記過的參與者');
  if (scanner === implementer || scanner === reviewer) {
    throw new LaunchError(`掃描者 ${scanner} 與本支實作者（${implementer}）或複審者（${reviewer}）重疊：G1 規定由第三個 AI 掃描`);
  }
  const base = askPlatform(platform, settings, 'branchSha', { branch: change.baseBranch }).sha;
  const comments = askPlatform(platform, settings, 'comments', { change: id });
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  const fetched = gitOk(root, ['fetch', '--quiet']);
  const risk = riskRun(id, { settings, platform, git: gitIn(root) });
  if (risk.code !== 0) throw new LaunchError(`風險級別算不出來：${risk.lines.join(' ')}`);
  if (risk.result.head !== head) throw new LaunchError(`準備掃描期間這一支換了版本（目前 ${String(head).slice(0, 12)}，算風險時是 ${String(risk.result.head).slice(0, 12)}）：請重跑一次`);
  const fileTier = risk.result.level;
  const bodyTierRaw = (fieldValue(change.body, '風險級別') || ((/^[ \t]*(?:-[ \t]*)?(?:\*\*)?風險級別(?:\*\*)?[：:][ \t]*([^\n]+)/mu.exec(String(change.body || '')) || [])[1] || '')).trim();
  let bodyTier = null;
  if (bodyTierRaw) {
    const m = /^(高|中|低)/u.exec(bodyTierRaw);
    if (!m) throw new LaunchError(`PR說明的「風險級別」欄「${bodyTierRaw}」讀不出高／中／低`);
    bodyTier = m[1];
  }
  for (const [label, candidate] of [['PR說明的「風險級別」', bodyTier], ['--tier', tierArg]]) {
    if (candidate && TIER_ORDER.indexOf(candidate) > TIER_ORDER.indexOf(fileTier)) {
      throw new LaunchError(`風險級別只升不降（D4）：依檔案算是${fileTier}風險，${label}不可調輕為${candidate}風險`);
    }
  }
  const tier = [fileTier, bodyTier, tierArg].filter(Boolean).reduce((a, b) => (TIER_ORDER.indexOf(b) < TIER_ORDER.indexOf(a) ? b : a));
  const reviewerEntry = (Array.isArray(settings.reviewers) ? settings.reviewers : []).find((r) => r && r.participant === reviewer);
  const lane = risk.result.fastLaneAI === true;
  const exhausted = lane && reviewerEntry && filled(reviewerEntry.source) && twoMissesInARow(comments, reviewer, reviewerEntry.source, usable);
  if (lane && !exhausted) {
    throw new LaunchError('這一支走快速通道（AI），照 G1、F12 不掃描（PR說明的「### 複審後掃」下寫「未執行：快速通道（AI）」）');
  }
  const tierRow = (settings.reviewTiers || {})[tier];
  if (!tierRow || !filled(tierRow.scan)) throw new LaunchError(`複審與掃描分級表找不到「${tier}」風險的掃描規定`);
  if (tierRow.scan === '不掃') {
    throw new LaunchError(`這一支是${tier}風險，照分級表不掃描（PR說明的「### 複審後掃」下寫「未執行：${tier}風險，表定不掃」）`);
  }

  const verdicts = evaluateVerdicts(comments, head, reviewer, usable, { ownerRole });
  if (verdicts.unsure) throw new LaunchError('這一支有結論留言的時間讀不出來：判不了是否已通過複審');
  if (verdicts.problems.length > 0) {
    throw new LaunchError(`目前版本 ${head.slice(0, 7)} 還沒有指定複審者 ${reviewer} 的合格「通過」結論（或尚有阻擋結論）：G1 規定複審「通過」之後才起掃描`);
  }
  const time = (c) => { const v = parseInstant(c.createdAt); return v === null ? Infinity : v; };
  const passComments = comments
    .map((c) => ({ c, h: headerOf(c.body, usable) }))
    .filter((x) => x.h && x.h.role === reviewer && !x.h.blocking && (x.h.role === ownerRole || missingHeadings(x.c.body).length === 0) && String(head).toLowerCase().startsWith(x.h.sha))
    .sort((a, b) => time(a.c) - time(b.c));
  if (!passComments.length) throw new LaunchError(`找不到 ${reviewer} 對目前版本 ${head.slice(0, 7)} 的合格「通過」留言`);
  const passComment = passComments[0].c;
  const passCommentLink = substitute(rl.commentLink, { project, change: id, comment: passComment.id }, '留言網址樣板').text;

  for (const [what, sha] of [['要掃的版本', head], ['基底', base]]) {
    if (!gitOk(root, ['cat-file', '-e', `${sha}^{commit}`])) throw new LaunchError(`本機倉庫沒有${what} ${sha}${fetched ? '' : '（git fetch 也沒成功）'}：開不了掃描樹`);
  }
  const folder = path.join(dir, `scan-${slugOf(project)}-${String(id).replace(/[^A-Za-z0-9._-]/gu, '')}`);
  const tree = path.join(folder, 'tree');
  const promptFile = path.join(folder, 'prompt.md');
  const outFile = path.join(folder, 'output.log');
  const tokens = { model: sc.strongest, effort: sc.maxEffort, scanTree: tree, promptFile, outFile, change: id, project };
  if (Object.keys(tokens).sort().join() !== [...SCAN_COMMAND_TOKENS].sort().join()) throw new Error('SCAN_COMMAND_TOKENS 跟這一張對不上（程式寫錯）');
  const command = substitute(sc.command, tokens, `掃描者「${scanner}」的啟動指令樣板`).text;
  const values = {
    project, change: id, scanner, implementer, reviewer, source: sc.source,
    head, headShort: head.slice(0, 7), baseBranch: change.baseBranch, base, tier,
    changeLink: substitute(rl.changeLink, { project, change: id }, 'PR 網址樣板').text,
    passCommentLink,
    scanTree: tree,
    fullDiff: `git diff ${base}...${head}`,
  };
  const prompt = fill(tpl, values, SCAN_FILL);
  if (fs.existsSync(folder)) throw new LaunchError(`${folder} 已經在了：上一次的掃描樹還沒收（先跑 --scan-close ${id}），或這一支已經掃過`);

  const record = {
    change: id, scanner, source: sc.source, reviewer, implementer, tier,
    head, base, passCommentId: passComment.id, passCommentLink,
    root, tree, promptFile, outFile, startedAt: now().toISOString(),
  };
  const before = new Set(lockedTrees(root).keys());
  try { fs.mkdirSync(folder); } catch (e) {
    if (e && e.code === 'EEXIST') throw new LaunchError(`${folder} 已經在了：另一個掃描剛好在開同一支，或上一次的掃描樹還沒收（先跑 --scan-close ${id}）`);
    throw e;
  }
  const created = [];
  try {
    git(root, ['worktree', 'add', '--detach', '-q', tree, head]);
    created.push(tree);
    const got = git(tree, ['rev-parse', 'HEAD']);
    if (got !== head) throw new LaunchError(`${tree} 開出來是 ${got}，不是要掃的版本 ${head}`);
    fs.writeFileSync(promptFile, prompt);
    fs.writeFileSync(path.join(folder, 'scan.json'), `${JSON.stringify(record, null, 1)}\n`);
  } catch (e) {
    let registered = created;
    try { registered = [...lockedTrees(root).keys()].filter((t) => t.startsWith(`${folder}${path.sep}`) && !before.has(t)); } catch { /* ignore */ }
    for (const t of new Set([...created, ...registered])) gitOk(root, ['worktree', 'remove', '--force', t]);
    fs.rmSync(folder, { recursive: true, force: true });
    throw e;
  }
  const lines = [
    `掃描準備｜變更 ${id}｜掃描者 ${scanner}（來源 ${sc.source}）｜掃 ${head.slice(0, 7)}｜基底 ${change.baseBranch} 的 ${base.slice(0, 7)}`,
    `  風險級別：${tier}（分級表規定：${tierRow.scan}）｜依據的複審通過留言：${passCommentLink}`,
    `  掃描樹：${tree}（HEAD ${head.slice(0, 7)}）`,
    `  掃描提示：${promptFile}（照 templates/scan-record.md 填好）`,
    fetched ? null : '  ⚠️ git fetch 沒成功：本機已經有這兩顆版本，照樣開了掃描樹。',
    `啟動指令（模型 ${sc.strongest}、推理 ${sc.maxEffort}）：`,
    command,
    `跑完：跑 node tools/review-launch.js --scan-post ${id}${dir === realDir(os.tmpdir()) ? '' : ` --dir ${dir}`} 先核掃描樹乾淨與標頭（且不含 🤖）再代貼 🔍 掃描留言；收樹：node tools/review-launch.js --scan-close ${id}${dir === realDir(os.tmpdir()) ? '' : ` --dir ${dir}`}`,
  ].filter((l) => l !== null);
  return { code: 0, lines, record, command, prompt };
}

/**
 * 核對掃描回覆：去除首尾空行，若最後一行單獨是「未貼」就剝掉；
 * 擋下任何含複審結論記號 🤖 的內容（以免觸發結論聯集閘壞標頭攔截）；
 * 擋下回覆自帶的「掃描時序」行（時序證據一律由 --scan-post 外殼依實際紀錄產生）；
 * 核第一行 🔍 標頭（角色、來源、掃描版本短碼）與後續內容非空，並在第二行補上 `> 掃描時序：...` 引用行。
 */
function prepareScan(raw, { scanner, source, head, usable, passCommentLink = null, startedAt = null, postedAt = null, base = null }) {
  const lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (!lines.length) throw new LaunchError('掃描回覆檔是空的');
  let strippedUnposted = false;
  if (lines[lines.length - 1].replace(/[ \t]+$/u, '') === '未貼') {
    strippedUnposted = true;
    lines.pop();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  }
  if (!lines.length) throw new LaunchError('掃描回覆檔只有「未貼」，沒有掃描內容');
  if (/🤖/u.test(lines.join('\n'))) {
    throw new LaunchError('掃描回覆含有複審結論記號 🤖：結論聯集閘會把含 🤖 的非結論留言當成壞標頭擋下（F4、G1），請移除後再代貼');
  }
  const m = SCAN_HEADER.exec(lines[0]);
  if (!m) {
    throw new LaunchError('掃描回覆第一行不是合規標頭（格式：🔍 <識別值>｜來源：<來源字串>｜掃 `<短碼>`；標頭前不可有前言或工具雜訊）');
  }
  const role = canonicalRole(m[1], usable);
  if (!role || role !== scanner) throw new LaunchError(`掃描標頭的角色是「${m[1]}」，不是本支掃描者 ${scanner}`);
  const gotSource = m[2].trim().replace(/\s+/gu, ' ');
  const wantSource = String(source).trim().replace(/\s+/gu, ' ');
  if (gotSource !== wantSource) throw new LaunchError(`掃描標頭的來源是「${gotSource}」，不是設定登記的「${wantSource}」`);
  const sha = m[3].toLowerCase();
  if (!String(head).toLowerCase().startsWith(sha)) {
    throw new LaunchError(`掃描標頭掃的是 ${sha}，對不上要掃的版本 ${String(head).slice(0, 7)}`);
  }
  const rest = lines.slice(1);
  while (rest.length && rest[0].trim() === '') rest.shift();
  if (!rest.length) throw new LaunchError('掃描回覆只有標頭、沒有掃描內容（零發現請寫「- 零發現」）');
  if (rest.some((l) => /^[ \t]*>?[ \t]*(?:\*\*|__)?[ \t]*掃描時序/u.test(l))) {
    throw new LaunchError('掃描回覆不可自帶「掃描時序」行（時序證據一律由 --scan-post 外殼依實際紀錄產生）');
  }
  const timingLine = passCommentLink && startedAt && postedAt && base
    ? `> 掃描時序：依據複審留言 ${passCommentLink}｜準備 ${startedAt}｜代貼 ${postedAt}｜範圍 \`${String(base).slice(0, 7)}..${String(head).slice(0, 7)}\``
    : null;
  const outLines = [lines[0]];
  if (timingLine) {
    outLines.push(timingLine, '');
  } else {
    outLines.push('');
  }
  outLines.push(...rest);
  return {
    body: `${outLines.join('\n')}\n`,
    header: { role, source: gotSource, sha },
    strippedUnposted,
  };
}

function scanPost(changeArg, { settings = readSettings(), platform = { ask }, dir: dirArg = os.tmpdir(), file: fileArg = null, runPost = defaultRunPost, now = () => new Date() } = {}) {
  const dir = realDir(dirArg);
  const project = settings.platform && settings.platform.project;
  if (!filled(project)) throw new LaunchError('專案設定的 platform.project 還沒填：找不到掃描樹放在哪');
  const rl = settings.reviewLaunch || {};
  if (!filled(rl.postComment)) throw new LaunchError('專案設定的 reviewLaunch.postComment 還沒填：不知道怎麼代貼掃描留言');
  const { usable } = rolesOf(settings);
  const folder = path.join(dir, `scan-${slugOf(project)}-${String(changeArg).replace(/[^A-Za-z0-9._-]/gu, '')}`);
  const recFile = path.join(folder, 'scan.json');
  if (!fs.existsSync(recFile)) throw new LaunchError(`在 ${dir} 底下找不到變更 ${changeArg} 的掃描紀錄（${folder}/scan.json）`);
  return withPostLock(folder, () => {
    const rec = JSON.parse(fs.readFileSync(recFile, 'utf8'));
    if (String(rec.change) !== String(changeArg)) throw new LaunchError(`scan.json 記的變更編號是 ${rec.change}，不是參數給的 ${changeArg}`);
    if (rec.closedAt) throw new LaunchError(`掃描樹（${folder}）已經在 ${rec.closedAt} 收樹，不代貼掃描留言`);
    if (rec.postedAt) throw new LaunchError(`掃描樹（${folder}）已經在 ${rec.postedAt} 代貼過掃描留言，不重複貼`);

    const locks = lockedTrees(rec.root);
    const removed = Array.isArray(rec.removed) ? rec.removed : [];
    const problems = [];
    const t = rec.tree;
    if (removed.includes(t)) problems.push('掃描樹已經收掉了（代貼掃描留言前掃描樹要還在、好核對乾淨與 HEAD）');
    else if (!fs.existsSync(t)) problems.push(`掃描樹不見了（${t}）`);
    else {
      if (!locks.has(t)) problems.push(`掃描樹不在 git worktree 登記裡（${t}）`);
      else if (locks.get(t)) problems.push('掃描樹上了鎖');
      const h = gitOk(t, ['rev-parse', 'HEAD']) ? git(t, ['rev-parse', 'HEAD']) : null;
      if (h !== rec.head) problems.push(`掃描樹的 HEAD 是 ${h || '讀不出'}，不是要掃的版本 ${rec.head.slice(0, 7)}`);
      const st = gitOk(t, ['status', '--porcelain']) ? git(t, ['status', '--porcelain']) : null;
      if (st === null) problems.push('掃描樹的狀態讀不出');
      else if (st) problems.push(`掃描樹不乾淨：${st.split('\n').slice(0, 5).join('；')}${st.split('\n').length > 5 ? '…' : ''}`);
    }
    if (problems.length) {
      return {
        code: 1,
        lines: [
          `沒貼掃描留言（${folder}）：`,
          ...problems.map((p) => `  ・${p}`),
          '  掃描樹要在、乾淨、HEAD 沒變、沒上鎖，才代貼掃描留言。',
        ],
      };
    }

    const srcPath = fileArg ? path.resolve(fileArg) : rec.outFile;
    if (!filled(srcPath)) throw new LaunchError('找不到掃描回覆檔路徑');
    let st;
    try { st = fs.lstatSync(srcPath); } catch (e) { throw new LaunchError(`讀不到掃描回覆檔 ${srcPath}（${e.code || e.message}）`); }
    if (!st.isFile()) throw new LaunchError(`掃描回覆檔 ${srcPath} 不是一般檔案（不收連結或資料夾）`);
    const realSrc = fs.realpathSync(srcPath);
    let realT = null;
    try { realT = fs.realpathSync(t); } catch { /* ignore */ }
    if (realT && (realSrc === realT || realSrc.startsWith(`${realT}${path.sep}`))) {
      throw new LaunchError(`掃描回覆檔不可放在掃描樹裡面（${realSrc}）`);
    }
    const raw = fs.readFileSync(realSrc, 'utf8');
    const nowIso = now().toISOString();
    const prepared = prepareScan(raw, {
      scanner: rec.scanner, source: rec.source, head: rec.head, usable,
      passCommentLink: rec.passCommentLink, startedAt: rec.startedAt, postedAt: nowIso, base: rec.base,
    });

    const sub = substitute(rl.postComment, { project, change: rec.change }, '貼留言的指令');
    if (!sub.used.includes('change')) throw new LaunchError('reviewLaunch.postComment 沒帶 {change}：不知道要貼到哪一支');
    const parts = splitCommandArgs(sub.text);
    if (parts.length < 2 || !parts.includes(FILE_SLOT)) {
      throw new LaunchError(`reviewLaunch.postComment 要包含獨立的 ${FILE_SLOT} 佔位`);
    }

    const change = askPlatform(platform, settings, 'change', { change: String(rec.change) });
    if (change.headSha !== rec.head) {
      throw new LaunchError(`平台目前版本是 ${String(change.headSha).slice(0, 7)}，不是開掃描樹時的 ${String(rec.head).slice(0, 7)}：版本已變，不代貼舊版掃描`);
    }
    const comments = askPlatform(platform, settings, 'comments', { change: rec.change });
    const wantSource = String(rec.source).trim().replace(/\s+/gu, ' ');
    const alreadyOnPlatform = comments.some((c) => {
      const firstLine = String(c.body || '').replace(/\r\n?/g, '\n').split('\n').find((l) => l.trim() !== '') || '';
      const m = SCAN_HEADER.exec(firstLine);
      if (!m) return false;
      const r = canonicalRole(m[1], usable);
      const s = m[2].trim().replace(/\s+/gu, ' ');
      return r === rec.scanner && s === wantSource && String(rec.head).toLowerCase().startsWith(m[3].toLowerCase());
    });
    if (alreadyOnPlatform) throw new LaunchError(`平台上已經有 ${rec.scanner}（${wantSource}）對 ${rec.head.slice(0, 7)} 的 🔍 掃描留言：不重複貼`);

    const replyFile = path.join(folder, `scan-reply-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.md`);
    fs.writeFileSync(replyFile, prepared.body, { flag: 'wx' });
    const argv = parts.map((p) => (p === FILE_SLOT ? replyFile : p));
    const clearEnv = Array.isArray(settings.platform && settings.platform.clearEnv) ? settings.platform.clearEnv : [];
    runPost(argv[0], argv.slice(1), { clearEnv });
    rec.postedAt = nowIso;
    rec.replyFile = replyFile;
    writeJsonAtomic(recFile, rec);
    return {
      code: 0,
      lines: [
        `已代貼掃描留言｜變更 ${rec.change}｜掃描者 ${rec.scanner}（來源 ${wantSource}）｜掃 ${rec.head.slice(0, 7)}${prepared.strippedUnposted ? '（已剝除文末「未貼」）' : ''}`,
        `  掃描樹的 HEAD 還是 ${rec.head.slice(0, 7)}、狀態乾淨；收樹跑：node tools/review-launch.js --scan-close ${rec.change}${dir === realDir(os.tmpdir()) ? '' : ` --dir ${dir}`}`,
      ],
      record: rec,
      header: prepared.header,
      body: prepared.body,
      argv,
    };
  });
}

function scanClose(changeArg, { settings = readSettings(), dir: dirArg = os.tmpdir(), leftoverRoots = [os.tmpdir(), '/tmp'], remove = removeTree } = {}) {
  const dir = realDir(dirArg);
  const project = settings.platform && settings.platform.project;
  if (!filled(project)) throw new LaunchError('專案設定的 platform.project 還沒填：找不到掃描樹放在哪');
  const cleanId = String(changeArg).replace(/[^A-Za-z0-9._-]/gu, '');
  const folder = path.join(dir, `scan-${slugOf(project)}-${cleanId}`);
  const recFile = path.join(folder, 'scan.json');
  if (!fs.existsSync(recFile)) throw new LaunchError(`在 ${dir} 底下找不到變更 ${changeArg} 還開著的掃描樹（${ path.basename(folder) }）`);
  const rec = JSON.parse(fs.readFileSync(recFile, 'utf8'));
  if (rec.closedAt) throw new LaunchError(`在 ${dir} 底下找不到變更 ${changeArg} 還開著的掃描樹（${ path.basename(folder) } 已於 ${rec.closedAt} 收樹）`);
  const save = () => fs.writeFileSync(recFile, `${JSON.stringify(rec, null, 1)}\n`);
  rec.removed = Array.isArray(rec.removed) ? rec.removed : [];
  const t = rec.tree;
  const locks = lockedTrees(rec.root);
  const problems = [];
  const lines = [];
  if (!rec.removed.includes(t)) {
    if (!fs.existsSync(t)) {
      if (!locks.has(t)) { rec.removed.push(t); save(); lines.push('  掃描樹已經不在、git 也沒登記：當作收過。'); }
      else problems.push(`掃描樹不見了（${t}），git 還登記著`);
    } else {
      if (locks.get(t)) problems.push('掃描樹上了鎖（git worktree unlock 之後再收）');
      const h = gitOk(t, ['rev-parse', 'HEAD']) ? git(t, ['rev-parse', 'HEAD']) : null;
      if (h !== rec.head) problems.push(`掃描樹的 HEAD 是 ${h || '讀不出'}，不是要掃的版本 ${rec.head.slice(0, 7)}`);
      const st = gitOk(t, ['status', '--porcelain']) ? git(t, ['status', '--porcelain']) : null;
      if (st === null) problems.push('掃描樹的狀態讀不出');
      else if (st) problems.push(`掃描樹不乾淨：${st.split('\n').slice(0, 5).join('；')}${st.split('\n').length > 5 ? '…' : ''}`);
    }
  }
  if (problems.length) {
    lines.push(`沒收掃描樹（${folder}）：`, ...problems.map((p) => `  ・${p}`), '  掃描樹留著；看完要收就自己 git worktree remove。');
    return { code: 1, lines };
  }
  if (!rec.removed.includes(t)) {
    const why = remove(rec.root, t);
    if (why) {
      lines.push(`沒收掃描樹（${folder}）：掃描樹移除失敗：${why}`);
      return { code: 1, lines };
    }
    rec.removed.push(t);
    save();
  }
  rec.closedAt = new Date().toISOString();
  save();
  lines.push(`收好掃描樹：HEAD 還是 ${rec.head.slice(0, 7)}、狀態乾淨，已移除（提示與輸出檔留在 ${folder}）。`);
  const re = scanFolderRe(slugOf(project), cleanId);
  const { groups, unreadable } = freshEntries(leftoverRoots, folder, Date.parse(rec.startedAt), re);
  for (const u of unreadable) lines.push(`  ⚠️ 讀不了 ${u}，那裡比開樹晚的沒列`);
  for (const g of groups) {
    lines.push(`  ${g.root} 第一層比開樹晚的 ${g.paths.length} 筆（新的在前；只列、不刪）：`);
    for (const p of g.paths.slice(0, 10)) lines.push(`    ${p}`);
    if (g.paths.length > 10) lines.push(`    另有 ${g.paths.length - 10} 筆沒列`);
  }
  return { code: 0, lines };
}

function parseArgs(argv) {
  const out = { change: undefined, reviewer: undefined, close: undefined, post: undefined, scan: undefined, scanner: undefined, tier: undefined, scanPost: undefined, scanClose: undefined, file: undefined, dir: undefined };
  const flagMap = {
    '--reviewer': 'reviewer',
    '--close': 'close',
    '--post': 'post',
    '--file': 'file',
    '--dir': 'dir',
    '--scan': 'scan',
    '--scanner': 'scanner',
    '--tier': 'tier',
    '--scan-post': 'scanPost',
    '--scan-close': 'scanClose',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (Object.hasOwn(flagMap, a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { error: `${a} 後面要接值` };
      out[flagMap[a]] = v;
      i += 1;
    } else if (a.startsWith('--')) return { error: `不認得的參數：${a}` };
    else if (out.change === undefined) out.change = a;
    else return { error: `多給了一個參數：${a}` };
  }
  const modes = ['close', 'post', 'scan', 'scanPost', 'scanClose'].filter((k) => out[k] !== undefined);
  if (modes.length > 1) return { error: '一次只能指定一種模式（--close、--post、--scan、--scan-post、--scan-close）' };
  if (out.close !== undefined) {
    return out.change === undefined && out.reviewer === undefined && out.scanner === undefined && out.tier === undefined && out.file === undefined
      ? out : { error: '--close 只收變更編號（和 --dir）' };
  }
  if (out.post !== undefined) {
    return out.change === undefined && out.reviewer === undefined && out.scanner === undefined && out.tier === undefined
      ? out : { error: '--post 只收變更編號（和選填的 --file、--dir）' };
  }
  if (out.scan !== undefined) {
    return out.change === undefined && out.reviewer === undefined && out.file === undefined
      ? out : { error: '--scan 只收變更編號（和選填的 --scanner、--tier、--dir）' };
  }
  if (out.scanPost !== undefined) {
    return out.change === undefined && out.reviewer === undefined && out.scanner === undefined && out.tier === undefined
      ? out : { error: '--scan-post 只收變更編號（和選填的 --file、--dir）' };
  }
  if (out.scanClose !== undefined) {
    return out.change === undefined && out.reviewer === undefined && out.scanner === undefined && out.tier === undefined && out.file === undefined
      ? out : { error: '--scan-close 只收變更編號（和 --dir）' };
  }
  if (out.scanner !== undefined) return { error: '--scanner 只能配 --scan 用' };
  if (out.tier !== undefined) return { error: '--tier 只能配 --scan 用' };
  if (out.file !== undefined) return { error: '--file 只能配 --post 或 --scan-post 用' };
  if (out.change === undefined || out.reviewer === undefined) return { error: '要給變更編號與 --reviewer' };
  return out;
}

function main(argv, opts = {}) {
  const a = parseArgs(argv);
  if (a.error) return { code: 2, lines: [a.error, USAGE] };
  const dir = a.dir || opts.dir;
  try {
    if (a.close !== undefined) return close(a.close, { ...opts, ...(dir ? { dir } : {}) });
    if (a.post !== undefined) return post(a.post, { ...opts, ...(dir ? { dir } : {}), ...(a.file ? { file: a.file } : {}) });
    if (a.scan !== undefined) return scanLaunch(a.scan, { ...opts, ...(a.scanner ? { scanner: a.scanner } : {}), ...(a.tier ? { tier: a.tier } : {}), ...(dir ? { dir } : {}) });
    if (a.scanPost !== undefined) return scanPost(a.scanPost, { ...opts, ...(dir ? { dir } : {}), ...(a.file ? { file: a.file } : {}) });
    if (a.scanClose !== undefined) return scanClose(a.scanClose, { ...opts, ...(dir ? { dir } : {}) });
    return launch(a.change, a.reviewer, { ...opts, ...(dir ? { dir } : {}) });
  } catch (e) {
    if (e instanceof LaunchError) {
      const action = (a.close !== undefined || a.scanClose !== undefined)
        ? '沒有收'
        : (a.post !== undefined || a.scanPost !== undefined)
          ? '沒有貼'
          : '沒有產生';
      return { code: 2, lines: [`送審產生器：${e.message}——${action}。`] };
    }
    throw e;
  }
}

if (require.main === module) {
  let result;
  try { result = main(process.argv.slice(2)); } catch (e) { result = { code: 2, lines: [`送審產生器：沒預期到的錯誤（${(e && e.code) || (e && e.message) || '不明'}）——沒有產生。`] }; }
  process.stdout.write(`${result.lines.join('\n')}\n`);
  process.exit(result.code);
}

module.exports = { main, launch, close, post, scanLaunch, scanPost, scanClose, prepareVerdict, prepareScan, splitCommandArgs, defaultRunPost, fill, promptPart, substitute, scopeOf, roundsOf, twoMissesInARow, parseArgs, templateProblems, freshEntries, lockedTrees, FILL, SCAN_FILL, SCAN_TEMPLATE, SCAN_HEADER, FILE_SLOT, SAFE, COMMAND_TOKENS, SCAN_COMMAND_TOKENS, LaunchError };

