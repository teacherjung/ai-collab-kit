# 實作常設、審查拋棄

- 日期：2026-08-04
- 本文條號：己1、丁2
- 發生什麼：審查者在同一個目錄裡看到實作者重整（＝把自己的改動搬到最新主幹上重放）、切分支十幾次，正在讀的樹在腳下移動、新舊程式混雜；同日又兩次實測另一方直接在主目錄開工，主目錄被切到功能分支、本機主幹一度改名消失。裁示者在一支變更審到第四輪時拍板統一：實作在各自的常設樹、審查在每支一棵的拋棄式樹、絕不動主目錄；審查樹由發審者釘住受審版本備好與收掉，審查者不建樹、不裝不刪套件。
- 代價：一支變更方案級重工（前四輪審的是舊方案）；主目錄一度收不到後續合併。
- 教訓：一個工作目錄只服務一個角色：實作常設、審查拋棄、主目錄不施工。
- 來源：PFW #398（2026-08-04）https://github.com/teacherjung/personal-finance-webapp/pull/398
- 相關：[review-tree-symlink-wipe](review-tree-symlink-wipe.md)、[dont-work-in-main-worktree](dont-work-in-main-worktree.md)、[concurrent-session-same-worktree](concurrent-session-same-worktree.md)
