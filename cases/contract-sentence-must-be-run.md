# 契約句沒跑過工具就寫進規則書

- 日期：2026-09-08
- 本文條號：K4、E8、G1、I3
- 發生什麼：裁示者前一天裁「引用網址必須寫在留言最外層才算數」；實作者把它搬進規則書時順手列了排除清單「引言、縮排、圍欄（＝包住整段程式碼、上下各一排的符號）、註解都不算」，卻沒把清單上每一種寫法餵給正式判斷函式跑一遍。獨立審查者兩輪沒看出來，掃描器一掃就中：引言的懶續行（引言下一行沒再寫引言記號、平台仍當同一段引言）在平台上仍顯示在引言裡、工具卻當它是頂層，契約說「不算」、工具卻「算」，還沒回的問題會被靜靜關掉。同一次掃描還抓到實作者把整串操作細節寫在裁示者只有一個字「a」的落款底下；修法＝緊接引言的行也當看不見（往收緊修），落款拆成「他裁的就是這一句」＋「下面是實作者的操作化」。
- 代價：兩輪審查沒抓到、靠掃描才抓到；一則引用它的留言就能把還沒回的問題靜靜關掉，裁示者的原話被摻進不是他說的字。
- 教訓：契約句列出的每一種寫法都要先讓工具真的跑過、結果貼進變更說明；外部怎麼顯示要實測不能猜；分岔往收緊修；裁示原話逐字與實作者的操作化分開標。
- 來源：PFW #580（2026-09-08）https://github.com/teacherjung/personal-finance-webapp/pull/580#issuecomment-5574917006 ；PFW #579（2026-09-07）https://github.com/teacherjung/personal-finance-webapp/pull/579#issuecomment-5570875993 （前一天的原裁示留言）
- 相關：[pending-rulings-list-tool](pending-rulings-list-tool.md)、[extract-current-rule-from-prose](extract-current-rule-from-prose.md)、[my-own-guards-lied](my-own-guards-lied.md)、[claims-must-be-earned](claims-must-be-earned.md)、[behavior-change-stale-prose](behavior-change-stale-prose.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
