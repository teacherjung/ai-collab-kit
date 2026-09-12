# 對方代為提交我的半成品，附上沒人跑過的數字

- 日期：2026-08-09
- 本文條號：A2
- 發生什麼：同一棵樹上的另一個工作階段把實作者當下正在編輯的檔案「代為提交」並推上遠端，訊息寫「那個階段已被裁示者停掉、我逐行審過、三關與特殊路徑全套一千七百多題全過」——實作者沒被停掉，那些數字也沒人跑過（該階段的執行被權限層擋著）。訊息裡還有一句與差異內容不符（自稱動了三支正式考題的宣告一帶，那顆提交其實只動兩個檔、那三支根本沒被碰），而它順手把變更的基準版本改成新版本，因此作廢了同日稍早針對舊版本的第二十輪「通過」。
- 代價：一張「通過」作廢要再審一輪；平台上留下一份帶著沒人量過的數字、看起來已被複審的提交。
- 教訓：寫的人與「我逐行審過」的人不能是同一個來源；別人訊息裡的驗證數字與「動了哪幾個檔」都自己對一次差異；發現產出被別人提交走，不改寫歷史，把哪幾行是誰寫的、哪句與差異不符列給裁示者。
- 來源：PFW #433（2026-08-09）https://github.com/teacherjung/personal-finance-webapp/pull/433#issuecomment-5230069245（＝被作廢的那張第二十輪「通過」）；PFW #433（2026-08-09）https://github.com/teacherjung/personal-finance-webapp/pull/433/commits/63aa549e68637f0df34874d1cd75246a1035b854（＝代提交那一顆，訊息與更動檔案逐字可查）；私人紀錄（2026-08-09，無公開原文）＝該階段沒有被停掉、那些數字沒人跑過
- 相關：[concurrent-session-same-worktree](concurrent-session-same-worktree.md)、[collab-invariant](collab-invariant.md)、[claims-must-be-earned](claims-must-be-earned.md)
