# 複審用什麼模型、多強，只記在一方的對話裡，各輪各用各的

- 日期：2026-10-02
- 本文條號：F11
- 發生什麼：PFW #655 第三輪用了最重的設定（自動模式、派多個助手）。追源頭：裁示者 8/10 只對其中一方 AI 說過「未來審查都用某個模型加自動模式」，之後 9/29、10/1 又口頭改過兩次模型，三句都只在那一方的對話記憶裡，另一方不知道。往前查還有：PFW #641、#642 共 17 輪，發審的一方用無沙箱、又漏帶推理強度（實際是最低一檔）起複審，結論標頭的來源卻寫成另一種工作階段。裁示者 10/3 定案：「複審每輪都用最強模型、最高推理、不開自動模式」，派不派助手由複審者自己決定；額度用完才自動降一檔，事後告訴他；模型名另放一張對照表，換新模型時只改表。
- 代價：同一個專案的複審，從最低一檔推理到開自動模式派一批助手都有；17 輪是在沒有沙箱、最低推理下審的，標頭說的卻是另一種，事後沒有任何紀錄說得出每一輪實際用了什麼。
- 教訓：複審的模型與強度寫成表、放在兩方都會讀的地方，每一輪照表、不隨輪數降；實際用了什麼由複審者寫在結論開頭，事後查得到。
- 來源：PFW #641 <https://github.com/teacherjung/personal-finance-webapp/pull/641>、PFW #642 <https://github.com/teacherjung/personal-finance-webapp/pull/642>、PFW #655 <https://github.com/teacherjung/personal-finance-webapp/pull/655>；私人紀錄（2026-10-02〜03 查證與裁示，無公開原文）
- 相關：[review-scope-by-risk-tier](review-scope-by-risk-tier.md)、[standing-instructions-only-one-side](standing-instructions-only-one-side.md)、[source-string-drift-ghost-reviewer](source-string-drift-ghost-reviewer.md)
