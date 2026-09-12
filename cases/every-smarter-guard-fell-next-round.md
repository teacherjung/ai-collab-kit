# 每一個更聰明的護欄都撐不到下一輪

- 日期：2026-09-10
- 本文條號：F10、K4
- 發生什麼：一支拿掉逾時預設的變更，要用考題證明工具裡「已經沒有逾時判斷」。實作者四輪各換一個更聰明的方法——字面比對（改個名字就過）、走語法樹找匯出（＝把程式當結構讀而不是當文字比，漏了幾種合法寫法）、在執行時把整個模組載進來清點它的匯出面（＝這個模組提供給別人使用的那些項目；但載入的結果會被模組自己一個叫 then 的函式整個換掉，量到的是那個函式交出來的假名單，偷偷多出來的項目根本看不見）、逐天掃四百天（反例落在兩個取樣點之間就穿過去）——每一個都被審查者實測找到沒想到的例外。第五輪審查者自己表示這類補強是選項、不是本支缺陷，也不要求再擴充取樣或另造護欄，該輪才通過。
- 代價：四輪各造一個新護欄又各被打穿，直到審查者說不必再補。
- 教訓：能量事實就量事實、不自己列舉；守得住的範圍寫死、每一句「守不住」親手跑過確認真的綠；審查者說「不要再補」就是收斂訊號，把已知反例釘成固定考題、只承諾那幾個案例是便宜且有終點的做法。
- 來源：PFW #595（2026-09-10）<https://github.com/teacherjung/personal-finance-webapp/pull/595#issuecomment-5618724694>
- 相關：[guard-claims-vs-evidence](guard-claims-vs-evidence.md)、[pin-widening-treadmill](pin-widening-treadmill.md)、[review-round-budget](review-round-budget.md)、[tripwire-vs-safety-gate](tripwire-vs-safety-gate.md)
