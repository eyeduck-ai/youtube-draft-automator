# YouTube Draft Automator v1.1
# YouTube 草稿影片自動發佈腳本 v1.1

> Author: ZMH

A browser console script that automates publishing draft videos in YouTube Studio.
在 YouTube Studio 中自動批量發佈草稿影片的瀏覽器控制台腳本。

---

## ✨ Features | 功能特色

| Feature | Description |
|---------|-------------|
| 🏛️ Playlist Page Support | Works on both Channel Content and Playlist pages |
| 🌐 Language Independent | Selectors work regardless of YouTube Studio language |
| 🌍 Bilingual Logs | Console logs in both English and Chinese |
| 🎛️ Visibility Options | Publish as Public / Unlisted / Private |
| 📋 Playlist Support | Auto-add videos to specified playlist |
| 👶 Not For Kids | Auto-mark as "Not made for kids" |
| 📄 Auto Pagination | Automatically navigate through pages |
| ✅ Publish Confirmation | Detects share dialog for reliable success detection |
| ⚠️ Error Handling | Detailed logging and error recovery |

| 功能 | 說明 |
|------|------|
| 🏛️ 播放清單頁面支援 | 支援 Channel Content 和 Playlist 頁面 |
| 🌐 語言獨立 | 選擇器不依賴 YouTube Studio 介面語言 |
| 🌍 雙語日誌 | 控制台訊息同時顯示英文和中文 |
| 🎛️ 可見性選項 | 發佈為 公開 / 不公開 / 私人 |
| 📋 播放清單支援 | 自動添加影片到指定播放清單 |
| 👶 非兒童內容 | 自動標記為「不是專為兒童打造」 |
| 📄 自動翻頁 | 自動瀏覽多頁處理所有草稿 |
| ✅ 發佈確認 | 偵測分享對話框確認發佈成功 |
| ⚠️ 錯誤處理 | 詳細日誌記錄與錯誤恢復 |

---

## 🚀 Step-by-Step Tutorial | 詳細使用教學

### Step 1: Navigate to YouTube Studio | 步驟 1：前往 YouTube Studio

1. Go to: `https://studio.youtube.com`
2. Click **Content** in the left sidebar
3. Filter by **Visibility: Draft** (optional but recommended)
4. Your URL should look like:
   - Channel: `https://studio.youtube.com/channel/YOUR_CHANNEL_ID/videos/upload`
   - Playlist: `https://studio.youtube.com/playlist/YOUR_PLAYLIST_ID/videos`

---

1. 前往：`https://studio.youtube.com`
2. 點擊左側選單的「**內容**」
3. 篩選「**瀏覽權限: 草稿**」（建議但非必要）
4. 網址應類似：`https://studio.youtube.com/channel/你的頻道ID/videos/upload`

---

### Step 2: Open Browser Console | 步驟 2：開啟瀏覽器控制台

1. Press **F12** to open Developer Tools
2. Click the **Console** tab

---

1. 按 **F12** 開啟開發者工具
2. 點擊「**Console**」標籤

---

### Step 3: Enable Pasting (First Time Only) | 步驟 3：啟用貼上功能（僅首次）

### ⚠️ IMPORTANT | 重要提示

**First time users**: Chrome blocks pasting in the console by default for security.

**首次使用者**：Chrome 預設會阻止在控制台貼上程式碼。

**To enable pasting | 啟用貼上功能：**

1. Type `allow pasting` in the console and press **Enter**
2. You should see a message confirming pasting is now allowed
3. You only need to do this once per browser session

---

1. 在控制台輸入 `allow pasting` 並按 **Enter**
2. 會看到確認訊息表示已允許貼上
3. 每個瀏覽器工作階段只需執行一次

---

### Step 4: Configure and Run | 步驟 4：設定並執行

1. Open `youtube_draft_automator.js`
2. Modify the configuration at the bottom of the file (see Configuration section below)
3. Copy the entire script
4. Paste into the console and press **Enter**
5. Watch the magic happen! ✨

---

1. 開啟 `youtube_draft_automator.js`
2. 修改檔案底部的配置（參見下方配置說明）
3. 複製整個腳本
4. 貼到控制台並按 **Enter**
5. 觀看自動化魔法！✨

---

## ⚙️ Configuration | 配置說明

```javascript
const automator = new YouTubeAutomator({
    // Playlist name (empty string = skip)
    // 播放清單名稱（空字串 = 跳過）
    playlistName: "My Playlist",
    
    // Visibility: 'public' | 'unlisted' | 'private'
    // 可見性：'public' | 'unlisted' | 'private'
    visibility: "unlisted",
    
    // Mark as "Not made for kids"
    // 標記為「非兒童內容」
    setNotForKids: true,
    
    // Batch size: -1 = all, positive number = specific count
    // 批量大小：-1 = 全部，正數 = 指定數量
    batchSize: -1,
    
    // Auto pagination (navigate to next page)
    // 自動翻頁
    autoPagination: true,
    
    // === Delay Settings (milliseconds) - Optimized ===
    // === 延遲時間設定（毫秒）- 已優化 ===
    delayBetweenVideos: 500,    // Between videos | 影片間隔
    dialogLoadDelay: 1500,      // Dialog loading | 對話框載入
    dropdownDelay: 500,         // Dropdown menu | 下拉選單
    tabSwitchDelay: 750,        // Tab switching | 標籤切換
    pageLoadDelay: 2500         // Page loading | 頁面載入
});

automator.start();
```

---

## 📋 Configuration Examples | 配置範例

### Example 1: Publish all drafts as Unlisted | 範例 1：將所有草稿發佈為不公開

```javascript
const automator = new YouTubeAutomator({
    playlistName: "",
    visibility: "unlisted",
    batchSize: -1
});
automator.start();
```

### Example 2: Publish 5 videos to a playlist | 範例 2：發佈 5 個影片到播放清單

```javascript
const automator = new YouTubeAutomator({
    playlistName: "My Course Videos",
    visibility: "public",
    batchSize: 5
});
automator.start();
```

### Example 3: Publish as Private without pagination | 範例 3：發佈為私人且不自動翻頁

```javascript
const automator = new YouTubeAutomator({
    playlistName: "",
    visibility: "private",
    autoPagination: false
});
automator.start();
```

---

## ⚠️ Troubleshooting | 疑難排解

### "Please run on Channel content page" Error | 「請在 Channel content 頁面執行」錯誤

**Problem**: Script is not running on the correct page.

**Solution**: Navigate to `https://studio.youtube.com/channel/YOUR_ID/videos/upload`

---

**問題**：腳本未在正確頁面執行。

**解決**：前往 `https://studio.youtube.com/channel/你的ID/videos/upload`

---

### No Drafts Found | 找不到草稿

**Problem**: The script cannot find any draft videos.

**Solutions**:
1. Make sure you have draft videos
2. Try filtering by "Visibility: Draft"
3. Wait for the page to fully load before running

---

**問題**：腳本找不到任何草稿影片。

**解決**：
1. 確保有草稿影片存在
2. 嘗試篩選「瀏覽權限: 草稿」
3. 等待頁面完全載入後再執行

---

### Script Runs Too Fast/Slow | 腳本執行太快/太慢

**Solution**: Adjust the delay settings in the configuration.

**解決**：調整配置中的延遲時間設定。

```javascript
delayBetweenVideos: 5000,  // Increase for slower | 增加此值可減慢速度
dialogLoadDelay: 3000,     // Increase if dialogs load slowly | 對話框載入慢時增加
```

> [!WARNING]
> **Keep browser in foreground!** This script does NOT work well in background tabs. Browser throttling can cause element detection failures.
> 
> **請保持瀏覽器在前景！** 此腳本不適合在背景分頁執行。瀏覽器的背景限制會導致元件偵測失敗。

---

## 📂 Files | 檔案說明

| File | Description |
|------|-------------|
| `youtube_draft_automator.js` | Main script (v1.0) |
| `README.md` | Documentation (this file) |

| 檔案 | 說明 |
|------|------|
| `youtube_draft_automator.js` | 主腳本 (v1.0) |
| `README.md` | 使用說明（此檔案）|

---

## ⚖️ License | 授權

MIT License - Free to use and modify | 可自由使用與修改
