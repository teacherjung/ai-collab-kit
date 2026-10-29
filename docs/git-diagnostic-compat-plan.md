# Git 診斷相容性修補計畫

## 授權與範圍

本人在理財優化工作線同意 Codex 承接必要套件修補；診斷修補技術依據為理財 #747 的 Sol 裁示 https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6446575016 。本支由 Codex 實作；2026-10-29 本人明確准僅本支改由未參與實作的 GPT-6.1 Sol／xhigh 正式複審，原話 https://github.com/teacherjung/ai-collab-kit/pull/129#issuecomment-6487957761 。掃描依本人指示暫停，理財 #747 仍用 Grok。

診斷範圍只調整 `tests/run-checks.test.js` 對損壞 Git 指標及 HEAD 夾具的診斷相容前提。正式 Git 失敗、執行器拒收、原診斷逐字保留與不提供還原指令均維持。不得改巢狀整卷成功斷言、工具退出碼、CI 必過設定或降級 Git。

本次改派的最小前置依 https://github.com/teacherjung/personal-finance-webapp/pull/747#issuecomment-6488044803 ：只承接固定 #128 的 Sol 參與者／複審者登記、由既有產生器重建 `PROJECT-SETTINGS.md`，並精準移植 `kit-only/settings-pin.test.js` 的 Sol 釘值與收件行為題；不搬啟動器或其他 Grok 測試。不改全域分工、原 Codex 模型、掃描、DLP、規矩或任何閘。原 Grok 場次隱私拒收，沒有有效正式結論；保留全部原件，不讀遭拒內容、不重試或追認為通過。

## 驗證

- 以適用 Git 版本重現舊前提失敗，再確認修正後通過；記錄實際執行版本，不以模擬版本冒充。
- 分別核對不存在的 gitdir 指標及 HEAD 亂碼；保留其他損壞設定情境。
- 有效突變驗證錯誤放行、漏印或改寫診斷、亂給還原指令會被行為斷言攔下。
- Sol 登記先留未登記的有效紅題，再驗精確命令、角色分工、錯來源／版本／小標拒收與不同身分歷史阻擋；記憶體突變須命中目標與預定斷言。深比較除 Sol 列外所有設定未改，設定產物必須與來源一致。
- 完整套件檢查及新固定版 CI 通過後，走官方 Sol 備審；另核實際原生命令、模型、推理、終態、完整結論與乾淨雙樹，獨立對帳及正式全閘合併。不以設定或技術裁示當正式審查證據。

## 不碰的工作

不改套件 #128 工作樹的啟動器、考題、清單及說明，不碰其原內容；不在理財直接修改共用考題。Sol 登記涉及同檔交疊，D3 讓路 https://github.com/teacherjung/ai-collab-kit/pull/128#issuecomment-6488056377 ：先暫關 #128、保留分支與全部證據，由本線 Codex 在 #129 合併後重開，承接新主幹並重驗、重審及走全部關卡。附加獨立 Codex 接線另續，不夾本支、不冒稱歷史阻擋解除。套件完成後再官方整批同步；必要時由 Codex 暫關理財 #747 保留分支及證據，同步完成後負責恢復。
