# 判不出算不算架構，一律當作算

- 日期：2026-08-14
- 本文條號：F8
- 發生什麼：「動到架構要問」的判準用列舉寫（模組邊界、資料流向、欄位歸屬），第四、五輪各被舉出落在列舉之外的反例（刪除縮減、單行程改多行程＝把原本一個程式做完的事拆成多個同時跑的程式），審查者喊「同族第三輪，停下來裁範圍」；實作者沒有自行補措辭，升給裁示者。裁示者第二次裁定加上兜底：判不出來屬不屬於架構，一律當作「算」。
- 代價：兩輪審查耗在補列舉，補到第三個反例才承認補不完。
- 教訓：列舉補不完的判準要有兜底條款，判不出來就落在「要問」那一邊——寧可多問不可漏問。
- 來源：PFW #457（2026-08-14）<https://github.com/teacherjung/personal-finance-webapp/pull/457#issuecomment-5294521561>
- 相關：[standing-review-authorization](standing-review-authorization.md)、[review-round-budget](review-round-budget.md)、[tripwire-vs-safety-gate](tripwire-vs-safety-gate.md)
