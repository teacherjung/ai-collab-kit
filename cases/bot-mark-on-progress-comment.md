# 進度留言帶了結論專用記號

- 日期：2026-08-12
- 本文條號：己4
- 發生什麼：實作者在變更上貼「返工完成」的進度通知，第一行照結論留言的長相寫、還帶了機器人記號；閘把任何帶那個記號的留言都當結論留言解析，標頭不合規＝非零退出碼，合併在第二道閘停下。救濟機制也救不了，因為它只救「標頭寫壞的真結論」；修法＝把自己留言的記號拿掉、內容不動。
- 代價：合併停在第二道閘一次。
- 教訓：機器標記是結論留言的專屬開頭，進度通知不帶它、也不用分欄的標頭長相。
- 來源：PFW #447（2026-08-12）https://github.com/teacherjung/personal-finance-webapp/pull/447#issuecomment-5261216915
- 相關：[review-verdict-strings](review-verdict-strings.md)、[bot-signature-in-pr-comment](bot-signature-in-pr-comment.md)
