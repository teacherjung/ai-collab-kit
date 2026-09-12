# 防空包彈的對照組自己是空包彈

- 日期：2026-08-23
- 本文條號：E8
- 發生什麼：實作者為了防止考題變成空包彈（＝要守的行為被拿掉它也不會紅），特地加了對照組：先證明拿掉回饋字樣就能配對，再證明帶著字樣就配不到。結果對照組量的是別的變因——程式配對用的鑰匙是從帳單原文算出來的，不是題名寫的「同店」，兩列原文本來就不同，所以回饋本來就配不到任何東西。獨立審查者與實作者自己的多視角對抗預審都沒看到，合併後補跑的掃描器一掃就中，並用「把那段判斷整個拿掉、十二題照樣全綠」證明。
- 代價：考題從頭到尾沒在守它宣稱的事就合併了；屬假綠，回頭另開一支重寫。
- 教訓：對照實驗前先去程式裡確認變因是誰，兩組除那一個變因外逐字相同；驗收固定＝對要防的行為注入突變看它轉紅。
- 來源：PFW #507（2026-08-23）<https://github.com/teacherjung/personal-finance-webapp/pull/507> （變更說明「我為了防空包彈而加的對照組，自己是空包彈」段）
- 相關：[fixture-carries-two-variables](fixture-carries-two-variables.md)、[mutation-per-point](mutation-per-point.md)、[my-own-guards-lied](my-own-guards-lied.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
