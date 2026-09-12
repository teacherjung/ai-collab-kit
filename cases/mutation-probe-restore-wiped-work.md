# 突變探針用版本控制還原，當批成果被洗掉

- 日期：2026-08-05
- 本文條號：E9
- 發生什麼：實作者做一批稽核探針，突變（＝把程式故意弄壞、看考題會不會紅）做到一半、成果還沒登記進版本控制，就用版本控制的還原指令把檔案改回去；還原回來的是上次登記的版本，這一批還沒登記的編輯一起被洗掉，而考題照樣全綠（綠的是舊版）。當天定下的修法是突變前先把檔案複製一份到樹外、還原時複製回來，並且先登記再突變。
- 代價：那一批還沒登記的探針成果消失、要重做一次；沒有獨立量測輪數或時間。
- 教訓：先登記再突變；還原一律用樹外的複本，不要用版本控制的還原指令，因為它只還得回已登記的版本。
- 來源：私人紀錄（2026-08-05，無公開原文）
- 相關：[restore-by-checkout-wiped-edits](restore-by-checkout-wiped-edits.md)、[probe-files-in-worktree](probe-files-in-worktree.md)、[mutation-per-point](mutation-per-point.md)、[my-own-guards-lied](my-own-guards-lied.md)
