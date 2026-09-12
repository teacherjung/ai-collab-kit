# 跨變更試合併閘量到的是負載

- 日期：2026-09-03
- 本文條號：H1、H4
- 發生什麼：跨變更試合併閘要把本支與其他五到七支開著的變更各試合一次、各跑全套考題，退出碼卻取決於機器忙不忙：機器安靜時五支全綠，代合併方自己跑就紅（它跑在自己的隔離環境裡，那個環境本身就在吃機器資源），別線正在合併時跑四次、每次紅的變更都不一樣。實作者手建合併樹在安靜環境跑全套三千多題全綠，紅的都是已知的計時題。「閘紅了怎麼解讀」屬於判準，實作者停下問裁示者，裁示者裁「這道閘紅了重跑一次再判，其餘閘不適用」，只限那一支。
- 代價：審查早已通過的變更被閘擋住，前後跑了七次閘、等到裁示才合併。
- 教訓：閘紅了先問「紅的是哪一題」，訊息被截斷就自己建合併樹重跑全套；閘失敗怎麼解讀是判準，要裁示者裁、不可自行拍板。
- 來源：PFW #547（2026-09-03）<https://github.com/teacherjung/personal-finance-webapp/pull/547#issuecomment-5521309335>
- 相關：[gate-rerun-once-standing](gate-rerun-once-standing.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)、[ci-forward-job-flaky](ci-forward-job-flaky.md)、[machine-load-breaks-timing-tests](machine-load-breaks-timing-tests.md)
