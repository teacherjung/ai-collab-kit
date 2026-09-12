# 護欄連兩輪被戳洞後改劃界

- 日期：2026-08-29
- 本文條號：K3、K4、E4
- 發生什麼：一道考題管「雲端設定檔不准出現『草稿就跳過』的條件」，連兩輪被獨立審查者戳出等價寫法（不含那個字的條件、標點拼法變體）。第三輪實作者不再追補寫法，改成寫清它的身分：它是防自己人不小心加回去的絆線（＝提醒用的線，擋不住存心繞過的人）、不是防惡意寫法的安全閘，安全不變量（＝任何情況都不准被打破的那條底線）住在另一道閘（能合併的版本一定真的跑過雲端檢查）；劃界寫進考題註解，常見拼法補進判斷式。審查者同一則裁定絆線身分成立，卻在同一則的第一條指出：被指名承重的那道閘，三處版本控制呼叫都沒清掉環境變數（＝執行時跟著帶進去的設定值），可能查到別的倉庫——劃界這句保證自己還沒站住。
- 代價：兩輪複審白花在追補等價寫法，第三輪才換做法。
- 教訓：同一道護欄連兩輪被戳洞就先問「它在防誰」：防不小心＝絆線用考題釘住並寫明邊界，防對抗才值得結構化驗證；而「安全住在別處」本身也是一句保證，要先去那裡驗過才寫得出口。
- 來源：PFW #526（2026-08-29）<https://github.com/teacherjung/personal-finance-webapp/pull/526#issuecomment-5463225551>
- 相關：[remote-url-parser-scope-cap](remote-url-parser-scope-cap.md)、[claims-must-be-earned](claims-must-be-earned.md)、[review-round-budget](review-round-budget.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)、[my-own-guards-lied](my-own-guards-lied.md)
