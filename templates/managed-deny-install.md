# 受管設定層的裝法（禁區攔截器的最外一層，B1）

**這一層買到的是「沒有管理員密碼就刪不掉那幾行」，不是把前面那幾道放鬆的理由。** 專案層那幾行本來就沒有任何下層蓋得掉（文件：「If a tool is denied at any level, no other level can allow it.」），所以它不是為了「蓋過誰」而存在；它防的是**那個檔被改掉、被誤刪、被某個 AI 改弱**。裝了它之後，前面那幾道一行都不要拿掉——雲端對話讀不到裝置上的檔（見「守不到的」①），拿掉就真的少一層；使用專案如果有一題釘住清單裡那幾行（建議要有），拿掉還會當場紅（**套件這邊沒有那一題**，套件不知道你的清單長什麼樣）。

一句話說它是什麼：macOS 上有一個只有管理員寫得動的設定檔，把專案禁區清單裡**那幾個完整的外接工具名**再抄一份進去。只有這一件事——不放鉤子、不放別的鍵。

適用範圍：Claude Code、macOS。別的作業系統受管檔的位置不同（自己查官方文件），別的 AI 沒有這一層。

---

## 這份範本的取捨（照抄之前先看）

1. **名字不讓人打字。** 下面那一行從**已經合併進主幹的版本**讀專案自己的清單（`git show <參照>:<清單檔>`），不讀當下工作樹——工作樹可能停在別的分支或改到一半。這件事不是潔癖：平台對拒絕規則的名字**打錯不會有任何警告**（文件：「A deny or ask rule whose tool name matches no known tool produces a startup warning to catch typos. Tool names containing `_` or `*` are exempt from the check.」），而所有 `mcp__` 開頭的名字都含 `_`＝全部豁免。打錯就是靜靜不擋。

2. **形狀檢查刻意分成兩半。**
   - **任何專案都成立的那一半寫死在指令裡**：每一項都要是完整的外接工具名（`mcp__<伺服器登記名>__<工具名>`），不可以有括號、空白、引號或 `*`。括號那條是文件寫的平台行為——「When Claude Code loads a settings file, it skips any `mcp__` rule that has parentheses.」＝帶括號的規則整條被跳過，放進去等於沒放，而且沒有訊息。`*` 擋掉是本範本的決定：這一行只搬逐字的完整名字，樣式規則要不要進受管層是另一個決定，不在這裡順手做。
   - **只有你的專案知道的那一半做成必填的 `SHAPE`**（例如「這幾支一定是下單那一族」），**沒填就停手**。
   - 為什麼不做成選填：選填＝多數人不會填，而漏填的那一次**沒有任何訊號**，畫面跟填了一模一樣。這是本專案記過的「靜靜通過最危險」。
   - 為什麼不乾脆拿掉這兩道：它們擋的是「來源那份清單哪天被改成別的東西」「伺服器登記名變形」。拿掉之後這一行就只剩「照抄當下的樣子」，而照抄錯了沒有人會知道。
   - ⚠️ **`SHAPE` 填成 `.` 或 `.*` 等於沒檢查**，而且畫面跟有檢查一模一樣。指令裡因此放了一個**假名字負對照**：兩個隨便編的名字都通過就停手。誠實劃界——它只擋得住「寬到連隨便的名字都收」的寫法，**擋不住寬度剛好錯的寫法**。

3. **清單裡有不是 `mcp__` 開頭的規則時，這一行會停手**（例如帶括號的、或內建工具的規則），不會靜靜產出一份不生效的檔。那種專案要自己想別的搬法，不要把這一行改鬆。

4. **量到的是什麼**：下面那兩段指令，套件這邊 2026-09-21 用一個假的來源倉庫跑過**除了 `sudo` 以外的每一段**（把目的地換成暫存路徑）——產得出下面那份 JSON、印得出來源版本、寫出來的權限是 `-rw-r--r--`、目的地已經有檔時走「停手、不覆蓋」那條路、`SHAPE` 空著與填 `.*` 時都停手、清單混進一條帶括號的規則時停手。**沒有跑過的**：任何真的動到 `/Library` 的那一步（`sudo mkdir`／`sudo install`／`sudo rm`），那是裁示者自己在自己的機器上貼。平台讀不讀得到這個檔、那幾行有沒有真的在生效，這裡一律量不到——那是「驗收」那一節的事。

---

## 1. 這個檔長什麼樣

路徑（macOS）：`/Library/Application Support/ClaudeCode/managed-settings.json`

```json
{
  "permissions": {
    "deny": [
      "mcp__<伺服器登記名>__<工具名>",
      "mcp__<伺服器登記名>__<另一支工具名>"
    ]
  }
}
```

那幾個名字**不要自己打**，由下一節那一行從專案清單抄過來。就這樣，**最外層只准有 `permissions` 一個鍵**：

- 不要抄官方範例的 `allowManagedPermissionRulesOnly`（文件：它會讓 Claude Code 忽略使用者、專案、本機與命令列給的權限規則——等於把你自己的清單關掉）。
- 不要放 `allowManagedHooksOnly`（文件：它會讓專案那組鉤子不再跑，而且**填了不合法的值時「Treated as `true` until fixed」**＝往更嚴的方向壞，直接把真正在擋的那道攔截器關掉）。
- 不要放 `env`（`tools/claude-pin.js` 的絆線明說看不到這一層；而平台設定裡的 `env` 會不會傳進鉤子的環境**沒量過**，套件一律當成會——鉤子的環境被塞一個變數，那一行就可能整行放行）。
- 不要放鉤子。
- **不要放驗收用的那顆測試鈕的名字**（[canary-install.md](canary-install.md)）：理由跟平台層同一條——光名字的拒絕會把那顆鈕從 AI 看得到的清單上整個拿掉，放進去就沒有鈕可以按；而且進了這一層要管理員密碼才拿得掉。
- **不要建 `managed-settings.d/` 目錄**：文件寫同一層還會讀它並合併，建了就多一個「下層蓋不回來」的落點。只建那一個檔。

---

## 2. 交給裁示者貼的那一行

先填上面五格（`REPO`、`REF`、`SRC`、`EXPECT`、`SHAPE`），**整段一次貼進終端機，按一次 Enter**。中途會問電腦密碼。

```bash
REPO="<專案根目錄的絕對路徑>"; REF="<已合併版本的參照，例如 origin/main>"; SRC="<清單檔在倉庫裡的相對路徑，例如 .claude/settings.json>"; EXPECT="<清單上剛好有幾支>"; SHAPE="<只有你的專案知道的名字形狀，例如 ^mcp__[A-Za-z0-9.-]+__(create|delete)_widget$>"; DEST="/Library/Application Support/ClaudeCode/managed-settings.json"; TMP="$(mktemp -t managed-settings)" && node -e '
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const [repo, out, ref, src, expect, shape] = process.argv.slice(1);
const stop = (m) => { throw new Error(m); };
if (!shape) stop("SHAPE 是空的＝沒有形狀檢查，停手（空著跟填了畫面一樣，所以不給選填）");
const re = new RegExp(shape, "u");
if (re.test("mcp__zz__anything_at_all") && re.test("mcp__yy__something_else")) stop("SHAPE 太寬，停手：兩個隨便編的名字都通過了");
const want = Number(expect);
if (!Number.isInteger(want) || want < 1) stop("EXPECT 不是正整數，停手：" + expect);
const git = (a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" });
const deny = JSON.parse(git(["show", ref + ":" + src])).permissions.deny;
if (!Array.isArray(deny)) stop("來源那一格不是清單，停手");
if (deny.length !== want) stop("來源不是剛好 " + want + " 支，停手：" + JSON.stringify(deny));
for (const n of deny) {
  if (typeof n !== "string" || !/^mcp__[^\s()"*]+__[^\s()"*]+$/u.test(n)) stop("不是完整的外接工具名（帶括號的規則平台會整條跳過），停手：" + JSON.stringify(n));
  if (!re.test(n)) stop("名字形狀不合 SHAPE，停手：" + n);
}
const text = JSON.stringify({ permissions: { deny } }, null, 2) + "\n";
JSON.parse(text);
fs.writeFileSync(out, text);
process.stderr.write("來源版本 " + ref + " " + git(["rev-parse", ref]).trim() + "\n");
process.stdout.write(text);
' "$REPO" "$TMP" "$REF" "$SRC" "$EXPECT" "$SHAPE" && { if [ -e "$DEST" ]; then echo "停手：這個檔已經在了，這一行不覆蓋。現有內容是："; cat "$DEST" 2>/dev/null || echo "（讀不到內容，要用 sudo cat 看）"; else echo "上面是要寫進去的內容；接下來會問你電腦密碼。"; sudo mkdir -p "/Library/Application Support/ClaudeCode" && sudo install -m 644 -o root -g wheel "$TMP" "$DEST" && echo "寫好了：$DEST" && cat "$DEST"; fi; rm -f "$TMP"; }
```

每一段在幹嘛（要改它的人先看懂這幾條）：

- **先產生、再檢查、才安裝**：內容用 `JSON.stringify` 產、再 `JSON.parse` 驗一次。這個檔不是合法 JSON ＝ **這台機器的 Claude Code 整個起不來**（文件：refuses to start），所以絕不能讓手打的字進去。
- **不覆蓋**：目的地已經有檔就印出現有內容並停手。要換內容＝先看過、自己刪掉、再跑一次（刪法見第 5 節）。
- **權限寫死 644、擁有者 root**：文件寫這個檔或它的目錄**讀不到**、而且沒有別的管理來源時，用 claude.ai 帳號登入的對話會**啟動就結束**。所以永遠不要用「改權限」的方式停用它。
- **路徑有中文或空白也沒關係**，每一格都加了引號。⚠️ 專案資料夾改名或搬家之後，`REPO` 要跟著改；受管檔本身不含路徑，只有重跑這一行時會受影響（改名後跑會直接失敗，不會靜靜產錯）。
- ⚠️ **退出碼不要拿來當判斷**：前面那幾種停手退 1，但「這個檔已經在了」那一條印完就結束、退的是 **0**（量到的）。這一行是給人看畫面用的，不要包進腳本拿退出碼判成功失敗。另外，停手的那幾種會在系統暫存目錄留下一個空的暫存檔（無害，系統自己會清）。

---

## 3. 驗收

**鐵則先寫**：整個驗收**不准叫任何禁區連接器上的工具**，包括唯讀查詢，包括清單上那幾支本身。唯一准按的是測試鈕（[canary-install.md](canary-install.md)）。

⚠️ 開始之前先確認**你手上有幾個客戶端、各是什麼版本**（`claude --version`；桌面版的引擎版本跟終端機那支可能不同，兩個都是真的）。兩件跟版本有關的事：`/status` 的 `Skipped sources` 那一行要比較新的版本才有；舊一點的版本 `/permissions` 會排到該回合結束才跑，所以要單獨打、不要夾在工作中間。**驗收一律在裁示者平常按測試鈕的那個客戶端做**，另一個只當次要。

### 裝好當下（照順序，五步）

| 步 | 做什麼 | 證明到 | 證明不到 |
|---|---|---|---|
| 0（裝之前） | 在新對話打 `/status`，把設定來源那一行抄下來 | before 基準（現在沒有受管來源），順便看到這個客戶端的版本 | 什麼都不擋、跟這一層無關 |
| 1 | 貼第 2 節那一行、輸密碼 | 檔寫進去了、內容逐字＝清單裡那幾行 | 平台有沒有讀它 |
| 2 | **關掉所有 Claude 對話（每一個客戶端都要），重開一個新的** | — | — |
| 3 | `/status`：要看到**剛好** `Enterprise managed settings (file)` | 受管來源被找到、被選中，而且它至少帶一個政策鍵 | **不證明那幾行在擋**，也不證明它們沒被當成無效丟掉。括號是 `(file + drop-ins)`／`(drop-ins)` ＝有人放了 drop-in；`(plist)`／`(remote)` ＝別的來源被選中、你的被跳過（新一點的版本另有 `Skipped sources` 一行）——這三種都停手回報 |
| 4 | `/permissions`：那幾行逐字在「目前生效」的規則表上，來源掛在受管那一格（文件：這個面板會列出每一條規則**以及它來自哪一個設定檔**） | 那幾行通過了平台的檢查、沒被當成無效丟掉、進了解析後的生效清單、來源就是這個檔 | **不證明名字沒打錯**（含 `_` 的名字豁免啟動警告，`claude doctor` 也不會說話）；不證明那幾支真工具被擋——不可以叫來試 |
| 5 | 按一次測試鈕，要看到攔截器那一組的拒絕理由（含「在拒絕清單上」） | **加了這一層沒有把攔截器弄死**（例如沒有誤加 `allowManagedHooksOnly`）；鉤子＋固定複本＋清單那條路仍然健康 | 受管層在不在。看到測試鈕正常回話＝停手回報；看到「指紋對不上」＝那台機器的複本問題，跟這一層無關 |

第 4 步要逐字比兩串很長的名字，很吃眼睛。**把人從字串裡拿掉**：叫 AI 跑這個唯讀指令（不用密碼），它自己去比。

```bash
REPO="<專案根目錄的絕對路徑>"; REF="<例如 origin/main>"; SRC="<例如 .claude/settings.json>"; node -e '
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const [repo, ref, src] = process.argv.slice(1);
const dest = "/Library/Application Support/ClaudeCode/managed-settings.json";
let text;
try { text = fs.readFileSync(dest, "utf8"); } catch (e) { console.log("受管檔讀不到（" + ((e && e.code) || "不明") + "）：這一層現在不在這台機器上"); process.exit(1); }
const doc = JSON.parse(text);
const repoDeny = JSON.parse(execFileSync("git", ["-C", repo, "show", ref + ":" + src], { encoding: "utf8" })).permissions.deny;
const managedDeny = doc.permissions && doc.permissions.deny;
console.log("最外層的鍵：" + JSON.stringify(Object.keys(doc)) + "（只准 permissions 這一個）");
console.log(JSON.stringify(managedDeny) === JSON.stringify(repoDeny) ? "那幾行跟清單逐字相同" : "不一樣\n  受管：" + JSON.stringify(managedDeny) + "\n  清單：" + JSON.stringify(repoDeny));
' "$REPO" "$REF" "$SRC"
```

⚠️ 它比的是**檔案內容**，不是**平台解析後生效的清單**——所以它取代不了第 4 步，兩個都要。
⚠️ 它的退出碼只分得出「檔讀不到」（退 1）；**內容不一樣照樣退 0**（量到的）。要看的是印出來那兩行字，不是退出碼。

### 以後怎麼知道它還在（每次平台改版、每次重連那個連接器、每隔一段時間）

四下，全部免密碼：

1. `/status` → 括號還是 `(file)`。
2. `/permissions` → 那幾行還在、來源還是受管。
3. 測試鈕 → 看到攔截器那一組的拒絕理由（不是正常回話、不是「指紋對不上」）。
4. 上面那個唯讀核對指令 → 「逐字相同」＋「最外層只有 permissions」。

另外一個免費的**警報**（注意：是警報，不是證據）：問 AI「那個連接器你現在看得到哪些工具」。清單上那幾支名字**重新出現**＝拒絕清單已經對不上了（多半是連接器換了登記名），立刻停手回報。
⚠️ 反過來不成立：**「看不到」證明不了是誰擋的**——連接器自己的逐支停用開關、專案層、受管層，三種畫面一模一樣。所以它只當「重新出現＝出事」的訊號，永遠不要寫成「受管層驗證成功」。

---

## 4. 守不到的

1. **雲端對話**：文件逐字「a session in an Anthropic-hosted environment doesn't read a device's MDM profile or file」。雲端那邊還是靠倉庫裡的那幾道。
2. **另一台機器**：沒有這個檔＝少這一層。每一台要各自貼一次、各自輸密碼。所以**「哪一台裝了、什麼時候裝的」一定要記在使用專案**（套件這邊不記；套件不知道你有幾台），不然只會有人以為全都有。
3. **名字改了它就靜靜失效**：連接器重連、換帳號換了登記名，或工具被改名，受管層那幾行從此比不到任何東西，**沒有任何訊息**（含 `_` 的名字豁免啟動警告）。那時還在擋的是攔截器的家族網（它只認工具名、不認登記名），而家族網詞表沒有的字兩層都漏。**這一層釘住的是「那幾行字」，不是「不准做那件事」。**
4. **兩份漂開**：專案清單收緊了、受管層沒跟（或反過來），**沒有任何閘、考題或驗收步驟在看**。測試鈕量的是攔截器、刻意不經過平台層，所以按測試鈕也驗不到這件事。只有第 3 節那個唯讀核對指令看得到，而跑不跑是人決定的。
5. **它不是鎖**：文件寫本機管理員可以自己改受管來源，而這台的管理員多半就是裁示者本人；檔案一變，正在跑的對話會重新讀進去（不必重開）——所以「驗過了」不代表現在還是那樣。它擋的是誤觸與冒名，不是擋有管理員權限的人。
6. **只證明那一刻**：平台改版之後沒有任何例行動作重量它。第 3 節下半段那四下就是為此而寫的。
7. **套件自己的絆線看不到這一層**：`tools/claude-pin.js` 的註解已經寫明「平台的其他設定層（使用者層、受管設定層）與別的送貨管道這裡看不到」。所以這個檔在不在、內容對不對、跟清單有沒有漂開，**沒有任何考題、沒有任何合併閘看得到**——考題刻意不讀真的家目錄與系統目錄，受管檔又只在某一台機器上。**只有人照第 3 節看得到。**

---

## 5. 哪天要拿掉

唯一正確的做法是**刪檔**（或把內容寫成 `{}`；文件寫空檔算 `{}`、檔不在也不算錯）：

```bash
sudo rm "/Library/Application Support/ClaudeCode/managed-settings.json"
```

- 一樣要輸密碼，一樣由裁示者自己貼。
- **絕對不要改它的權限來「停用」**：文件寫這個檔或目錄讀不到、又沒有別的管理來源時，用 claude.ai 帳號登入的對話會**啟動就結束**。
- 拿掉之後：重開對話，`/status` 裡 `Enterprise managed settings` 那一行會消失；按一次測試鈕確認攔截器還在。
- **這一節跟第 2 節刻意寫在同一張紙上**——真的出事的時候，沒有人會有空去別處找怎麼救。

---

## 附：給裁示者的三句話

1. **這個檔只准有那幾支工具的拒絕清單，多一個鍵都不要加**——尤其是鉤子、`env`、和「只認公司的鉤子／只認公司的權限規則」那兩個開關（它們會把真正在擋的那道攔截器關掉，其中一個填錯值還會被當成「開」）；測試鈕的名字也永遠不進這個檔，進去之後那顆鈕會整個從清單上消失、再也按不到。
2. **它釘住的是「那幾行字」，不是「不准做那件事」**：連接器重連、工具改名、換一台電腦、雲端對話，它就靜靜地不再蓋到、不會有任何訊息。它買到的是「沒有你的密碼就刪不掉那幾行」——**是最外面那條皮帶，不是把前面幾道放鬆的理由**。
3. **裝好的證據是三樣一起看**：新開對話 `/status` 要剛好看到 `Enterprise managed settings (file)`、`/permissions` 裡那幾行在而且來源是受管、再按一次測試鈕要看到攔截器那一組的拒絕理由。這個檔只要變成不合法的 JSON，這台機器的 Claude Code 會**整個起不來**；要拿掉就是刪檔（`sudo rm`，一樣你自己貼），**但絕不要去改它的權限**——讀不到的檔會讓對話一開就結束。
