# 改說明的斷言失敗、上傳照跑

- 日期：2026-09-05
- 本文條號：戊9
- 發生什麼：實作者在一條指令鏈裡先用腳本改變更說明，斷言失敗（基準版本那行對不上）卻沒讓鏈停下，後面「上傳標題與內文」照跑：標題改成新的、內文還是舊的。獨立審查者起跑三十秒內就讀走舊說明，只好殺掉那輪重發。
- 代價：一輪審查殺掉重發。
- 教訓：每個會寫檔或上傳的步驟後面明確檢查退出碼；改內容與上傳分兩個呼叫，上傳前先確認新字樣真的在檔裡。
- 來源：PFW #568（2026-09-05）https://github.com/teacherjung/personal-finance-webapp/pull/568；事故經過只有私人紀錄、無公開原文
- 相關：[edit-failure-must-block-commit](edit-failure-must-block-commit.md)、[review-prompt-derivation-slip](review-prompt-derivation-slip.md)
