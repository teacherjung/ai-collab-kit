# 閘沒跑卻回報通過

- 日期：2026-08-03
- 本文條號：E5
- 發生什麼：實作者把合併閘複製到系統暫存目錄執行，完全沒有輸出、退出碼 0（＝程式回報「成功」的代號）；根因是暫存目錄是符號連結（＝指向另一個位置的捷徑），進入點守衛比對的兩個路徑一個是解析過的真實路徑、一個是打進去的樣子，主程式從來沒跑，而退出碼 0 對合併程序就是「這道閘通過了」。清查發現六個地方各寫一份守衛、五份會被騙，於是收成單一實作再用考題關門，宣告只有那一份可以做這個判斷。
- 代價：一道閘完全沒跑卻回報通過；六份判斷五份會被騙、整族收攏重寫。
- 教訓：靜靜通過比沒有護欄更糟，因為沒有人會再看；閘只看退出碼、查不到就不放行、不吞例外，判斷程式收成一支再用考題宣告誰有資格做。
- 來源：PFW #388（2026-08-03）https://github.com/teacherjung/personal-finance-webapp/pull/388
- 相關：[ignore-rule-made-a-hiding-place](ignore-rule-made-a-hiding-place.md)、[lint-output-tail-misread](lint-output-tail-misread.md)、[edit-failure-must-block-commit](edit-failure-must-block-commit.md)、[same-blind-spot-no-gate](same-blind-spot-no-gate.md)、[tool-lock-flag-silently-failed](tool-lock-flag-silently-failed.md)
