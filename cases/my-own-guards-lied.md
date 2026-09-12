# 自己的護欄回報通過卻沒在守

- 日期：2026-08-05
- 本文條號：戊8、戊9
- 發生什麼：執行夜間稽核修補時，實作者的護欄一天內六次「回報通過、其實沒在守」：用版本控制還原突變洗掉成果、備份考題三顆空包彈（弄壞被守的東西照樣綠）、掃描器跳過非英文檔名卻回報零問題、考題走不到要測的那行、只看退出碼不看紀錄、幫審查者另開一棵乾淨的樹那條準備管線吞掉錯誤。六次沒有一次是規則寫錯，全是檢查器自己有洞。
- 代價：六次假通過各要重做一次驗證，其中「只看退出碼」那次的假綠已經先對外回報過。
- 教訓：護欄跑完沒出聲不等於在守：每道檢查先讓它紅一次，掃描器先印出「看到幾份」，退出碼與紀錄都要看。
- 來源：私人紀錄（2026-08-05，無公開原文）
- 相關：[silent-pass-is-worst](silent-pass-is-worst.md)、[claims-must-be-earned](claims-must-be-earned.md)、[six-changes-tested-middle-layer](six-changes-tested-middle-layer.md)、[guard-became-defect-source](guard-became-defect-source.md)、[comments-lied-one-in-five](comments-lied-one-in-five.md)、[restore-by-checkout-wiped-edits](restore-by-checkout-wiped-edits.md)、[mutation-per-point](mutation-per-point.md)
