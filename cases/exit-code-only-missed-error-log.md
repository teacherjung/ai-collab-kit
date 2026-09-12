# 只看退出碼就回報三關全綠，錯誤就印在自己導出的檔案裡

- 日期：2026-08-05
- 本文條號：E2、K4
- 發生什麼：實作者手動跑型別、風格、測試三關時把畫面輸出導進檔案，只看指令回報的那個數字（＝退出碼，零表示成功）就對外回報三關全綠。失敗訊息就印在自己導出的那個檔案裡，從頭到尾沒有人打開看。
- 代價：那一次對外回報的「三關全綠」是假的。
- 教訓：三關交給推送前那道自動門跑；真要自己手動跑，退出碼與輸出內容都要看，而且先確認自己找的字樣在失敗時真的會出現。
- 來源：私人紀錄（2026-08-05，無公開原文）
- 相關：[piped-exit-code-hid-lint-errors](piped-exit-code-hid-lint-errors.md)、[lint-output-tail-misread](lint-output-tail-misread.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[my-own-guards-lied](my-own-guards-lied.md)
