# 邊界考題踩的值離邊界很遠，門檻調鬆全綠

- 日期：2026-08-05
- 本文條號：E8
- 發生什麼：一支補七處提醒門檻邊界考題的變更，考題用的值離門檻很遠：門檻是七天卻拿五天與兩天、門檻是六十天卻拿三十天與九十天。獨立審查者把門檻從七改成五、六十改成三十，七條新題與全卷一千四百多題全綠；同一輪另抓到兩條宣稱「前後端同口徑」「兩種速度都守」的題其實只驗了其中一半。
- 代價：本則只算邊界值這一項在第一輪被整條推翻；這支後來磨到二十一輪的成本記在 guard-became-defect-source，不在這裡重複計。
- 教訓：邊界考題要踩相鄰的兩格、兩側各放一個斷言；宣稱「兩邊都守住」就要有兩發突變各自讓它轉紅。
- 來源：PFW #413（2026-08-05）<https://github.com/teacherjung/personal-finance-webapp/pull/413#issuecomment-5189709528>
- 相關：[guard-became-defect-source](guard-became-defect-source.md)、[mutation-per-point](mutation-per-point.md)、[claims-must-be-earned](claims-must-be-earned.md)、[fixture-carries-two-variables](fixture-carries-two-variables.md)、[tests-called-helper-not-the-wiring](tests-called-helper-not-the-wiring.md)
