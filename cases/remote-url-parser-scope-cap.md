# 解析器連四輪被戳後劃界封頂

- 日期：2026-09-06
- 本文條號：F10
- 發生什麼：一支腳本要用解析器（＝專門讀懂某種格式的程式）從版本控制的遠端網址算出倉庫名，好去查對應的變更。獨立審查者從第五輪到第八輪每輪各戳一刀（主機名可被環境變數導去別站、連接埠被當雜訊丟掉、網址正規化吃掉路徑、使用者資訊欄——網址裡帳號那一段——吃掉分隔符），實作者每輪補一種寫法、下一輪又被戳。第八輪之後改成把邊界寫進檔頭（它守的是設定寫錯、不是惡意：能改本機遠端設定的人也能直接改這支腳本）並宣告封頂，第九輪就通過。
- 代價：連四輪複審每輪都有一刀落在同一支解析器上，整支跑到第十輪才合併。
- 教訓：同一道非安全護欄（＝擋住寫錯、不是擋惡意的那種檢查）被連續戳到第三輪就該停下問「它在防誰」，再補一種寫法只是跑步機，劃界封頂才會收斂。
- 來源：PFW #573（2026-09-06）https://github.com/teacherjung/personal-finance-webapp/pull/573#issuecomment-5554280687
- 相關：[tripwire-vs-safety-gate](tripwire-vs-safety-gate.md)、[pin-widening-treadmill](pin-widening-treadmill.md)、[review-round-budget](review-round-budget.md)、[precision-can-defeat-usability](precision-can-defeat-usability.md)
