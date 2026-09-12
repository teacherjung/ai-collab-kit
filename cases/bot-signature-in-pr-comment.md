# 留言尾註的機器人記號觸發永久阻擋

- 日期：2026-08-15
- 本文條號：F4
- 發生什麼：實作者的預審回報與修正回報貼成變更留言時帶了工具自動加的「由 AI 產生」尾註；閘把任何含那個記號的留言當審查標頭掃描，第一行不合格＝永久阻擋、重述也救不了。最後動用裁示者特准：逐字補發（去尾註）並刪原留言。
- 代價：兩則留言要裁示者特准才能補發，並刪掉原留言。
- 教訓：帶機器人記號的尾註只放變更說明與提交訊息，變更留言一律不帶。
- 來源：PFW #464（2026-08-15）https://github.com/teacherjung/personal-finance-webapp/pull/464#issuecomment-5302222264
- 相關：[bot-mark-on-progress-comment](bot-mark-on-progress-comment.md)、[review-verdict-strings](review-verdict-strings.md)
