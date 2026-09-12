# 同一句話連三輪被抓寬

- 日期：2026-09-10
- 本文條號：K4、F10
- 發生什麼：規則書裡一句描述某支檢查行為的話（「這一格沒有解析器、填什麼都收」）被審查者抓到超出證據——整則留言只要出現機器人記號（＝留言裡標明這則是機器產生的那個符號）就會被壞標頭偵測咬住；實作者改成「整則只要出現就會咬住」，下一輪又被抓（它會先剝掉程式碼區塊、引用與行內程式碼記號——那些是純文字排版裡用來把一段字標成程式碼的符號）；再改成「包進反引號（＝鍵盤左上角那個往左斜的小撇，成對用來框住一段程式碼）或引用則不會」，第三輪又被抓（那個剝除是逐行的簡化比對、不是完整的 Markdown（＝用純文字符號排版的寫法）解析，雙反引號內含反引號之類仍咬得住）。三輪都是低嚴重度、每輪都通過，但同一句連中三次。
- 代價：同一句話三輪各收窄一次，每次新寫的句子又成了下一輪的發現。
- 教訓：收窄一句話時，新句要用同一把尺再驗一次；描述某支程式的行為前先讀它的實作（那支剝除函式自己就寫著「不做完整 Markdown」）。
- 來源：PFW #593（2026-09-10）<https://github.com/teacherjung/personal-finance-webapp/pull/593#issuecomment-5613833545>
- 相關：[guard-claims-vs-evidence](guard-claims-vs-evidence.md)、[pin-widening-treadmill](pin-widening-treadmill.md)、[behavior-change-stale-prose](behavior-change-stale-prose.md)
