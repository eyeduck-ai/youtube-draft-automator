/**
 * YouTube Studio Draft Auto-Publisher v1.0
 * YouTube Studio 草稿影片自動發佈腳本 v1.0
 * 
 * Features | 功能：
 * - Publish drafts as Public / Unlisted / Private | 將草稿發佈為 公開/不公開/私人
 * - Auto-add to specified playlist | 自動添加到指定播放清單
 * - Auto-mark as "Not made for kids" | 自動標記為「非兒童內容」
 * - Auto pagination support | 支援自動翻頁
 * - Detailed progress tracking & error handling | 詳細進度追蹤與錯誤處理
 * - URL validation for correct page | 網址驗證確保正確頁面
 * 
 * Usage | 使用方法：
 * 1. Open YouTube Studio Channel content page | 開啟 YouTube Studio 頻道內容頁面
 *    URL: https://studio.youtube.com/channel/YOUR_ID/videos/upload
 *    OR Playlist Page | 或播放清單頁面
 *    URL: https://studio.youtube.com/playlist/YOUR_PLAYLIST_ID/videos
 * 2. Press F12, go to Console tab | 按 F12，切換到 Console 標籤
 * 3. Type "allow pasting" first (Chrome security) | 先輸入 "allow pasting"（Chrome 安全性）
 * 4. Paste this script and run | 貼上此腳本並執行
 */

class YouTubeAutomator {
    constructor(config = {}) {
        // ==================== Configuration | 配置區域 ====================
        this.config = {
            // Playlist name (empty string = skip) | 播放清單名稱（空字串 = 跳過）
            playlistName: config.playlistName || "",

            // Visibility: 'public' | 'unlisted' | 'private' | 可見性設定
            visibility: config.visibility || "unlisted",

            // Mark as "Not made for kids" | 標記為「非兒童內容」
            setNotForKids: config.setNotForKids !== false,

            // Batch size: -1 = all, positive = specific count | 批量大小：-1 = 全部
            batchSize: config.batchSize || -1,

            // Auto pagination | 自動換頁
            autoPagination: config.autoPagination !== false,

            // ========== Delay Settings (ms) | 延遲時間設定（毫秒）==========
            // 註: 大部分操作已有元件偵測，這些是表础延遲時間
            delayBetweenVideos: config.delayBetweenVideos || 500,   // Between videos | 影片間隔
            dialogLoadDelay: config.dialogLoadDelay || 1500,        // Dialog loading | 對話框載入
            dropdownDelay: config.dropdownDelay || 500,             // Dropdown menu | 下拉選單
            tabSwitchDelay: config.tabSwitchDelay || 750,           // Tab switching | 標籤切換
            pageLoadDelay: config.pageLoadDelay || 2500,            // Page loading | 頁面載入
        };

        // Statistics | 統計
        this.stats = {
            processed: 0,
            success: 0,
            failed: 0,
            total: 0
        };

        this.isProcessing = false;
    }

    // ==================== Utility Functions | 工具函數 ====================

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(message, type = 'info') {
        const styles = {
            info: 'color: #2196F3',
            success: 'color: #4CAF50; font-weight: bold',
            warning: 'color: #FF9800',
            error: 'color: #F44336; font-weight: bold',
            progress: 'color: #9C27B0'
        };
        const icons = {
            info: '📋',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            progress: '🔄'
        };
        console.log(
            `%c${icons[type] || '📋'} [${new Date().toLocaleTimeString()}] ${message}`,
            styles[type] || styles.info
        );
    }

    async waitForElement(selector, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) return element;
            await this.sleep(100);
        }
        return null;
    }

    async waitForText(text, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (document.body.textContent.includes(text)) {
                return true;
            }
            await this.sleep(100);
        }
        return false;
    }

    async safeClick(element, description = '元素') {
        if (!element) {
            this.log(`找不到 ${description}`, 'warning');
            return false;
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);
        element.click();
        await this.sleep(1000);
        return true;
    }

    // ==================== Pagination | 分頁處理 ====================

    /**
     * 切換每頁顯示 50 項
     */
    async setItemsPerPage() {
        this.log('設定每頁顯示 50 項...', 'progress');

        try {
            // 策略 1: 使用結構化選擇器 (ytcp-table-footer 內的 dropdown)
            const pageSizeDropdown = document.querySelector('.ytcp-table-footer ytcp-dropdown-trigger') ||
                // Fallback: 嘗試找 paginator 區域
                document.querySelector('ytcp-table-paginator ytcp-dropdown-trigger');

            if (pageSizeDropdown) {
                await this.safeClick(pageSizeDropdown, '每頁數量下拉選單');
                await this.sleep(500);

                // 選項通常是 tp-yt-paper-item
                const options = document.querySelectorAll('tp-yt-paper-item');
                for (const option of options) {
                    // 50 是數字，語言無關
                    if (option.textContent.trim() === '50') {
                        await this.safeClick(option, '50 項目選項');
                        this.log('已設定每頁顯示 50 項', 'success');
                        await this.sleep(this.config.pageLoadDelay);
                        return true;
                    }
                }
                // 如果沒找到 50，關閉選單
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            }

            this.log('使用預設的每頁顯示數量', 'info');
            return false;
        } catch (error) {
            this.log(`設定每頁數量時發生錯誤: ${error.message}`, 'warning');
            return false;
        }
    }

    /**
     * 檢查是否有下一頁
     */
    hasNextPage() {
        // 使用穩定的ID #navigate-after
        const nextButton = document.querySelector(
            'ytcp-icon-button#navigate-after:not([disabled])'
        );
        return nextButton && !nextButton.disabled;
    }

    /**
     * 前往下一頁
     */
    async goToNextPage() {
        if (!this.config.autoPagination) return false;

        this.log('前往下一頁...', 'progress');

        const nextButton = document.querySelector(
            'ytcp-icon-button#navigate-after:not([disabled])'
        );

        if (nextButton && !nextButton.disabled) {
            await this.safeClick(nextButton, '下一頁按鈕');
            await this.sleep(this.config.pageLoadDelay); // 等待新頁面載入
            this.log('已前往下一頁', 'success');
            return true;
        }

        this.log('已經是最後一頁', 'info');
        return false;
    }

    // ==================== Video Detection | 影片偵測 ====================

    /**
     * 獲取所有 "Edit draft" 按鈕
     * 優先使用 href 屬性判斷，其次使用文字內容
     */
    getEditDraftButtons() {
        const buttons = [];
        const processedRows = new Set();

        // 策略 1: 結構化搜尋 (Language Agnostic)
        // 找到所有的編輯連結 (通常在標題或縮圖)
        const editLinks = document.querySelectorAll('a[href*="/video/"][href*="/edit"]');

        for (const link of editLinks) {
            // 往上找直到找到行容器 (ytcp-video-row)
            const row = link.closest('ytcp-video-row');
            if (row && !processedRows.has(row)) {
                // 在此行內尋找合適的按鈕
                // "Edit draft" 按鈕通常是 ytcp-button (文字按鈕), 不是 ytcp-icon-button (圖示按鈕)
                // 且它通常位於特定的 render-status 區域
                const actionButton = row.querySelector('ytcp-button.edit-draft-button') ||
                    row.querySelector('.render-status-content ytcp-button') ||
                    // 如果找不到特定class，找行內第一個可見的非icon button，且通常不是 "Analytics" 或 "Comments"
                    Array.from(row.querySelectorAll('ytcp-button')).find(btn => {
                        const style = window.getComputedStyle(btn);
                        return style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            !btn.hasAttribute('disabled');
                    });

                if (actionButton) {
                    buttons.push(actionButton);
                    processedRows.add(row);
                }
            }
        }

        if (buttons.length > 0) {
            return buttons;
        }

        // 策略 2: 文字搜尋 (Fallback)
        return Array.from(document.querySelectorAll('button, ytcp-button')).filter(
            btn => {
                const text = btn.textContent.trim();
                return text === 'Edit draft' || text === '編輯草稿';
            }
        );
    }

    /**
     * 獲取草稿影片數量
     */
    getDraftCount() {
        return this.getEditDraftButtons().length;
    }

    /**
     * 獲取草稿影片行（備用方法）
     */
    getDraftRows() {
        const allRows = document.querySelectorAll('ytcp-video-row');
        return Array.from(allRows).filter(row => {
            const text = row.innerText || row.textContent || '';
            return text.includes('草稿') || text.includes('Draft');
        });
    }

    // ==================== Core Operations | 核心操作 ====================

    /**
     * 點擊 Visibility 標籤
     * 如果 Visibility 標籤被禁用（例如 Initial Check 有錯誤），則使用 Next 按鈕導航
     */
    async clickVisibilityTab() {
        const visibilityTab = document.querySelector('#step-badge-3');

        // 檢查 Visibility 標籤是否存在且未被禁用
        if (visibilityTab && !visibilityTab.hasAttribute('disabled')) {
            await this.safeClick(visibilityTab, 'Visibility 標籤 (step-badge-3)');
            return true;
        }

        // 如果 Visibility 標籤被禁用，使用 Next 按鈕逐步導航
        if (visibilityTab && visibilityTab.hasAttribute('disabled')) {
            this.log('Visibility 標籤被禁用，使用 Next 按鈕導航...', 'progress');

            // 最多嘗試點擊 Next 3 次（從 Details -> Video Elements -> Initial Check -> Visibility）
            for (let i = 0; i < 3; i++) {
                // 尋找 Next 按鈕 (通常在 dialog footer，ID 為 #next-button 或類似)
                const nextButton = document.querySelector('#next-button') ||
                    document.querySelector('ytcp-button#next-button') ||
                    document.querySelector('[test-id="NEXT_STEP_BUTTON"]');

                if (nextButton && !nextButton.hasAttribute('disabled')) {
                    await this.safeClick(nextButton, `Next 按鈕 (第 ${i + 1} 次)`);
                    await this.sleep(this.config.tabSwitchDelay);

                    // 檢查是否已經到達 Visibility 標籤
                    const currentVisibilityTab = document.querySelector('#step-badge-3');
                    if (currentVisibilityTab &&
                        (currentVisibilityTab.hasAttribute('active') ||
                            currentVisibilityTab.getAttribute('aria-selected') === 'true')) {
                        this.log('已透過 Next 按鈕到達 Visibility 標籤', 'success');
                        return true;
                    }
                } else {
                    this.log(`Next 按鈕不可用或被禁用 (嘗試 ${i + 1})`, 'warning');
                    break;
                }
            }
        }

        this.log('無法到達 Visibility 標籤', 'warning');
        return false;
    }

    /**
     * 選擇「非兒童內容」
     */
    /**
     * 選擇「非兒童內容」
     */
    async selectNotForKids() {
        if (!this.config.setNotForKids) return true;

        this.log('Setting Not For Kids... | 設定為非兒童內容...', 'progress');

        // 使用正確的 name 屬性 (Language Agnostic)
        const notForKidsRadio = document.querySelector(
            'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'
        );

        if (notForKidsRadio) {
            await this.safeClick(notForKidsRadio, '非兒童內容選項 (VIDEO_MADE_FOR_KIDS_NOT_MFK)');
            this.log('Selected: Not For Kids | 已選擇：非兒童內容', 'success');
            return true;
        }

        this.log('找不到非兒童內容選項', 'warning');
        return false;
    }

    /**
     * 選擇可見性
     */
    async selectVisibility(visibility) {
        this.log(`Selecting ${visibility.toUpperCase()} visibility... | 選擇 ${visibility.toUpperCase()} 可見性...`, 'progress');

        const nameMap = {
            'public': 'PUBLIC',
            'unlisted': 'UNLISTED',
            'private': 'PRIVATE'
        };

        const radioName = nameMap[visibility.toLowerCase()];
        if (radioName) {
            const radioByName = document.querySelector(
                `tp-yt-paper-radio-button[name="${radioName}"]`
            );
            if (radioByName) {
                await this.safeClick(radioByName, `${visibility} 選項 (name=${radioName})`);
                this.log(`Selected ${visibility.toUpperCase()} | 已選擇 ${visibility.toUpperCase()}`, 'success');
                return true;
            }
        }

        this.log(`找不到 ${visibility} 選項（請確認已切換到 Visibility 標籤）`, 'warning');
        return false;
    }

    /**
     * 選擇播放清單
     */
    async selectPlaylist(playlistName) {
        // 空字串 = 跳過播放清單設定
        if (!playlistName) {
            return true;
        }

        this.log(`設定播放清單: ${playlistName}...`, 'progress');

        // 首先找到播放清單區域
        const playlistSection = document.querySelector('ytcp-video-metadata-playlists');

        if (!playlistSection) {
            this.log('找不到播放清單區域', 'warning');
            return false;
        }

        // 檢查是否已經選擇（在觸發器中顯示）
        const triggerText = playlistSection.textContent || '';
        if (triggerText.includes(playlistName)) {
            this.log(`播放清單已選擇: ${playlistName}`, 'success');
            return true;
        }

        // 點擊下拉選單觸發器
        const dropdownTrigger = playlistSection.querySelector('ytcp-dropdown-trigger');
        if (dropdownTrigger) {
            await this.safeClick(dropdownTrigger, '播放清單下拉選單');
            await this.sleep(this.config.dropdownDelay); // 等待下拉選單動畫完成
        } else {
            this.log('找不到播放清單下拉選單', 'warning');
            return false;
        }

        // 等待播放清單列表出現
        await this.waitForElement('#playlists-list, ytcp-playlist-dialog', 3000);
        await this.sleep(500);

        // 尋找播放清單選項（使用 label 標籤）
        const labels = document.querySelectorAll('label.ytcp-checkbox-group');

        for (const label of labels) {
            const labelText = label.textContent.trim();
            if (labelText.includes(playlistName)) {
                // 找到對應的 checkbox
                const checkbox = label.querySelector('ytcp-checkbox-lit');
                const isChecked = checkbox && (
                    checkbox.hasAttribute('checked') ||
                    checkbox.getAttribute('aria-checked') === 'true'
                );

                if (!isChecked) {
                    // 點擊 label 來勾選
                    await this.safeClick(label, `播放清單: ${playlistName}`);
                    this.log(`已勾選播放清單: ${playlistName}`, 'success');
                } else {
                    this.log(`播放清單已勾選: ${playlistName}`, 'info');
                }

                // 點擊 Done 按鈕關閉對話框
                await this.sleep(500);
                // 尋找 dialog 內的 done button. 通常是 class="done-button" 或在 action 區域
                const doneButton = document.querySelector('.done-button') ||
                    document.querySelector('ytcp-playlist-dialog #done-button') ||
                    document.querySelector('ytcp-button[label="Done"]') || // Fallback if attribute exists
                    // 找 dialog footer 的最後一個按鈕
                    document.querySelector('ytcp-playlist-dialog .ytcp-playlist-dialog-content + div ytcp-button:last-child');

                if (doneButton && doneButton.offsetParent !== null) {
                    await this.safeClick(doneButton, '播放清單完成按鈕');
                }

                return true;
            }
        }

        this.log(`找不到播放清單 "${playlistName}"`, 'warning');

        // 嘗試關閉對話框（即使沒找到播放清單）
        // 尋找取消按鈕 (通常是 done button 旁邊的那個)
        const cancelBtn = document.querySelector('ytcp-playlist-dialog #cancel-button') ||
            document.querySelector('ytcp-playlist-dialog .ytcp-playlist-dialog-content + div ytcp-button:first-child');

        if (cancelBtn) {
            await this.safeClick(cancelBtn, '取消按鈕');
        }

        return false;
    }

    /**
     * 點擊儲存/發佈按鈕
     */
    async clickSaveButton() {
        this.log('Finding save button... | 尋找儲存按鈕...', 'progress');

        // 使用穩定的 ID
        const saveButton = document.querySelector('#save-button') ||
            document.querySelector('#publish-button') ||
            document.querySelector('#done-button');

        if (saveButton && !saveButton.disabled) {
            await this.safeClick(saveButton, '儲存/發佈按鈕');
            return true;
        }

        this.log('找不到儲存按鈕 (#save-button / #publish-button / #done-button)', 'error');
        return false;
    }

    /**
     * 等待發佈完成
     * 策略: 等待分享對話框出現 (內含影片連結)，這是語言獨立的
     */
    async waitForPublishComplete() {
        this.log('Waiting for publish complete... | 等待發佈完成...', 'progress');

        const startTime = Date.now();
        const timeout = 30000; // 增加超時時間到 30 秒，因為上傳可能需要時間

        while (Date.now() - startTime < timeout) {
            // 檢查分享對話框是否出現 (內有影片連結)
            // 分享對話框中有 #share-url 連結，這是語言獨立的
            const shareUrl = document.querySelector('ytcp-video-share-dialog #share-url');
            if (shareUrl && shareUrl.offsetParent !== null) {
                this.log('Share dialog detected, publish success! | 偵測到分享對話框，影片發佈成功！', 'success');
                return true;
            }

            // 備用: 檢查 ytcp-video-share-dialog 本身是否出現
            const shareDialog = document.querySelector('ytcp-video-share-dialog');
            if (shareDialog && shareDialog.offsetParent !== null) {
                this.log('偵測到分享對話框 (ytcp-video-share-dialog)，影片發佈成功！', 'success');
                return true;
            }

            await this.sleep(500);
        }

        // 超時，但為了安全起見仍繼續（可能網路慢但已經成功）
        this.log('等待分享對話框超時，嘗試繼續...', 'warning');
        return true;
    }

    /**
     * 關閉對話框
     */
    async closeDialogs() {
        // 1. 尋找發佈完成後的分享對話框的關閉按鈕
        // 分享對話框中有 #close-icon-button (X 按鈕) 和 #close-button (關閉按鈕)
        const shareDialogCloseIcon = document.querySelector('ytcp-video-share-dialog #close-icon-button');
        if (shareDialogCloseIcon && shareDialogCloseIcon.offsetParent !== null) {
            await this.safeClick(shareDialogCloseIcon, '分享對話框關閉按鈕 (X)');
            await this.sleep(500);
            return; // 成功關閉
        }

        const shareDialogCloseBtn = document.querySelector('ytcp-video-share-dialog #close-button');
        if (shareDialogCloseBtn && shareDialogCloseBtn.offsetParent !== null) {
            await this.safeClick(shareDialogCloseBtn, '分享對話框關閉按鈕');
            await this.sleep(500);
            return; // 成功關閉
        }

        // 2. 通用: 使用 icon button "close"
        const closeButtons = document.querySelectorAll('ytcp-icon-button[icon="close"]');
        for (const btn of closeButtons) {
            if (btn.offsetParent !== null) {
                await this.safeClick(btn, '關閉按鈕 (icon=close)');
                await this.sleep(300);
            }
        }

        // 3. 嘗試 #close-button (通用)
        const closeBtnId = document.querySelector('#close-button');
        if (closeBtnId && closeBtnId.offsetParent !== null) {
            await this.safeClick(closeBtnId, '關閉按鈕 (#close-button)');
        }

        // 4. ESC 鍵 (Last resort)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await this.sleep(500);
    }

    // ==================== Main Processing Flow | 主要處理流程 ====================

    /**
     * 處理單一草稿影片
     */
    async processSingleDraft(processedCount) {
        this.log(`\n${'='.repeat(50)}`, 'progress');
        this.log(`處理第 ${processedCount + 1} 個影片...`, 'progress');
        this.log(`${'='.repeat(50)}`, 'progress');

        try {
            // 步驟 1: 點擊 Edit draft 按鈕
            const editButton = this.getEditDraftButtons()[0];
            if (!editButton) {
                throw new Error('找不到 Edit draft 按鈕');
            }

            this.log('Clicking Edit draft button... | 點擊 Edit draft 按鈕...', 'progress');
            await this.safeClick(editButton, 'Edit draft 按鈕');
            await this.sleep(1500);

            // 步驟 2: 等待對話框載入
            await this.waitForElement('dialog, ytcp-dialog, [role="dialog"]', 5000);
            this.log('Edit dialog loaded | 編輯對話框已載入', 'success');

            // ========== Details 標籤（預設開啟）==========
            // 等待內容完全載入
            await this.sleep(this.config.dialogLoadDelay);

            // 選擇播放清單（在 Details 標籤中，位置較上）
            await this.selectPlaylist(this.config.playlistName);

            // 捲動到 Audience 區域（位置較下）
            const scrollable = document.querySelector('#scrollable-content');
            if (scrollable) {
                scrollable.scrollTop = scrollable.scrollHeight;
                await this.sleep(200); // 縮短捲動等待
            }

            // 設定非兒童內容（在 Details 標籤中）
            await this.selectNotForKids();

            // ========== Visibility 標籤 ==========
            // 步驟 6: 切換到 Visibility 標籤
            await this.sleep(500);
            await this.clickVisibilityTab();
            await this.sleep(this.config.tabSwitchDelay); // 等待標籤切換完成

            // 步驟 7: 選擇可見性
            await this.selectVisibility(this.config.visibility);

            // 步驟 8: 點擊儲存
            await this.sleep(500);
            const saved = await this.clickSaveButton();
            if (!saved) {
                throw new Error('無法點擊儲存按鈕');
            }

            // 步驟 9: 等待發佈完成
            await this.waitForPublishComplete();

            // 步驟 10: 關閉對話框
            await this.closeDialogs();

            this.stats.success++;
            this.log(`Video #${processedCount + 1} processed successfully ✓ | 第 ${processedCount + 1} 個影片處理成功 ✓`, 'success');

            return true;

        } catch (error) {
            this.stats.failed++;
            this.log(`Video #${processedCount + 1} failed: ${error.message} | 第 ${processedCount + 1} 個影片處理失敗`, 'error');

            await this.closeDialogs();

            if (this.config.askOnError) {
                const continueProcessing = confirm(
                    `處理第 ${processedCount + 1} 個影片時出錯:\n${error.message}\n\n是否繼續處理下一個影片？`
                );
                return continueProcessing ? 'continue' : 'stop';
            }

            return false;
        }
    }

    /**
     * 主執行函數
     */
    async start() {
        console.clear();
        this.log('╔════════════════════════════════════════════════════════════════╗', 'success');
        this.log('║  YouTube Studio Draft Auto-Publisher v1.0                      ║', 'success');
        this.log('║  YouTube Studio 草稿自動發佈腳本 v1.0                          ║', 'success');
        this.log('╚════════════════════════════════════════════════════════════════╝', 'success');

        // 確認在正確頁面（Channel content 影片頁面 或 Playlist 頁面）
        const currentUrl = window.location.href;
        const channelContentPattern = /^https:\/\/studio\.youtube\.com\/channel\/[^\/]+\/videos/;
        const playlistPattern = /^https:\/\/studio\.youtube\.com\/playlist\/[^\/]+\/videos/;

        if (!channelContentPattern.test(currentUrl) && !playlistPattern.test(currentUrl)) {
            const errorMessage =
                '請在 YouTube Studio 的「Channel content」或「Playlist」頁面執行此腳本！\n\n' +
                '正確的網址格式：\n' +
                '1. https://studio.youtube.com/channel/YOUR_ID/videos/upload\n' +
                '2. https://studio.youtube.com/playlist/YOUR_PLAYLIST_ID/videos\n\n' +
                '當前網址：\n' + currentUrl;
            alert(errorMessage);
            this.log('腳本需要在 Channel content 或 Playlist 頁面執行', 'error');
            this.log(`當前網址: ${currentUrl}`, 'info');
            return;
        }

        this.log('✓ Confirmed on correct page | 已確認在正確的頁面', 'success');

        // (已移除 setItemsPerPage，因為自動換頁功能已足夠)

        try {
            // 計算草稿數量，如果當前頁沒有則嘗試翻頁
            this.stats.total = this.getDraftCount();

            // 如果當前頁沒有草稿但有下一頁，嘗試翻頁找草稿
            while (this.stats.total === 0 && this.config.autoPagination && this.hasNextPage()) {
                this.log('當前頁無草稿，嘗試翻頁...', 'progress');
                const wentToNext = await this.goToNextPage();
                if (!wentToNext) break;
                this.stats.total = this.getDraftCount();
            }

            if (this.stats.total === 0) {
                alert('未發現任何草稿影片，請確保：\n1. 已篩選為草稿\n2. 頁面已完全載入\n3. 確認有草稿存在');
                return;
            }

            // 計算處理數量
            let targetCount = this.config.batchSize > 0
                ? this.config.batchSize
                : Infinity; // -1 表示處理全部

            // 顯示配置資訊
            this.log(`\n配置設定:`, 'info');
            this.log(`  • 可見性: ${this.config.visibility.toUpperCase()}`, 'info');
            this.log(`  • 播放清單: ${this.config.playlistName || '(跳過)'}`, 'info');
            this.log(`  • 非兒童內容: ${this.config.setNotForKids ? '是' : '否'}`, 'info');
            this.log(`  • 批量大小: ${this.config.batchSize === -1 ? '全部' : this.config.batchSize}`, 'info');
            this.log(`  • 自動換頁: ${this.config.autoPagination ? '是' : '否'}`, 'info');
            this.log(`  • 當前頁草稿: ${this.stats.total} 個`, 'info');

            this.log('\nStarting... | 開始執行...', 'progress');
            this.isProcessing = true;

            let totalProcessed = 0;
            let pageCount = 1;

            // 主迴圈：處理當前頁 + 自動換頁
            do {
                this.log(`\n━━━ Page ${pageCount} | 第 ${pageCount} 頁 ━━━`, 'progress');

                // 處理當前頁面的草稿
                while (totalProcessed < targetCount) {
                    // 重新獲取草稿（因為每處理完一個，列表會更新）
                    const currentDrafts = this.getDraftCount();

                    if (currentDrafts === 0) {
                        this.log('當前頁面已無草稿', 'info');
                        break;
                    }

                    // 處理一個草稿
                    const result = await this.processSingleDraft(totalProcessed);
                    totalProcessed++;
                    this.stats.processed = totalProcessed;

                    if (result === 'stop') {
                        this.log('用戶選擇停止處理', 'warning');
                        break;
                    }

                    // 檢查是否達到目標數量
                    if (totalProcessed >= targetCount) {
                        break;
                    }

                    // 等待後處理下一個
                    this.log(`等待 ${this.config.delayBetweenVideos / 1000} 秒...`, 'info');
                    await this.sleep(this.config.delayBetweenVideos);
                }

                // 檢查是否需要換頁
                if (totalProcessed >= targetCount) {
                    break; // 已達目標數量
                }

                // 嘗試換頁
                if (this.config.autoPagination && this.hasNextPage()) {
                    const wentToNext = await this.goToNextPage();
                    if (wentToNext) {
                        pageCount++;
                    } else {
                        break; // 換頁失敗
                    }
                } else {
                    break; // 沒有下一頁或不自動換頁
                }

            } while (true);

        } catch (error) {
            this.log(`腳本執行錯誤: ${error.message}`, 'error');
            console.error(error);
        } finally {
            this.isProcessing = false;
        }

        // 顯示結果
        this.log('\n╔════════════════════════════════════════════════════════╗', 'success');
        this.log('║                     執行結果                           ║', 'success');
        this.log('╚════════════════════════════════════════════════════════╝', 'success');
        this.log(`  ✓ 成功: ${this.stats.success} 個`, 'success');
        if (this.stats.failed > 0) {
            this.log(`  ✗ 失敗: ${this.stats.failed} 個`, 'error');
        }
        this.log(`  總共: ${this.stats.processed} 個`, 'info');

        alert(`完成！\n成功: ${this.stats.success} 個\n失敗: ${this.stats.failed} 個`);
    }
}

// 創建自動化實例
const automator = new YouTubeAutomator({
    playlistName: "",  // 空字串 = 跳過
    visibility: "unlisted",            // public | unlisted | private
    setNotForKids: true,
    batchSize: -1,                      // -1 = 全部

    // 延遲時間（毫秒，可調整速度）
    delayBetweenVideos: 500,
    dialogLoadDelay: 1500,
    dropdownDelay: 500,
    tabSwitchDelay: 750,
    pageLoadDelay: 2500
});

automator.start();