# 前瞻工作的既有間歇紅差點被誤認

- 日期：2026-08-30
- 本文條號：H1
- 發生什麼：雲端有一個「前瞻、失敗不擋部署」的工作，其中一題時序考題在主幹上本來就會間歇紅，而這種工作紅了整場結論仍顯示成功、把它藏起來。實作者在一支純註解的變更上看到它紅，第一反應是自己弄的——上一支確實因為自己的大夾具（＝考題用的假資料）拖慢鄰居害它紅過。去量對照組（＝拿沒有這支改動的主幹跑同一件事來比）才排除：主幹最近十次跑那個工作有三次失敗，全是同一題同一句話。
- 代價：差點把既有抖動記成自己這支弄的，要多花一段時間量對照組才排除。
- 教訓：紅了先問紅的是哪一題，再拿主幹跑對照組；別看整場結論，失敗不擋的工作會被整場的綠蓋掉；自己這支有沒有份，用這一輪的差異內容證，不靠印象。
- 來源：PFW #533（2026-08-30）<https://github.com/teacherjung/personal-finance-webapp/pull/533> 這支只能定位是哪一支變更，差點誤判與對照組那三次失敗沒有公開留言；私人紀錄（2026-08-30，無公開原文）
- 相關：[forward-job-red-stopped-proxy-merge](forward-job-red-stopped-proxy-merge.md)、[same-blind-spot-no-gate](same-blind-spot-no-gate.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)、[blank-round-control-group](blank-round-control-group.md)、[machine-load-breaks-timing-tests](machine-load-breaks-timing-tests.md)
