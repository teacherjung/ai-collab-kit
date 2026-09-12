# 自己讀表格文法四輪被打穿

- 日期：2026-09-10
- 本文條號：F10、I4
- 發生什麼：為守住角色表裡一句話，實作者四輪換四種做法自己讀表格文法（＝自己寫程式去看懂純文字表格怎麼排），第四輪被「表頭前四個空白」「分隔列裡一個不換行空白」打穿（網站把它畫成零張表），而一個多月前的先例早下過「要嘛寫真正的解析器（＝專門讀懂某種格式的程式）、要嘛不走」的結論。問裁示者時的選項裡寫了一句假賣點（「專案目前一個外部套件都沒有」），趁裁前貼了更正。裁示者選逐字釘住整塊，並同時立了「同一件事連續第三輪被抓、動手前先答五題」的自問表。
- 代價：四輪審查白燒加一則更正留言；量過的維護成本＝逐字釘那塊約每四天要回來同步一次。
- 教訓：檢查若要重做別人做好的東西（畫面怎麼呈現、某語言怎麼解析）第二輪就該停，換一個自己量得到的東西；給裁示者的選項先自己核一遍有沒有假話。
- 來源：PFW #596（2026-09-10）<https://github.com/teacherjung/personal-finance-webapp/pull/596#issuecomment-5621280390>
- 相關：[pin-widening-treadmill](pin-widening-treadmill.md)、[benefit-claims-to-decider](benefit-claims-to-decider.md)、[review-round-budget](review-round-budget.md)、[structural-guard-use-parser](structural-guard-use-parser.md)
