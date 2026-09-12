# 瀏覽器驗證誤套用到真實資料

- 日期：2026-07-18
- 本文條號：B4
- 發生什麼：實作者在瀏覽器驗證一個會寫入的一次性資料整理，用腳本模擬點擊、本來要點的是取消；那次呼叫逾時異常，整理被套用到開發伺服器連著的真實資料庫，上百筆交易紀錄被改寫。轉換內容剛好是裁示者要的、存檔也有自動備份，但那是未經他按鈕核准的即時資料變更；已從備份完整還原並驗過。
- 代價：真實資料在未核准下被改寫，靠自動備份才救回來。
- 教訓：會寫入的功能，瀏覽器只驗唯讀的部分（預覽、計數、畫面結構），正確性靠隔離資料的考題；程式化點擊會逾時、會誤觸鄰近的寫入鍵。
- 來源：PFW #87（2026-07-18）<https://github.com/teacherjung/personal-finance-webapp/pull/87>
- 相關：[money-absolute-boundary](money-absolute-boundary.md)、[agent-mutation-in-live-worktree](agent-mutation-in-live-worktree.md)、[probe-files-in-worktree](probe-files-in-worktree.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
