# 機器索引（本文每個「機器」標籤對到什麼）

本文（RULES.md）句尾的執行者標籤，定義在這裡、只在這裡：

| 標籤 | 意思 | 守不到的 |
|---|---|---|
| 機器：雲端 | 合併前必過的雲端檢查，每次推送自動跑 | 要在平台上設成「必過檢查」且對管理員一樣生效，沒設＝退化成靠自覺 |
| 機器：合併閘 | 合併步驟裡由合併者親手跑的腳本；跑了才擋 | 沒跑沒人擋；只認它讀得到的自報欄位與留言 |
| 機器：鉤子 | 推送前在本機自動跑；每份複本要自己啟用 | 可被強制跳過；沒啟用的複本等於沒有 |
| 機器：考題 | 測試卷裡的一題，改壞就紅 | 只守它斷言的那件事；不證明人有沒有遵守 |
| 機器：攔截 | 工具被呼叫的當下被擋 | 只認清單上的工具名；每一方的攔截器要各自安裝、信任、啟用 |
| 靠自覺 | 沒有機器 | 全部 |

換專案先照下表的「啟用前提」逐項驗過；驗不過的標籤一律當靠自覺（本文開頭那句）。

## 專案設定（每個專案自己填一處，本文與機器都從這裡取值）

- 參與者識別值：每一位（人、每個 AI）一個固定字串；變更說明四欄與結論標頭填的是**識別值**，不是職稱。
- 禁區工具與能力清單（本文 乙1）、真實資料檔清單（乙4）。
- 掃描發射者的登記方式：每支一位；兩方都起得了掃描器時誰來（本文 甲1）。
- 合併是否預先授權（甲5）。
- 來源字串標準表（結論標頭「來源」欄只認表上的值，一個字不改）。

## 本文條目 → 機器（移植狀態：2026-09-12 全部「尚未移植」，原專案 personal-finance-webapp 的實作路徑供搬運）

| 本文 | 原專案的實作 | 違反時會紅的條件 | 守不到的 | 移植狀態 |
|---|---|---|---|---|
| 甲2、戊1、丁3 | `scripts/check-pr-collab-fields.js`＋`.github/workflows/collab-fields.yml`＋PR 範本＋`test/collab-fields-cli.test.js` | 四欄非空、角色可辨、實作者≠獨立審查者 | 真實身分、是否真的複審過、誰按鍵 | 尚未移植（要改：識別值名單、欄位名、分支保護設定） |
| 乙1 | `.claude/settings.json` deny＋PreToolUse hook、`.codex/hooks.json`、`test/money-boundary.test.js`、`test/codex-money-hook.test.js` | 命中清單上的工具名／家族即拒絕 | 清單外的任何能力；沒安裝那一方 | 尚未移植（要改：工具名清單；每一方各自信任＋啟用） |
| 乙4、戊7 | `test/no-hiding-places.test.js` | 指定忽略／豁免清單被改就紅 | 資料是否被讀；子目錄另設清單、其他豁免通道 | 尚未移植（清單重列） |
| 戊2、戊3 | `scripts/git-hooks/pre-push`、`.github/workflows/ci.yml`、`test/worktree-integrity.test.js`、`test/deploy-config.test.js` | 三關任一失敗＝鉤子擋推送／雲端紅 | 鉤子被跳過；沒人看雲端結果 | 尚未移植（要改：執行環境版本、稽核等級） |
| 戊4 | `lib/git-env.js`＋`test/git-env.test.js`＋各已知呼叫點的行為題 | 共用實作退化、受測呼叫點洩漏環境變數就紅 | 新呼叫點不會被自動找到 | 尚未移植 |
| 戊5 | 各閘的 CLI 題、`test/entry-guard.test.js` | 已知退出路徑與進入點的行為 | 未來新腳本 | 尚未移植 |
| 戊6 | `test/doc-naming.test.js` | 已追蹤路徑含非可見 ASCII 就紅 | 未追蹤的檔 | 尚未移植（例外名單清空） |
| 己4、己5 | `scripts/check-review-verdicts.js`＋`test/review-verdicts.test.js` | 合規標頭取聯集、更高輪次撤銷、只認目前版本、放行只認指定審查者 | 沒標頭的留言只警告不擋 | 尚未移植（要改：識別值、來源字串表） |
| 庚2 | `scripts/grok-scan.js` 家族（金絲雀、隔離設定、轉送器、驗屍）＋`test/grok-scan-flow-*.test.js` | 被呼叫時前置檢查失敗＝退 2；驗屍破口＝退 1 | 只在被呼叫時；綁 macOS 沙箱與特定掃描器 | 尚未移植（換掃描器＝重寫；要不要搬待裁） |
| 辛1 | `test/helpers/merge-gates.js`＋登記對帳題 | 自報閘與程序登記集合不符就紅 | 有沒有人跑、閘有沒有效 | 尚未移植 |
| 辛2 | `scripts/check-pr-merge-gate.js`＋`test/merge-gate.test.js` | 底不是主幹或有上層＝退 1；查不清＝退 2 | 刪分支、改底順序 | 尚未移植 |
| 辛3 | `scripts/check-ci-really-ran.js`＋`test/ci-really-ran.test.js` | 必要檢查最新場次非成功、自動合併開著就擋 | 仍須人跑 | 尚未移植 |
| 辛4 | `scripts/check-cross-pr-merge.js`＋`test/cross-pr-merge.test.js` | 以主幹為底的每支 open 變更試合併後三關紅就擋；環境查不清退 2 | 重跑次數不計；非主幹底的支 | 尚未移植 |
| 辛6 | `scripts/acceptance-tier.js`＋考題 | 算出級別與動作 | 有沒有照做 | 尚未移植（路徑家族表要重寫） |
| 子2 | 本倉庫 `tests/rules-length.test.js` | 去空白字元數＞3,000 就紅 | 取捨理由 | 已就位 |
| 子3 | `test/comment-test-refs.test.js` | 指定考題目錄第一層、帶記號的同檔路標不存在就紅 | 其他目錄與更深層 | 尚未移植 |
| 丁1 | `scripts/pending-rulings.js`＋`test/pending-rulings.test.js` | 只印清單、不擋 | 一切 | 尚未移植（要拔掉舊的 72 小時常數與逾時欄位） |

## 範本（本文指到「範本」的地方）

- `templates/pr-body.md`：變更說明四欄與固定小標（戊1、庚3）。
- `templates/verdict-header.md`：結論留言機器標頭與撤銷條件（己4、己5、己7）。
- `templates/review-fixed-dimensions.md`：審查固定維度（己2）。
- `templates/self-review.md`：公開自評的首行與四格（己9）。
- `templates/third-round-self-check.md`：第三輪自問表五題（己10）。
- `templates/scan-record.md`：掃描紀錄（庚3）。
- `templates/ruling-record.md`：問裁示者與裁示落地的留痕形狀（壬1、壬3）。
