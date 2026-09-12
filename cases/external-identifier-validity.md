# 考題餵自己假名字永遠綠

- 日期：2026-09-02
- 本文條號：戊8
- 發生什麼：程式拿外部世界定義的識別字（官方財報元素名）去比對，考題的夾具與期望值都是從正式程式抄來的同一份字串，名字寫錯照樣全綠。一顆名字寫錯的元素因此躺了好幾個月靜靜匹配不到、畫面留空，同一張表還有另外兩顆同病。
- 代價：錯名字躺了數月沒被任何考題抓到，一個欄位長期讀不到值。
- 教訓：看到比對外部字串的表，先問「哪一條考題會因為名字是假的而紅」；答不出就把外部真相帶進來（連網查核或官方快照），考題自己分不出真假。
- 來源：PFW #546（2026-09-02）https://github.com/teacherjung/personal-finance-webapp/pull/546
- 相關：[exemption-list-is-attack-surface](exemption-list-is-attack-surface.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[claims-must-be-earned](claims-must-be-earned.md)、[fixture-control-assertion](fixture-control-assertion.md)
