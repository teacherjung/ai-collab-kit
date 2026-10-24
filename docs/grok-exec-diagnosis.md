# Grok 隔離執行環境失敗調查與修正計畫

本計畫依據 William 指派：「先查清楚 Grok 為什麼一直失敗，把執行問題修好後再補掃 #119，先不要同步理財。」建立。

## 已證實事實
1. **已驗證的操作成功**：Grok CLI 1.0.62 在盒內能成功執行 `read_file` 與 `run_terminal_command`，回傳 `end_turn`。
2. **錯誤的成功回報**：先前失敗是因為 `runGrokExec` 僅核 `status=0`。在非互動環境下，RequestPermission 引發的 `cancelled` 仍會以 `0` 退出。
3. **程序掛起**：`relay.close` 等待數分鐘未結，已證實為 Socket 資源未完全回收。
4. **原生 NDJSON 嚴格核驗**：需驗證 `system` init 與 `assistant` end_turn。原生原始輸出限本機追溯，正式留言只代貼核驗後正文。
5. **材料直接供給**：完整 diff 附加對象為盒內 `boxPromptFile`。scan 模式避開 shell 核准取消，任何 `cancelled` 狀態仍拒絕完成。

## 最小修復方向
1. **嚴格解析**：共享 `parseGrokStrictNDJSON`，拒絕 `cancelled` 或格式損毀。完整 JSON 原樣存於 `outFile` 供查閱。
2. **Socket 回收**：`startGrokRelay` 實作資源清單，呼叫 `close()` 時主動銷毀所有 sockets 與連線，解決掛起問題。
3. **避開互動依賴**：scan 模式透過外部提供 diff 材料至 `boxPromptFile`。
4. **官方來源參考**：
   - Headless Scripting: https://docs.x.ai/build/cli/headless-scripting
   - Wire Protocol: https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/src/headless/reducer/messages/wire.rs

## 待驗項目
1. **修復後真探針**：確認真實環境執行與結束正常（保留歷史失敗事實）。
2. **修復後 #119 補掃**：使用正式修復邏輯重新執行掃描，確保不再因 `cancelled` 誤報成功。
3. **正式代貼**：透過 `scan-post` 核驗結果並完成。
