# 考題被「文字出現過」滿足而假綠

- 日期：2026-08-02
- 本文條號：戊8
- 發生什麼：補欄位閘時新增的考題只斷言雲端設定檔裡出現那支腳本的路徑字串，而檔頭註解就有那個路徑，把真正執行它的那一行換掉照樣通過——這是同型假綠第三次（前兩次分別在分工規則那支的角色表題、在試算表套件的白名單題，各在別支）。獨立審查者接著又實測出兩個假綠，病因是全檔搜尋沒限定在那個作業區塊內。修法＝斷言行為（真的有一行在執行它、只在區塊內成立），不是斷言字串出現過。
- 代價：新加的考題等於沒守，要靠審查者實測才現形。
- 教訓：考題斷言的對象要是行為不是文字出現過；補完考題先把守的東西拿掉看它紅不紅。
- 來源：PFW #382（2026-08-02）https://github.com/teacherjung/personal-finance-webapp/pull/382（該支無留言，逐條證據在變更說明）
- 相關：[collab-invariant](collab-invariant.md)、[enumerate-bypasses-close-the-door](enumerate-bypasses-close-the-door.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[my-own-guards-lied](my-own-guards-lied.md)、[mutation-per-point](mutation-per-point.md)
