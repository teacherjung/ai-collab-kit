# 兩方都起得了掃描時，預設由實作者起

- 日期：2026-09-25
- 本文條號：A1
- 發生什麼：掃描發射者 9/11 定成「起得了掃描器的那一方」，現況登記在專案設定；套件 A1 寫兩方都行時「由專案設定定誰」，理財網頁的設定那一格則寫當時只有一方起得了、平手規則刻意不預寫，「出現兩方都起得了時要補一條——由誰定沒有寫明」。裁示者 9/25 問「掃描發射者為什麼一定要登記？不能都由實作者發射嗎？」；實作者回：不是每個 AI 都起得了掃描者，理財網頁那邊有一個 AI 自己跑在一層沙箱裡、實測套不上掃描者要的第二層，它實作的 PR 只能由另一方起；給三選一：維持登記、加預設「兩方都起得了＝實作者」（建議）／一律實作者發射／維持只登記，並把「一律實作者在理財網頁現況做不到」標成推論。裁示者回「6. a＝維持登記，加預設」。
- 代價：沒有事故；截至 PFW #645 理財網頁仍只有一方起得了，那一格還用不到；缺的是以後：真遇到兩方都起得了時，得先停下來補一條規則，而由誰定沒有寫明；反過來若改成一律實作者發射，理財網頁由那個 AI 實作的 PR 就起不了掃描（實作者當時標為推論）。
- 教訓：「誰來做」先看誰做得到：做得到的一方登記在設定裡，兩方都做得到時給一個跟著這支 PR 走的預設，不留「到時再補」的空格。
- 來源：私人紀錄（2026-09-25，無公開原文）；本套件 #19（2026-09-28）<https://github.com/teacherjung/ai-collab-kit/pull/19> 與 PFW #645（2026-09-29）<https://github.com/teacherjung/personal-finance-webapp/pull/645> 只證明後續落地（A1 補上這個預設、設定那一格改寫成實作者），不是當日原話
- 相關：[role-name-collision-scan-launcher](role-name-collision-scan-launcher.md)、[ready-for-review-by-scan-launcher](ready-for-review-by-scan-launcher.md)、[self-eval-poster-is-the-grinder](self-eval-poster-is-the-grinder.md)、[rename-reviewer](rename-reviewer.md)
