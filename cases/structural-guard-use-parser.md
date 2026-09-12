# 正規式護欄同時假綠假紅

- 日期：2026-09-04
- 本文條號：戊8
- 發生什麼：三個檔案「不可自己寫死預設匯率」的護欄原本用正規式（＝按字元樣式比對的規則）只認舊數字，掃描器指出改成常數後抓不到新數字；實作者放寬正規式後，獨立審查者一輪抓到兩刀：一個真退路因名單缺項與雙空白漏抓（假綠），一個筆數退路因同一行有幣別名被誤抓（假紅）。實作者改用倉庫既有的語法解析器看語法樹（＝把程式拆成結構來看，不是看字），判準改成「存取鏈末端名字在名單內」、名單從正式程式匯入，假綠假紅各留探針題、每個受護檔各打一發突變（＝故意改壞一處，確認考題會紅）。
- 代價：一輪中兩刀，護欄整個換掉重寫。
- 教訓：要判斷程式長什麼形狀就看語法樹不看字元；審查者給的假綠假紅例子各留一題，改法有幾處就各打一發突變，解析器不丟例外時要自己讀診斷結果轉紅。
- 來源：PFW #558（2026-09-04）https://github.com/teacherjung/personal-finance-webapp/pull/558#issuecomment-5538553045
- 相關：[my-own-guards-lied](my-own-guards-lied.md)、[claims-must-be-earned](claims-must-be-earned.md)、[mutation-per-point](mutation-per-point.md)、[behavior-change-stale-prose](behavior-change-stale-prose.md)
