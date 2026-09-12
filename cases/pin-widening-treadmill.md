# 考題邊界外推一格連九輪被繞

- 日期：2026-09-07
- 本文條號：F10、K4
- 發生什麼：一顆保住規則書某一節不被宣告作廢的考題，實作者每一輪的修法都是把釘住的邊界往外推一格，獨立審查者下一輪就站到新邊界外面，到第九輪每一輪都還有新寫法繞過去。停下來去量那段程式要守的東西：五份規則文件裡最常見那種標題有五十三個，它要擋的另外兩種寫法一次都沒出現過，裁示者據此裁定只認最常見那一種、其餘明寫擋不到。這支第四輪曾拿到一次通過又被打回，第十六輪才收官。
- 代價：十六輪審查，中間一整段是同一個動作反覆重複；真正讓它停下的不是再補一格，而是去量那兩種寫法在專案裡出現過幾次（答案是零次）。
- 教訓：同一件事連續第三輪被抓就停手問「這道考題到底能證明什麼」，不要再修形狀；砍或收窄護欄（＝擋住錯誤寫法的那道檢查）前先量它實際守到的量，射程照量到的寫。
- 來源：PFW #578（2026-09-07）https://github.com/teacherjung/personal-finance-webapp/pull/578#issuecomment-5565356167
- 相關：[absolute-guarantee-invites-blockers](absolute-guarantee-invites-blockers.md)、[reimplementing-parser-stop-second-round](reimplementing-parser-stop-second-round.md)、[review-round-budget](review-round-budget.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)、[my-own-guards-lied](my-own-guards-lied.md)、[tripwire-vs-safety-gate](tripwire-vs-safety-gate.md)
