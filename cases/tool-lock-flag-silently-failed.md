# 鎖工具旗標五十三次掃描五十二次靜默失效

- 日期：2026-08-22
- 本文條號：庚2
- 發生什麼：掃描器靠「請它不要跑指令」的鎖工具旗標當圍欄（＝擋住它亂跑的那道界線）；全量稽核五十三次掃描，五十二次留有工具足跡（＝它動用過工具的痕跡）＝旗標靜默失效，掃描器進過主目錄讀原始碼、列過家目錄的資料夾名、連過外網，只是沒碰到機密。裁示者裁定改做作業系統層沙箱（＝由作業系統擋住，只准看掃描目錄、不准連網），先用金絲雀（＝在盒子外放假機密，證明掃描器讀不到）證明沙箱有效才恢復掃描，驗證通過前暫停。
- 代價：圍欄整段期間都是宣稱不是保證——沒碰到機密是它自己沒去、不是被擋；掃描暫停到沙箱那支次日合併。
- 教訓：「請它不要做」不是隔離；隔離要由作業系統擋，而且要先用假機密實測擋得住，前置檢查沒過就當沒掃。
- 來源：PFW #500（2026-08-22）https://github.com/teacherjung/personal-finance-webapp/pull/500 —— 五十三次掃描／五十二次留有工具足跡的稽核表、當日裁示與沙箱修法都寫在這支的變更說明裡；日期取裁示日，這支本身 2026-08-23 才合併。
- 相關：[scan-ledger-lied-move-scan-after-pass](scan-ledger-lied-move-scan-after-pass.md)、[shared-state-flaky-across-sessions](shared-state-flaky-across-sessions.md)、[silent-pass-is-worst](silent-pass-is-worst.md)
