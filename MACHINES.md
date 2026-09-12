# 機器索引（本文每個「機器」標籤對到什麼）

本文（RULES.md）句尾的執行者標籤，定義在這裡、只在這裡（標籤只寫名字，不寫「機器：」前綴；**每個標籤都要以這張表上的某個名字開頭**，後面才接射程說明。`tests/rules-length.test.js` 會拿這張表對帳：表上沒有的名字、或名字沒擺在開頭，都會紅）：

| 標籤 | 意思 | 守不到的 |
|---|---|---|
| 雲端 | 合併前必過的雲端檢查，每次推送自動跑 | 要在平台上設成「必過檢查」且對管理員一樣生效，沒設＝退化成靠自覺 |
| 合併閘 | 合併步驟裡由合併者親手跑的腳本；跑了才擋 | 沒跑沒人擋；只認它讀得到的自報欄位與留言 |
| 鉤子 | 推送前在本機自動跑；每份複本要自己啟用 | 可被強制跳過；沒啟用的複本等於沒有 |
| 考題 | 測試卷裡的一題，改壞就紅 | 只守它斷言的那件事；不證明人有沒有遵守 |
| 攔截 | 工具被呼叫的當下被擋 | 只認清單上的工具名；每一方的攔截器要各自安裝、信任、啟用 |
| 掃描自檢 | 掃描腳本自己的前置檢查與事後驗屍；只有在被呼叫那一次會跑 | 沒人去跑就什麼都不會發生；綁著它跑的那台機器與那支掃描器 |
| 分級腳本 | 合併後算「這一支要驗到什麼程度」並印出來；只算不擋 | 有沒有照印出來的做完全靠自覺；路徑家族表沒列到的一律往重的算 |
| 靠自覺 | 沒有機器 | 全部 |

## 專案設定

正本＝`settings.json`（值只有這一份）；`PROJECT-SETTINGS.md` 是由它產生的**產物**，給人讀、不要手改（改完跑 `node tools/build-settings.js`，考題比逐字元相同）。搬進專案後把每個「未設定」填掉：參與者識別值（值域與貼文帳號資格）、來源字串標準表、各清單與正本的位置（禁區、真實資料、忽略／豁免、路標範圍、主幹分支、三關命令、必要檢查、合併步驟登記、驗收依據與分級正本）、掃描發射者的登記方式、合併預授權，以及每支機器的啟用狀態。變更說明的「實作者」「獨立審查者」兩欄、結論標頭與自評的角色格，填的是識別值、不是職稱；「共享檔案」「最糟失去什麼」兩欄填內容。來源字串標準表是**寫作義務**：機器只驗來源非空、同一身分前後一致，不驗它在不在表上。

## 本文條目 → 機器

移植狀態（2026-09-12）：除 K2 的長度考題已在本倉庫就位，其餘**全部尚未移植**；「原專案的實作」欄是 personal-finance-webapp main `7246efa` 的路徑，供搬運時定位。「啟用前提」驗不過的，那條標籤當靠自覺。

| 本文 | 原專案的實作 | 違反時會紅的條件 | 守不到的 | 啟用前提 | 移植狀態 |
|---|---|---|---|---|---|
| A2、E1、D3 | `scripts/check-pr-collab-fields.js`＋`.github/workflows/collab-fields.yml`＋`.github/pull_request_template.md`＋`test/collab-fields-cli.test.js` | 四欄任一缺、角色識別值不在名單、實作者＝獨立審查者 | 真實身分、是否真的複審過、誰按鍵、預約秩序 | 平台上設成必過檢查且對管理員生效；識別值名單改成本專案的 | 尚未移植 |
| A2、F4、F5 | `scripts/check-review-verdicts.js`＋`test/review-verdicts.test.js`＋`test/review-verdicts-cli.test.js` | 有未撤銷的阻擋、沒有針對目前版本的合規通過、有 🤖 記號但標頭寫壞（普通補發救不了，要正式重述或豁免）＝退 1；查不清＝退 2 | 沒有 🤖 記號的留言只提醒不擋；來源是否在標準表上；有沒有人跑 | 合併者親手跑；來源字串規矩照 templates/verdict-header.md；識別值只收純拉丁字母 | 尚未移植（要改：識別值名單、豁免句裡寫死的裁示者名字） |
| B1 | `.claude/settings.json` deny＋PreToolUse hook、`.codex/hooks.json`、`test/money-boundary.test.js`、`test/codex-money-hook.test.js` | 命中清單上的工具名／家族即拒絕 | 清單外的任何能力；沒安裝那一方 | 每一方各自安裝、信任、啟用；清單改成本專案的 | 尚未移植 |
| B4、E7 | `test/no-hiding-places.test.js` | 指定忽略／豁免清單被改就紅 | 資料是否被讀；子目錄另設清單、其他豁免通道 | 清單重列 | 尚未移植 |
| E2、E3 | `scripts/git-hooks/pre-push`、`.github/workflows/ci.yml`、`test/worktree-integrity.test.js`、`test/deploy-config.test.js` | 三關任一失敗＝鉤子擋推送／雲端紅 | 鉤子被跳過；沒人看雲端結果 | 每份複本啟用鉤子；雲端工作設成必過檢查；執行環境版本與稽核等級改成本專案的 | 尚未移植 |
| E4 | `lib/git-env.js`＋`test/git-env.test.js`＋各已知呼叫點的行為題 | 共用實作退化、受測呼叫點洩漏環境變數就紅 | 新呼叫點不會被自動找到 | 新呼叫點各補一題 | 尚未移植 |
| E5 | 各閘的 CLI 題、`test/entry-guard.test.js` | 已知退出路徑與進入點的行為 | 未來新腳本 | 每支新閘各補題 | 尚未移植 |
| E6 | `test/doc-naming.test.js` | 已追蹤路徑含非可見 ASCII 就紅 | 未追蹤的檔 | 例外名單清空 | 尚未移植 |
| G2 | `scripts/grok-scan.js` 家族（金絲雀、隔離設定、轉送器、驗屍）＋`test/grok-scan-flow-*.test.js` | 被呼叫時前置檢查失敗＝退 2；驗屍破口＝退 1 | 只在被呼叫時；綁 macOS 沙箱與特定掃描器 | 同一掃描器與作業系統；換掃描器＝重寫 | 尚未移植（要不要搬待裁） |
| H1 | `test/collab-invariant-docs.test.js` 的閘登記對帳題＋`test/helpers/merge-gates.js`；登記正本＝REVIEW-AND-MERGE.md「合併步驟」 | 腳本自報的閘與程序登記的集合不符就紅 | 有沒有人跑、閘有沒有效 | 本套件要有自己的「合併步驟」登記正本 | 尚未移植 |
| H2 | `scripts/check-pr-merge-gate.js`＋`test/merge-gate.test.js` | 底不是主幹或有上層＝退 1；查不清＝退 2 | 刪分支、改底順序 | 合併者親手跑 | 尚未移植 |
| H3 | `scripts/check-ci-really-ran.js`＋`test/ci-really-ran.test.js` | 必要檢查最新場次非成功、自動合併開著就擋 | 仍須人跑 | 必要檢查名單改成本專案的 | 尚未移植 |
| H4 | `scripts/check-cross-pr-merge.js`＋`test/cross-pr-merge.test.js` | 以主幹為底的每支 open 變更試合併後三關紅就擋；環境查不清退 2 | 重跑次數不計；非主幹底的支；枚舉上限（原腳本 `--limit 100`） | 合併者親手跑 | 尚未移植 |
| H6 | `scripts/acceptance-tier.js`＋`test/acceptance-tier.test.js` | 算出級別與動作 | 有沒有照做 | 路徑家族表重寫成本專案的 | 尚未移植 |
| A5、H1 | 本倉庫 `tools/merge.js`＋`tests/merge.test.js`（閘的登記在 `settings.json`） | 沒有任何一道閘登記成「已啟用」、主幹分支名沒填、沒給變更編號、任一道閘非零、合併指令沒登記，都不放行；任一道紅就停在那裡，後面的閘與合併鍵都不動 | 擋不住「不用這支指令、直接按平台的合併鍵」（那要平台級的分支保護）；也不驗那幾道閘自己對不對 | 無 | 已就位 |
| A1 | 本倉庫 `tools/build-settings.js`＋`tests/settings.test.js`（專案設定的值存 `settings.json`，說明是產物） | PROJECT-SETTINGS.md 與重新產生的結果不一致、欄位不合契約、啟用狀態不是約定的三種、機器標了不存在的條號，就紅 | 欄位填的值對不對、「已啟用」是不是真的啟用 | 無 | 已就位 |
| K2 | 本倉庫 `tests/rules-length.test.js`＋`tools/build-rules.js`（規矩存 `rules.json`，本文是產物；資料契約＋所有 ASCII 標點一律跳脫） | 字數超過、資料不合契約（非單行／空／前後帶空白）、標籤沒以已定義名字開頭、編碼漏跳脫或解回來與原文不同、RULES.md 與產生結果不一致，就紅 | 作者把語意上的新規矩寫成一個仍然合格的標題或射程說明；「解回來與原文相同」只保證本地解碼（呈現器對空字元另有替換，已由契約擋掉，其餘呈現差異不在保證內）；也不宣稱任何未來改法都繞不過 | 無 | 已就位 |
| 案例簿 | 本倉庫 `tests/casebook.test.js`＋`tools/build-casebook-index.js`（索引由案例檔產生、是產物；產生器的輸入與本文共用同一套契約與字面編碼） | 案例或索引含 CR 之類的換行或 HTML 註解記號、案例檔不是固定形狀（標題、空行、六欄依序、最多一行「相關」）、**索引與重新產生的結果不逐字元相同**、索引產生器的輸入不合契約（日期、檔名、條號的固定寫法，散文單行非空）、條號不存在、本文有條規矩沒案例指著、案例或索引出現字表上的名字（不分大小寫、整行照掃），就紅 | 欄位「非空」指的是原始欄值非空、不是呈現出來看得到字（這一題不解讀標記語言，只擋掉已知會產生隱藏內容的那兩樣）；事實對不對、一事一檔、來源連結活不活著、條號撐不撐得住那條規矩（字面引用≠事件支撐）、字表以外的新產品名與變形拼寫、其他個人狀況 | 無 | 已就位 |
| K3 | `test/comment-test-refs.test.js` | 指定考題目錄第一層、帶記號的同檔路標不存在就紅 | 其他目錄與更深層 | 目錄範圍改成本專案的 | 尚未移植 |
| D1 | `scripts/pending-rulings.js`＋`test/pending-rulings.test.js` | 只印清單、不擋 | 一切 | 留痕形狀要對上它的解析器（templates/ruling-record.md 是形狀正本）；解析器裡寫死的裁示者名字、撤回自報句、只採計擁有者帳號（OWNER）這三處要參數化成 PROJECT-SETTINGS 的值 | 尚未移植 |

## 範本（本文指到「範本」的地方）

- `templates/pr-body.md`：變更說明四欄與固定小標（E1、G3）。
- `templates/verdict-header.md`：結論留言機器標頭、三種留言的分法、撤銷條件（F4、F5、F7）。
- `templates/review-fixed-dimensions.md`：審查固定維度＋條件列（F2）。
- `templates/self-review.md`：公開自評的首行、四格與邊界（F9）。
- `templates/third-round-self-check.md`：第三輪自問表五題（F10）。
- `templates/scan-record.md`：掃描紀錄與未執行收口（G3）。
- `templates/ruling-record.md`：問裁示者、裁示落地、合規撤回的留痕形狀（I1、I3）。
