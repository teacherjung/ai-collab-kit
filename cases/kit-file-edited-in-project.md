# 套件的檔在專案先改：兩邊各走各的，事後同步又把專案的改動悄悄換掉

- 日期：2026-10-15
- 本文條號：D5
- 發生什麼：原專案一支錢的攔截器修正（PFW #641）直接在專案改了 6 個共用檔，說明與 32 則留言沒有一處提到協作套件，兩邊約 34 小時內容不同，是有人手動比對兩份程式才發現；另一支標題寫同步的 PR（PFW #643）逐段挑著搬，做出協作套件從來沒有過的版本，兩邊約 22 小時對不上任何一版。2026-09-29 立了「先在專案改要記例外、之後搬回」與共用檔清單（本套件 #21），到 10/15 例外一次都沒用過；10/14 隔離重現量到它的洞：記了例外再照舊法整批覆蓋、事後寫清單，專案的改動被換掉、例外被清掉，檢查照樣全綠。擁有者 10/15 裁：一律不能改、沒有例外；同步前查到專案自己改過就停、不覆蓋；開工先查要改的檔在不在清單上。
- 代價：兩邊行為不同約 34 小時；約 22 小時兩邊對不上任何一版；例外機制留著一條「專案的改動在同步時無聲消失、檢查卻全綠」的路。
- 教訓：共用的檔只留一個能改的地方，別處只整批同步；換檔之前先查對方有沒有自己的改動，有就停下來，不要先覆蓋再補記。
- 來源：PFW #641 <https://github.com/teacherjung/personal-finance-webapp/pull/641>；PFW #643 <https://github.com/teacherjung/personal-finance-webapp/pull/643>；本套件 #21（2026-09-29）<https://github.com/teacherjung/ai-collab-kit/pull/21>；隔離重現與裁示＝私人紀錄（2026-10-14〜15，無公開原文）
- 相關：[rule-copied-six-places-drifted](rule-copied-six-places-drifted.md)、[exemption-list-is-attack-surface](exemption-list-is-attack-surface.md)
