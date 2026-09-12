# 寫提示詞的步驟被管線吃掉、審查空跑

- 日期：2026-09-09
- 本文條號：戊9
- 發生什麼：實作者把「建審查樹、掛套件、寫提示詞檔、發射審查」串成同一條指令，串的開頭有一段管線。寫提示詞用的內嵌文字（＝直接寫在指令裡、餵給指令當輸入的一段文字）被那段管線先讀走，提示詞檔零位元組，審查器拿到空字串，整輪只回「請告訴我要處理什麼」。
- 代價：一輪審查空跑。
- 教訓：產生檔案的動作自己一個呼叫，寫完先驗大小或關鍵字再用它；不要把「寫檔」與「用那個檔」串在同一條有管線的鏈裡。
- 來源：PFW #587（2026-09-09）https://github.com/teacherjung/personal-finance-webapp/pull/587；事故經過只有私人紀錄、無公開原文
- 相關：[edit-failure-must-block-commit](edit-failure-must-block-commit.md)、[review-prompt-derivation-slip](review-prompt-derivation-slip.md)
