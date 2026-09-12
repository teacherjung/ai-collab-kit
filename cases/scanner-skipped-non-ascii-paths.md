# 掃描器跳過非英文檔名，回報零問題

- 日期：2026-08-05
- 本文條號：E6、K4
- 發生什麼：實作者寫的自查腳本先用版本控制列出這支動過的檔案，再用「檔名結尾是 .md」挑出文件來檢查。版本控制列出非英文路徑時會自動加上引號，結尾就變成引號而不是 .md，十三份中文檔名的文件裡十二份被跳過，腳本回報「零問題」。
- 代價：一次自查等於沒做：十二份文件沒有被看過，回報出去的卻是零問題。
- 教訓：掃描器要先印出「這次看到幾份」並和預期數量對一次；列檔名時關掉引號跳脫，別讓檔名長什麼樣決定誰被掃到。
- 來源：私人紀錄（2026-08-05，無公開原文）
- 相關：[english-only-filenames](english-only-filenames.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[night-audit-3-findings](night-audit-3-findings.md)、[my-own-guards-lied](my-own-guards-lied.md)
