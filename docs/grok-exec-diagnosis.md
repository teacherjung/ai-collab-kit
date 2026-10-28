# Grok 隔離執行環境失敗調查與修正計畫 (2026-10-25 正式送審前快照，真探針 HEAD 3378941 之後)

## 2026-10-29 本支複審改派

- [本人指示](https://github.com/teacherjung/ai-collab-kit/pull/128#issuecomment-6476591085)要求先排除 Gemini 工作衝突，再交全新 GPT-6.1 Sol／xhigh 複審；下方 Grok 分工保留為歷史，所有掃描仍暫停。
- 依[技術裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6476698003)，只新增套件實體 Sol 參與者／複審設定、命令釘值與設定產物，沿既有 Codex CLI 樣板及來源；全域分工、其他審查者、安全檢查與合併閘不變。技術裁示者不兼任本支正式複審者。
- 此登記不等於模型已執行；新固定版本須完整檢查、新 CI、官方備審及可信原生模型／推理證據，正式結論由官方收件後仍獨立對帳與跑全部閘。舊 DLP 拒收證據不改，不讀遭拒內容或真實認證，不用換人解除舊阻擋。

## 2026-10-27 接手後的修補範圍

- [本人交接授權](https://github.com/teacherjung/ai-collab-kit/pull/128#issuecomment-6449877394)：Codex 接手、Grok 正式複審，保留原工作與失敗證據；所有掃描（含下述歷史計畫的 #119 補掃）暫停。完成 #128、#129 後依正式程序同步理財，再接續 #747；下方早期分工與暫不同步敘述是歷史紀錄。
- [技術原題](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6449960460)與[Sol 裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6450020889)：先修考題前置，不能把 TypeError 算成有效產品失敗；來源有 replace/grafts 或無法核對時拒收，不改宿主設定。DLP 排除只依原提示的同一記憶體快照，附加差異與路徑改寫不可擴張例外。JSON 在同物件範圍先核對解碼後的重複鍵，再解析；保留原文與解碼鍵值攔截。
- 自貼結論只在本地完整合法正文與平台正文一致時收尾；下方早期「無標頭摘要可收尾」不作本次判準。缺標頭、前言或失敗仍保留現場，不補寫或追認。
- 提示須依實際工具能力說明；不能使用終端時明列考題未執行，不把閱讀材料當執行考題。驗證含正常對照、有效突變、完整檢查及獨立正式複審；技術裁示與局部綠燈都不等於正式通過。
- 正式審查啟動器的信任來源另題核定；不得以候選啟動器自報成功追認 #129 舊輸出。這份計畫不授權啟動模型或掃描。

## 2026-10-28 原生拒寫核實與驗證邊界

- [補充裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6460657449)的大小寫缺口推論，經[原生量測後重裁](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6461066287)撤回：本次宿主的 `.git`、`.GIT`、`.gIt` 指向同一目錄，既有 `subpath` 規則對三者寫入均回 `EPERM`；一般突變檔、鄰近 `.github` 及暫存區仍可寫。移除既有禁寫項後，三個同物件別名均變可寫。這僅核實受測宿主、剖面及操作，不外推其他系統或寫入方式，也不將歷史掃描整項宣告誤報。
- 保留既有剖面，不新增 regex 或放寬權限。預檢補同物件、非符號連結、特定權限錯誤碼與正常寫入對照，並核受保護內容未被改寫；路徑不存在或其他 IO 錯誤不可算隔離成功。
- 機密輸出驗證含原始 stdout 與解碼鍵值；不新增短針豁免，不宣稱能辨識所有秘密、編碼或變形。合成 stderr 的正常及失敗路徑不進返回訊息或結果檔，未新增真實 stderr 留存或公開診斷。
- 檔案快照只是執行前後端點比較，不能證明中途從未改動，不能替代核心禁寫；持續監控、mode 與 xattr 等限制仍留待辦，未在本支完成。

## 2026-10-28 有限執行前置與合成驗證

- [有限施工裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6461979220)選套件內補直接執行拒絕、指定通道隔離及有界收尾；不搬理財執行器，不啟真服務、敏感工具或外送 DNS。正式模型啟動仍須固定版本後另題核定。
- 三個指定系統程式的實體路徑直接執行拒絕由剖面與靜態拒啟題核接線；原生只跑同型規則的自編無害程式，不冒稱真程式已執行測試。檔案型 Unix socket 使用本次自建合成通道；數字 IP 本機 relay、Node、Git、shell、讀檔保留正控。
- Mach generic 拒絕對本輪明確允許的合成名稱未生效，具名拒絕可生效。[名稱選擇器裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6462514617)後實測兩規則存在重疊，移除 XPC 一條未使保護斷言轉紅；保留失敗，依[重裁](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6462555413)採單一 `global-name-prefix` 拒絕。
- 單一規則原生驗證：Global 與 XPC 政策拒絕、合成服務實際查找拒絕；保留註冊與查找操作，只移除該規則，兩政策恢復允許且查找成功，保護斷言轉紅。Global 有實際查找證據，XPC 僅政策層證據；不外推真服務、既有 port、所有 IPC 或全部 DNS 側路。完整剖面下必要正控及合成直接執行／Unix 拒絕亦通過。
- 發射前以不可覆寫的 `execution.json` 留下一小時期限與十秒群組清理界限；程序退出不等於管線關閉，先清本次可信 PID 所屬群組，再確認群組清空與管線關閉。只有 `ESRCH` 算群組不存在，其他查核錯誤拒收；不操作其他群組，也不宣稱能追回自行脫離群組的後代。
- 逾時、取消、relay 失效或清理失敗均否決成功；外層取消監聽涵蓋子程序退出後的資源收尾，解除監聽前核取消資格。結果僅於協定、機密、快照核驗與必要清理成功後寫入。合成考題涵蓋正常／非零、持管線後代、他組保留、未知群組、收尾期間取消、通道失效及發射證據保存；移除期限、取消、群組未知拒收、失效監看或提前輸出會使相應斷言失敗。
- 本段合成結果不替代完整檢查、當版 CI 或獨立正式複審；固定候選版本後仍須另題取得正式啟動核定。

## 2026-10-28 正式失敗後的有限診斷

- 固定 `65b8a15` 的正式場次退出2，沒有正式結果；只有一般退碼訊息，不能辨認期限、取消、通道或清理何者觸發。日誌最後寫入時間及收件時間不替代受控結束／原因證據，舊場次不補寫推測原因。
- 依[Sol 裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6471264762)，同支只補內容無關的失敗觀測。觸發與清理分開、原始子退出碼與包裝退碼分開；有限白名單投影後才送失敗日誌，不序列化原始回覆或錯誤物件。
- 分類只是執行器所見，不診斷模型額度或底層網路根因；未知維持未知。原 stdout/stderr、請求內容與檔案路徑不納入新診斷，拒收／清理／輸出資格不因診斷改變。新固定版本完成驗證後另核正式啟動，不沿用舊版核定。
- 依[清理期間觀測裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6472012910)，以白名單 `vetoTrigger` 分開記首個取消／期限／通道否決；先發生的正常退出不可遮住後到否決，原始子退出碼仍保留。無否決為 `none`，無法辨識為 `unknown`；不記錄事件原文或推定歷史失敗原因。

- 依[DLP 階段裁示](https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6473042791)，拒收訊息只附固定 `dlp_raw`／`dlp_decoded`，表示實際返回的檢查分支；原字串優先短路，不能據此宣稱解碼分支未命中。標記不包含命中內容或特徵、不改比對與成功資格，也不能還原舊場次原因。完成合成驗證不授權自動重啟正式模型，受控再審須另核具體目的與停止條件。

以下為接手前計畫與歷史；與上方接手裁示不一致者，不作本次通過依據。

本計畫依據 William 指派：「先查清楚 Grok 為什麼一直失敗，把執行問題修好後再補掃 #119，先不要同步理財。」建立。

## 已證實事實
1. **已驗證的操作成功**：Grok CLI 1.0.62 在盒內能成功執行 `read_file` 與 `run_terminal_command`（單一 `run_terminal_command` 成功寫明只驗 `git rev-parse --short HEAD`，不代表任意 shell），並回傳 `end_turn`。
2. **錯誤的成功回報**：修正先前「僅核 status」過度推論：已重現的觸發點是非互動 `RequestPermission` 取消（cancelled），修復前漏核完成狀態（result.stop_reason）會把取消誤報成功；不推定全部歷史失敗同因。
3. **程序掛起**：`relay.close` 等待數分鐘未結，已證實為 Socket 資源未完全回收。
4. **原生 NDJSON 嚴格核驗**：需驗證 `system` init 與 `assistant` end_turn。原生原始輸出限本機追溯，正式留言只代貼核驗後正文。
5. **材料直接供給與短提示指標**：完整 diff 附加對象為盒內 `boxPromptFile`。-p 指令改為路徑指標以避開命令列容量限制；實際讀檔以真探針為準。scan 模式避開 shell 核准取消，任何 `cancelled` 狀態仍拒絕完成。
6. **真探針未完成**：本輪尚未執行實測。

## 最小修復方向
1. **嚴格解析**：共享 `parseGrokStrictNDJSON`，拒絕 `cancelled` 或格式損毀。完整 JSON 原樣存於 `outFile` 供查閱。
2. **Socket 回收**：`startGrokRelay` 實作資源清單，呼叫 `close()` 時主動銷毀所有 sockets 與連線，解決掛起問題。
3. **避開互動依賴與短提示**：scan 模式透過外部提供 diff 材料至 `boxPromptFile`，且啟動指令改用短路徑指標指向盒內唯讀材料，外殼接受原生壓縮界線並繼續核驗完成。
4. **官方來源參考**：
   - Headless Scripting: https://docs.x.ai/build/cli/headless-scripting
   - Wire Protocol: https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/src/headless/reducer/messages/wire.rs

## 2026-10-25 修正摘要
1. **CLI 封包核驗優先**：在 `post` 流程中，即使平台已有合法結論，仍優先對本地 CLI 輸出（NDJSON/JSON）執行解包核驗。若解包失敗（CLI 協議錯誤），拒絕自動收尾，保留現場供診斷。
2. **區分封包與格式**：成功輸出僅是無結論標頭的自貼摘要時，可在平台已有同人/來源/輪次/版本合法結論的前提下收尾；解碼後含不合規機器人標頭或與平台正文不一致仍拒並留現場。
3. **依來源選解析器**：unwrapScanOutput 說明已知 Grok 以 forceGrok、未知可用 system.init.model 的 grok 前綴識別，不用共用 stop_reason 猜。
4. **原生輸出 UTF-8 無損**：在建立 Grok 執行子程序時，明確對 `stdout` 與 `stderr` 設定 `utf8` 編碼，確保多位元組字元（如 NDJSON 中的中文或 🤖 記號）在串流接收階段即以正確字元集處理，避免分段拆字損毀合法UTF8封包；後續DLP仍檢查完整解碼文字。

## 後續證據正本
1. **正式 Codex 複審及修復 PR 自身 Grok 掃描**：以 https://github.com/teacherjung/ai-collab-kit/pull/128 的正式留言為準。
2. **#119 修復後補掃**：以 https://github.com/teacherjung/ai-collab-kit/pull/119 的 🔍 留言及合併後補掃記錄為準。
