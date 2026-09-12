# 六條備份考題全綠，其中三條弄壞了也不會紅

- 日期：2026-08-05
- 本文條號：E8
- 發生什麼：實作者為「東西壞掉時能不能照著還原」補了六條備份考題，一次全綠就準備收工。照規矩逐條做突變（＝把被守的東西故意弄壞、看考題會不會紅）之後，六條裡有三條是空包彈：一條讓失敗發生在該檢查的殘骸產生之前、一條的失敗走的是另一條路徑、一條的判準寫成「有沒有丟出錯誤」而不是「有沒有留下還原指引」。
- 代價：六條考題有三條完全沒有守備力，而全綠的結果不會透露這件事；三條要重寫並各自再跑一次突變。
- 教訓：每條考題寫完先問「把它守的那件事弄壞，這條會紅嗎」並且實跑一次；判準要斷言要守的那件事本身，不是順手會出現的錯誤。
- 來源：私人紀錄（2026-08-05，無公開原文）
- 相關：[silent-pass-is-worst](silent-pass-is-worst.md)、[assert-behavior-not-text](assert-behavior-not-text.md)、[mutation-per-point](mutation-per-point.md)、[fixture-missing-field-never-reached](fixture-missing-field-never-reached.md)、[scanner-skipped-non-ascii-paths](scanner-skipped-non-ascii-paths.md)、[exit-code-only-missed-error-log](exit-code-only-missed-error-log.md)、[review-tree-pipeline-swallowed-failure](review-tree-pipeline-swallowed-failure.md)、[mutation-probe-restore-wiped-work](mutation-probe-restore-wiped-work.md)
