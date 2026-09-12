# 結論只留在終端沒貼上變更

- 日期：2026-08-19
- 本文條號：己7、己4
- 發生什麼：一支變更走了十輪，只有其中三輪的結論真的貼到變更上，其餘都只留在審查工具的輸出裡；實作者每輪讀日誌看到結論就往下走。合併前跑閘（＝合併前自動跑的檢查，不過就不准合併）當場擋下：貼上去的最後一則是「需修改後再審」、沒被同一位審查者用更高輪次撤銷。
- 代價：合併被擋，要審查者本人補發缺的結論。
- 教訓：「他說通過了」只有在變更留言看得到時才算數；發射提示明寫要貼留言，收到結論後自己去變更上確認那一則在不在。
- 來源：PFW #490（2026-08-19）https://github.com/teacherjung/personal-finance-webapp/pull/490#issuecomment-5345417975
- 相關：[review-verdict-strings](review-verdict-strings.md)、[verdicts-left-in-terminal-again](verdicts-left-in-terminal-again.md)
