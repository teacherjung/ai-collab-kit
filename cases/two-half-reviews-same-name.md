# 兩份審查各看一半

- 日期：2026-08-02
- 本文條號：F2、F4、F5
- 發生什麼：同一支變更的同一版上出現兩份都自稱同一審查角色、結論相反的留言：一份「通過，可以合併」，一份「需修改後再審」，平台上兩則長得一模一樣（同一個帳號底下至少四個審查者）。兩份其實都對，只是一份查版面結構、一份查金額口徑（＝金額怎麼認定、怎麼算的規則）與表格格數，後者實測出五個假綠（考題該紅卻是綠的：四個數字不走共用格式器＝統一把數字排成同一種樣子的共用程式，資料列少一格讓整排錯位）。修法三件：帶結論的留言第一行自報角色、來源、受審版本與輪次；阻擋取聯集（＝每一位審查者的阻擋都要各自解除才算清）、不取最後一則；審查者每輪跑一份固定維度清單。
- 代價：五個假綠差點被同名的那份「通過，可以合併」放行。
- 教訓：作者的重點清單會決定審查者看不到什麼，所以固定維度要每輪全跑，留言要自報來歷，阻擋只由同一位審查者對同一版解除——否則兩份審查各看一半，合起來還是漏。
- 來源：PFW #383（2026-08-02）<https://github.com/teacherjung/personal-finance-webapp/pull/383#issuecomment-5158259737>；PFW #385（2026-08-03）<https://github.com/teacherjung/personal-finance-webapp/pull/385> —— 這支只證明後續修法，不是原事故。
- 相關：[review-verdict-strings](review-verdict-strings.md)、[role-name-collision-scan-launcher](role-name-collision-scan-launcher.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[collab-invariant](collab-invariant.md)
