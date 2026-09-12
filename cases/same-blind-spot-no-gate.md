# 雲端檢查紅了八輪沒人看

- 日期：2026-08-15
- 本文條號：戊3
- 發生什麼：實作者本機三關（＝送審前固定要跑的三種檢查）全綠，雲端兩個作業卻從第一顆提交起就紅；實作者與獨立審查者都在同一種作業系統上跑三關，八輪審查沒有人看過雲端結果，直到通過後要跑合併閘才第一次看。病灶只是考題挑了一個雲端機器上沒有的殼層（＝執行指令用的解譯程式）。修好後三項檢查才全綠，多走了第九輪。
- 代價：八輪審查等於沒有那道關；雲端紅燈從第一顆提交拖到通過後才發現，再補一輪修復。
- 教訓：兩個把關者用同一套眼睛，那道關就等於不存在；送審前與合併前都要自己看雲端三關對目前版本真的跑完且綠，不要因本機全綠就以為不必看。
- 來源：PFW #463（2026-08-15）https://github.com/teacherjung/personal-finance-webapp/pull/463#issuecomment-5302897072
- 相關：[stale-green-after-promote](stale-green-after-promote.md)、[my-own-guards-lied](my-own-guards-lied.md)、[ci-forward-job-flaky](ci-forward-job-flaky.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
