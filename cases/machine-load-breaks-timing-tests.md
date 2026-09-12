# 機器負載把計時考題弄紅

- 日期：2026-09-02
- 本文條號：辛1、辛4
- 發生什麼：一天內八支以上變更同時在飛、十八個審查程序併行，機器負載飆到正常的好幾倍，量時間與量記憶體的考題間歇紅、單獨重跑全過；推送前守門與跨變更試合併閘都跑全卷，實作者被擋下、看起來像自己弄壞的。裁示者裁「等負載降」而不是授權跳過閘；之後兩支變更把那幾題改成量處理器工作量與因果上界，門檻語意不動。
- 代價：多次推送與合併被擋、等負載降才能繼續；被裁示者要求等而非跳過。
- 教訓：被擋先看負載、再問「紅的是哪一題」、本支有沒有動那個檔、單獨重跑；環境紅不是跳過閘的理由。
- 來源：私人紀錄（2026-09-02，無公開原文）；修法 PFW #552（2026-09-03）https://github.com/teacherjung/personal-finance-webapp/pull/552
- 相關：[cross-pr-gate-measures-load](cross-pr-gate-measures-load.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)、[ci-forward-job-flaky](ci-forward-job-flaky.md)、[pre-push-stuck-looks-like-running](pre-push-stuck-looks-like-running.md)
