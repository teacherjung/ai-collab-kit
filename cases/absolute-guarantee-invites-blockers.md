# 檔頭一句絕對保證審了二十九輪

- 日期：2026-09-07
- 本文條號：F10、K3、K4
- 發生什麼：一支判斷「這段字在網頁上看不看得見」的小工具，實作者在檔頭寫了一句做不到的絕對保證「不可能少剝」（少剝＝該當成看不見的字沒剝乾淨）。從第五輪起，審查者每找到一個網頁語法的合法角落就合理判成「你的保證撐不住」，同一族反例連著十幾輪冒出來。實作者改把安全網做在輸出上（把配對到的留言印出來讓人看）、檔頭改寫成防誰不防誰，第二十五輪拿到第一張通過，第二十九輪收官。
- 代價：二十九輪審查＝這一支從頭到尾的總成本，只記在這一則（同一支的那則裁示記在 [pending-rulings-list-tool](pending-rulings-list-tool.md)，那裡不再重複計）；每一輪都是一次完整審查，這個數字量到的是實作者多久才去改任務本身，不是風險。
- 教訓：護欄說明裡不寫絕對量詞，寫防誰、防什麼、不防什麼；護欄的失敗是不是無聲的先去看輸出，讓失敗看得見比讓判斷更聰明便宜得多。
- 來源：PFW #579（2026-09-07）https://github.com/teacherjung/personal-finance-webapp/pull/579#issuecomment-5561064990；PFW #579（2026-09-08）https://github.com/teacherjung/personal-finance-webapp/pull/579#issuecomment-5573726516（＝第二十九輪收官那則，可核整支輪數）
- 相關：[pin-widening-treadmill](pin-widening-treadmill.md)、[pending-rulings-list-tool](pending-rulings-list-tool.md)、[claims-must-be-earned](claims-must-be-earned.md)、[tripwire-vs-safety-gate](tripwire-vs-safety-gate.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)
