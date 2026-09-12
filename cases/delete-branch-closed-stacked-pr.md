# 合併時刪基底分支，上層兩支被平台關閉

- 日期：2026-07-10
- 本文條號：辛2
- 發生什麼：合併堆疊變更時勾了「合併後刪分支」，基底分支一刪，疊在上面的兩支被平台直接關閉，而不是自動改底到主幹。當天把「堆疊不刪分支」寫進規則書。
- 代價：兩支變更被關閉、要重開重走。
- 教訓：堆疊合併不刪分支；每合一支就把下一支改底到主幹。
- 來源：PFW #3／#5（2026-07-10）https://github.com/teacherjung/personal-finance-webapp/pull/3；事故記載於 PFW #353（2026-07-30）https://github.com/teacherjung/personal-finance-webapp/pull/353
- 相關：[stacked-pr-merged-into-base](stacked-pr-merged-into-base.md)
