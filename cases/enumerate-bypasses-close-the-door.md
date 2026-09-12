# 列舉繞法三輪補不完，關門才收

- 日期：2026-08-02
- 本文條號：己10
- 發生什麼：試算表套件的引入護欄連三輪都在列舉寫法：第一輪列字串寫法漏掉五種、第二輪改列語法形狀漏掉六種、第三輪改列名字又漏掉五種，每輪換的只是列舉的對象。第三輪之後才改成把那個模組整個禁掉——正式程式對它零使用，關掉成本是零，門就關了；考題從二十一種擴到二十六種，下一輪通過。
- 代價：三輪審查燒在補洞，每補一種下一輪又冒一種。
- 教訓：同一道護欄連三輪被同類寫法漏過，就停下來換做法——關門（整個禁掉、只認一種寫法）比補洞便宜。
- 來源：PFW #374（2026-08-02）https://github.com/teacherjung/personal-finance-webapp/pull/374#issuecomment-5155738018
- 相關：[assert-behavior-not-text](assert-behavior-not-text.md)、[collab-invariant](collab-invariant.md)、[tripwire-vs-safety-gate](tripwire-vs-safety-gate.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)、[extract-current-rule-from-prose](extract-current-rule-from-prose.md)
