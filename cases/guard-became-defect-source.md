# 護欄自己成了最大缺陷來源，拆掉才第一次通過

- 日期：2026-08-06
- 本文條號：F10
- 發生什麼：一支邊界考題的變更，實作者為了守「畫面不被事後改掉」先用自己捏的假網頁、再列白名單、再包一層攔在中間的替身物件（每次存取都先經過它），每一輪被繞過就再補一層；到第 18 輪，七項發現裡四項是這個替身自己造成的誤殺。第 19 輪拆掉它、改成誠實劃界，第 21 輪才第一次通過。
- 代價：21 輪才第一次通過（本則只計到首次通過；之後還有幾輪、最後改由替代變更延續），其中九輪在補被繞過的入口（假網頁五輪、白名單四輪）。
- 教訓：同一族連三輪中刀就停下來問「這個方向對不對」；護欄擋掉的洞比它自己製造的誤殺少就該拆，不是再補一層。
- 來源：PFW #413（2026-08-06）<https://github.com/teacherjung/personal-finance-webapp/pull/413#issuecomment-5207433125>
- 相關：[my-own-guards-lied](my-own-guards-lied.md)、[review-round-budget](review-round-budget.md)、[tripwire-vs-safety-gate](tripwire-vs-safety-gate.md)、[guard-claims-vs-evidence](guard-claims-vs-evidence.md)
