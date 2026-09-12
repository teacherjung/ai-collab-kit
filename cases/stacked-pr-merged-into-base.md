# 堆疊變更合進中間分支

- 日期：2026-07-28
- 本文條號：辛2、子1
- 發生什麼：三支堆疊變更（每支疊在前一支的分支上）逐一按合併，畫面顯示已合併、檢查全綠、零錯誤訊息，上面兩支其實各自合進了自己的基底分支，主幹只拿到最底層那支。十八天前那次事故之後「堆疊不刪分支」已寫進規則書，但執行合併的人照的是另一份程序檔，那裡寫著無條件刪分支、沒提堆疊，規則等於不存在。靠另開一支把兩支的內容挑揀回主幹救回，兩天後補上機械閘：底不是主幹擋、有變更疊在上面擋、查不清楚一律當堆疊。
- 代價：兩支已標記合併的內容沒進主幹，要另開一支挑揀救回；「是不是堆疊」靠印象判斷第二次失敗。
- 教訓：堆疊只能由下而上、每合一支就把下一支改底到主幹重審；「已合併＋全綠」不代表進了主幹；規則要寫在執行的人真的會讀的那份檔，判堆疊用機械檢查不靠印象。
- 來源：PFW #322（2026-07-28）https://github.com/teacherjung/personal-finance-webapp/pull/322；閘 PFW #353（2026-07-30）https://github.com/teacherjung/personal-finance-webapp/pull/353
- 相關：[delete-branch-closed-stacked-pr](delete-branch-closed-stacked-pr.md)、[rebase-checkout-theirs-loses-hunks](rebase-checkout-theirs-loses-hunks.md)、[collab-invariant](collab-invariant.md)
