# 掃描結果抄進考題註解時抄反了

- 日期：2026-09-09
- 本文條號：K3、K4
- 發生什麼：掃描器的一條發現被抄進考題註解時抄反了：掃描器把「同一句折行、讓關鍵詞掉出擷取視窗（＝考題只看關鍵詞前後那一小段）」列在「正常編輯會被誤擋」那一欄，實作者卻寫成「擋不到，實測仍綠」。獨立審查者把那個詞折到視窗外、四處逐一實測都是紅（每處五過一紅），跟註解寫的相反；變更說明的逐條判定也跟著錯一列。
- 代價：這一輪退回，註解與變更說明兩處的紅綠宣稱要更正（考題本身不必改）。
- 教訓：別人的發現要寫進註解之前，每一條自己先跑一次；轉述時回原文看它被列在哪一欄，不要照記憶壓縮。
- 來源：PFW #588（2026-09-09）<https://github.com/teacherjung/personal-finance-webapp/pull/588#issuecomment-5603427150>
- 相關：[launch-reason-skipped-measured-premise](launch-reason-skipped-measured-premise.md)、[quote-rules-verbatim](quote-rules-verbatim.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)、[claims-must-be-earned](claims-must-be-earned.md)
