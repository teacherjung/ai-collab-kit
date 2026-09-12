# 考題只呼叫小函式，正式接線改壞照樣全綠

- 日期：2026-08-05
- 本文條號：戊8
- 發生什麼：一支新增五條「雲端防線」考題的變更，考題直接呼叫做判斷的小函式與常數；使用者真正會走的是主程式掛上去的請求大小上限，以及擋跨站請求的中介層（＝在請求到達處理程式之前先攔一手的那段程式）。獨立審查者在隔離副本把上限從三十二 KB 放寬成一 MB、把來源比對改成「開頭相符就放行」，小函式一字不動，新增五題與全卷一千四百多題照樣全綠。第二輪同一族再現一次：帳號遮罩題仍只呼叫小函式，真的送一次請求回來的末四碼是錯的。
- 代價：第一輪與第二輪都退回在「考題只打到小函式、沒打到接線」這一族；第三輪退回的是另外兩項考題撐不住自己宣稱的問題，08-05 至 08-06 共四輪，第 4 輪通過。這支整支四輪的成本只記在本則。
- 教訓：考題要打在使用者真的會走的那條路——真的送一次請求、走主入口——不是它裡面呼叫的那顆小函式；突變也要打在接線上。
- 來源：PFW #412（2026-08-05）https://github.com/teacherjung/personal-finance-webapp/pull/412#issuecomment-5189709315
- 相關：[assert-behavior-not-text](assert-behavior-not-text.md)、[mutation-per-point](mutation-per-point.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[boundary-tests-far-from-the-edge](boundary-tests-far-from-the-edge.md)、[cannot-do-claimed-reviewer-did-it](cannot-do-claimed-reviewer-did-it.md)、[my-own-guards-lied](my-own-guards-lied.md)
