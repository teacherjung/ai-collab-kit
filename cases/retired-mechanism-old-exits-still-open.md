# 廢掉一條機制，舊出口在執行層還通著

- 日期：2026-09-10
- 本文條號：K5
- 發生什麼：裁示者裁掉「問他問題要附時限、時限到就照建議先做」整套，實作者改規則文字，五輪審查抓的全是「話有沒有說滿」。轉正式前掃描器抓到舊路沒封上：「待裁未結就不合併」沒了出口而「審查通過就可以合」還在（以前靠逾時接起來）、解析器（＝專門讀懂某種格式的程式）沒在驗日期（今天貼一則舊格式的暫定紀錄照樣收）、工具檔頭與審查提示還用現在式教舊制。9 條裡 8 條屬實回頭改。
- 代價：掃描 9 條、8 條屬實回頭改，再拿一張通過才轉正式。
- 教訓：廢一條機制時除了掃講它的句子，還要掃三處：還在讀它的解析器、印給人看的字、它原本接起來的兩條規則各自往哪去——接縫最容易漏，因為它不在任何一句被刪的話裡。
- 來源：PFW #595（2026-09-10）https://github.com/teacherjung/personal-finance-webapp/pull/595 掃到的九條逐條記在該支變更說明的複審後掃描段。
- 相關：[behavior-change-stale-prose](behavior-change-stale-prose.md)、[no-deadline-wait-for-ruling](no-deadline-wait-for-ruling.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
