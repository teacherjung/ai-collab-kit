# 夾具在新環境靜靜變空包彈

- 日期：2026-09-01
- 本文條號：戊8、子4
- 發生什麼：實作者寫考題測「錯誤訊息會帶出輸入前綴」，夾具（＝考題用的假資料）用的壞寫法在新版執行環境根本不回顯前綴，同支另一題也沒先證明環境真的收得下髒值——兩題照樣綠但什麼都沒測到。突變雖然轉紅，紅的原因是訊息措辭對不上、不是前綴斷言抓到外洩，實作者卻把它當「已驗證」寫進變更說明。獨立審查者第九輪才抓到那格證據是假的。
- 代價：一格假的「已驗證」撐到第九輪才被抓，那支變更又多走了兩輪才通過。
- 教訓：依賴環境行為的夾具先加一條對照斷言證明現象真的發生；突變轉紅要看紅的是不是對應那一行，寫「N 刀全紅」前逐刀確認。
- 來源：PFW #535（2026-09-01）https://github.com/teacherjung/personal-finance-webapp/pull/535#issuecomment-5492648998
- 相關：[blank-round-control-group](blank-round-control-group.md)、[mutation-per-point](mutation-per-point.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[claims-must-be-earned](claims-must-be-earned.md)、[external-identifier-validity](external-identifier-validity.md)
