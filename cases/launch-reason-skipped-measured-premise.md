# 發射理由少了中間那一環，兩件事實被說成足以證明結論

- 日期：2026-09-09
- 本文條號：子4
- 發生什麼：規矩文件裡「掃描一律由某一方發射」的理由，寫的是兩件原始碼事實：發射指令帶著外層隔離（＝把程式關進限制權限的盒子裡跑），而掃描器套不上隔離就整支不跑。獨立審查者指出這兩件各自成立，卻都沒有證明中間那一環——這個外層環境會讓第二層隔離套不上。他自己跑了一次隔離能力探測、拿到「不被允許」的錯誤，才補上這個前提。
- 代價：可歸屬自己的代價是兩份規矩文件與變更說明的理由段落要重寫成「指令與流程是寫死的、環境能力是實測的」兩段；這條和抄反那條同屬一輪，沒有可獨立歸屬的輪數，輪數記在 scan-finding-transcribed-backwards。
- 教訓：兩件事實推到結論之前先問中間那一環量過沒有；量得到的前提就自己去量一次，不要把兩端寫得更肯定來補洞。
- 來源：PFW #588（2026-09-09）https://github.com/teacherjung/personal-finance-webapp/pull/588#issuecomment-5603427150
- 相關：[scan-finding-transcribed-backwards](scan-finding-transcribed-backwards.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)、[claims-must-be-earned](claims-must-be-earned.md)、[no-explicit-rule-vs-not-on-this-table](no-explicit-rule-vs-not-on-this-table.md)
