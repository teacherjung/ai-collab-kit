# 共享狀態讓合併閘隨機紅

- 日期：2026-08-25
- 本文條號：H1
- 發生什麼：跨變更試合併閘在一方手上退 1（＝退出碼 1，程式回報失敗）、在實作者手上連兩次退 0（＝回報成功），看起來像兩支變更有真衝突；同一天獨立審查者跑完整測試也紅過一題。研判是一題考題在真正的家目錄數金絲雀目錄（＝掃描器隔離測試用的假機密資料夾）的個數，另一個工作階段同時在跑測試就會弄紅它——但閘的退出碼不帶題名，指認是哪一題只能算假說；請對方暫停測試後，同一道閘首次重跑就綠。實作者另開一支修復，讓考題改在隔離根目錄裡看絕對值，並劃界說明同檔還有一條共用鎖沒修。
- 代價：合併閘隨機退 1、長得跟真衝突一樣，會誘使人去改根本沒問題的差異；修復那支走了七輪審查。
- 教訓：閘紅了先問「紅的是哪一題」，隔離重跑加完整重跑都綠才算環境干擾，不可只憑「重跑就過」放行；在共享空間認身分要認內容不數個數。
- 來源：PFW #514（2026-08-25）<https://github.com/teacherjung/personal-finance-webapp/pull/514#issuecomment-5414385509>；PFW #516（2026-08-26）<https://github.com/teacherjung/personal-finance-webapp/pull/516> —— 這支只證明後續的修復，不是原事故。
- 相關：[concurrent-session-same-worktree](concurrent-session-same-worktree.md)、[machine-load-breaks-timing-tests](machine-load-breaks-timing-tests.md)、[cross-pr-gate-measures-load](cross-pr-gate-measures-load.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
