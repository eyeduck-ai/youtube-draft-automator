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
            delayBetweenVideos: config.delayBetweenVideos || 3000,  // Between videos | 影片間隔
            dialogLoadDelay: config.dialogLoadDelay || 2000,        // Dialog loading | 對話框載入
            dropdownDelay: config.dropdownDelay || 1500,            // Dropdown menu | 下拉選單
            tabSwitchDelay: config.tabSwitchDelay || 1000,          // Tab switching | 標籤切換
            pageLoadDelay: config.pageLoadDelay || 3000,            // Page loading | 頁面載入
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
            const pageSizeDropdown = document.querySelector(
                'ytcp-dropdown-trigger[aria-label*="Rows per page"],' +
                'ytcp-dropdown-trigger[aria-label*="每頁列數"],' +
                '.ytcp-table-footer ytcp-dropdown-trigger'
            );

            if (pageSizeDropdown) {
                await this.safeClick(pageSizeDropdown, '每頁數量下拉選單');
                await this.sleep(500);

                const options = document.querySelectorAll('tp-yt-paper-item');
                for (const option of options) {
                    if (option.textContent.trim() === '50') {
                        await this.safeClick(option, '50 項目選項');
                        this.log('已設定每頁顯示 50 項', 'success');
                        await this.sleep(this.config.pageLoadDelay);
                        return true;
                    }
                }
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
        const nextButton = document.querySelector(
            'ytcp-icon-button#navigate-after:not([disabled]),' +
            '[aria-label="Next page"]:not([disabled]),' +
            '[aria-label="下一頁"]:not([disabled]),' +
            '.navigation-button.forward:not([disabled])'
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
            'ytcp-icon-button#navigate-after:not([disabled]),' +
            '[aria-label="Next page"]:not([disabled]),' +
            '[aria-label="下一頁"]:not([disabled]),' +
            '.navigation-button.forward:not([disabled])'
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
     */
    getEditDraftButtons() {
        return Array.from(document.querySelectorAll('button')).filter(
            btn => btn.textContent.trim() === 'Edit draft' ||
                btn.textContent.trim() === '編輯草稿'
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
     */
    async clickVisibilityTab() {
        // 方法 1: 使用 step-badge-3 (Visibility 是第 4 個標籤，index 3)
        const visibilityTabById = document.querySelector('button[role="tab"][id*="step-badge-3"]');
        if (visibilityTabById) {
            await this.safeClick(visibilityTabById, 'Visibility 標籤 (by id)');
            return true;
        }

        // 方法 2: 使用文字內容
        const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
        const visibilityTab = tabs.find(tab =>
            tab.textContent.includes('Visibility') ||
            tab.textContent.includes('瀏覽權限') ||
            tab.textContent.includes('公開設定')
        );

        if (visibilityTab) {
            await this.safeClick(visibilityTab, 'Visibility 標籤');
            return true;
        }

        this.log('找不到 Visibility 標籤', 'warning');
        return false;
    }

    /**
     * 選擇「非兒童內容」
     */
    async selectNotForKids() {
        if (!this.config.setNotForKids) return true;

        this.log('設定為非兒童內容...', 'progress');

        // 方法 1: 使用正確的 name 屬性
        const notForKidsRadio = document.querySelector(
            'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'
        );

        if (notForKidsRadio) {
            await this.safeClick(notForKidsRadio, '非兒童內容選項 (by name)');
            this.log('已選擇：非兒童內容', 'success');
            return true;
        }

        // 方法 2: 使用文字內容
        const radios = Array.from(document.querySelectorAll('tp-yt-paper-radio-button'));
        const radioByText = radios.find(radio => {
            const text = radio.textContent || '';
            return text.includes("No, it's not made for kids") ||
                text.includes('不是專為兒童打造') ||
                text.includes('非兒童');
        });

        if (radioByText) {
            await this.safeClick(radioByText, '非兒童內容選項 (by text)');
            this.log('已選擇：非兒童內容', 'success');
            return true;
        }

        this.log('找不到非兒童內容選項', 'warning');
        return false;
    }

    /**
     * 選擇可見性
     */
    async selectVisibility(visibility) {
        this.log(`選擇 ${visibility.toUpperCase()} 可見性...`, 'progress');

        // 方法 1: 使用 name 屬性（最可靠）
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
                await this.safeClick(radioByName, `${visibility} 選項 (by name)`);
                this.log(`已選擇 ${visibility.toUpperCase()}`, 'success');
                return true;
            }
        }

        // 方法 2: 使用文字內容
        const visibilityKeywords = {
            'public': ['Public', '公開', '公开'],
            'unlisted': ['Unlisted', '不公開', '不公開列出', '非公开'],
            'private': ['Private', '私人', '私有']
        };
        const keywords = visibilityKeywords[visibility.toLowerCase()] || visibilityKeywords['unlisted'];

        const radios = Array.from(document.querySelectorAll('tp-yt-paper-radio-button'));
        for (const radio of radios) {
            const text = radio.textContent || '';
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    await this.safeClick(radio, `${visibility} 選項 (by text)`);
                    this.log(`已選擇 ${visibility.toUpperCase()}`, 'success');
                    return true;
                }
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
                const doneButton = document.querySelector(
                    'ytcp-playlist-dialog button[aria-label="Done"], ' +
                    'ytcp-playlist-dialog #done-button, ' +
                    '#playlists-list + * button, ' +
                    'button[aria-label="Done"]'
                );

                if (doneButton && doneButton.offsetParent !== null) {
                    await this.safeClick(doneButton, '播放清單完成按鈕');
                }

                return true;
            }
        }

        // 備用：嘗試其他選擇器
        const checkboxes = document.querySelectorAll(
            'tp-yt-paper-checkbox, ytcp-checkbox-lit, [role="option"]'
        );

        for (const checkbox of checkboxes) {
            const text = checkbox.textContent || '';
            if (text.includes(playlistName)) {
                const isChecked = checkbox.hasAttribute('checked') ||
                    checkbox.getAttribute('aria-checked') === 'true';

                if (!isChecked) {
                    await this.safeClick(checkbox, `播放清單: ${playlistName}（備用方法）`);
                    this.log(`已勾選播放清單: ${playlistName}（備用方法）`, 'success');
                }

                // 關閉對話框
                await this.sleep(500);
                const doneBtn = document.querySelector('button[aria-label="Done"]');
                if (doneBtn) {
                    await this.safeClick(doneBtn, '播放清單完成');
                }
                return true;
            }
        }

        this.log(`找不到播放清單 "${playlistName}"`, 'warning');

        // 嘗試關閉對話框（即使沒找到播放清單）
        const cancelBtn = document.querySelector('button[aria-label="Cancel"]');
        if (cancelBtn) {
            await this.safeClick(cancelBtn, '取消按鈕');
        }

        return false;
    }

    /**
     * 點擊儲存/發佈按鈕
     */
    async clickSaveButton() {
        this.log('尋找儲存按鈕...', 'progress');

        // 尋找 Save/Done/Publish 按鈕
        const buttons = Array.from(document.querySelectorAll('button, ytcp-button'));
        const saveButton = buttons.find(btn => {
            const text = btn.textContent.trim();
            return ['Save', 'Done', 'Publish', '儲存', '完成', '發布'].some(t => text.includes(t));
        });

        if (saveButton && !saveButton.disabled) {
            const dialog = saveButton.closest('ytcp-dialog, tp-yt-paper-dialog, dialog');
            if (dialog) {
                await this.safeClick(saveButton, '儲存按鈕');
                return true;
            }
        }

        // 備用：直接用 ID
        const idButtons = ['#done-button', '#save-button', '#publish-button'];
        for (const id of idButtons) {
            const btn = document.querySelector(id);
            if (btn && !btn.disabled) {
                await this.safeClick(btn, '儲存按鈕');
                return true;
            }
        }

        this.log('找不到儲存按鈕', 'error');
        return false;
    }

    /**
     * 等待發佈完成
     */
    async waitForPublishComplete() {
        this.log('等待發佈完成...', 'progress');

        // 等待「影片已發佈」訊息
        const success = await this.waitForText('Video published', 10000) ||
            await this.waitForText('影片已發布', 10000) ||
            await this.waitForText('已儲存', 10000);

        if (success) {
            this.log('影片發佈成功！', 'success');
            return true;
        }

        // 備用：等待對話框關閉
        await this.sleep(3000);
        return true;
    }

    /**
     * 關閉對話框
     */
    async closeDialogs() {
        // Close 按鈕
        const closeButtons = Array.from(document.querySelectorAll('button')).filter(
            btn => ['Close', '關閉'].includes(btn.textContent.trim())
        );

        for (const btn of closeButtons) {
            if (btn.offsetParent !== null) {
                await this.safeClick(btn, '關閉按鈕');
            }
        }

        // X 按鈕
        const xButtons = document.querySelectorAll('[aria-label*="close"], [aria-label*="關閉"]');
        for (const btn of xButtons) {
            if (btn.offsetParent !== null) {
                await this.safeClick(btn, 'X 按鈕');
            }
        }

        // ESC 鍵
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

            this.log('點擊 Edit draft 按鈕...', 'progress');
            await this.safeClick(editButton, 'Edit draft 按鈕');
            await this.sleep(1500);

            // 步驟 2: 等待對話框載入
            await this.waitForElement('dialog, ytcp-dialog, [role="dialog"]', 5000);
            this.log('編輯對話框已載入', 'success');

            // ========== Details 標籤（預設開啟）==========
            // 等待內容完全載入
            await this.sleep(this.config.dialogLoadDelay);

            // 步驟 4: 選擇播放清單（在 Details 標籤中，位置較上）
            await this.selectPlaylist(this.config.playlistName);

            // 步驟 5: 捲動到 Audience 區域（位置較下）
            const scrollable = document.querySelector('#scrollable-content');
            if (scrollable) {
                scrollable.scrollTop = scrollable.scrollHeight;
                await this.sleep(500);
            }

            // 步驟 6: 設定非兒童內容（在 Details 標籤中）
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
            this.log(`第 ${processedCount + 1} 個影片處理成功 ✓`, 'success');

            return true;

        } catch (error) {
            this.stats.failed++;
            this.log(`第 ${processedCount + 1} 個影片處理失敗: ${error.message}`, 'error');

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

        // 確認在正確頁面（Channel content 影片頁面）
        const currentUrl = window.location.href;
        const channelContentPattern = /^https:\/\/studio\.youtube\.com\/channel\/[^\/]+\/videos/;

        if (!channelContentPattern.test(currentUrl)) {
            const errorMessage =
                '請在 YouTube Studio 的「Channel content」頁面執行此腳本！\n\n' +
                '正確的網址格式：\n' +
                'https://studio.youtube.com/channel/你的頻道ID/videos/upload\n\n' +
                '當前網址：\n' + currentUrl;
            alert(errorMessage);
            this.log('腳本需要在 Channel content 頁面執行', 'error');
            this.log(`正確網址格式: https://studio.youtube.com/channel/UC.../videos/upload`, 'info');
            this.log(`當前網址: ${currentUrl}`, 'info');
            return;
        }

        this.log('✓ 已確認在 Channel content 頁面', 'success');

        try {
            // 步驟 1: 設定每頁顯示數量
            await this.setItemsPerPage();

            // 步驟 2: 計算草稿數量，如果當前頁沒有則嘗試翻頁
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

            this.log('\n開始執行...', 'progress');
            this.isProcessing = true;

            let totalProcessed = 0;
            let pageCount = 1;

            // 主迴圈：處理當前頁 + 自動換頁
            do {
                this.log(`\n━━━ 第 ${pageCount} 頁 ━━━`, 'progress');

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
    delayBetweenVideos: 3000,
    dialogLoadDelay: 2000,
    dropdownDelay: 1500,
    tabSwitchDelay: 1000,
    pageLoadDelay: 3000
});

automator.start();