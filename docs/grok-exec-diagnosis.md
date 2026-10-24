# Grok 執行問題診斷與修復計畫

## 核心問題事實

1. **狀態誤判與空輸出 (Issue 1)**
   - **事實**: `runGrokExec` 目前未指定 `--output-format`（預設為 `plain`），僅依賴子程序退出碼 `status === 0` 判定成功，並直接寫入 `stdout`。
   - **事實**: 官方 CLI 在中途取消（cancelled）或截短時，仍可能返回退出碼 `0`。在 plain 模式下，這會導致未完成的執行被誤當成成功，產生僅有前言或空文本的輸出。
   - **事實**: 官方 `--output-format json` 或 `streaming-json` 會包含 `stopReason`（例如 `end_turn`、`cancelled`）及實際完成的文本 `text`。

2. **程序懸掛不退出 (Issue 2)**
   - **事實**: 真實執行中，即使 Grok 程序已退出、`read_file` 完成且輸出檔案已寫入，但在 `finally` 區塊呼叫 `relay.close()` 後，`runGrokExec` 外殼程序仍遲遲不退出。
   - **事實**: `startGrokRelay` 建立的 `http.createServer()` 及預檢使用的 `net.createServer()`，在呼叫 `.close()` 時僅拒絕新連線，並未主動中斷（destroy）已建立但尚未結束的 socket 或是正在等待的 upstream 連線。

## 候選原因與方案設計

### 1. 執行狀態辨識方案
- **候選原因**: 未解析原生 JSON 輸出中的 `stopReason`，導致「取消」與「完成」被同等對待。
- **方案設計**:
  - 將 `--output-format json` 加入 Grok 啟動參數。
  - 對子程序的 `stdout` 進行 JSON 解析。
  - **完成判定**: 僅當 `stopReason === 'end_turn'` 且 `text` 欄位有非空內容時，才視為成功完成。
  - **Fail Closed**: 遭遇取消 (`cancelled`)、截短 (`max_turns`)、空文本 (`text` 為空或 null)、解析失敗時，一律拋錯或返回 `code: 2` 拒絕寫出結果。
  - **DLP 與安全**: 執行前先對完整的 `stdout` 原始字串執行 DLP 檢查（避免漏查 `thought` 等欄位）。僅將白名單內的 `text` 欄位（經由 `stripGrokPreamble` 去除前言）寫出，絕不直接貼出包含 `thought` 或 `stderr` 的原始結果。

### 2. 轉送器與伺服器資源回收方案
- **候選原因**: `startGrokRelay` 與 `probeGuardServer` 未追蹤連線，導致長連線或未完成的 upstream request 卡住 Node.js Event Loop。
- **方案設計**:
  - **Tracking**: 
    - 在 `startGrokRelay` 的 HTTP server 掛載 `connection` 事件，將 socket 記錄至 Set；連線關閉時移除。
    - 針對 upstream request (`requestImpl`)，將建立的請求物件記錄至 Set，結束時移除。
    - 在 `runGrokExec` 的 `probeGuardServer` 掛載 `connection` 事件追蹤 socket。
  - **Teardown**:
    - 呼叫 `relay.close()` 時，除了 `server.close()` 外，走訪並執行 `socket.destroy()` 與 `request.destroy()`。
    - 呼叫 `probeGuardServer.close()` 時，一併 destroy 所追蹤的 TCP sockets。
  - **避免強制結束**: 確保資源乾淨釋放，不使用 `process.exit()` 假裝完成。

## 待驗證項目

1. 修改後，當注入 `--output-format json` 並模擬中止時，工具是否能正確捕捉 `stopReason !== 'end_turn'` 並回報失敗（退出碼 2）。
2. 在模擬長連線或未閉合連線的環境中，呼叫 `relay.close()` 後 Event Loop 是否能在一秒內自然結束退出。
3. 確保 DLP 檢查仍對整個 JSON 字串生效，且診斷或結果輸出不包含 `thought`。