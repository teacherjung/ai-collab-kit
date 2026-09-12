# 並行六條線共用暫存目錄，突變落到別條線的樹上

- 日期：2026-09-06
- 本文條號：丁2
- 發生什麼：同一輪稽核六條線並行，各有隔離樹，卻共用同一個暫存根目錄與同名腳本；其中一條的突變落到別條線的樹上，沒有任何東西擋。發現的那條線自己還原。
- 代價：一條線的樹被別條線改到，靠那條線自己發現還原。
- 教訓：並行的每條線暫存目錄各自獨立命名，改檔工具要有「目標不在自己樹底下就中止」的硬閘。
- 來源：私人紀錄（2026-09-06，無公開原文）
- 相關：[night-audit-3-findings](night-audit-3-findings.md)、[agent-mutation-in-live-worktree](agent-mutation-in-live-worktree.md)、[probe-files-in-worktree](probe-files-in-worktree.md)、[machine-load-breaks-timing-tests](machine-load-breaks-timing-tests.md)
