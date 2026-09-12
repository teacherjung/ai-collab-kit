# 探針備份被掃進提交上了變更

- 日期：2026-09-09
- 本文條號：戊9
- 發生什麼：實作者寫探針（＝專門拿來戳一道檢查有沒有洞的小程式）驗證那個洞，順手把兩份工作流設定的備份寫在正在用的工作樹裡，接著整樹加入提交，一百三十八行無用副本跟著上了變更。獨立審查者第一輪就點名「實際差異多了兩份備份檔、與送審範圍不符」。那兩份是會漂的版控副本，將來有人改了正式那份忘了這份，就多一個說謊的來源。
- 代價：一輪審查裡多一條發現要收；差點在倉庫裡留下兩份會漂的副本。
- 教訓：探針、突變、備份一律寫到工作樹外，最好整個實驗在另抽出的副本裡做；整樹加入提交前先看一次狀態清單，提交後再對一次檔案清單與變更說明是否一致。
- 來源：PFW #586（2026-09-09）https://github.com/teacherjung/personal-finance-webapp/pull/586#issuecomment-5589724230
- 相關：[agent-mutation-in-live-worktree](agent-mutation-in-live-worktree.md)、[edit-failure-must-block-commit](edit-failure-must-block-commit.md)、[dont-work-in-main-worktree](dont-work-in-main-worktree.md)
