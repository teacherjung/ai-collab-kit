# 環境紅寫進合併規則：不是跳過閘的理由

- 日期：2026-09-26
- 本文條號：H1
- 發生什麼：A4 已定放寬成由實作者自己跑合併指令（原本要防的利益衝突改由合併指令的自動檢查接手）；第二輪走到 H1，實作者提議主句寫明「合併一律跑合併指令」，子點補「負載、抖動、別的 Session 弄紅的，都不是跳過「閘」的理由」（實作者當時數 H1 的 6 則案例，3 則是這類環境紅：負載、共用狀態、間歇紅的工作），以及跨PR閘那次的教訓：閘紅了怎麼解讀是判準，判不出就照 F8 問裁示者。裁示者 9/26 把條文貼回來定案，四分鐘後再把環境紅那句拆成獨立子點，同時收下實作者補提的「全綠後只合併核過的那一版」。
- 代價：沒有新事故；三則舊案例付過的代價：負載紅讓多次推送與合併被擋、只能等負載降；共用狀態讓合併閘隨機紅得像真衝突，修復那支走了七輪；前瞻工作的間歇紅差點被記成自己弄的，多花一段時間量對照組才排除。
- 教訓：閘由要合併的一方自己跑時，把案例裡出過的環境紅（負載、抖動、別的 Session）明寫成不是跳過的理由；紅了先問是哪一題，怎麼解讀是判準，判不出就問裁示者。
- 來源：私人紀錄（2026-09-26，無公開原文）；本套件 #19（2026-09-28）<https://github.com/teacherjung/ai-collab-kit/pull/19> 只證明後續落地，不是當日原話。
- 相關：[machine-load-breaks-timing-tests](machine-load-breaks-timing-tests.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)、[ci-forward-job-flaky](ci-forward-job-flaky.md)、[cross-pr-gate-measures-load](cross-pr-gate-measures-load.md)、[implementer-runs-merge-command](implementer-runs-merge-command.md)
