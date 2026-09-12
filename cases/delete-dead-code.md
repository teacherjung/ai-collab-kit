# 死程式搬到退役夾反而混進別支

- 日期：2026-08-03
- 本文條號：E9
- 發生什麼：一支早已裁「規則收下、工具不收」的舊工具還躺在放合併閘的資料夾裡，讓整個資料夾看起來都是活的，裁示者裁「未來沒有用的程式都直接刪除」。實作者先試折衷，把它搬到樹裡一個未追蹤的「退役資料夾」，結果它在切分支時忽隱忽現——另一支變更的「全部加入」把它收進版控了，實作者一度以為有東西在刪檔案。搬動不是備份：未追蹤的檔，版本控制沒有副本。
- 代價：追了一陣假的「檔案被刪」；規則入冊那支還得明寫「不准為退役資料夾開豁免」。
- 教訓：備份與退役物不放在樹裡：要嘛進版控、要嘛刪掉；刪的是程式碼不是決定，理由先寫在別處。
- 來源：PFW #387（2026-08-03）<https://github.com/teacherjung/personal-finance-webapp/pull/387>
- 相關：[english-only-filenames](english-only-filenames.md)、[probe-files-in-worktree](probe-files-in-worktree.md)、[concurrent-session-same-worktree](concurrent-session-same-worktree.md)
