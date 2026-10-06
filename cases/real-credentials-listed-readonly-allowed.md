# B4 寫明存著真實憑證的檔也列進清單、AI 可以在真實資料上唯讀驗證

- 日期：2026-10-06
- 本文條號：B4
- 發生什麼：把第一個使用專案的鐵則搬進套件時，對照出兩處。一、那個專案把券商的存取權杖、帳單密碼列為不進版本控制的敏感資料，套件 B4 卻只寫「真實資料」，「真實憑證」只出現在掃描盒那一條（G2）。二、B4 主句寫「不餵給 AI」，子點又寫「在真實資料上驗證只走唯讀」，讀起來打架；那個專案在這件事上比套件嚴（複審者絕不讀真實資料庫）。兩題各問一次擁有者，他回「同意」（明寫）與「允許」（AI 可以做唯讀驗證）。存著真實憑證的檔不在唯讀許可裡，是實作者的操作化（問的是真實資料，不是憑證）。
- 代價：沒有事故，這是兩則裁示。推論、沒量過：只照 B4 字面列清單的專案，可能漏列存著密碼與權杖的設定檔、環境檔；第一個使用專案的忽略清單就沒有擋環境檔（2026-10-05 量的，只查會不會被忽略，沒讀那個檔）。
- 教訓：規矩用的詞要涵蓋它真正要守的東西；主句與子點讀起來打架時，問一次，把例外寫明，不讓讀者自己猜哪一句算數。
- 來源：本套件 #43（2026-10-06）兩對留痕：明寫真實憑證 <https://github.com/teacherjung/ai-collab-kit/pull/43#issuecomment-6008424377>、<https://github.com/teacherjung/ai-collab-kit/pull/43#issuecomment-6008428437>；唯讀驗證 <https://github.com/teacherjung/ai-collab-kit/pull/43#issuecomment-6008424614>、<https://github.com/teacherjung/ai-collab-kit/pull/43#issuecomment-6008428663>；擁有者的原話在對話中，由實作者轉述
- 相關：[verify-mutations-on-real-data](verify-mutations-on-real-data.md)、[personal-details-not-public](personal-details-not-public.md)
