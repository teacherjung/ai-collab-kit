# 收緊判準反而在別處多猜了一次

- 日期：2026-08-28
- 本文條號：戊9、子4
- 發生什麼：實作者把「發卡銀行名稱有歧義」從猜一家收緊成「不猜」，單看那一層是查不到就不放行；但下游把那張卡移出候選族群後，「該銀行只剩一張卡就自動歸類」的分支反而成立，本來會問使用者的情況靜靜變成自動決定。那支的說明原本寫「唯一的行為改變」，逐一跑過才發現是一收緊三放寬。獨立審查者連審四輪都沒看到，實作者在第四輪之後另開的多視角對抗驗證才抓到，修法加了一對考題：一題回歸、一題對照組（＝證明那道守門不是永遠成立的空話）。
- 代價：那支變更自己的立論被推翻；若上線，錯歸類會靜靜發生，而不是多按一次選卡。
- 教訓：「查不到就停」是單一層的性質不是全流程的性質，寫「唯一的改變」之前先把每個消費端跑一遍，看有沒有「只剩一個就自動」的分支；互不重疊視角的自審能抓到獨立審查者連看四輪都看不到的東西。
- 來源：PFW #520（2026-08-28）https://github.com/teacherjung/personal-finance-webapp/pull/520
- 相關：[silent-pass-is-worst](silent-pass-is-worst.md)、[my-own-guards-lied](my-own-guards-lied.md)、[pre-review-caught-dead-switch](pre-review-caught-dead-switch.md)、[tighten-then-run-real-data](tighten-then-run-real-data.md)
