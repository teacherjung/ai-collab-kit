# 用版本控制還原突變，沒提交的成果一起被洗掉

- 日期：2026-09-02
- 本文條號：E10
- 發生什麼：實作者做完突變（＝把程式故意改壞、看考題會不會紅）探針後，用版本控制的「還原這個檔案」指令復原；那個指令還原的是索引（＝上次登記的版本），這一輪還沒登記的正式編輯被一起洗掉。考題照樣全綠（綠的是舊版），沒有任何訊號說成果沒了。同一種事在此之前與之後都再犯過。
- 代價：這一輪還沒登記的編輯無聲消失、要整批重做，而全綠的考題不會給任何提示。
- 教訓：突變前把檔案複製一份到樹外、還原時複製回來，不用版本控制還原。
- 來源：私人紀錄（2026-09-02，無公開原文）
- 相關：[mutation-per-point](mutation-per-point.md)、[probe-files-in-worktree](probe-files-in-worktree.md)、[agent-mutation-in-live-worktree](agent-mutation-in-live-worktree.md)、[my-own-guards-lied](my-own-guards-lied.md)
