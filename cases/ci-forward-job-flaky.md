# 前瞻工作的既有間歇紅差點被誤認

- 日期：2026-08-30
- 本文條號：辛1
- 發生什麼：雲端三關裡有一個「前瞻、不擋部署」的工作，其中一題時序考題在主幹上本來就會間歇紅；實作者在一支純註解的變更上看到它紅，第一反應是「又是我弄的」（前一支確實因大夾具拖慢鄰居害它紅過）。實作者去量對照組：主幹最近十次那個工作三次失敗、全是同一題同一句，證明是既有抖動；而那個工作設成「失敗不擋」，整場結論會顯示成功把它藏起來。它不是必要檢查、機械閘不看它，但合併步驟的「確認全綠」會看，下一支變更的代合併方就照規矩停在那一步，處置是重跑那個工作拿真的綠燈、不是放寬那一步。
- 代價：差點把既有抖動誤認成自己這支弄的；下一支變更的代合併被它停了一次。
- 教訓：紅了先問紅的是哪一題、拿主幹跑對照組，別看整場結論；自己這支有沒有份用差異內容證、不靠印象；處置是重跑一次，不是放寬。
- 來源：PFW #533（2026-08-30）https://github.com/teacherjung/personal-finance-webapp/pull/533（代合併停下那次＝PFW #534，2026-08-31，無公開留言）
- 相關：[same-blind-spot-no-gate](same-blind-spot-no-gate.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)、[blank-round-control-group](blank-round-control-group.md)、[machine-load-breaks-timing-tests](machine-load-breaks-timing-tests.md)
