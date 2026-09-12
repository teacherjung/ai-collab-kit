# 「紅了重跑一次」擴為常設

- 日期：2026-09-05
- 本文條號：辛4
- 發生什麼：兩天前只對單一支變更裁的「跨變更試合併閘紅了重跑一次再判」，實作者在協作系統體檢的第二題提三個選項，裁示者選「擴成常設」。附帶限制：只限這一道閘、只限一次、第二次紅照擋、重跑前先看訊息列出的是哪一題紅。同支變更順便讓閘在試合併後先核對套件鎖檔（＝記下每個外部套件確切版本的檔案）與已裝套件，對不上就退出並明說處置，那種紅不適用重跑。
- 代價：沒有事故；把單支處置寫成常設規則那支變更走了十四輪審查才合併。
- 教訓：「間歇紅重跑一次」只能給量到負載而非相容性的那道閘，而且要寫明第二次紅照擋，否則重跑就變成繞過。
- 來源：PFW #566（2026-09-05）https://github.com/teacherjung/personal-finance-webapp/pull/566#issuecomment-5550607351
- 相關：[cross-pr-gate-measures-load](cross-pr-gate-measures-load.md)、[machine-load-breaks-timing-tests](machine-load-breaks-timing-tests.md)
