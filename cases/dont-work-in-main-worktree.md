# 在主目錄施工提交落到別人分支

- 日期：2026-09-02
- 本文條號：丁2
- 發生什麼：實作者在主目錄施工，提交的那一瞬間另一個工作階段把主目錄切到它自己剛開的新分支，提交因此落到別人的分支上。成果沒丟，把自己的分支指回那顆提交就接回來；但對方那條分支正被主目錄用著、還有未提交的改動，什麼都不能動，只能改用自己的常設樹、等對方自己清。
- 代價：提交落錯分支要手動接回，對方的分支上多了一顆不屬於它的提交、要等它自己清。
- 教訓：主目錄是所有工作階段的公用地、切分支沒有鎖；實作一律在自己的常設樹，主目錄只做短動作，動前先看狀態與分支名。
- 來源：私人紀錄（2026-09-02，無公開原文）
- 相關：[concurrent-session-same-worktree](concurrent-session-same-worktree.md)、[agent-mutation-in-live-worktree](agent-mutation-in-live-worktree.md)、[probe-files-in-worktree](probe-files-in-worktree.md)
