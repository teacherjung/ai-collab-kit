# 改出來的審查提示漏改編號

- 日期：2026-09-07
- 本文條號：F3
- 發生什麼：實作者把上一支的審查提示詞改成新一輪，漏改了變更網址、受審版本、審查樹（＝為了審查另外開的工作目錄）路徑、留言編號四處。獨立審查者開審前自檢發現樹的版本與指定的對不上，停下不審，整輪沒有產出。要是漏改的只有留言編號而樹剛好對，結論會貼到另一支已合併的變更上。
- 代價：一輪審查白燒（約八萬 token，token＝模型處理文字的計量單位），沒有任何產出。
- 教訓：從上一支改出來的提示詞，發射（＝下指令把這一輪審查跑起來）前搜尋舊編號與舊版本、四處基本資料逐項核對，並自己先對一次審查樹的版本。
- 來源：PFW #579（2026-09-07）https://github.com/teacherjung/personal-finance-webapp/pull/579 —— 這支只證明重發後的第三輪，停審那一輪沒有留公開留言；私人紀錄（2026-09-07，無公開原文）停審與四處漏改的細節只在這裡。
- 相關：[scan-record-copied-from-previous-change](scan-record-copied-from-previous-change.md)、[review-verdict-strings](review-verdict-strings.md)
