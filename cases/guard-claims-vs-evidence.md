# 護欄的宣稱一直超出證據

- 日期：2026-09-09
- 本文條號：K4、K3、F10
- 發生什麼：一支改換行檢查的變更審了十一輪，被抓的發現多半不是程式錯而是考題註解與說明超出證據：寫「掃了哪些檔」但那份名單是從輸入抄出來的、跟迴圈實際處理了誰沒有連動；寫「逐碼位釘死」（＝一個字元一個字元的編碼位置都比對）但有一類空白字元只取代表值；寫「新題釘住實際宣告」但把原陣列包進註解、真宣告改成讀檔照樣全綠。每句都只多一點點，要拿證據去對才現形。第十一輪審查者接受把話縮回實測範圍，並點出「同一份可被編輯的考題，不能保證自己沒有被繞過」。
- 代價：十一輪審查，被抓的發現以敘述超出證據為主，不是程式錯。
- 教訓：寫下護欄的宣稱前先問「拿什麼證明的、證明涵蓋到哪」，涵蓋不到就把話縮回去——縮回去是正解不是失敗，劃界句自己也要實測。
- 來源：PFW #586（2026-09-09）https://github.com/teacherjung/personal-finance-webapp/pull/586#issuecomment-5595854691
- 相關：[claims-must-be-earned](claims-must-be-earned.md)、[my-own-guards-lied](my-own-guards-lied.md)、[pin-widening-treadmill](pin-widening-treadmill.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[benefit-claims-to-decider](benefit-claims-to-decider.md)、[rule-item-pin-overclaimed-boundary](rule-item-pin-overclaimed-boundary.md)、[narrowed-sentence-still-overclaims](narrowed-sentence-still-overclaims.md)、[every-smarter-guard-fell-next-round](every-smarter-guard-fell-next-round.md)、[no-explicit-rule-vs-not-on-this-table](no-explicit-rule-vs-not-on-this-table.md)、[scan-finding-transcribed-backwards](scan-finding-transcribed-backwards.md)
