# 受管設定層的裝法（禁區攔截器的最外一層，B1）

**這一層買到的是「沒有管理員密碼就刪不掉那幾行」，不是把前面那幾道放鬆的理由。** 專案層那幾行本來就沒有任何下層蓋得掉（文件：「If a tool is denied at any level, no other level can allow it.」），所以它不是為了「蓋過誰」而存在；它防的是**那個檔被改掉、被誤刪、被某個 AI 改弱**。裝了它之後，前面那幾道一行都不要拿掉——雲端對話讀不到裝置上的檔（見「守不到的」①），拿掉就真的少一層；使用專案如果有一題釘住清單裡那幾行（建議要有），拿掉還會當場紅（**套件這邊沒有那一題**，套件不知道你的清單長什麼樣）。

一句話說它是什麼：macOS 上有一個只有管理員寫得動的設定檔，把專案禁區清單裡**那幾個完整的外接工具名**再抄一份進去。只有這一件事——不放鉤子、不放別的鍵。

適用範圍：Claude Code、macOS。別的作業系統受管檔的位置不同（自己查官方文件），別的 AI 沒有這一層。

---

## 這份範本的取捨（照抄之前先看）

1. **名字不讓人打字。** 下面那一行從**已經合併進主幹的版本**讀專案自己的清單（`git show <參照>:<清單檔>`），不讀當下工作樹——工作樹可能停在別的分支或改到一半。這件事不是潔癖：平台對拒絕規則的名字**打錯不會有任何警告**（文件：「A deny or ask rule whose tool name matches no known tool produces a startup warning to catch typos. Tool names containing `_` or `*` are exempt from the check.」），而所有 `mcp__` 開頭的名字都含 `_`＝全部豁免。打錯就是靜靜不擋。

2. **形狀檢查刻意分成兩半。**
   - **任何專案都成立的那一半寫死在指令裡**，它擋得住三件事：①不是 `mcp__` 開頭；②名字裡有**平台不可能用的字元**（角括號、引號、空白、括號、星號——**最常見的就是「佔位沒填完」**，例如清單裡還留著 `mcp__` 加角括號的樣板，產出來會是一份永遠比不到任何工具的拒絕清單）；③不是 `mcp__` 伺服器 `__` 工具 那個形狀。收的字元只有英文字母、數字、`.`、`-`、`_`（測試鈕那種帶一個底線的伺服器名照樣收得進來）。
     括號那條是文件寫的平台行為——「When Claude Code loads a settings file, it skips any `mcp__` rule that has parentheses.」＝帶括號的規則整條被跳過、等於沒放。⚠️ 這一種**不是完全無聲**：同一頁接著寫互動啟動時的「設定無效」對話框與 `claude doctor` 會把被跳過的規則列出來——但要有人去看。（這跟上面第 1 條「名字打錯不會有任何警告」是**兩件不同的事**：那一條講的是「名字對不上任何已知工具」，這一條講的是「規則的寫法讓它整條被跳過」，不要混成同一件。）星號擋掉是本範本的決定：這一行只搬逐字的完整名字，樣式規則要不要進受管層是另一個決定，不在這裡順手做。
     ⚠️ **它不是「合法性驗證」**：字元對、形狀對，但那個伺服器或那支工具根本不存在，它照樣收得進去——那種事這一行看不出來，只有真的開一個對話照驗收第 4 步看（而且連那裡也看不出打錯字，見上面第 1 條）。
   - **只有你的專案知道的那一半做成必填的 `SHAPE`**（例如「這幾支一定是下單那一族」），**沒填就停手**。
   - 為什麼不做成選填：選填＝多數人不會填，而漏填的那一次**沒有任何訊號**，畫面跟填了一模一樣。這是本專案記過的「靜靜通過最危險」。
   - 為什麼不乾脆拿掉這兩道：它們擋的是「來源那份清單哪天被改成別的東西」「伺服器登記名變形」。拿掉之後這一行就只剩「照抄當下的樣子」，而照抄錯了沒有人會知道。
   - ⚠️ **`SHAPE` 填成 `.` 或 `.*` 等於沒檢查**，而且畫面跟有檢查一模一樣。指令裡因此放了一個**假名字負對照**：兩個隨便編的名字都通過就停手。誠實劃界——它只擋得住「寬到連隨便的名字都收」的寫法，**擋不住寬度剛好錯的寫法**。

3. **清單裡有不是 `mcp__` 開頭的規則時，這一行會停手**（例如帶括號的、或內建工具的規則），不會靜靜產出一份不生效的檔。那種專案要自己想別的搬法，不要把這一行改鬆。

4. **量到的是什麼**：下面那兩段指令，套件這邊 2026-09-21 用一個假的來源倉庫跑過**除了 `sudo` 以外的每一段**（把目的地換成暫存路徑，擁有者與那兩個期望的擁有者值一起換成跑的人——不能造 root 的檔，所以那一半是等價替換、不是原封不動跑）。
   - 產出：產得出下面那份 JSON、印得出來源版本、檔案是 `-rw-r--r--`、**目錄是 `drwxr-xr-x`，而且在 `umask 077` 與 `umask 022` 下都是**（對照組：換回舊寫法 `mkdir -p`，`umask 077` 下量到的是 `drwx------`＝一般帳號穿不過去的那一種）。
   - 停手：`SHAPE` 空著、填 `.*`、比不到；筆數不符；清單混進帶括號的規則、非 `mcp__` 開頭的規則；**清單裡是沒填完的佔位**（名字含角括號）；目的地已經有一般檔；目的地是**指到不存在目標的符號連結**；目的地的目錄已經在但權限不是 root 755。
   - 唯讀核對指令：逐字相同、內容漂開、最外層多一個鍵、`permissions` 底下多一個鍵、檔不在、讀不到（`EACCES`）、不是合法 JSON，七種各跑一次，退出碼 0／4／4／4／1／2／3。
   - **沒有跑過的**：任何真的動到 `/Library` 的那一步（`sudo install`／`sudo chmod`／`sudo rm`／`sudo rmdir`），那是裁示者自己在自己的機器上貼；平台讀不讀得到這個檔、那幾行有沒有真的在生效，這裡一律量不到——那是「驗收」那一節的事。

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
- **不要放驗收用的那顆測試鈕的名字**（[canary-install.md](canary-install.md)）：理由跟專案層同一條——光名字的拒絕規則在的期間，那顆鈕**不可呼叫**（Claude Code；文件逐字「A bare tool name like Bash removes the tool from Claude's context entirely, so Claude never sees it.」），等於沒有鈕可以按。進了這一層更糟：**要管理員把那個檔改掉或刪掉才恢復**。
- **不要建 `managed-settings.d/` 目錄**：文件寫同一層還會讀它並合併，建了就多一個「下層蓋不回來」的落點。只建那一個檔。

---

## 2. 交給裁示者貼的那一行

先填五格，**整段一次貼進終端機，按一次 Enter**。中途會問電腦密碼。每一格是什麼、從哪裡來：

| 格 | 填什麼 | 來源與前提 |
|---|---|---|
| `REPO` | 這台機器上，專案根目錄的絕對路徑 | 資料夾改名或搬家就要跟著改（改了不改＝直接失敗，不會靜靜產錯） |
| `REF` | 已經合併進主幹的參照，例如 `origin/main` | ⚠️ **人工前提，指令不驗**：它不檢查這個參照有沒有合併、是不是最新的。追蹤參照是你本機上次 fetch 的樣子，所以**跑之前自己先 `git -C <REPO> fetch`**，不然抄到的是舊的 |
| `SRC` | 倉庫裡**有 `permissions.deny` 陣列**的那份 JSON（Claude Code 的專案設定檔） | ⚠️ **不可以填套件的 `settings.json`**：那裡面是 `forbidden.deny`（攔截器自己的禁區清單），跟平台的權限規則**是兩份不同的清單、結構也不同**。填錯那一格，這一行會在讀 `permissions.deny` 那一步當場出錯 |
| `EXPECT` | 那份清單上剛好有幾支 | 清單增減就要跟著改，不然停手。它的用途就是「數字對不上時吵」 |
| `SHAPE` | 只有你的專案知道的名字形狀 | **由誰決定**＝核定禁區清單的那一位（裁示者）；**依據**＝你的專案已經核對過的那份工具家族清單（在哪份文件就引哪份），不是隨手寫的。寫法與陷阱見上面「取捨」第 2 條 |

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
  if (typeof n !== "string") stop("清單裡有不是字串的項目，停手：" + JSON.stringify(n));
  if (!n.startsWith("mcp__")) stop("不是外接工具的完整名字（要 mcp__ 開頭；帶括號的規則平台會整條跳過），停手：" + JSON.stringify(n));
  if (!/^[A-Za-z0-9._-]+$/u.test(n)) stop("名字裡有平台不可能用的字元（角括號、引號、空白、括號、星號之類——最常見的就是佔位沒填完），停手：" + JSON.stringify(n));
  const rest = n.slice(5);
  if (!rest.includes("__") || rest.startsWith("__") || rest.endsWith("__")) stop("不是 mcp__ 伺服器 __ 工具 這個形狀，停手：" + JSON.stringify(n));
  if (!re.test(n)) stop("名字形狀不合 SHAPE，停手：" + n);
}
const text = JSON.stringify({ permissions: { deny } }, null, 2) + "\n";
JSON.parse(text);
fs.writeFileSync(out, text);
process.stderr.write("來源版本 " + ref + " " + git(["rev-parse", ref]).trim() + "\n");
process.stdout.write(text);
' "$REPO" "$TMP" "$REF" "$SRC" "$EXPECT" "$SHAPE" && { DIR="$(dirname "$DEST")"; if [ -e "$DEST" ] || [ -L "$DEST" ]; then echo "停手：這個位置已經有東西了（一般檔、目錄、指到哪裡都算的符號連結），這一行不覆蓋。現在是："; ls -ldn "$DEST"; cat "$DEST" 2>/dev/null || echo "（讀不到內容：可能是連結指到不存在的地方，或要用 sudo cat 才看得到）"; elif [ -L "$DIR" ] || { [ -e "$DIR" ] && [ ! -d "$DIR" ]; }; then echo "停手：$DIR 已經在了，但它不是一個真的目錄（是檔或符號連結）。自己看過再處理："; ls -ldn "$DIR"; elif [ -d "$DIR" ] && [ "$(stat -f "%OLp %u" "$DIR")" != "755 0" ]; then echo "停手：$DIR 已經在了，但它不是 root 的 755——這一行不默默裝進去。一般帳號穿不過去的目錄＝受管檔讀不到＝對話可能一開就結束。現在是："; ls -ldn "$DIR"; echo "看過、確定要修的話：sudo chown root:wheel \"$DIR\" && sudo chmod 755 \"$DIR\"，然後再跑一次這一行。"; else echo "上面是要寫進去的內容；接下來會問你電腦密碼。"; umask 022; sudo install -d -m 755 -o root -g wheel "$DIR" && sudo install -m 644 -o root -g wheel "$TMP" "$DEST" && echo "裝好了。下面兩行要是「目錄 drwxr-xr-x 0」「檔 -rw-r--r-- 0」："; ls -ldn "$DIR" "$DEST"; if [ "$(stat -f "%OLp %u" "$DIR")" != "755 0" ] || [ "$(stat -f "%OLp %u" "$DEST")" != "644 0" ]; then echo "⚠️ 權限不是那兩個值：照第 5 節先修好再開 Claude，不然對話可能一開就結束。"; fi; fi; rm -f "$TMP"; }
```

每一段在幹嘛（要改它的人先看懂這幾條）：

- **先產生、再檢查、才安裝**：內容用 `JSON.stringify` 產、再 `JSON.parse` 驗一次。這個檔不是合法 JSON ＝ **這台機器的 Claude Code 整個起不來**（文件：refuses to start），所以絕不能讓手打的字進去。
- **不覆蓋**：目的地已經有東西（一般檔、目錄、或**指到不存在目標的符號連結**）就印出來並停手。連結那一種特別要擋：只用「檔案存在嗎」問，斷掉的連結會答「不在」，接著 `install` 會把連結移掉、照樣裝上去（量到的）。要換內容＝先看過、自己刪掉、再跑一次（刪法見第 5 節）。
- **檔與目錄的權限都寫死、都不靠 umask**：檔 644、目錄 755、擁有者都是 root。**目錄這一半是必須的**：`mkdir -p` 會吃 umask，在 `umask 077` 下用 root 建出來的目錄是 700（量到的），一般帳號穿不過去＝受管檔讀不到；而文件寫這個檔或它的目錄**讀不到**、又沒有別的管理來源時，指定登入類型的對話會**啟動就結束**。所以這一行改用 `install -d -m 755`、先 `umask 022`（管中間那幾層目錄），裝完再把兩個權限印出來核一次。
- **目錄已經在、但權限不對時會停手**，不會默默裝進去（那正是上面那個「裝了反而起不來」的形狀）；訊息裡附修的指令，要不要修由人決定。
- **絕對不要用「改權限」的方式停用它**：讀不到的受管檔比沒有受管檔更糟（同上，對話會一開就結束）。要停用就是刪檔，見第 5 節。
- **路徑有中文或空白也沒關係**，每一格都加了引號。⚠️ 專案資料夾改名或搬家之後，`REPO` 要跟著改；受管檔本身不含路徑，只有重跑這一行時會受影響（改名後跑會直接失敗，不會靜靜產錯）。
- ⚠️ **退出碼不要拿來當判斷**：產內容那一段停手時退 1，但後半段（位置已經有東西、目錄不是目錄、目錄權限不對）印完就結束、退的是 **0**（量到的）。這一行是給人看畫面用的，**不要包進腳本拿退出碼判成功失敗**——要判就判印出來那幾行字。另外，前半段停手的那幾種會在系統暫存目錄留下一個空的暫存檔（無害，系統自己會清）。

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
const show = (s) => JSON.stringify(s);
let text;
try { text = fs.readFileSync(dest, "utf8"); } catch (e) {
  const code = (e && e.code) || "不明";
  if (code === "ENOENT") { console.log("受管檔不在：這一層現在不在這台機器上（退 1）"); process.exit(1); }
  console.log("受管檔讀不到（" + code + "）：判斷不了它在不在、內容對不對——這跟「不在」不是同一件事（退 2）");
  console.log("  讀不到的受管檔會讓指定登入類型的對話一開就結束（文件）。先看權限：ls -ldn " + show(dest));
  process.exit(2);
}
let doc;
try { doc = JSON.parse(text); } catch { console.log("受管檔不是合法的 JSON：這台機器的 Claude Code 會整個起不來，先修它（退 3）"); process.exit(3); }
const perms = doc && doc.permissions;
const permsOk = perms && typeof perms === "object" && !Array.isArray(perms);
const managedDeny = permsOk ? perms.deny : undefined;
const topKeys = doc && typeof doc === "object" && !Array.isArray(doc) ? Object.keys(doc) : null;
const permKeys = permsOk ? Object.keys(perms) : null;
const shapeOk = show(topKeys) === show(["permissions"]) && show(permKeys) === show(["deny"]) && Array.isArray(managedDeny) && managedDeny.every((x) => typeof x === "string");
console.log(shapeOk ? "結構對：整個檔只有 permissions.deny 這一條路，裡面全是字串" : "結構不對（只准 permissions.deny）：最外層的鍵＝" + show(topKeys) + "，permissions 底下的鍵＝" + show(permKeys));
const repoDeny = JSON.parse(execFileSync("git", ["-C", repo, "show", ref + ":" + src], { encoding: "utf8" })).permissions.deny;
const sameOk = show(managedDeny) === show(repoDeny);
console.log(sameOk ? "那幾行跟清單逐字相同" : "不一樣\n  受管：" + show(managedDeny) + "\n  清單：" + show(repoDeny));
process.exit(shapeOk && sameOk ? 0 : 4);
' "$REPO" "$REF" "$SRC"
```

⚠️ 它比的是**檔案內容**，不是**平台解析後生效的清單**——所以它取代不了第 4 步，兩個都要。
退出碼（量到的）：**0＝結構對而且逐字相同**；1＝檔不在；2＝**讀不到＝判斷不了**（不是「不在」，而且讀不到的受管檔會讓對話一開就結束，要當成壞事處理）；3＝不是合法 JSON；4＝結構或內容不對。要看的還是印出來那幾行字，退出碼只是讓它可以被別的東西接住。
⚠️ 它驗的範圍到這裡為止：最外層只有 `permissions`、`permissions` 底下只有 `deny`、`deny` 裡全是字串、而且那幾行跟清單逐字相同。**再往外它就看不到了**——那幾支工具真的存不存在、平台有沒有載入、有沒有在擋，都要靠第 3、4、5 步。

### 以後怎麼知道它還在（每次平台改版、每次重連那個連接器、每隔一段時間）

四下，全部免密碼：

1. `/status` → 括號還是 `(file)`。
2. `/permissions` → 那幾行還在、來源還是受管。
3. 測試鈕 → 看到攔截器那一組的拒絕理由（不是正常回話、不是「指紋對不上」）。
4. 上面那個唯讀核對指令 → 要看到「結構對」＋「那幾行跟清單逐字相同」，退出碼 0。任何別的退出碼都要當成出事（尤其退 2＝讀不到，那會讓對話一開就結束）。

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
7. **裝錯權限只有「裝的那一刻」看得到**：第 2 節那一行建目錄時把權限寫死成 root 755、既有目錄不對就停手——但它只在你跑它的那一刻看。之後有人去改那個目錄或那個檔的權限，沒有任何東西會說話，症狀是**對話一開就結束**（讀不到的受管檔比沒有受管檔更糟）。救法寫在第 5 節。
8. **套件自己的絆線看不到這一層**：`tools/claude-pin.js` 的註解已經寫明「平台的其他設定層（使用者層、受管設定層）與別的送貨管道這裡看不到」。所以這個檔在不在、內容對不對、跟清單有沒有漂開，**沒有任何考題、沒有任何合併閘看得到**——考題刻意不讀真的家目錄與系統目錄，受管檔又只在某一台機器上。**只有人照第 3 節看得到。**

---

## 5. 哪天要拿掉

唯一正確的做法是**刪檔**（或把內容寫成 `{}`；文件寫空檔算 `{}`、檔不在也不算錯）：

```bash
sudo rm "/Library/Application Support/ClaudeCode/managed-settings.json"
```

- 一樣要輸密碼，一樣由裁示者自己貼。
- **絕對不要改它的權限來「停用」**：文件寫這個檔或目錄讀不到、又沒有別的管理來源時，用 claude.ai 帳號登入的對話會**啟動就結束**。
- 拿掉之後：重開對話，`/status` 裡 `Enterprise managed settings` 那一行會消失；按一次測試鈕確認攔截器還在。

### 救援：對話一開就結束，或 `/status` 讀不到那個檔

這是**裝錯權限**的形狀，`sudo rm` 那一行**救不回來**：檔刪掉了，但那個目錄還在，而且一般帳號穿不過去——平台還是讀不到它，對話還是一開就結束。先看它現在長什麼樣（免密碼）：

```bash
ls -ldn "/Library/Application Support" "/Library/Application Support/ClaudeCode" "/Library/Application Support/ClaudeCode/managed-settings.json"
```

要的是目錄 `drwxr-xr-x`、擁有者 `0`。不是的話，修目錄本身（要密碼，自己貼）：

```bash
sudo chown root:wheel "/Library/Application Support/ClaudeCode" && sudo chmod 755 "/Library/Application Support/ClaudeCode"
```

那個目錄底下什麼都不剩、確定整個不要了，才連目錄一起收掉（`rmdir` 只刪得掉空目錄，所以它比 `rm -rf` 安全，非空會自己失敗）：

```bash
sudo rmdir "/Library/Application Support/ClaudeCode"
```

⚠️ 這一節的三行**套件這邊沒有跑過**（不碰真的系統目錄）；跑過的是同樣形狀的暫存目錄。第 2 節那一行已經把新建目錄的權限寫死成 755、既有目錄權限不對就停手，所以照那一行裝的話不會走到這裡——會走到這裡的是**手動建過那個目錄**、或用別的方式裝過的情形。
- **這一節跟第 2 節刻意寫在同一張紙上**——真的出事的時候，沒有人會有空去別處找怎麼救。

---

## 附：給裁示者的三句話

1. **這個檔只准有那幾支工具的拒絕清單，多一個鍵都不要加**——尤其是鉤子、`env`、和「只認公司的鉤子／只認公司的權限規則」那兩個開關（它們會把真正在擋的那道攔截器關掉，其中一個填錯值還會被當成「開」）；測試鈕的名字也永遠不進這個檔，進去之後那顆鈕會整個從清單上消失、再也按不到。
2. **它釘住的是「那幾行字」，不是「不准做那件事」**：連接器重連、工具改名、換一台電腦、雲端對話，它就靜靜地不再蓋到、不會有任何訊息。它買到的是「沒有你的密碼就刪不掉那幾行」——**是最外面那條皮帶，不是把前面幾道放鬆的理由**。
3. **裝好的證據是三樣一起看**：新開對話 `/status` 要剛好看到 `Enterprise managed settings (file)`、`/permissions` 裡那幾行在而且來源是受管、再按一次測試鈕要看到攔截器那一組的拒絕理由。這個檔只要變成不合法的 JSON，這台機器的 Claude Code 會**整個起不來**；要拿掉就是刪檔（`sudo rm`，一樣你自己貼），**但絕不要去改它的權限**——讀不到的檔會讓對話一開就結束。
