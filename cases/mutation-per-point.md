# 只突變一處就宣稱三處都守住

- 日期：2026-08-29
- 本文條號：戊8
- 發生什麼：實作者為三處呼叫都補了同一種保護，突變驗證（把程式故意弄壞、看考題會不會紅）只拿掉其中一處、看到考題轉紅，就宣稱「拿掉任一處都轉紅」。獨立審查者逐點突變：第一處紅、第二三處綠——考題餵的假資料讓閘在第一步就關門，後兩處根本沒被走到。抽樣剛好抽中唯一有覆蓋（＝真的有考題走到）的那格，結論看起來成立其實是運氣。
- 代價：宣稱被獨立審查者逐點突變當場推翻，多一輪返工（同一輪的其餘修正核對無誤）。
- 教訓：宣稱 N 處都守住就要 N 個突變各打一發；多步驟流程還要有一題餵合法資料走完全程，只有早退的考題等於只有第一步有覆蓋。
- 來源：PFW #526（2026-08-29）https://github.com/teacherjung/personal-finance-webapp/pull/526#issuecomment-5463288160
- 相關：[my-own-guards-lied](my-own-guards-lied.md)、[blank-round-control-group](blank-round-control-group.md)、[claims-must-be-earned](claims-must-be-earned.md)、[restore-by-checkout-wiped-edits](restore-by-checkout-wiped-edits.md)
