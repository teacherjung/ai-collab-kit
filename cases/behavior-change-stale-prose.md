# 改了行為，舊句子連八輪變假話

- 日期：2026-09-02
- 本文條號：子5、子3、子4
- 發生什麼：實作者把匯率判準從「有值就照算」收緊成「必須正數」，計算邏輯第一輪之後就沒再改過（獨立審查者第八輪也逐字確認），但倉庫裡原本正確的契約、題名、註解與「見上一題／同上／下一行」這類會漂的路標自動變成假話。實作者每輪只修被點名的那幾處，同族其他處要等下一輪才被抓，第一輪起連續八輪每輪都至少中一處，第九輪才首次通過（之後還有兩輪在收變更說明）。第八輪還多抓到實作者自己寫的「本支新增文字已不再有任何位置式描述」與實際不符。
- 代價：計算邏輯早就對了，之後八輪全燒在文字，第九輪才首次通過。
- 教訓：改行為的當支就用舊行為的關鍵字掃整個倉庫的活文字一次收乾淨，路標用題名關鍵字不用相對位置；寫「已全部改」前先搜尋驗一次。
- 來源：PFW #544（2026-09-02）https://github.com/teacherjung/personal-finance-webapp/pull/544#issuecomment-5505647221
- 相關：[completion-claim-is-new-falsehood](completion-claim-is-new-falsehood.md)、[retired-mechanism-old-exits-still-open](retired-mechanism-old-exits-still-open.md)、[stale-header-in-tests-only-change](stale-header-in-tests-only-change.md)、[stale-comments-after-parser-simplified](stale-comments-after-parser-simplified.md)、[claims-must-be-earned](claims-must-be-earned.md)、[review-round-budget](review-round-budget.md)、[my-own-guards-lied](my-own-guards-lied.md)
