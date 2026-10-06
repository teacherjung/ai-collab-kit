# 突變沒改到東西，紅綠照樣算數

- 日期：2026-09-05
- 本文條號：E8、E10
- 發生什麼：主事故是 PFW #567 第三輪。專案有一張突變表（＝固定腳本，逐發把程式故意改壞、看考題紅不紅），其中兩發替換契約頁首的一串字。這支變更改了頁首寫法，那兩發仍去替換舊字串，替換前也沒先確認目標存在。複審者量到舊字串在主幹命中 1 次、在受審版本 0 次，所以兩發什麼都沒改，等於拿沒改的程式跑。複審者據此推論：兩發期望紅、會跑出綠，整張表會以退出碼 1 失敗，宣稱要測的情境也沒被突變到。實作者在變更說明自述，前兩輪只跑了自己另做的 14 發，沒跑那張表。同族更早兩次：PFW #340，殼層把變數展開成空字串，替換沒生效卻顯示「通過」；PFW #384 第 23 輪，一發找不到目標而報錯，腳本照樣往下跑，沒改的基準被當成那發的「期望綠」過關，最後退出碼 0、印「全部符合期望」。#340 之後，專案規矩寫進突變一律先確認替換目標存在；#384 第 23 輪之後，腳本改成突變報錯就中止。#567 那兩發是 #384 後段才加的：沒照規矩先確認；替換找不到目標時不報錯，腳本的中止也接不到。
- 代價：第三輪唯一一條發現，結論「需修改後再審」；補一顆提交（兩發改打新字串、替換前先確認剛好命中一次）再進第四輪。第四輪複審者在隔離副本實測：拿掉那道確認、目標改成不存在，兩發都跑出「綠（期望 紅）」，整支退出碼 1；同一輪也把整張表的替換改成沒命中就報錯、逐段跑，90 次替換、定位全部命中，修好後沒有別的空轉。期望綠的空轉不會出聲，#384 那次就是退出碼 0（實作者轉述）；那一發過關了幾輪，沒查。
- 教訓：每一發突變先確認替換目標剛好命中一次，沒命中就報錯停下。沒改到的突變不算紅也不算綠：期望紅的會被讀成考題漏抓，期望綠的會跟沒改的基準對上、靜靜過關。改到既有突變表會打的字樣，就把整張表重跑一次。
- 來源：PFW #567（2026-09-05）第三輪複審原文 <https://github.com/teacherjung/personal-finance-webapp/pull/567#issuecomment-5550895138>、第四輪實測 <https://github.com/teacherjung/personal-finance-webapp/pull/567#issuecomment-5550988306>，實作者自述在變更說明 <https://github.com/teacherjung/personal-finance-webapp/pull/567>；PFW #340（2026-07-28）<https://github.com/teacherjung/personal-finance-webapp/pull/340>（該支無留言，只見於實作者變更說明一句，沒有留下輸出）；PFW #384（2026-08-02）<https://github.com/teacherjung/personal-finance-webapp/commit/3ec840c131dd7f74ae50eb06fa1ae22c5c755638>（第 23 輪原文不在 PR 上，PR 只有一則第 47 輪留言；只見於實作者這顆提交寫進突變腳本的註解，是轉述）
- 相關：[edit-failure-must-block-commit](edit-failure-must-block-commit.md)、[comment-swallowed-rest-of-line](comment-swallowed-rest-of-line.md)、[mutation-per-point](mutation-per-point.md)、[fixture-control-assertion](fixture-control-assertion.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[deleting-the-operation-is-not-a-mutation](deleting-the-operation-is-not-a-mutation.md)
