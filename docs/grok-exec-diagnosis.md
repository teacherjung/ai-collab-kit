# Grok 隔離執行環境失敗調查與修正計畫 (2026-10-25 正式送審前快照，真探針 HEAD 3378941 之後)

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

## 後續證據正本
1. **正式 Codex 複審及修復 PR 自身 Grok 掃描**：以 https://github.com/teacherjung/ai-collab-kit/pull/128 的正式留言為準。
2. **#119 修復後補掃**：以 https://github.com/teacherjung/ai-collab-kit/pull/119 的 🔍 留言及合併後補掃記錄為準。
