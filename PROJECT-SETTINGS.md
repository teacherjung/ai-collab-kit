# 專案設定（每個使用這套架構的專案填一份；規矩本文與機器都從這裡取值）

這是產物：值住在 settings.json，改完跑 node tools/build-settings.js。搬進專案後把每個「未設定」填掉；沒填的欄位＝那條規矩的機器退化成靠自覺。「填了設定」和「機器已啟用」是兩件事，最後一節逐支登記。

本檔裡的指令是**展示**：一格一格用空白隔開，含空白、引號、反斜線或換行的那一格用 JSON 字串寫（例如換行寫成 \n）。不要把展示文字直接貼進終端機跑——那樣 \n 會變成字面的反斜線加 n；執行一律用 settings.json 裡的陣列、經工具入口。

## 一、參與者識別值

PR說明的「實作者」「複審者」兩欄、結論標頭與自評的角色格，填的是這裡的識別值，不是職稱。參與者可以登記三個以上：多一位就在下表多加一列（例如第三個 AI）。

值域：現階段只准純拉丁字母：結論標頭的正則只收 A 到 Z 的字母，協作欄位閘收得寬，兩道機器值域不同——要放寬就得標頭與欄位閘整族一起改。

| 參與者 | 識別值 | 貼文帳號 |
|---|---|---|
| 裁示者（人） | William | teacherjung |
| AI 甲 | Claude | teacherjung |
| AI 乙 | Codex | teacherjung |

貼文帳號資格：只採計登記在參與者表裡的貼文帳號貼的 ❓／⚖️／🚫；沒登記的帳號貼的不採計為有效留痕——它貼的 ❓ 不入待裁，它貼的 ⚖️／🚫 不能替已採計的問題收口（原題繼續待裁），形狀合規的會另列成疑似。⚖️ 另外要由裁示者那一位的帳號貼。結論閘只認識別值、不認帳號。多方共用同一個帳號時，機器分不出是誰親自貼的——那是這套機制的邊界，不是保證。

預設分工（規矩 A1；裁示者沒有逐支指定時，PR說明的「實作者」「複審者」兩欄照這個填）：實作者＝Claude；複審者＝Codex

擁有者（規矩 A1；文字快速通道由他當複審者，F12，結論閘認他的「通過」不要求固定小標）：William

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
| 必要檢查名單與分支保護設定（指向平台上的設定正本與驗證入口，不另抄一份會漂的名單） | E3、H3 | 正本在 GitHub：main 分支保護的 required\_status\_checks（唯讀重讀：gh api repos\/teacherjung\/ai\-collab\-kit\/branches\/main\/protection\/required\_status\_checks）；檢查名逐字對應 \.github\/workflows\/ci\.yml 與 \.github\/workflows\/collab\-fields\.yml 的 job 名；怎麼設（傳統分支保護規則、勾哪幾格）見 README「本倉庫自己怎麼合併」的雲端那一項 |
| 合併步驟登記正本（閘登記對帳題讀它） | H1 | settings\.json 的 gates（登記；每筆＝name／rules／command／args／state）；各閘腳本＝tools\/gates\/\*\.js；對帳考題＝tests\/settings\.test\.js（磁碟上的閘 vs 登記的閘）；合併指令 tools\/merge\.js 只跑登記為已啟用的閘、任一非零就停 |
| 「按合併鍵」前要查的三種例外（裁示者叫停、本支還沒回的待裁、改到禁區清單的PR要擁有者點頭） | A5 | 本支還沒回的待裁＝合併指令裡的待裁閘（tools\/gates\/check\-pending\-rulings\.js）；開工時看全部還沒回的＝node tools\/pending\-rulings\.js。另外兩種靠自覺：叫停＝看對話與本支PR的留言；改到禁區清單的PR＝先等擁有者點頭——空白範本 tests\/helpers\/unfilled\-settings\.json 的 forbidden 那一塊與禁區攔截器 tools\/forbidden\-tools\.js 就是每個專案拿到的禁區清單與判斷，改到它們的PR一樣先等 |
| 合併後驗收分級與動作的正本（路徑家族表＋各級動作） | H6 | 已啟用（2026\-10\-08）：套件倉庫沒有畫面、部署或要重啟的程式，acceptance 只填一級「免驗收」、所有路徑都歸它（合併後 node tools\/acceptance\-tier\.js \<編號\> 印得出來，照它印的做＝不需擁有者驗收）；改動在同步進使用專案那一支照該專案的分級驗收 |
| 「指示檔」與「常設指示」寫在哪（兩方每次開工都會自動整份讀進去的那一份） | K6 | 根目錄 AGENTS\.md 的「擁有者的常設指示」那一節。不建 CLAUDE\.md（也不建 CLAUDE\.local\.md、\.claude\/CLAUDE\.md；工作目錄的上層任何一層也算）：只要有它，Claude 就只讀它、不讀 AGENTS\.md（Claude Code 2\.1\.277 起才讀 AGENTS\.md、2\.1\.281 起各種工作階段都讀）；Codex 只自動讀 AGENTS\.md 前約 32 KB，所以那份要保持短 |
| 「進度摘要」放在哪、已結束的留幾天（各方共用一份） | J5 | 主目錄的上一層、檔名 progress\-summary\.md，跟使用專案 personal\-finance\-webapp 共用同一份（兩個主目錄在同一層；以主目錄為準，放在別處的工作資料夾（樹）的上一層不是這裡）；附件（證據位置）從 2026\-10\-09 起另放同一層的 progress\-attachments\.md，本檔的附件那一節只留指標（檢查時帶 \-\-attachments）。已結束的留 30 天（擁有者 2026\-10\-07 裁，取代 2026\-09\-21 對 personal\-finance\-webapp 裁的七天；2026\-10\-05 裁示這套規定也放進套件）。歷史（J5「經過不寫，歷史留在版本控制」）：主目錄的上一層那個資料夾本身是一個只在本機、不推送的 git 小倉庫，只追蹤這份、附件檔與同一層幾份倉庫外文件（擁有者 2026\-10\-07 裁），每次更新由更新的那一方提交一次、只帶自己改的檔。這個小倉庫不是套件或使用專案的倉庫：考題、閘與PR的差異都看不到它；形狀、兩個時間、沒動的線、附件條號由進度摘要檢查列出（只列不擋），內容真不真、清理（結案縮一行、超過保留天數刪）靠更新的那一方（靠自覺） |

待辦清單（開工印待辦 tools/backlog-touch.js 讀它；規矩 F6）：BACKLOG\.md 的「\#\# 待辦」那一節

使用這個套件的專案（下游落後 tools/downstream-lag.js 讀它、開工時手動跑、只列不擋；只有套件倉庫要填，使用專案留空）：
- 理財：teacherjung\/personal\-finance\-webapp 的 main；還沒裝 kit-lock.json 時用的版本 0820c4d28839ff5c923c069462156f6005e61252（出處：理財 PROJECT\.md 記的套件版本（2026\-09\-28 那一版＝套件 \#19；2026\-09\-29 理財 \#645 同步）；理財裝了 kit\-lock\.json 之後改讀它，這兩格就不再用）

主幹分支名（原閘寫死 main，規矩 H2、H3、H4）：main

## 四、掃描發射者（規矩 A1、G1、G4）

- 掃描者：無（套件倉庫沒有隔離盒；掃描者與隔離綁在使用專案）（沒有掃描者＝照風險級別要掃的那幾支，掃描紀錄寫「未執行：本專案無掃描者」，由下面指定的那一方記錄並轉正式；表定不掃的照規矩 G1）
- 誰指派、登記在哪：無（沒有掃描者）
- 兩方都起得了時：無（沒有掃描者）
- 沒有合格者時，誰記錄未執行、誰轉正式：要掃的那幾支（照風險級別，G1）由實作者在 PR說明的「\#\#\# 複審後掃」下逐字寫「未執行：本專案無掃描者」，表定不掃的照 G1 寫；都不擋合併；轉正式也由實作者做
- 掃描用的最強模型（規矩 G1；換新模型只改這裡）：無（沒有掃描者）；最高推理：無（沒有掃描者）

隔離（規矩 G2；裁示者 2026-09-12 裁「丙」：隔離本身不在套件裡，由這裡指定誰提供；套件只帶掃前檢查與掃後檢查兩支小工具）：

- 由誰提供：未設定（「無」或「未設定」＝不掃，掃描紀錄寫「未執行：無隔離」）
- 從盒內跑一條指令的前綴（{box} 會換成盒子路徑、{projectRoot} 會換成專案根目錄）：未設定
- 盒子建在：未設定（未設定＝系統暫存區）
- 盒內必須讀不到也寫不進的目錄（~ 代表家目錄；掃前檢查在每一個各埋一個假機密）：未設定
- 整條鏈（每一步退非零就停，掃描紀錄寫未執行）：
  1. node tools/scan-probe.js：任一禁區用它的讀寫機制碰得到＝隔離是假的，不掃；連試探都做不成（含盒內起不了那個機制）＝不掃。
  2. node tools/scan-probe.js --plant <清單檔>：在每個禁區埋一個掃描期間才有的假機密。清單檔不要貼進任何紀錄。
  3. 起掃描者（本套件不代跑）。
  4. node tools/scan-postmortem.js --secrets <清單檔> --reply <回覆檔> --logs <日誌目錄>：假機密或未給盒子的真值出現在任何輸出（含檔名）＝事故。
  5. node tools/scan-probe.js --sweep <清單檔>：把埋下去的收掉。這一步一定要跑。

## 五、平台介面（規矩 E5、H1；閘要問平台的每一件事都走這裡）

套件只定「問什麼」與「答案長什麼樣」，每個動作填一條指令，指令要把答案印成約定形狀的 JSON。翻譯是這個專案的事，套件不碰任何平台的語彙。沒登記的動作被問到時一律不放行，不會回一個空答案假裝問過了。

平台：GitHub；倉庫身分（指令裡的 {project}）：teacherjung\/ai\-collab\-kit；問平台前要清掉的選倉環境變數：GH\_REPO、GH\_HOST

| 動作 | 要問什麼 | 登記的指令 |
|---|---|---|
| change | 讀一支PR的基本資料 | gh pr view \{change\} \-R \{project\} \-\-json number\,title\,body\,baseRefName\,headRefName\,headRefOid\,state\,isDraft\,isCrossRepository\,autoMergeRequest\,changedFiles\,author \-\-jq \{id\:\(\.number\|tostring\)\,title\:\.title\,body\:\.body\,baseBranch\:\.baseRefName\,headBranch\:\.headRefName\,headSha\:\.headRefOid\,state\:\.state\,isDraft\:\.isDraft\,isCrossRepo\:\.isCrossRepository\,autoMergeOn\:\(\.autoMergeRequest\!\=null\)\,changedFileCount\:\(\.changedFiles\|tostring\)\,author\:\.author\.login\} |
| openChanges | 列出目前開著的每一支PR（⚠️ 必須是全部，分頁要在這條指令裡處理完；套件驗不到少給了幾支） | gh api \-\-paginate repos\/\{project\}\/pulls\?state\=open\&per\_page\=100 \-\-jq \[\.\[\]\|\{id\:\(\.number\|tostring\)\,baseBranch\:\.base\.ref\,headBranch\:\.head\.ref\,headSha\:\.head\.sha\,isDraft\:\.draft\,author\:\.user\.login\}\] |
| comments | 讀一支PR底下的留言（結論、裁示、撤回都靠它） | gh api \-\-paginate repos\/\{project\}\/issues\/\{change\}\/comments\?per\_page\=100 \-\-jq \[\.\[\]\|\{id\:\(\.id\|tostring\)\,author\:\.user\.login\,body\:\.body\,createdAt\:\.created\_at\}\] |
| allComments | 讀整個專案的每一則一般留言，各帶它所屬的PR編號（⚠️ 必須是全部、含已關的PR，分頁要在這條指令裡處理完） | gh api \-\-paginate repos\/\{project\}\/issues\/comments\?per\_page\=100 \-\-jq \"\[\.\[\]\|\{id\:\(\.id\|tostring\)\,author\:\.user\.login\,body\:\.body\,createdAt\:\.created\_at\,change\:\(\.issue\_url\|split\(\\\"\/\\\"\)\|last\)\}\]\" |
| changedFiles | 讀一支PR動了哪些檔 | gh api \-\-paginate repos\/\{project\}\/pulls\/\{change\}\/files\?per\_page\=100 \-\-jq \"\[\.\[\]\|\{path\:\.filename\,status\:\.status\,previousPath\:\(\.previous\_filename \/\/ null\)\}\]\" |
| checks | 讀某一顆版本上跑過的檢查場次（⚠️ 必須是全部，分頁要在這條指令裡處理完） | gh api \-\-paginate repos\/\{project\}\/commits\/\{sha\}\/check\-runs\?per\_page\=100 \-\-jq \"\[\.check\_runs\[\]\|\{name\:\.name\,status\:\.status\,conclusion\:\.conclusion\,completedAt\:\.completed\_at\,producer\:\(if \.app then \(\.app\.id\|tostring\) else null end\)\}\]\" |
| requiredChecks | 讀主幹設了哪些必過檢查（名單的正本在平台上，不另抄一份會漂的） | gh api repos\/\{project\}\/branches\/\{branch\}\/protection\/required\_status\_checks \-\-jq \"\[\.checks\[\]\|\{name\:\.context\,producer\:\(if \(\.app\_id \/\/ \-1\) \< 0 then null else \(\.app\_id\|tostring\) end\)\}\]\" |
| branchSha | 讀一個分支現在指到哪一顆 | gh api repos\/\{project\}\/git\/ref\/heads\/\{branch\} \-\-jq \{sha\:\.object\.sha\} |
| repoTree | 讀別的倉庫某一條分支上的每一個檔（路徑與內容雜湊；⚠️ 必須是全部，平台把清單截斷時這條指令要失敗） | gh api repos\/\{repo\}\/git\/trees\/\{ref\}\?recursive\=1 \-\-jq \"if \.truncated then error\(\\\"平台把檔案清單截斷了\\\"\) else \[\.tree\[\]\|select\(\.type\=\=\\\"blob\\\"\)\|\{path\:\.path\,sha\:\.sha\}\] end\" |
| repoFile | 讀別的倉庫某一條分支上一個檔的內容（原文） | gh api repos\/\{repo\}\/contents\/\{path\}\?ref\=\{ref\} \-\-jq \{content\:\(\.content\|\@base64d\)\} |
| markReady | 把一支PR從草稿轉成正式 | node \-e \"process\.stderr\.write\(\'實跑：這個平台動作刻意封住，合併一律走 mergeCommand\\\\n\'\)\;process\.exit\(97\)\" \{change\} |
| merge | 按下合併鍵 | node \-e \"process\.stderr\.write\(\'實跑：這個平台動作刻意封住，合併一律走 mergeCommand\\\\n\'\)\;process\.exit\(97\)\" \{change\} |

## 六、三關（規矩 E2、E3、H4；跨PR試合併閘在臨時工作資料夾（樹）裡跑的就是這幾條）

- 臨時工作資料夾（樹）的準備指令（在新開的那一份裡跑一次，例如安裝相依；沒有就填「無」）：無
- 三關指令（依序跑、任一非零＝紅；每一條要自己保證執行環境跟合併後的工作資料夾（樹）一致——套件驗不到這件事）：
  1. node \-\-test
- 主目錄布局（只有三關執行器看；填「一般工作樹」＝從連結工作樹跑三關時，前後各問一次主目錄有沒有被判成裸倉庫、打不打得開；未設定＝不問）：一般工作樹
- 索引錨點（只有三關執行器看；填一串從根目錄算起的檔案路徑＝每一個都要在跑三關那棵樹的索引裡，前後各驗一次；未設定＝不驗）：package\.json、rules\.json、settings\.json

## 七、禁區（規矩 B1；攔截器的判斷讀這裡，程式裡不寫任何禁區的名字）

- 禁區叫什麼：未設定（未設定＝攔截器一律拒絕）
- 會動到禁區的連接器（白名單制；兩欄的登記名＝工具名 mcp__ 後面、下一個 __ 前面那一段，一個連接器一筆、逐字、沒有萬用字元）：（空）
- 不會動到禁區的連接器（整個放行；登記制：mcp__ 開頭的名字所屬的連接器兩欄都沒登記＝一律拒絕，兩欄都空＝全擋）：（空）
- 那些連接器上准用的唯讀工具：（空）
- 逐字拒絕的工具名：（空）
- 家族網的動詞：（空）；名詞：（空）；唯讀前綴（豁免到哪一道、代價與射程＝「兩張樣式表」，正本＝`docs/money-guard-two-pattern-tables.md`，本檔不重述）：（空）
- 兩張樣式表的條數：額外樣式 0 條、patternsReadSafe 0 條（分工＝見「兩張樣式表」）
- 額外樣式（patterns）：（空）
- 額外樣式（patternsReadSafe）：（空）

## 八、合併後驗收分級（規矩 H6；分級工具讀這裡，只算不擋）

| 級別（從最重到最輕） | 動作 |
|---|---|
| 免驗收 | 套件倉庫沒有畫面、部署或要重啟的程式：合併後不需擁有者驗收；改動在同步進使用專案那一支照該專案的分級驗收 |

| 路徑家族（正規式） | 級別 |
|---|---|
| \^ | 免驗收 |

沒列到的路徑一律當：免驗收

## 九、風險分級（規矩 D4；合併前算，跟第八節合併後的驗收是兩張不同的表）

| 路徑家族（正規式） | 風險級別 |
|---|---|
| \^README\\\.md\$ | 低 |
| \^AGENTS\\\.md\$ | 低 |
| \^BACKLOG\\\.md\$ | 低 |
| \^cases\/ | 低 |
| \^\(rules\\\.json\|RULES\\\.md\|GLOSSARY\\\.md\|MACHINES\\\.md\)\$ | 高 |
| \^\(tools\|tests\|templates\|manual\|docs\)\/ | 高 |
| \^kit\-only\/ | 高 |
| \^\(settings\\\.json\|PROJECT\-SETTINGS\\\.md\)\$ | 高 |
| \^\(\\\.github\/\|package\(\-lock\)\?\\\.json\$\|\\\.node\-version\$\|\\\.gitignore\$\) | 高 |

沒列到的路徑算高（規矩 D4：判不出＝高）。

升級條件（內容碰到任一條，整支就算高）：

- 改到「金額」、「資料存取」、「機密」、「判準」、「禁區」或「閘」的做法（只是提到這些字不算）
- 刪掉或放寬「既有考題」的行為檢查

## 十、複審與掃描分級（規矩 F2、G1；複審者的模型與推理見第十一節、掃描者的見第四節）

| 風險級別 | 全審 | 只核差異 | 通過後照 F6 回頭改的那一輪 | 掃描 |
|---|---|---|---|---|
| 高 | 每一輪 | 不適用 | 全審 | 掃 |
| 中 | 第 1〜7 輪 | 第 8 輪起 | 只核差異 | 掃 |
| 低 | 第 1〜3 輪 | 第 4 輪起 | 只核差異 | 不掃 |

## 十一、複審者的模型與怎麼起（規矩 F1、F11；每個 AI 一列，換新模型改這裡——有釘值題的專案連釘值題一起改，套件倉庫自己的是 kit-only/settings-pin.test.js）

| 複審者 | 最強模型 | 次強模型（額度用完才用） | 最高推理 | 不開的自動模式 |
|---|---|---|---|---|
| Claude | claude\-fable\-5\-1 | claude\-opus\-5\-5 | max | Ultracode |
| Codex | gpt\-6\-astra | gpt\-6\-sol | max | ultra（這一檔會自動派助手） |

| 複審者 | 怎麼起（含放行哪些考題指令） | 機器擋得住的 | 只靠提示的、已知缺口 | 驗過的日期 |
|---|---|---|---|---|
| Claude | 送審產生器 node tools\/review\-launch\.js \<編號\> \-\-reviewer \<識別值\> 照下一格的樣板印出填好的那一行；為什麼這樣寫見 README\.md「本倉庫自己怎麼合併」的「送審」那一項 | 放行清單以外的指令一律被拒（不跳出詢問）；Edit 工具改不了審查樹、只准改突變副本；不讀主目錄的本機設定檔 | 放行的指令仍可能寫檔（例如 git diff 的 \-\-output），副本裡改了程式再跑考題＝能跑任意程式，所以審查樹唯讀靠提示；讀檔的禁令管不到考題程式自己讀檔；助手被拒時最後的輸出看不到，要逐筆搜「has been denied」 | 2026\-10\-03 玩具資料夾、便宜模型；本倉庫沒實跑過 |
| Codex | 送審產生器 node tools\/review\-launch\.js \<編號\> \-\-reviewer \<識別值\> 照下一格的樣板印出填好的那一行；為什麼這樣寫見 README\.md「本倉庫自己怎麼合併」的「送審」那一項 | 幾乎沒有：審查樹與系統暫存區都寫得進；使用者層放行規則命中的指令在沙箱外跑；樣板帶 approval\_policy＝never，申請提權一律不准（不帶就照本機設定檔自動核准） | 唯讀、不轉正式、不合併、只貼一則留言，全靠提示；退出 0 不代表通過、也不代表留言已貼成功（啟動失敗會退非零），發審的一方要自己去 PR 看留言在不在；設定檔預設推理是 low，指令漏帶就靜默降級；唯讀沙箱配 \-\-add\-dir 突變副本（2026\-10\-07 實測）連副本、暫存區、網路都被擋，不能拿來讓審查樹唯讀 | 2026\-10\-03 本倉庫 \#30 兩輪；2026\-10\-07 \#49 r1 用產生器印的指令（帶 approval\_policy＝never）跑一輪，日誌印 approval\: never，結論照常貼上 |

| 複審者 | 結論標頭的來源字串 | 啟動指令樣板（送審產生器替換記號後印出） |
|---|---|---|
| Claude | Claude CLI | cd \{reviewTree\} \&\& claude \-p \"\$\(cat \{promptFile\}\)\" \-\-model \{model\} \-\-effort \{effort\} \-\-permission\-mode dontAsk \-\-setting\-sources user\,project \-\-add\-dir \{mutationCopy\} \-\-verbose \-\-output\-format json \-\-allowedTools \'Read\,Grep\,Glob\,Bash\(node \-\-test \*\)\,Bash\(npm \-\-prefix \{mutationCopy\} test \*\)\,Bash\(git diff \*\)\,Bash\(git log \*\)\,Bash\(git show \*\)\,Bash\(git rev\-parse HEAD\)\,Bash\(git \-C \{mutationCopy\} rev\-parse HEAD\)\,Bash\(git \-C \{mutationCopy\} status \-\-porcelain\)\,Bash\(git \-C \{mutationCopy\} diff\)\,Bash\(gh pr view \*\)\,Bash\(gh pr diff \*\)\,Bash\(gh pr checks \*\)\,Bash\(gh run view \*\)\,Bash\(gh run list \*\)\,Bash\(gh pr comment \{change\} \*\)\,Edit\(\/\{mutationCopy\}\/\*\*\)\,Workflow\' \-\-disallowedTools \'Write\,NotebookEdit\,WebFetch\,WebSearch\,Edit\(\/\{reviewTree\}\/\*\*\)\,Bash\(gh pr merge \*\)\,Bash\(gh pr edit \*\)\,Bash\(gh pr close \*\)\,Bash\(gh pr review \*\)\,Bash\(gh pr ready \*\)\,Bash\(git push \*\)\,Bash\(git commit \*\)\,Bash\(git checkout \*\)\,Bash\(git switch \*\)\,Bash\(git stash \*\)\,Bash\(git worktree \*\)\,Bash\(git fetch \*\)\,Bash\(npm install \*\)\,Bash\(npm ci \*\)\,Bash\(npx \*\)\,Bash\(node \-e \*\)\' \< \/dev\/null \> \{outFile\} |
| Codex | codex CLI | codex exec \-m \{model\} \-c model\_reasoning\_effort\=\'\"\{effort\}\"\' \-c approval\_policy\=\'\"never\"\' \-s workspace\-write \-c sandbox\_workspace\_write\.network\_access\=true \-C \{reviewTree\} \- \< \{promptFile\} \> \{outFile\} 2\>\&1 |

送審產生器另外要的：PR 網址樣板 https\:\/\/github\.com\/\{project\}\/pull\/\{change\}；留言網址樣板 https\:\/\/github\.com\/\{project\}\/pull\/\{change\}\#issuecomment\-\{comment\}；複審者貼結論的指令 gh pr comment \{change\} \-R \{project\} \-\-body\-file \<你寫好的結論檔\>；在突變副本裡跑考題 npm \-\-prefix \{mutationCopy\} test \-\- \<考題檔\>

## 十二、忽略清單登記（規矩 B4、E7；考題比對每一份的生效樣式）

- \.gitignore：node\_modules\/、\.DS\_Store、\.env、\.env\.local

## 十三、合併步驟登記（規矩 H1；合併指令照這個順序跑，任一道紅就停）

| 順序 | 閘 | 規矩 | 指令 | 狀態 |
|---|---|---|---|---|
| 1 | 待裁（本支貼的 ❓ 都配到 ⚖️ 或 🚫） | A5 | node tools\/gates\/check\-pending\-rulings\.js | 已啟用 |
| 2 | 複審結論聯集（有沒有未撤銷的阻擋、有沒有對目前版本的通過） | A2、F4、F5 | node tools\/gates\/check\-review\-verdicts\.js | 已啟用 |
| 3 | 協作欄位（四欄齊全、實作者不等於複審者） | A2、E1 | node tools\/gates\/check\-collab\-fields\.js | 已啟用 |
| 4 | 堆疊（底是主幹、上面沒有疊別支） | H2 | node tools\/gates\/check\-stacked\.js | 已啟用 |
| 5 | 真考卷（必要檢查最新場次真的跑過且成功） | H3 | node tools\/gates\/check\-checks\-really\-ran\.js | 已啟用 |
| 6 | 跨PR試合併（與每支以主幹為底的開著PR真合起來跑三關） | H4 | node tools\/gates\/check\-cross\-merge\.js | 已啟用 |

全綠之後執行的合併指令：gh pr merge \{change\} \-R \{project\} \-\-squash \-\-delete\-branch \-\-match\-head\-commit \{sha\} \-\-body \"Reviewed\-By\: \{reviewer\}\\nMerged\-By\: \{merger\}\"

合併指令認得的記號：{change}（PR編號）、{sha}（按鍵前核過的版本）、{project}（platform.project）、{reviewer}（PR說明「複審者」欄那一位）、{merger}（跑 node tools/merge.js <編號> --merger <識別值> 自報的那一位）。帶上 {reviewer}／{merger} 合併紀錄才留得下誰複審、誰按合併鍵（H5）；帶上 {sha} 平台才會替你擋最後一刻被推上來的新版本。認不得的記號＝不放行。

⚠️ 沒有任何一道閘登記成「已啟用」時，合併指令不放行：一支什麼都沒檢查就按合併鍵的指令比沒有更危險。

## 十四、機器啟用狀態（逐支登記；「已啟用」以外的一律當靠自覺）

| 機器 | 規矩 | 狀態 | 驗過的日期 |
|---|---|---|---|
| 平台介面（閘、待裁清單與下游落後問平台的十二個動作，答案形狀不合就不放行） | E5、H1 | 已啟用 | 2026\-09\-13 |
| 合併指令（依序跑完登記的閘，任一道紅就停） | H1 | 已啟用 | 2026\-09\-12 |
| 協作欄位閘（四欄齊全、實作者不等於複審者） | A2、D3、E1 | 已啟用 | 2026\-09\-27 |
| 結論聯集閘（阻擋只有同一位能解除、放行只認指定那一位對目前版本的通過） | F4、F5、F7 | 已啟用 | 2026\-09\-27 |
| 禁區攔截器（判斷一份，兩家 AI 的鉤子都呼叫它） | B1 | 已安裝未啟用 |  |
| 忽略清單一致考題（登記的每一份忽略檔跟生效的樣式一字不差） | B4、E7 | 已啟用 | 2026\-09\-13 |
| 推送前鉤子範本＋三關執行器（讀設定的三關、前後驗工作資料夾（樹）） | E2 | 已安裝未啟用 |  |
| 雲端三關與協作欄位閘的範本 | E3 | 已啟用 | 2026\-09\-27 |
| 清版本控制環境變數的共用實作（GIT\_ 前綴整族清） | E4 | 已啟用 | 2026\-09\-13 |
| 閘的退出路徑與進入點行為題（每一道閘的考題各有「真的跑一遍指令」與「問不到＝退 2」） | E5 | 已啟用 | 2026\-09\-13 |
| 檔名考題（已追蹤路徑只用可見 ASCII；例外名單寫死、只出不進） | E6 | 已啟用 | 2026\-09\-13 |
| 掃描前試探（禁區各埋一個假機密，從盒內試讀試寫；隔離本身由專案設定指定誰提供） | G2 | 已啟用 | 2026\-09\-12 |
| 掃描後比對（假機密與未給盒子的真值不得出現在回覆、日誌、檔名） | G2 | 已啟用 | 2026\-09\-12 |
| 合併閘登記對帳題（磁碟上的閘 vs 設定登記的閘） | H1 | 已啟用 | 2026\-09\-13 |
| 堆疊閘（底必須是主幹、不可以有別支疊在上面） | H2 | 已啟用 | 2026\-09\-27 |
| 真考卷閘（必過檢查在那顆版本上真的跑過且成功） | H3 | 已啟用 | 2026\-09\-27 |
| 跨PR試合併閘（與每支以主幹為底的開著PR真合起來跑三關） | H4 | 已啟用 | 2026\-09\-27 |
| 驗收分級工具（路徑家族表住設定；只算不擋） | H6 | 已啟用 | 2026\-10\-08 |
| 本文長度考題 | K2 | 已啟用 | 2026\-09\-12 |
| 案例簿考題＋索引產生器 | K1、K2 | 已啟用 | 2026\-09\-12 |
| 共用檔清單（釘住套件版本；專案改到套件的檔要記例外） | E7、K1 | 未移植 |  |
| 專案設定產生器 | K1 | 已啟用 | 2026\-09\-12 |
| 範本存在與固定小標考題 | E1、G3 | 已啟用 | 2026\-09\-13 |
| 路標考題（帶記號的引號路標要指得到） | K3 | 已啟用 | 2026\-09\-13 |
| 待裁清單工具（掃整個專案的留言；只列不擋） | D1、I3 | 已啟用 | 2026\-09\-27 |
| 待裁閘（本支貼的 ❓ 還沒配到 ⚖️ 或 🚫 就不放行；判斷用待裁清單工具那一份） | A5 | 已啟用 | 2026\-10\-07 |
| 風險分級工具（合併前依檔案算風險級別、印出複審與掃描分級表那一列，只算不擋） | D4 | 已啟用 | 2026\-10\-04 |
| 舊文字掃描（列出這支刪掉或改掉的字串還出現在哪，只列不擋） | K5 | 已啟用 | 2026\-10\-04 |
| 開工印待辦（列出待辦清單裡提到這支改到的檔的那幾條，只列不擋） | F6 | 已啟用 | 2026\-10\-07 |
| 進度摘要檢查（摘要每則的形狀、兩個時間、沒動的線、大小、附件條號、已合併對不對得上平台，只列不擋） | J5 | 已啟用 | 2026\-10\-07 |
| 本週成果產生器（最近七天合併進主幹的 PR 照日期列成摘要那一節，\-\-write 才換掉那一節） | J5 | 已啟用 | 2026\-10\-09 |
| 下游落後（套件這一邊印出登記的使用專案落後幾支、哪些共用檔不同、設定少哪些欄位與機器列，只列不擋） | K1 | 已啟用 | 2026\-10\-08 |
