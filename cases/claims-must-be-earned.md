# 註解裡「兩邊都要」的保證沒有考題撐

- 日期：2026-08-03
- 本文條號：K3、K4
- 發生什麼：實作者在入口守衛的註解裡寫「兩邊都要解析真實路徑」，突變測試（故意只留一邊的解析、看考題會不會紅）卻顯示只解析一邊照樣全綠，因為執行環境預設已替其中一邊解析——那句是沒根據的保證，讀的人會當成驗過的事實。補救不是刪句子，而是加一條在「不自動解析」模式下跑的考題，讓那句話變成真的。同一天兩次突變沒轉紅，都是突變的前提錯而不是護欄錯，先查規格再改考題。
- 代價：一句沒根據的保證進了正式註解，直到突變才發現；補一條考題與一次查規格。
- 教訓：寫「一律／全部／兩邊都」前先問哪條考題會因它不成立而轉紅，答不出來就把話改小；突變沒紅時先分清錯的是突變還是護欄。
- 來源：PFW #388（2026-08-03）<https://github.com/teacherjung/personal-finance-webapp/blob/24b7e0b/lib/is-main.js>
- 相關：[completeness-claim-breeds-gaps](completeness-claim-breeds-gaps.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[my-own-guards-lied](my-own-guards-lied.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)
