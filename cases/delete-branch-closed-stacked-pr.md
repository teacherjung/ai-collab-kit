# 合併時刪基底分支，上層兩支被平台關閉

- 日期：2026-07-10
- 本文條號：H2
- 發生什麼：合併堆疊變更（＝一支以另一支為基底、疊著開的兩支以上變更）時勾了「合併後刪分支」，基底分支一刪，疊在上面的兩支被平台直接關閉，而不是自動改底到主幹。當天把「堆疊不刪分支」寫進規則書。
- 代價：兩支變更被關閉、要重開重走。
- 教訓：堆疊合併不刪分支；每合一支就把下一支改底到主幹。
- 來源：PFW #3（2026-07-10）https://github.com/teacherjung/personal-finance-webapp/pull/3 ；PFW #5（2026-07-10）https://github.com/teacherjung/personal-finance-webapp/pull/5 ；PFW #353（2026-07-30）https://github.com/teacherjung/personal-finance-webapp/pull/353 ——此支是二十天後把那條例外補進真正會被執行的那份檔案的變更，只證明後續修法不是原事故
- 相關：[stacked-pr-merged-into-base](stacked-pr-merged-into-base.md)
