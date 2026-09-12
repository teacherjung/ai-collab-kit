# 雲端檢查還沒綠就發射代合併

- 日期：2026-09-04
- 本文條號：戊3
- 發生什麼：實作者推完最新版本沒幾分鐘就發射代合併，雲端三關還在跑。代合併方過了前兩道閘，在「確認雲端檢查全綠」那一步看到兩項仍是「待處理」，依程序停下、沒合併，後面的閘與合併命令都沒執行。約三分鐘後檢查跑完全綠，重發一次才合併成功。
- 代價：一整輪代合併白跑、要從第一道閘重來。
- 教訓：發射合併前自己看雲端檢查對目前版本真的跑完且綠，隔一段再看第二次；不要靠「剛推完應該快好了」。
- 來源：PFW #554（2026-09-04）https://github.com/teacherjung/personal-finance-webapp/pull/554#issuecomment-5531396875
- 相關：[same-blind-spot-no-gate](same-blind-spot-no-gate.md)、[ci-forward-job-flaky](ci-forward-job-flaky.md)
