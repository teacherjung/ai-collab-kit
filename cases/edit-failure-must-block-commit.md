# 編輯沒寫入、提交照跑

- 日期：2026-09-03
- 本文條號：E9
- 發生什麼：實作者用一支多處替換的腳本改程式，其中一處斷言錯（出現次數寫三、實際四），腳本整支一個字都沒寫入；同一條指令鏈卻照樣跑了考題（綠，因為什麼都沒改）、推送前固定要跑的三道檢查、提交、推送並發射審查。提交訊息與變更說明宣稱了程式裡根本沒有的改動，獨立審查者開審的是不實版本。發現後停掉那輪審查、補一顆坦白提交（訊息寫明上一顆說了程式沒做的事）、重發。
- 代價：一輪審查白燒；歷史裡多一顆坦白提交。
- 教訓：編輯與提交分開呼叫，提交前看差異、宣稱要有差異撐；編輯失敗就整條鏈停下，不靠殼層的自動停止。
- 來源：PFW #553（2026-09-03）<https://github.com/teacherjung/personal-finance-webapp/commit/b106ff3b9f5ba788dcf387ea6492f384de9b0cbe>
- 相關：[comment-swallowed-rest-of-line](comment-swallowed-rest-of-line.md)、[pr-body-edit-chain-did-not-stop](pr-body-edit-chain-did-not-stop.md)、[log-grep-gate-judged-syntax-error-green](log-grep-gate-judged-syntax-error-green.md)、[heredoc-eaten-empty-prompt](heredoc-eaten-empty-prompt.md)、[my-own-guards-lied](my-own-guards-lied.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
