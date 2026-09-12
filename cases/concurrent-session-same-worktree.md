# 兩個工作階段共用一棵樹，改到一半的檔被覆寫

- 日期：2026-08-09
- 本文條號：丁2
- 發生什麼：實作者在一棵實作樹上改考題，另一個工作階段在同一棵樹上兩度覆寫它改到一半的檔案：近千行的考題被換成一百多行、順手拿掉一個依賴，接著提交並推上遠端。徵兆是狀態裡冒出沒碰過的檔案、最新提交自己往前跳、幾分鐘前寫進去的字串找不到了。實作者沒有回退對方已推的方向（那是編輯戰），先把自己的成果複製到樹外，把衝突與誰的待辦列給裁示者裁。
- 代價：改到一半的檔案被換掉要重做。
- 教訓：一棵樹一個工作階段；改到一半先把成果放到樹外、做完盡快提交，成果只存在工作樹＝隨時可能歸零；對方已推的方向不回退，衝突列給裁示者。
- 來源：PFW #433（2026-08-09）https://github.com/teacherjung/personal-finance-webapp/pull/433
- 相關：[proxy-commit-voided-pass](proxy-commit-voided-pass.md)、[worktree-switched-under-feet](worktree-switched-under-feet.md)、[worktree-hijack-caught-by-test-count](worktree-hijack-caught-by-test-count.md)、[dont-work-in-main-worktree](dont-work-in-main-worktree.md)、[agent-mutation-in-live-worktree](agent-mutation-in-live-worktree.md)、[bare-repo-incident](bare-repo-incident.md)
