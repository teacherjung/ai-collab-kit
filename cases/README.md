# 案例簿索引

一則事故（或一則裁示）一檔；每則指回本文條號。角色寫法：擁有者／裁示者／實作者／複審者／掃描者，不寫人名；新寫的照新名字，舊案例照當時的寫法、不改名。
來源欄的 PFW \#n ＝原專案 personal\-finance\-webapp 的第 n 支PR。

共 181 則。

| 日期 | 案例 | 本文條號 |
|---|---|---|
| 2026-07-10 | [合併時刪基底分支，上層兩支被平台關閉](delete-branch-closed-stacked-pr.md) | H2 |
| 2026-07-18 | [瀏覽器驗證誤套用到真實資料](verify-mutations-on-real-data.md) | B4 |
| 2026-07-24 | [管線吃掉退出碼，四條錯漏網](piped-exit-code-hid-lint-errors.md) | E2、E5 |
| 2026-07-28 | [堆疊變更合進中間分支](stacked-pr-merged-into-base.md) | H2、K1 |
| 2026-07-29 | [刪掉受測操作還綠，不代表考題假綠](deleting-the-operation-is-not-a-mutation.md) | E8 |
| 2026-07-30 | [加規則與刪規則混在一份提案](add-and-delete-rules-in-one-change.md) | C2 |
| 2026-07-30 | [實作者不按自己的合併鍵](implementer-never-presses-merge.md) | A4 |
| 2026-07-30 | [審查方切走主幹、主目錄卡住](reviewer-worktree-took-over-main.md) | A3 |
| 2026-07-31 | [人工預約表會過期，改成開工先開草稿PR](reservation-table-retired.md) | D3、E1 |
| 2026-08-02 | [考題被「文字出現過」滿足而假綠](assert-behavior-not-text.md) | E8 |
| 2026-08-02 | [不變量寫在沒人讀的檔、平台上也看不出分工](collab-invariant.md) | A2、E1、K1、H5 |
| 2026-08-02 | [列舉繞法三輪補不完，關門才收](enumerate-bypasses-close-the-door.md) | F10 |
| 2026-08-02 | [逃生門開著＝每次操作都在繞過](github-branch-protection.md) | A2 |
| 2026-08-02 | [審查樹清理清空主目錄](review-tree-symlink-wipe.md) | F1 |
| 2026-08-02 | [兩份審查各看一半](two-half-reviews-same-name.md) | F2、F4、F5 |
| 2026-08-03 | [註解裡「兩邊都要」的保證沒有考題撐](claims-must-be-earned.md) | K3、K4 |
| 2026-08-03 | [死程式搬到退役夾反而混進別支](delete-dead-code.md) | E10 |
| 2026-08-03 | [檔名一律用英文](english-only-filenames.md) | E6 |
| 2026-08-03 | [忽略清單把藏身處做得比刪除更順手](ignore-rule-made-a-hiding-place.md) | E7 |
| 2026-08-03 | [連接器能備妥真委託單](money-absolute-boundary.md) | B1、B2、B3 |
| 2026-08-03 | [閘沒跑卻回報通過](silent-pass-is-worst.md) | E5 |
| 2026-08-04 | [實作常設、審查拋棄](permanent-impl-tree-disposable-review-tree.md) | F1、D2 |
| 2026-08-05 | [邊界考題踩的值離邊界很遠，門檻調鬆全綠](boundary-tests-far-from-the-edge.md) | E8 |
| 2026-08-05 | [「做不到」被寫成誠實劃界，審查者當場做出來](cannot-do-claimed-reviewer-did-it.md) | K4 |
| 2026-08-05 | [只看退出碼就回報三關全綠，錯誤就印在自己導出的檔案裡](exit-code-only-missed-error-log.md) | E2、K4 |
| 2026-08-05 | [夾具少一個欄位，要測的那一行根本沒被走到](fixture-missing-field-never-reached.md) | E8 |
| 2026-08-05 | [突變探針用版本控制還原，當批成果被洗掉](mutation-probe-restore-wiped-work.md) | E10 |
| 2026-08-05 | [六條備份考題全綠，其中三條弄壞了也不會紅](my-own-guards-lied.md) | E8 |
| 2026-08-05 | [六支並行讓裁示者讀不完](one-thing-at-a-time.md) | C1、J2 |
| 2026-08-05 | [審查回饋無條件全改的跑步機](review-feedback-treadmill.md) | F6 |
| 2026-08-05 | [備審查樹失敗被管線吞掉，審查者拿到舊版本](review-tree-pipeline-swallowed-failure.md) | F3、F1 |
| 2026-08-05 | [掃描器跳過非英文檔名，回報零問題](scanner-skipped-non-ascii-paths.md) | E6、K4 |
| 2026-08-05 | [考題只呼叫小函式，正式接線改壞照樣全綠](tests-called-helper-not-the-wiring.md) | E8 |
| 2026-08-06 | [護欄自己成了最大缺陷來源，拆掉才第一次通過](guard-became-defect-source.md) | F10 |
| 2026-08-06 | [結論字串加括號閘看不見](review-verdict-strings.md) | F3、F4 |
| 2026-08-06 | [停損門檻至少超過七輪，而且問自己不問他](stop-loss-over-seven-rounds.md) | F9 |
| 2026-08-08 | [註解裡的現在式敘述近兩成站不住](comments-lied-one-in-five.md) | K3 |
| 2026-08-09 | [測試夾具把倉庫寫成裸倉庫](bare-repo-incident.md) | E4、K4 |
| 2026-08-09 | [兩個工作階段共用一棵樹，改到一半的檔被覆寫](concurrent-session-same-worktree.md) | D2 |
| 2026-08-09 | [對方代為提交我的半成品，附上沒人跑過的數字](proxy-commit-voided-pass.md) | A2 |
| 2026-08-10 | [清環境的考題只看幾個名字，退化成列名照樣全綠](child-env-proxy-test-stayed-green.md) | E4、E8 |
| 2026-08-12 | [進度留言帶了結論專用記號](bot-mark-on-progress-comment.md) | F4 |
| 2026-08-13 | [審過即合併的常設授權](merge-standing-authorization.md) | A5 |
| 2026-08-14 | [判不出算不算架構，一律當作算](architecture-undecidable-counts.md) | F8 |
| 2026-08-14 | [送審前預審抓到功能整個是死的](pre-review-caught-dead-switch.md) | E9 |
| 2026-08-14 | [一行小字審了二十三輪](review-round-budget.md) | F10、F8 |
| 2026-08-14 | [同一條規則寫六份，三輪各漏一項](rule-copied-six-places-drifted.md) | K1 |
| 2026-08-14 | [來源字串打法漂一次生出幽靈審查者](source-string-drift-ghost-reviewer.md) | F3、F5 |
| 2026-08-14 | [複審與修不修的常設授權](standing-review-authorization.md) | F6、F8 |
| 2026-08-14 | [樹在腳下被切到別人的分支，提交落進別人的變更](worktree-switched-under-feet.md) | D2 |
| 2026-08-15 | [留言尾註的機器人記號觸發永久阻擋](bot-signature-in-pr-comment.md) | F4 |
| 2026-08-15 | [一顆空字元讓新閘的差異只剩「二進位檔不同」](control-char-hid-the-diff.md) | E6 |
| 2026-08-15 | [回報裡不放版本雜湊那類亂碼](no-hash-ids-in-reports.md) | J2 |
| 2026-08-15 | [規則越補越精確補到現場記不住](precision-can-defeat-usability.md) | K2、K3 |
| 2026-08-15 | [雲端檢查紅了八輪沒人看](same-blind-spot-no-gate.md) | E3 |
| 2026-08-18 | [角色欄寫了查表外的名字](role-name-not-in-table.md) | F3、F4 |
| 2026-08-18 | [掃描記帳說謊、改成複審後掃一次](scan-ledger-lied-move-scan-after-pass.md) | G1、G3 |
| 2026-08-19 | [結論只留在終端沒貼上變更](verdicts-left-in-terminal.md) | F7、F4 |
| 2026-08-22 | [「已逐條列完」的宣稱自己成了下一輪的缺口](completeness-claim-breeds-gaps.md) | K4、F10 |
| 2026-08-22 | [鎖工具旗標五十三次掃描五十二次靜默失效](tool-lock-flag-silently-failed.md) | G2 |
| 2026-08-23 | [防空包彈的對照組自己是空包彈](blank-round-control-group.md) | E8 |
| 2026-08-23 | [漏寫「不要合併」、審完直接合了](review-prompt-missing-do-not-merge.md) | F3、G1 |
| 2026-08-23 | [樹被切走，是考題數對不上才發現](worktree-hijack-caught-by-test-count.md) | D2 |
| 2026-08-25 | [共享狀態讓合併閘隨機紅](shared-state-flaky-across-sessions.md) | H1 |
| 2026-08-28 | [收緊判準反而在別處多猜了一次](population-filter-uniqueness-trap.md) | E9、K4 |
| 2026-08-28 | [結論沒貼上變更，九天後再踩](verdicts-left-in-terminal-again.md) | F7、F4 |
| 2026-08-29 | [待辦卡片生卡片，裁示者消化不完](chip-policy.md) | F6 |
| 2026-08-29 | [只突變一處就宣稱三處都守住](mutation-per-point.md) | E8 |
| 2026-08-29 | [重疊的草稿變更擋住快合併的那支](pr-overlap-open-strategy.md) | D3 |
| 2026-08-29 | [護欄連兩輪被戳洞後改劃界](tripwire-vs-safety-gate.md) | K3、K4、E4 |
| 2026-08-29 | [沒貼上的「需修改」擋不住合併](unposted-block-cannot-stop-merge.md) | F4 |
| 2026-08-30 | [前瞻工作的既有間歇紅差點被誤認](ci-forward-job-flaky.md) | H1 |
| 2026-08-31 | [不擋部署的工作紅著，代合併照規矩停在確認全綠那一步](forward-job-red-stopped-proxy-merge.md) | E3、H1 |
| 2026-08-31 | [提示詞要具體字串、整遍掃描判事故](scan-prompt-asked-for-literal-strings.md) | G2、G3 |
| 2026-09-01 | [夾具在新環境靜靜變空包彈](fixture-control-assertion.md) | E8、K4 |
| 2026-09-01 | [假替身比真的寬鬆、間歇紅被當成負載和抖動，一道牆的收尾從第一天就沒生效](lenient-test-double-hid-day-one-bug.md) | E8、H1 |
| 2026-09-01 | [原話含個人狀況抄進公開倉庫](personal-details-not-public.md) | B5 |
| 2026-09-01 | [沒按信任的攔截鉤子一聲不吭跳過](untrusted-hook-silently-skipped.md) | B1 |
| 2026-09-02 | [代理在我的樹上突變被提交進去](agent-mutation-in-live-worktree.md) | D2、E10 |
| 2026-09-02 | [改了行為，舊句子連八輪變假話](behavior-change-stale-prose.md) | K5、K3、K4 |
| 2026-09-02 | [在主目錄施工提交落到別人分支](dont-work-in-main-worktree.md) | D2 |
| 2026-09-02 | [豁免清單連三輪中刀、工具整支撤下](exemption-list-is-attack-surface.md) | E7、F10 |
| 2026-09-02 | [考題餵自己假名字永遠綠](external-identifier-validity.md) | E8 |
| 2026-09-02 | [機器負載把計時考題弄紅](machine-load-breaks-timing-tests.md) | H1、H4 |
| 2026-09-02 | [用版本控制還原突變，沒提交的成果一起被洗掉](restore-by-checkout-wiped-edits.md) | E10 |
| 2026-09-03 | [跨變更試合併閘量到的是負載](cross-pr-gate-measures-load.md) | H1、H4 |
| 2026-09-03 | [編輯沒寫入、提交照跑](edit-failure-must-block-commit.md) | E10 |
| 2026-09-03 | [看輸出最後一行判乾淨，兩個錯誤被看成綠](lint-output-tail-misread.md) | E5 |
| 2026-09-03 | [並開變更上限定為兩支](max-two-open-prs.md) | C1 |
| 2026-09-03 | [同族第三刀改請審查者分類](same-family-third-strike-classify.md) | F10、F6 |
| 2026-09-04 | [行尾註解吞掉同行後面的程式](comment-swallowed-rest-of-line.md) | E10 |
| 2026-09-04 | [雲端檢查還沒綠就發射代合併](merge-launched-before-cloud-green.md) | E3 |
| 2026-09-04 | [提示詞裡的「之後會怎樣」被當成指令](next-step-read-as-instruction.md) | F3 |
| 2026-09-04 | [回報標籤三套字混用被抓](report-format.md) | J1、J2 |
| 2026-09-04 | [純考題變更也把別檔的劃界句弄成假話](stale-header-in-tests-only-change.md) | K5、K3 |
| 2026-09-04 | [正規式護欄同時假綠假紅](structural-guard-use-parser.md) | E8 |
| 2026-09-05 | [「紅了重跑一次」擴為常設](gate-rerun-once-standing.md) | H4 |
| 2026-09-05 | [突變沒改到東西，紅綠照樣算數](mutation-replaced-nothing.md) | E8、E10 |
| 2026-09-05 | [改說明的斷言失敗、上傳照跑](pr-body-edit-chain-did-not-stop.md) | E10 |
| 2026-09-05 | [重整時整檔換邊丟掉對方的考題](rebase-checkout-theirs-loses-hunks.md) | K4、E10 |
| 2026-09-06 | [問裁示者的固定形狀](ask-shape-three-options.md) | I1 |
| 2026-09-06 | [用日誌字樣當閘、語法錯被判綠](log-grep-gate-judged-syntax-error-green.md) | E5 |
| 2026-09-06 | [代理自報全綠約百分之四是誤報](night-audit-3-findings.md) | K4 |
| 2026-09-06 | [並行六條線共用暫存目錄，突變落到別條線的樹上](parallel-lanes-shared-scratch-collision.md) | D2 |
| 2026-09-06 | [待裁清單工具不是閘](pending-rulings-list-tool.md) | D1 |
| 2026-09-06 | [合併後驗收分級由腳本算、不是閘](post-merge-acceptance-tier-not-a-gate.md) | H6 |
| 2026-09-06 | [解析器連四輪被戳後劃界封頂](remote-url-parser-scope-cap.md) | F10 |
| 2026-09-06 | [審查附件改摘要加連結](review-attachment-summary-and-link.md) | J1 |
| 2026-09-06 | [版本往前走了閘照樣放行](stale-pass-on-moved-head.md) | F5 |
| 2026-09-07 | [檔頭一句絕對保證審了二十九輪](absolute-guarantee-invites-blockers.md) | F10、K3、K4 |
| 2026-09-07 | [共用夾具搬進子資料夾，守它的檢查靜靜失效](check-scope-lost-on-file-move.md) | K3 |
| 2026-09-07 | [夾具自己同時帶兩個變因](fixture-carries-two-variables.md) | E8 |
| 2026-09-07 | [考題邊界外推一格連九輪被繞](pin-widening-treadmill.md) | F10、K4 |
| 2026-09-07 | [改出來的審查提示漏改編號](review-prompt-derivation-slip.md) | F3 |
| 2026-09-07 | [判準收緊後真語料整則假紅](tighten-then-run-real-data.md) | E8 |
| 2026-09-08 | [用量不到的好處換來裁示](benefit-claims-to-decider.md) | I4、K4 |
| 2026-09-08 | [契約句沒跑過工具就寫進規則書](contract-sentence-must-be-run.md) | K4、E8、G1、I3 |
| 2026-09-08 | [想從散文抽出「現行規則是哪幾個字」，審了十一輪](extract-current-rule-from-prose.md) | F10 |
| 2026-09-08 | [搬走的規矩留樁保號，樁的後半還掛著一條活規矩](moved-rule-stub-hid-live-rule.md) | K1 |
| 2026-09-08 | [釘住一條規則的考題，條界說明連補十三輪](rule-item-pin-overclaimed-boundary.md) | K4、K3、F10 |
| 2026-09-08 | [判準簡化後，考題註解還在講已刪的機制](stale-comments-after-parser-simplified.md) | K5、K3 |
| 2026-09-08 | [撤回只限三種客觀理由，而且一定印出來](withdrawal-three-objective-reasons.md) | D1 |
| 2026-09-09 | [護欄的宣稱一直超出證據](guard-claims-vs-evidence.md) | K4、K3、F10 |
| 2026-09-09 | [寫提示詞的步驟被管線吃掉、審查空跑](heredoc-eaten-empty-prompt.md) | E10 |
| 2026-09-09 | [發射理由少了中間那一環，兩件事實被說成足以證明結論](launch-reason-skipped-measured-premise.md) | K4 |
| 2026-09-09 | [超過七輪要留公開自評](over-seven-rounds-public-self-review.md) | F9 |
| 2026-09-09 | [探針備份被掃進提交上了變更](probe-files-in-worktree.md) | E10 |
| 2026-09-09 | [把常態講成規矩被裁示者問住](quote-rules-verbatim.md) | J3 |
| 2026-09-09 | [掃描結果抄進考題註解時抄反了](scan-finding-transcribed-backwards.md) | K3、K4 |
| 2026-09-09 | [掃描紀錄從上一支抄過來](scan-record-copied-from-previous-change.md) | G3 |
| 2026-09-10 | [完成式保證自己就是新假話](completion-claim-is-new-falsehood.md) | K4、K5 |
| 2026-09-10 | [每一個更聰明的護欄都撐不到下一輪](every-smarter-guard-fell-next-round.md) | F10、K4 |
| 2026-09-10 | [同一句話連三輪被抓寬](narrowed-sentence-still-overclaims.md) | K4、F10 |
| 2026-09-10 | [時限機制落地四天就拿掉](no-deadline-wait-for-ruling.md) | I2、D1 |
| 2026-09-10 | [「沒有明文」與「這張表上沒有」是兩句話](no-explicit-rule-vs-not-on-this-table.md) | K4 |
| 2026-09-10 | [一次回好幾題就一題一則](one-ruling-per-question.md) | I3 |
| 2026-09-10 | [回報裡自造的工程詞裁示者看不懂](plain-language-explanations.md) | J2 |
| 2026-09-10 | [守門卡住與在跑長得一模一樣](pre-push-stuck-looks-like-running.md) | K4 |
| 2026-09-10 | [自己讀表格文法四輪被打穿](reimplementing-parser-stop-second-round.md) | F10、I4 |
| 2026-09-10 | [廢掉一條機制，舊出口在執行層還通著](retired-mechanism-old-exits-still-open.md) | K5 |
| 2026-09-10 | [磨超過七輪的自評由誰貼](self-eval-poster-is-the-grinder.md) | F9 |
| 2026-09-10 | [轉正式後檢查重跑，拿舊綠就發射合併](stale-green-after-promote.md) | H3、E3 |
| 2026-09-10 | [誰在磨誰拍板](whoever-is-grinding-decides.md) | A1、F6 |
| 2026-09-11 | [兩個「發射者」撞名](role-name-collision-scan-launcher.md) | A1、G4 |
| 2026-09-13 | [九個動作的形狀全是我自己想的，碰真平台第一分鐘就破](designed-shapes-never-touched-a-real-platform.md) | E5、H1 |
| 2026-09-19 | [驗收在新舊兩版印同一句，漏掉的那一步看不出來](acceptance-same-result-old-and-new.md) | H6、E8 |
| 2026-09-20 | [合併指令改由實作者自己跑](implementer-runs-merge-command.md) | A4、A2 |
| 2026-09-20 | [從裁示者分出一個只有人能坐的擁有者座位](owner-seat.md) | A1、A3、B1、B2、B3、B5 |
| 2026-09-21 | [刪掉「加一條先說砍哪一條」，改用進門五問](k2-drop-cut-one-first.md) | K2 |
| 2026-09-21 | [一次一支與最多兩支併成一條](one-thing-merge-c1-c2.md) | C1 |
| 2026-09-21 | [給裁示者的留言編號是憑印象編出來的](report-link-from-memory.md) | J4、J1 |
| 2026-09-22 | [考題掃不到，被寫成規矩不適用](test-reach-read-as-rule-reach.md) | J3、K4、E6 |
| 2026-09-23 | [對裁示者說的話要分開量到的與推論的](j4-facts-vs-inference-rule.md) | J4、I1、J3 |
| 2026-09-23 | [合併前不再回頭問裁示者](merge-without-asking-decider.md) | A5 |
| 2026-09-24 | [框框從強調定成本規則的關鍵詞，框了就查得到](brackets-mark-keywords.md) | J2 |
| 2026-09-24 | [要照抄的字句改用灰底框，不跟關鍵詞共用「」](grey-box-copy-verbatim.md) | F3、J1 |
| 2026-09-24 | [規則裡的「變更」全書改叫 PR](rename-change-to-pr.md) | K2、J2 |
| 2026-09-24 | [「審查」拆成自審與複審，規則裡寫清楚是哪一種](split-self-review-and-review.md) | A2、E9 |
| 2026-09-24 | [給裁示者的「誤擋 0」是推論不是量測](unmeasured-zero-given-to-decider.md) | J4 |
| 2026-09-25 | [回頭改的清單從三種補到六種](f6-six-kinds.md) | F6 |
| 2026-09-25 | [規矩寫清楚後撐破三千字，上限先放寬到四千](k2-limit-raised.md) | K2 |
| 2026-09-25 | [審查那一方改名叫複審者，名字跟著它做的事走](rename-reviewer.md) | A1、A2 |
| 2026-09-25 | [複審必驗清單改名、一格拆成兩格，並加「挑一句宣稱去跑」，九項變十二項](review-checklist-twelve-items.md) | F2 |
| 2026-09-25 | [掃描五步包成一支指令，舊裁示「丙」只改字面不改理由](scan-command-literal-ruling.md) | G2、G3 |
| 2026-09-25 | [兩方都起得了掃描時，預設由實作者起](scan-launcher-defaults-to-implementer.md) | A1 |
| 2026-09-25 | [連三輪自問表改版補「在防誰」，名字不帶題數](three-round-self-check-revised.md) | F10 |
| 2026-09-26 | [註解漂移稽核提了兩次，被問「有必要做嗎」後撤回](comment-drift-audit-dropped.md) | K3、K5、I4 |
| 2026-09-26 | [被問有沒有必要寫註解，量完只留三種](comments-only-three-kinds.md) | K3 |
| 2026-09-26 | [環境紅寫進合併規則：不是跳過閘的理由](environment-red-no-excuse.md) | H1 |
| 2026-09-26 | [J4 的對象從擁有者改成裁示者](j4-audience-decider.md) | J4 |
| 2026-09-26 | [K2 上限放寬到七千，數法搬去機器表](k2-seven-thousand-count-in-machines.md) | K2、K1 |
| 2026-09-26 | [轉正式留給起掃描的那一方，沒人起得了掃描時預設實作者](ready-for-review-by-scan-launcher.md) | G4 |
| 2026-09-30 | [回報不寫已經解決的問題](report-skip-resolved-problems.md) | J2 |
| 2026-10-02 | [複審用什麼模型、多強，只記在一方的對話裡，各輪各用各的](review-launch-settings-drift.md) | F11 |
| 2026-10-02 | [一支排版 PR 審了三輪、九個半小時：審多深、掃不掃改成照風險級別查表](review-scope-by-risk-tier.md) | D4、F2、G1 |
| 2026-10-03 | [拿到通過後順手再改，通過作廢、多審四輪](fix-after-pass-only-six-kinds.md) | F6、F2 |
| 2026-10-03 | [送審提示由實作者自己寫：限定範圍、不准跑整份考題、蓋掉清單](review-prompt-overrode-template.md) | F3、F1、F7 |
| 2026-10-03 | [擁有者的常設指示只有一方知道：43 則裡 22 則另一方讀不到或只讀到一部分](standing-instructions-only-one-side.md) | K6 |
| 2026-10-03 | [只改畫面文字的 PR：擁有者想改成只自審，定案成他自己當複審者](text-only-fast-lane.md) | F12 |
| 2026-10-05 | [進度摘要的規定只在一個專案：在套件做完的一支，共用的摘要裡沒有它自己的一則](progress-summary-one-project-only.md) | J5 |
| 2026-10-06 | [B4 寫明存著真實憑證的檔也列進清單、AI 可以在真實資料上唯讀驗證](real-credentials-listed-readonly-allowed.md) | B4 |

## 不是事故、但值得記的方法

\- 用算式重算對方回報的每一個數字：唯讀審查環境開不了瀏覽器時，拿倉庫裡的常數把實作者回報的數字重算一次；多個數字同時對上，支持回報與程式常數相符；這是算式對帳，不等於重新量測，也不能單獨證明對方執行過量測，還順便算出真正的門檻。這是正面示範、沒有事故，所以不進上面的索引。
