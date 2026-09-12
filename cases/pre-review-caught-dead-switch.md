# 送審前預審抓到功能整個是死的

- 日期：2026-08-14
- 本文條號：戊9
- 發生什麼：實作者第一次在送獨立審查前，用四個互不重疊的視角各審一遍自己的變更，每條發現再派專門反駁它的視角去打：二十條發現被打掉十三條（含兩條被誇大成阻擋級的既有問題），留下七條，其中一條是那支變更最壞的結果本身——新加的開關根本存不起來。實作者自己跑一行才確認那條是真的；第一版彙整程式還把存活的發現全過濾掉、印出「零條」。
- 代價：在正式送審前抓到並修正開關存不起來；節省的輪數未量測。
- 教訓：送審前先多視角預審加逐條反駁，反駁者不確定就判不成立；預審抓到的每一條要自己再驗才動手，連彙整程式也要驗。
- 來源：PFW #455（2026-08-14）https://github.com/teacherjung/personal-finance-webapp/pull/455/commits/91d666e915a6dec7cf08c874fff4ac061261da77
- 相關：[my-own-guards-lied](my-own-guards-lied.md)、[claims-must-be-earned](claims-must-be-earned.md)、[population-filter-uniqueness-trap](population-filter-uniqueness-trap.md)
