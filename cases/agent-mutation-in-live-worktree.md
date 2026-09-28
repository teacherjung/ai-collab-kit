# 代理在我的樹上突變被提交進去

- 日期：2026-09-02
- 本文條號：D2、E10
- 發生什麼：實作者在送審前的預審裡叫一個代理程式「實際做突變」（＝故意改壞程式看考題會不會紅），卻讓它直接改實作者正在用的那棵工作樹（＝正在編輯的那份倉庫副本）。同一時間實作者在同一棵樹上執行「全部加入並提交」，把代理拿掉白名單欄位那一瞬間的檔案提交了進去：那顆提交的白名單少一個欄位，整支變更在真實流程裡失效。代理隨即把檔案還原，所以單獨重跑考題是綠的，只有推送前跑全套時紅了一次，看起來像偶發抖動、差點被放過。
- 代價：一顆壞提交上了變更、差點被當偶發抖動放行；比對提交內容與磁碟不同才重做。
- 教訓：要代理做突變或寫檔就給它自己的樹，純閱讀才可共用；考題單獨重跑綠、推送前紅時，先比對提交內容與工作樹，不要直接歸成抖動。
- 來源：PFW #547（2026-09-02）<https://github.com/teacherjung/personal-finance-webapp/pull/547> （變更說明「過程中的一次自傷與修復」段）
- 相關：[concurrent-session-same-worktree](concurrent-session-same-worktree.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)、[probe-files-in-worktree](probe-files-in-worktree.md)、[my-own-guards-lied](my-own-guards-lied.md)
