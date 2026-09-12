# 審查樹清理清空主目錄

- 日期：2026-08-02
- 本文條號：F1
- 發生什麼：審查用的工作樹（＝同一個倉庫另外開的工作目錄）以符號連結（＝一個指向別處資料夾的捷徑）借用主目錄的套件目錄；清理暫存工作樹時刪除動作順著連結進去，主目錄的套件被清空，裁示者的應用程式立刻起不來、錯誤訊息指不到真因。這個借用做法正是規則書自己教的，當天才補上「只准建、不准動」。
- 代價：應用程式停擺一次，錯誤訊息完全指不到真因。
- 教訓：審查者在審查樹裡只讀、不裝不刪套件；樹的生與死由備樹（＝事前把那棵工作樹準備好）的人負責。
- 來源：PFW #379（2026-08-02）https://github.com/teacherjung/personal-finance-webapp/pull/379 —— 這支是事故當天補規則的變更，事故本身記在它的變更說明「另外兩處」。
- 相關：[permanent-impl-tree-disposable-review-tree](permanent-impl-tree-disposable-review-tree.md)、[dont-work-in-main-worktree](dont-work-in-main-worktree.md)
