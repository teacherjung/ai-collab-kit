# 樹被切走，是考題數對不上才發現

- 日期：2026-08-23
- 本文條號：丁2
- 發生什麼：實作者在常設實作樹上開分支、改了四個檔，回頭跑全卷才發現那棵樹已被切到別人的分支：通過題數比預期多三十五題，那些是別人的。狀態只顯示自己改的四個檔，看起來很正常，分支名要自己去看才會發現。保命順序＝先把差異存到樹外、確認差異只有自己動的檔、只還原自己動過的那幾個檔、通知對方、換一棵樹重做；裁示者當日個案裁示另開一棵暫時實作樹。
- 代價：四個檔的改動要搬到另一棵樹重做一次。
- 教訓：每次跑三關順手核對通過題數，數字跳動先看分支名；還原只動自己動過的檔，絕不整樹重設。
- 來源：PFW #502（2026-08-23）https://github.com/teacherjung/personal-finance-webapp/pull/502（樹被切走那一段無公開留言）
- 相關：[worktree-switched-under-feet](worktree-switched-under-feet.md)、[concurrent-session-same-worktree](concurrent-session-same-worktree.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)
