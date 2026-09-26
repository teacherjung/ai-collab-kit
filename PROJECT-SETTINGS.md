# 專案設定（每個使用這套架構的專案填一份；規矩本文與機器都從這裡取值）

這是產物：值住在 settings.json，改完跑 node tools/build-settings.js。搬進專案後把每個「未設定」填掉；沒填的欄位＝那條規矩的機器退化成靠自覺。「填了設定」和「機器已啟用」是兩件事，最後一節逐支登記。

本檔裡的指令是**展示**：一格一格用空白隔開，含空白、引號、反斜線或換行的那一格用 JSON 字串寫（例如換行寫成 \n）。不要把展示文字直接貼進終端機跑——那樣 \n 會變成字面的反斜線加 n；執行一律用 settings.json 裡的陣列、經工具入口（搬家修正 r2 T6）。

## 一、參與者識別值

變更說明的「實作者」「獨立審查者」兩欄、結論標頭與自評的角色格，填的是這裡的識別值，不是職稱。

值域：現階段只准純拉丁字母：結論標頭的正則只收 A 到 Z 的字母，協作欄位閘收得寬，兩道機器值域不同——要放寬就得標頭與欄位閘整族一起改。

| 參與者 | 識別值 | 貼文帳號 |
|---|---|---|
| 裁示者（人） | William | teacherjung |
| AI 甲 | Claude | teacherjung |
| AI 乙 | Codex | teacherjung |

貼文帳號資格：只採計登記在參與者表裡的貼文帳號貼的 ❓／⚖️／🚫；沒登記的帳號貼的不採計為有效留痕——它貼的 ❓ 不入待裁，它貼的 ⚖️／🚫 不能替已採計的問題收口（原題繼續待裁），形狀合規的會另列成疑似。⚖️ 另外要由裁示者那一位的帳號貼。結論閘只認識別值、不認帳號。多方共用同一個帳號時，機器分不出是誰親自貼的——那是這套機制的邊界，不是保證。

## 二、來源字串標準表（結論標頭的來源欄；寫作義務：跨輪次一字不改、不含會變的東西）

| 審查工具或工作階段 | 逐字來源字串 |
|---|---|
| 本機 codex CLI 起的審查 session | codex CLI |
| Claude Code CLI 起的審查 session | Claude CLI |
| Codex 桌面 session | Codex 桌面 |
| Claude 桌面 session | Claude 桌面 |
| William 本人（產品裁決） | William 本人 |

## 三、清單與正本的位置

| 項目 | 規矩 | 位置 |
|---|---|---|
| 禁區工具與能力清單（含攔截器安裝在哪一方） | B1 | 無：套件倉庫沒有接任何攔截器（倉庫裡沒有 \.claude\/、\.codex\/），根目錄 settings\.json 的 forbidden 維持未設定；攔截器的判斷程式與接線範本是給使用專案的（tools\/forbidden\-tools\.js、templates\/hook\-\*\.json） |
| 真實資料檔清單 | B4 | 無：套件倉庫沒有真實資料（考題一律用自己造的假資料） |
| 忽略清單、檢查豁免允許清單 | E7 | 忽略＝\.gitignore（由 settings\.json 的 ignoreLists 登記、tests\/ignore\-lists\.test\.js 逐字比對）；檢查豁免：無 |
| 路標考題掃描的目錄範圍 | K3 | tests\/signposts\.test\.js：掃 tests\/ 第一層的 \*\.test\.js 與 tests\/helpers\/ 第一層的 \.js（目錄寫死、不讀這一格） |
| 三關的實際命令、執行環境版本、稽核等級（或唯一設定檔位置） | E2、E3 | settings\.json 的 checks：只有 node \-\-test 一關（套件零相依，沒有型別與風格兩關）；雲端＝\.github\/workflows\/ci\.yml 的「三關」job 呼叫 tools\/run\-checks\.js；執行環境版本＝\.node\-version；本機推送前鉤子：套件倉庫沒裝（core\.hooksPath 沒設），E2 在本倉庫靠自覺 |
| 必要檢查名單與分支保護設定（指向平台上的設定正本與驗證入口，不另抄一份會漂的名單） | E3、H3 | 正本在 GitHub：main 分支保護的 required\_status\_checks（唯讀重讀：gh api repos\/teacherjung\/ai\-collab\-kit\/branches\/main\/protection\/required\_status\_checks）；檢查名逐字對應 \.github\/workflows\/ci\.yml 與 \.github\/workflows\/collab\-fields\.yml 的 job 名 |
| 合併步驟登記正本（閘登記對帳題讀它） | H1 | settings\.json 的 gates（登記；每筆＝name／rules／command／args／state）；各閘腳本＝tools\/gates\/\*\.js；對帳考題＝tests\/settings\.test\.js（磁碟上的閘 vs 登記的閘）；合併指令 tools\/merge\.js 只跑登記為已啟用的閘、任一非零就停 |
| 合併前必做的驗收依據 | A5 | 無合併前驗收：套件倉庫沒有畫面與部署；改動同步進使用專案時照那個專案的驗收走。合併預授權＝本檔 mergeAuthorization 那一格 |
| 合併後驗收分級與動作的正本（路徑家族表＋各級動作） | H6 | 未啟用：套件倉庫沒有畫面與部署，acceptance 維持未設定；改動在同步進使用專案那一支照該專案的分級驗收 |

主幹分支名（原閘寫死 main，規矩 H2、H3、H4）：main

## 四、掃描發射者（規矩 A1、G4）

- 掃描器：無（套件倉庫沒有隔離盒；掃描器與隔離綁在使用專案）（沒有掃描器＝每支的掃描紀錄寫「未執行：本專案無掃描器」，由下面指定的那一方記錄並轉正式）
- 誰指派、登記在哪：無（沒有掃描器）
- 兩方都起得了時：無（沒有掃描器）
- 沒有合格者時，誰記錄未執行、誰轉正式：每支由實作者在 PR 說明的「\#\#\# 複審後掃」下逐字寫「未執行：本專案無掃描器」、不擋合併；轉正式也由實作者做

隔離（規矩 G2；裁示者 2026-09-12 裁「丙」：隔離本身不在套件裡，由這裡指定誰提供；套件只帶掃前試探與掃後比對兩支小工具）：

- 由誰提供：未設定（「無」或「未設定」＝不掃，掃描紀錄寫「未執行：無隔離」）
- 從盒內跑一條指令的前綴（{box} 會換成盒子路徑、{projectRoot} 會換成專案根目錄）：未設定
- 盒子建在：未設定（未設定＝系統暫存區）
- 盒內必須讀不到也寫不進的目錄（~ 代表家目錄；試探在每一個各埋一個假機密）：未設定
- 整條鏈（每一步退非零就停，掃描紀錄寫未執行）：
  1. node tools/scan-probe.js：任一禁區用它的讀寫機制碰得到＝隔離是假的，不掃；連試探都做不成（含盒內起不了那個機制）＝不掃。
  2. node tools/scan-probe.js --plant <清單檔>：在每個禁區埋一個掃描期間才有的假機密。清單檔不要貼進任何紀錄。
  3. 跑掃描器（本套件不代跑）。
  4. node tools/scan-postmortem.js --secrets <清單檔> --reply <回覆檔> --logs <日誌目錄>：假機密或未給盒子的真值出現在任何輸出（含檔名）＝事故。
  5. node tools/scan-probe.js --sweep <清單檔>：把埋下去的收掉。這一步一定要跑。

## 五、平台介面（規矩 E5、H1；閘要問平台的每一件事都走這裡）

套件只定「問什麼」與「答案長什麼樣」，每個動作填一條指令，指令要把答案印成約定形狀的 JSON。翻譯是這個專案的事，套件不碰任何平台的語彙。沒登記的動作被問到時一律不放行，不會回一個空答案假裝問過了。

平台：GitHub；倉庫身分（指令裡的 {project}）：teacherjung\/ai\-collab\-kit；問平台前要清掉的選倉環境變數：GH\_REPO、GH\_HOST

| 動作 | 要問什麼 | 登記的指令 |
|---|---|---|
| change | 讀一支變更的基本資料 | gh pr view \{change\} \-R \{project\} \-\-json number\,title\,body\,baseRefName\,headRefName\,headRefOid\,state\,isDraft\,isCrossRepository\,autoMergeRequest\,changedFiles\,author \-\-jq \{id\:\(\.number\|tostring\)\,title\:\.title\,body\:\.body\,baseBranch\:\.baseRefName\,headBranch\:\.headRefName\,headSha\:\.headRefOid\,state\:\.state\,isDraft\:\.isDraft\,isCrossRepo\:\.isCrossRepository\,autoMergeOn\:\(\.autoMergeRequest\!\=null\)\,changedFileCount\:\(\.changedFiles\|tostring\)\,author\:\.author\.login\} |
| openChanges | 列出目前開著的每一支變更（⚠️ 必須是全部，分頁要在這條指令裡處理完；套件驗不到少給了幾支） | gh api \-\-paginate repos\/\{project\}\/pulls\?state\=open\&per\_page\=100 \-\-jq \[\.\[\]\|\{id\:\(\.number\|tostring\)\,baseBranch\:\.base\.ref\,headBranch\:\.head\.ref\,headSha\:\.head\.sha\,isDraft\:\.draft\,author\:\.user\.login\}\] |
| comments | 讀一支變更底下的留言（結論、裁示、撤回都靠它） | gh api \-\-paginate repos\/\{project\}\/issues\/\{change\}\/comments\?per\_page\=100 \-\-jq \[\.\[\]\|\{id\:\(\.id\|tostring\)\,author\:\.user\.login\,body\:\.body\,createdAt\:\.created\_at\}\] |
| allComments | 讀整個專案的每一則一般留言，各帶它所屬的變更編號（⚠️ 必須是全部、含已關的變更，分頁要在這條指令裡處理完） | gh api \-\-paginate repos\/\{project\}\/issues\/comments\?per\_page\=100 \-\-jq \"\[\.\[\]\|\{id\:\(\.id\|tostring\)\,author\:\.user\.login\,body\:\.body\,createdAt\:\.created\_at\,change\:\(\.issue\_url\|split\(\\\"\/\\\"\)\|last\)\}\]\" |
| changedFiles | 讀一支變更動了哪些檔 | gh api \-\-paginate repos\/\{project\}\/pulls\/\{change\}\/files\?per\_page\=100 \-\-jq \"\[\.\[\]\|\{path\:\.filename\,status\:\.status\,previousPath\:\(\.previous\_filename \/\/ null\)\}\]\" |
| checks | 讀某一顆版本上跑過的檢查場次（⚠️ 必須是全部，分頁要在這條指令裡處理完） | gh api \-\-paginate repos\/\{project\}\/commits\/\{sha\}\/check\-runs\?per\_page\=100 \-\-jq \"\[\.check\_runs\[\]\|\{name\:\.name\,status\:\.status\,conclusion\:\.conclusion\,completedAt\:\.completed\_at\,producer\:\(if \.app then \(\.app\.id\|tostring\) else null end\)\}\]\" |
| requiredChecks | 讀主幹設了哪些必過檢查（名單的正本在平台上，不另抄一份會漂的） | gh api repos\/\{project\}\/branches\/\{branch\}\/protection\/required\_status\_checks \-\-jq \"\[\.checks\[\]\|\{name\:\.context\,producer\:\(if \(\.app\_id \/\/ \-1\) \< 0 then null else \(\.app\_id\|tostring\) end\)\}\]\" |
| branchSha | 讀一個分支現在指到哪一顆 | gh api repos\/\{project\}\/git\/ref\/heads\/\{branch\} \-\-jq \{sha\:\.object\.sha\} |
| markReady | 把一支變更從草稿轉成正式 | node \-e \"process\.stderr\.write\(\'實跑：這個平台動作刻意封住，合併一律走 mergeCommand\\\\n\'\)\;process\.exit\(97\)\" \{change\} |
| merge | 按下合併鍵 | node \-e \"process\.stderr\.write\(\'實跑：這個平台動作刻意封住，合併一律走 mergeCommand\\\\n\'\)\;process\.exit\(97\)\" \{change\} |

## 六、三關（規矩 E2、E3、H4；跨變更試合併閘在臨時樹裡跑的就是這幾條）

- 臨時樹的準備指令（在新開的臨時樹裡跑一次，例如安裝相依；沒有就填「無」）：無
- 三關指令（依序跑、任一非零＝紅；每一條要自己保證執行環境跟合併後的樹一致——套件驗不到這件事）：
  1. node \-\-test
- 主目錄布局（只有三關執行器看；填「一般工作樹」＝從連結工作樹跑三關時，前後各問一次主目錄有沒有被判成裸倉庫、打不打得開；未設定＝不問）：一般工作樹
- 索引錨點（只有三關執行器看；填一串從根目錄算起的檔案路徑＝每一個都要在跑三關那棵樹的索引裡，前後各驗一次；未設定＝不驗）：package\.json、rules\.json、settings\.json

## 七、禁區（規矩 B1；攔截器的判斷讀這裡，程式裡不寫任何禁區的名字）

- 禁區叫什麼：未設定（未設定＝攔截器一律拒絕）
- 會動到禁區的連接器（白名單制）：（空）
- 那些連接器上准用的唯讀工具：（空）
- 逐字拒絕的工具名：（空）
- 家族網的動詞：（空）；名詞：（空）；唯讀前綴（跳過家族網）：（空）
- 額外樣式：（空）

## 八、合併後驗收分級（規矩 H6；分級工具讀這裡，只算不擋）

| 級別（從最重到最輕） | 動作 |
|---|---|
| 未設定 | 未設定 |

| 路徑家族（正規式） | 級別 |
|---|---|
| 未設定 | 未設定 |

沒列到的路徑一律當：未設定

## 九、忽略清單登記（規矩 B4、E7；考題比對每一份的生效樣式）

- \.gitignore：node\_modules\/、\.DS\_Store

## 十、合併步驟登記（規矩 H1；合併指令照這個順序跑，任一道紅就停）

| 順序 | 閘 | 規矩 | 指令 | 狀態 |
|---|---|---|---|---|
| 1 | 複審結論聯集（有沒有未撤銷的阻擋、有沒有對目前版本的通過） | A2、F4、F5 | node tools\/gates\/check\-review\-verdicts\.js | 已啟用 |
| 2 | 協作欄位（四欄齊全、實作者不等於獨立審查者） | A2、E1 | node tools\/gates\/check\-collab\-fields\.js | 已啟用 |
| 3 | 堆疊（底是主幹、上面沒有疊別支） | H2 | node tools\/gates\/check\-stacked\.js | 已啟用 |
| 4 | 真考卷（必要檢查最新場次真的跑過且成功） | H3 | node tools\/gates\/check\-checks\-really\-ran\.js | 已啟用 |
| 5 | 跨變更試合併（與每支以主幹為底的開著變更真合起來跑三關） | H4 | node tools\/gates\/check\-cross\-merge\.js | 已啟用 |

全綠之後執行的合併指令：gh pr merge \{change\} \-R \{project\} \-\-squash \-\-delete\-branch \-\-match\-head\-commit \{sha\} \-\-body \"Reviewed\-By\: \{reviewer\}\\nMerged\-By\: \{merger\}\"

合併指令認得的記號：{change}（變更編號）、{sha}（按鍵前核過的版本）、{project}（platform.project）、{reviewer}（變更說明「獨立審查者」欄那一位）、{merger}（跑 node tools/merge.js <編號> --merger <識別值> 自報的那一位）。帶上 {reviewer}／{merger} 合併紀錄才留得下誰審、誰合（H5）；帶上 {sha} 平台才會替你擋最後一刻被推上來的新版本。認不得的記號＝不放行。

⚠️ 沒有任何一道閘登記成「已啟用」時，合併指令不放行：一支什麼都沒檢查就按合併鍵的指令比沒有更危險。

## 十一、合併預授權（規矩 A5）

未設定。預授權不取代 A5 列的其餘條件。

## 十二、機器啟用狀態（逐支登記；「已啟用」以外的一律當靠自覺）

| 機器 | 規矩 | 狀態 | 驗過的日期 |
|---|---|---|---|
| 平台介面（閘與待裁清單問平台的十個動作，答案形狀不合就不放行） | E5、H1 | 已啟用 | 2026\-09\-13 |
| 合併指令（依序跑完登記的閘，任一道紅就停） | H1 | 已啟用 | 2026\-09\-12 |
| 協作欄位閘（四欄齊全、實作者不等於獨立審查者） | A2、E1 | 已啟用 |  |
| 結論聯集閘（阻擋各自撤銷、放行只認指定那一位對目前版本的通過） | F4、F5 | 已啟用 |  |
| 禁區攔截器（判斷一份，兩家 AI 的鉤子都呼叫它） | B1 | 已安裝未啟用 |  |
| 忽略清單一致考題（登記的每一份忽略檔跟生效的樣式一字不差） | B4、E7 | 已啟用 | 2026\-09\-13 |
| 推送前鉤子範本＋三關執行器（讀設定的三關、前後驗工作樹） | E2 | 已安裝未啟用 |  |
| 雲端三關與協作欄位閘的範本 | E3 | 已啟用 |  |
| 清版本控制環境變數的共用實作（GIT\_ 前綴整族清） | E4 | 已啟用 | 2026\-09\-13 |
| 閘的退出路徑與進入點行為題（每一道閘的考題各有「真的跑一遍指令」與「問不到＝退 2」） | E5 | 已啟用 | 2026\-09\-13 |
| 檔名考題（已追蹤路徑只用可見 ASCII；例外名單寫死、只出不進） | E6 | 已啟用 | 2026\-09\-13 |
| 掃描前試探（禁區各埋一個假機密，從盒內試讀試寫；隔離本身由專案設定指定誰提供） | G2 | 已啟用 | 2026\-09\-12 |
| 掃描後比對（假機密與未給盒子的真值不得出現在回覆、日誌、檔名） | G2 | 已啟用 | 2026\-09\-12 |
| 合併閘登記對帳題（磁碟上的閘 vs 設定登記的閘） | H1 | 已啟用 | 2026\-09\-13 |
| 堆疊閘（底必須是主幹、不可以有別支疊在上面） | H2 | 已啟用 |  |
| 真考卷閘（必過檢查在那顆版本上真的跑過且成功） | H3 | 已啟用 |  |
| 跨變更試合併閘（與每支以主幹為底的開著變更真合起來跑三關） | H4 | 已啟用 |  |
| 驗收分級工具（路徑家族表住設定；只算不擋） | H6 | 已安裝未啟用 |  |
| 本文長度考題 | K2 | 已啟用 | 2026\-09\-12 |
| 案例簿考題＋索引產生器 | K1、K2 | 已啟用 | 2026\-09\-12 |
| 專案設定產生器 | K1 | 已啟用 | 2026\-09\-12 |
| 範本存在與固定小標考題 | E1、G3 | 已啟用 | 2026\-09\-13 |
| 路標考題（帶記號的引號路標要指得到） | K3 | 已啟用 | 2026\-09\-13 |
| 待裁清單工具（掃整個專案的留言；只列不擋） | D1 | 已啟用 |  |
