# 夾具少一個欄位，要測的那一行根本沒被走到

- 日期：2026-08-05
- 本文條號：戊8
- 發生什麼：一條退款配對考題的夾具（＝考題自己捏的假資料）少寫了一個欄位，配對用的鑰匙因此是空的，程式在跑到要測的日期比較之前就走了別條路。那條考題照樣綠，但它要守的那一行從頭到尾沒有被執行到。
- 代價：一條掛在那裡卻什麼都沒測到的考題，要補正向情境重寫。
- 教訓：先寫一條「正向情境真的會成功」的斷言，證明假資料走得到要測的那一行，再去測要守的條件。
- 來源：私人紀錄（2026-08-05，無公開原文）
- 相關：[fixture-control-assertion](fixture-control-assertion.md)、[fixture-carries-two-variables](fixture-carries-two-variables.md)、[mutation-per-point](mutation-per-point.md)、[my-own-guards-lied](my-own-guards-lied.md)
