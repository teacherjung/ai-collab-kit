# 六支一次送審全退回：考題驗的是中間層

- 日期：2026-08-05
- 本文條號：戊8
- 發生什麼：實作者把六支夜間稽核修補一次送審，第一輪沒有一支通過，退回理由同族：考題只呼叫被主程式呼叫的小函式與常數，正式的承重點（主程式的接線、中介層）改壞了考題照樣綠；另一支的邊界考題用離邊界很遠的值，門檻調鬆全綠；還有一支把「做不到」寫成技術限制，審查者當場做出來。
- 代價：六支同日整批退回重做。
- 教訓：考題要驗使用者真的會走的那條路、突變要打在承重點上，邊界要踩相鄰兩格；「做不到」也是一種保證，同樣要有證據。
- 來源：PFW #412（2026-08-05）https://github.com/teacherjung/personal-finance-webapp/pull/412#issuecomment-5189709315
- 相關：[my-own-guards-lied](my-own-guards-lied.md)、[claims-must-be-earned](claims-must-be-earned.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
