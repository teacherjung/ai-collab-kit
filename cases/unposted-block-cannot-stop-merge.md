# 沒貼上的「需修改」擋不住合併

- 日期：2026-08-29
- 本文條號：己4
- 發生什麼：一支變更的實作階段中斷，監督線接手收尾並發了一輪審查、拿到「需修改後再審」；隨後原實作階段復活，用自己的輪次編號貼了兩張「通過」、走閘、合併。監督線那張「需修改」從頭到尾沒貼到變更上，對閘與對方等於不存在，合併時少了它的修法。漏掉的修法另開一支小變更走完整流程補進去。
- 代價：合併版本少一條修法，另補一支小變更。
- 教訓：審查結論不貼到變更上等於沒發生，跑完立刻貼；接手前先在變更上留言認領；撞了不吵架、撿殘件補一支。
- 來源：PFW #522（2026-08-29）https://github.com/teacherjung/personal-finance-webapp/pull/522#issuecomment-5454530832
- 相關：[concurrent-session-same-worktree](concurrent-session-same-worktree.md)、[review-verdict-strings](review-verdict-strings.md)、[two-half-reviews-same-name](two-half-reviews-same-name.md)
