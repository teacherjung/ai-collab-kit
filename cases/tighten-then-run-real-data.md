# 判準收緊後真語料整則假紅

- 日期：2026-09-07
- 本文條號：E8
- 發生什麼：實作者把待裁清單工具的判準收緊成「行首欄名＋粗體引號，引號裡不准再有引號」，四十四題夾具（＝考題自備的假資料）全綠。拿真語料（＝實際在用的真資料）實跑才發現裁示者的回覆本身就有一組巢狀引號，整則被判「形狀不合」，兩題已經回過的問題冒回「還沒回」。改成貪婪比對收到行尾最後一組引號才對，並補一題釘住「原話裡可以再有引號」、用突變（＝故意改壞一處，確認考題會紅）證明它會紅。
- 代價：差一步就把已裁的兩題當成沒裁；夾具全綠給了假的安心，靠實跑真語料比對前後分類數字才攔下。
- 教訓：只用自己挑的夾具，可能漏掉真實資料的合法形狀——收緊判準前後另以真語料核對、比對前後分類數字，把漏掉的形狀補成回歸考題並用突變證明會紅；中文引號、括號天生會巢狀，寫「不准出現結束符」之前先問它會不會自己嵌自己。
- 來源：PFW #579（2026-09-07）https://github.com/teacherjung/personal-finance-webapp/pull/579
- 相關：[fixture-control-assertion](fixture-control-assertion.md)、[contract-sentence-must-be-run](contract-sentence-must-be-run.md)、[population-filter-uniqueness-trap](population-filter-uniqueness-trap.md)
