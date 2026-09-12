# 結論字串加括號閘看不見

- 日期：2026-08-06
- 本文條號：己3、己4
- 發生什麼：實作者的審查提示只寫「結論：<你的結論>」，獨立審查者寫出帶括號補充的結論（像「通過（無阻擋）」「退回修改（1 個 High）」）；合併閘逐字比對三個合規字串，那些留言在閘眼裡根本不存在，審了四輪直到合併才被擋下。閘做對了、錯的是實作者發出去的提示；修法＝請審查者本人補一則「格式正規化、不是改判」的重述留言，不去改舊留言。
- 代價：審了四輪到合併才被閘擋下，要審查者本人補發一則合規結論。
- 教訓：機器解析的欄位只放閘要的那個值，提示詞把三個結論字串逐字給審查者，補充寫在結論下面的內文。
- 來源：PFW #411（2026-08-06）https://github.com/teacherjung/personal-finance-webapp/pull/411#issuecomment-5195185342
- 相關：[source-string-drift-ghost-reviewer](source-string-drift-ghost-reviewer.md)、[role-name-not-in-table](role-name-not-in-table.md)、[bot-mark-on-progress-comment](bot-mark-on-progress-comment.md)、[verdicts-left-in-terminal](verdicts-left-in-terminal.md)、[stale-pass-on-moved-head](stale-pass-on-moved-head.md)、[silent-pass-is-worst](silent-pass-is-worst.md)、[collab-invariant](collab-invariant.md)
