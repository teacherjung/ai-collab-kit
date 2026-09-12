# 備審查樹失敗被管線吞掉，審查者拿到舊版本

- 日期：2026-08-05
- 本文條號：己3、己1
- 發生什麼：發審者要為獨立審查者備一棵拋棄式的審查樹，漏拆掉舊的同名樹，建立指令因此失敗；那條指令接在管線後面、只留最後一行，錯誤訊息被吞掉，發審者當成備好了就發射審查。審查者拿到的是舊版本，它開審前自檢「樹上的版本＝提示指定的版本」對不上，停下不審。
- 代價：一輪審查空跑、要重備一棵樹重發；擋住它的是審查者自己的自檢，發審這一端從頭到尾沒有任何訊號。
- 教訓：備樹每一步各自一個呼叫、不要接管線；發射前自己比對樹上的版本等於指定的受審版本，對不上就不發。
- 來源：私人紀錄（2026-08-05，無公開原文）
- 相關：[heredoc-eaten-empty-prompt](heredoc-eaten-empty-prompt.md)、[review-prompt-derivation-slip](review-prompt-derivation-slip.md)、[piped-exit-code-hid-lint-errors](piped-exit-code-hid-lint-errors.md)、[my-own-guards-lied](my-own-guards-lied.md)
