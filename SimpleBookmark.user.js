// ==UserScript==
// @name         SimpleBookmark - 移动端标签导航
// @name:en      SimpleBookmark - Mobile Tag Navigator
// @namespace    https://github.com/your-username/simplebookmark
// @version      1.0.7
// @description  移动端网页标签导航工具，支持悬浮标签、拖拽移动、本地存储等功能
// @description:en Mobile web bookmark navigator with floating tags, drag & drop, local storage
// @author       Your Name
// @match        *://*/*
// @exclude      *://greasyfork.org/*
// @exclude      *://github.com/*
// @exclude      *://localhost:*/manager.html*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @license      MIT
// @homepageURL  https://github.com/your-username/simplebookmark
// @supportURL   https://github.com/your-username/simplebookmark/issues
// @updateURL    https://github.com/your-username/simplebookmark/raw/main/SimpleBookmark.user.js
// @downloadURL  https://github.com/your-username/simplebookmark/raw/main/SimpleBookmark.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    // 配置选项
    const CONFIG = {
        enabled: GM_getValue('sb_enabled', true),
        showTrigger: GM_getValue('sb_show_trigger', true),
        triggerPosition: GM_getValue('sb_trigger_position', 'top-left'),
        maxBookmarks: GM_getValue('sb_max_bookmarks', 20),
        shortcutKey: GM_getValue('sb_shortcut_key', 'KeyB'),
        blacklist: GM_getValue('sb_blacklist', ['greasyfork.org', 'github.com']),
        autoHideTrigger: GM_getValue('sb_auto_hide_trigger', true)
    };
    
    // 检查是否在黑名单中
    function isBlacklisted() {
        const hostname = window.location.hostname;
        return CONFIG.blacklist.some(domain => hostname.includes(domain));
    }
    
    // 如果脚本被禁用或在黑名单中，则不运行
    if (!CONFIG.enabled || isBlacklisted()) {
        return;
    }
    
    // 样式定义
    const CSS = `
        #sb-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        #sb-trigger {
            position: fixed;
            top: 0;
            left: 0;
            width: 0.5cm;
            height: 0.5cm;
            background: rgba(102, 126, 234, 0.1);
            border: 2px dashed rgba(102, 126, 234, 0.4);
            cursor: pointer;
            pointer-events: auto;
            z-index: 999998;
            transition: all 0.3s ease;
            border-radius: 4px;
        }
        
        #sb-trigger:hover {
            background: rgba(102, 126, 234, 0.2);
            border-color: rgba(102, 126, 234, 0.6);
        }
        
        #sb-trigger.hidden {
            opacity: 0;
            pointer-events: none;
        }
        
        .sb-bookmark {
            position: absolute;
            width: 0.5cm;
            height: 0.5cm;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 2px solid #fff;
            border-radius: 8px;
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
            user-select: none;
            color: white;
            font-size: 8px;
            font-weight: bold;
            text-align: center;
            line-height: 1.2;
            word-break: break-all;
            overflow: hidden;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
        }
        
        .sb-bookmark:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }
        
        .sb-bookmark.dragging {
            opacity: 0.8;
            transform: scale(1.2) rotate(5deg) !important;
            z-index: 999997;
            transition: none !important;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
        }
        
        .sb-bookmark:nth-child(2) { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .sb-bookmark:nth-child(3) { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .sb-bookmark:nth-child(4) { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
        .sb-bookmark:nth-child(5) { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        .sb-bookmark:nth-child(6) { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); }
        .sb-bookmark:nth-child(7) { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); }
        .sb-bookmark:nth-child(8) { background: linear-gradient(135deg, #ff8a80 0%, #ea4c88 100%); }
        
        #sb-menu {
            position: fixed;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 999996;
            display: none;
            min-width: 150px;
            overflow: hidden;
            pointer-events: auto;
            backdrop-filter: blur(10px);
        }
        
        #sb-menu.show {
            display: block;
        }
        
        .sb-menu-item {
            padding: 12px 16px;
            cursor: pointer;
            font-size: 14px;
            color: #333;
            border-bottom: 1px solid #f0f0f0;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .sb-menu-item:last-child {
            border-bottom: none;
        }
        
        .sb-menu-item:hover {
            background-color: #f8f9fa;
        }
        
        .sb-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 999995;
            pointer-events: auto;
            backdrop-filter: blur(5px);
        }
        
        .sb-modal.show {
            display: flex;
        }
        
        .sb-modal-content {
            background: white;
            padding: 24px;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            animation: sbModalAppear 0.3s ease;
        }
        
        @keyframes sbModalAppear {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .sb-modal h3 {
            margin: 0 0 20px 0;
            color: #333;
            font-size: 18px;
            font-weight: 600;
        }
        
        .sb-modal input {
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }
        
        .sb-modal input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .sb-modal-buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
        
        .sb-modal button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            min-width: 80px;
        }
        
        .sb-btn-primary {
            background: #667eea;
            color: white;
        }
        
        .sb-btn-primary:hover {
            background: #5a6fd8;
            transform: translateY(-1px);
        }
        
        .sb-btn-secondary {
            background: #f8f9fa;
            color: #333;
            border: 1px solid #e0e0e0;
        }
        
        .sb-btn-secondary:hover {
            background: #e9ecef;
            transform: translateY(-1px);
        }
        
        .sb-drag-hint {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 999994;
            display: none;
            pointer-events: none;
            backdrop-filter: blur(5px);
        }
        
        .sb-drag-hint.show {
            display: block;
        }
        
        .sb-settings-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            z-index: 999993;
            display: none;
            min-width: 250px;
            pointer-events: auto;
        }
        
        .sb-settings-panel.show {
            display: block;
        }
        
        .sb-settings-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #333;
        }
        
        .sb-setting-item {
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .sb-setting-label {
            font-size: 14px;
            color: #666;
        }
        
        .sb-setting-input {
            width: 60px;
        }
        
        @media (max-width: 768px) {
            .sb-bookmark {
                font-size: 7px;
            }
            
            .sb-modal-content {
                width: 95%;
                padding: 20px;
            }
            
            .sb-menu-item {
                padding: 14px 16px;
                font-size: 16px;
            }
            
            .sb-settings-panel {
                right: 10px;
                top: 10px;
                min-width: 200px;
            }
        }
        
        @media (hover: none) {
            .sb-bookmark:hover {
                transform: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .sb-menu-item:hover {
                background-color: transparent;
            }
        }
        
        
        /* 强制清除任何可能的伪元素残留 */
        .sb-bookmark::before,
        .sb-bookmark::after {
            content: none !important;
            display: none !important;
        }
        
        /* 强制硬件加速，避免渲染缓存问题 */
        .sb-bookmark {
            transform: translateZ(0);
            will-change: transform;
        }
    `;
    
    // 创建样式表
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    
    // 创建HTML结构
    const container = document.createElement('div');
    container.id = 'sb-container';
    container.innerHTML = `
        <div id="sb-trigger" title="点击添加标签 (${CONFIG.shortcutKey.replace('Key', 'Ctrl+')})"></div>
        <div id="sb-menu">
            <div class="sb-menu-item" data-action="drag">🖱️ 拖拽移动</div>
            <div class="sb-menu-item" data-action="set-url">🔗 设置当前页面</div>
            <div class="sb-menu-item" data-action="edit">✏️ 修改名称</div>
            <div class="sb-menu-item" data-action="delete">🗑️ 删除标签</div>
        </div>
        <div id="sb-add-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>新增标签</h3>
                <input type="text" id="sb-name" placeholder="请输入标签名称" maxlength="10">
                <input type="url" id="sb-url" placeholder="请输入链接地址">
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-edit-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>修改标签名称</h3>
                <input type="text" id="sb-edit-name" placeholder="请输入新的标签名称" maxlength="10">
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-edit-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-edit-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-drag-hint" class="sb-drag-hint">
            按住标签拖拽到任意位置，松开鼠标完成移动
        </div>
        <div id="sb-settings-panel" class="sb-settings-panel">
            <div class="sb-settings-title">SimpleBookmark 设置</div>
            <div class="sb-setting-item">
                <span class="sb-setting-label">显示触发区域</span>
                <input type="checkbox" id="sb-setting-trigger" ${CONFIG.showTrigger ? 'checked' : ''}>
            </div>
            <div class="sb-setting-item">
                <span class="sb-setting-label">最大标签数</span>
                <input type="number" id="sb-setting-max" class="sb-setting-input" value="${CONFIG.maxBookmarks}" min="1" max="50">
            </div>
            <div class="sb-setting-item">
                <span class="sb-setting-label">自动隐藏触发器</span>
                <input type="checkbox" id="sb-setting-auto-hide" ${CONFIG.autoHideTrigger ? 'checked' : ''}>
            </div>
            <div style="margin-top: 15px; text-align: center;">
                <button class="sb-btn-primary" id="sb-save-settings">保存设置</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(container);
    
    // 标签管理器类
    class SimpleBookmarkManager {
        constructor() {
            this.bookmarks = [];
            this.currentBookmarkId = null;
            this.storageKey = 'simple-bookmarks-userscript';
            this.isContextMenuOpen = false;
            this.touchStartTime = 0;
            this.longPressTimeout = null;
            this.hasBookmarks = false;
            
            this.init();
        }
        
        init() {
            this.loadBookmarks();
            this.bindEvents();
            this.renderBookmarks();
            this.updateTriggerVisibility();
            this.registerMenuCommands();
            
        }
        
        registerMenuCommands() {
            GM_registerMenuCommand('打开设置面板', () => {
                this.toggleSettings();
            });
            
            GM_registerMenuCommand('清空所有标签', () => {
                if (confirm('确定要清空所有标签吗？此操作不可撤销！')) {
                    this.bookmarks = [];
                    this.saveBookmarks();
                    this.renderBookmarks();
                    this.updateTriggerVisibility();
                }
            });
            
            GM_registerMenuCommand('导出标签数据', () => {
                const data = JSON.stringify(this.bookmarks, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'simplebookmark-data.json';
                a.click();
                URL.revokeObjectURL(url);
            });
        }
        
        bindEvents() {
            // 触发器点击
            document.getElementById('sb-trigger').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAddModal();
            });
            
            // 快捷键支持
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.code === CONFIG.shortcutKey) {
                    e.preventDefault();
                    this.showAddModal();
                }
                
                if (e.key === 'Escape') {
                    this.hideMenu();
                    this.hideAddModal();
                    this.hideEditModal();
                    this.hideSettings();
                }
            });
            
            // 添加标签
            document.getElementById('sb-confirm').addEventListener('click', () => {
                this.addBookmark();
            });
            
            document.getElementById('sb-cancel').addEventListener('click', () => {
                this.hideAddModal();
            });
            
            // 编辑标签
            document.getElementById('sb-edit-confirm').addEventListener('click', () => {
                this.editBookmark();
            });
            
            document.getElementById('sb-edit-cancel').addEventListener('click', () => {
                this.hideEditModal();
            });
            
            // 菜单事件
            document.getElementById('sb-menu').addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action) {
                    this.handleMenuAction(action);
                }
            });
            
            // 设置面板
            document.getElementById('sb-save-settings').addEventListener('click', () => {
                this.saveSettings();
            });
            
            // 全局点击关闭菜单
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#sb-menu') && !e.target.closest('#sb-settings-panel')) {
                    this.hideMenu();
                    this.hideSettings();
                }
            });
            
            // 自动隐藏触发器功能已禁用
        }
        
        showTrigger() {
            document.getElementById('sb-trigger').classList.remove('hidden');
        }
        
        hideTrigger() {
            document.getElementById('sb-trigger').classList.add('hidden');
        }
        
        updateTriggerVisibility() {
            const trigger = document.getElementById('sb-trigger');
            if (CONFIG.showTrigger) {
                trigger.style.display = 'block';
                this.hasBookmarks = this.bookmarks.length > 0;
                // 始终显示触发器，不自动隐藏
                this.showTrigger();
            } else {
                trigger.style.display = 'none';
            }
        }
        
        toggleSettings() {
            const panel = document.getElementById('sb-settings-panel');
            panel.classList.toggle('show');
        }
        
        hideSettings() {
            document.getElementById('sb-settings-panel').classList.remove('show');
        }
        
        saveSettings() {
            const showTrigger = document.getElementById('sb-setting-trigger').checked;
            const maxBookmarks = parseInt(document.getElementById('sb-setting-max').value);
            const autoHide = document.getElementById('sb-setting-auto-hide').checked;
            
            GM_setValue('sb_show_trigger', showTrigger);
            GM_setValue('sb_max_bookmarks', maxBookmarks);
            GM_setValue('sb_auto_hide_trigger', autoHide);
            
            CONFIG.showTrigger = showTrigger;
            CONFIG.maxBookmarks = maxBookmarks;
            CONFIG.autoHideTrigger = autoHide;
            
            this.updateTriggerVisibility();
            this.hideSettings();
            
            alert('设置已保存！');
        }
        
        showAddModal() {
            const modal = document.getElementById('sb-add-modal');
            modal.classList.add('show');
            document.getElementById('sb-name').focus();
            
            // 自动填充当前页面信息
            document.getElementById('sb-url').value = window.location.href;
        }
        
        hideAddModal() {
            const modal = document.getElementById('sb-add-modal');
            modal.classList.remove('show');
            document.getElementById('sb-name').value = '';
            document.getElementById('sb-url').value = '';
        }
        
        showEditModal() {
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                document.getElementById('sb-edit-name').value = bookmark.name;
                const modal = document.getElementById('sb-edit-modal');
                modal.classList.add('show');
                document.getElementById('sb-edit-name').focus();
            }
        }
        
        hideEditModal() {
            const modal = document.getElementById('sb-edit-modal');
            modal.classList.remove('show');
            document.getElementById('sb-edit-name').value = '';
        }
        
        showMenu(e, bookmarkId) {
            e.preventDefault();
            e.stopPropagation();
            
            this.currentBookmarkId = bookmarkId;
            this.isContextMenuOpen = true;
            
            const menu = document.getElementById('sb-menu');
            menu.classList.add('show');
            
            const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            
            menu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
            menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
        }
        
        hideMenu() {
            const menu = document.getElementById('sb-menu');
            menu.classList.remove('show');
            this.isContextMenuOpen = false;
            this.currentBookmarkId = null;
        }
        
        handleMenuAction(action) {
            // 先保存当前选中的标签ID，再隐藏菜单
            const bookmarkId = this.currentBookmarkId;
            this.hideMenu();
            
            switch (action) {
                case 'drag':
                    // 临时恢复currentBookmarkId用于拖拽
                    this.currentBookmarkId = bookmarkId;
                    this.startDrag();
                    break;
                case 'set-url':
                    this.currentBookmarkId = bookmarkId;
                    this.setCurrentUrl();
                    this.currentBookmarkId = null;
                    break;
                case 'edit':
                    this.currentBookmarkId = bookmarkId;
                    this.showEditModal();
                    break;
                case 'delete':
                    this.currentBookmarkId = bookmarkId;
                    this.deleteBookmark();
                    this.currentBookmarkId = null;
                    break;
            }
        }
        
        addBookmark() {
            const name = document.getElementById('sb-name').value.trim();
            const url = document.getElementById('sb-url').value.trim();
            
            if (!name || !url) {
                alert('请输入标签名称和链接地址');
                return;
            }
            
            if (this.bookmarks.length >= CONFIG.maxBookmarks) {
                alert(`最多只能添加 ${CONFIG.maxBookmarks} 个标签`);
                return;
            }
            
            const bookmark = {
                id: Date.now(),
                name: name.substring(0, 10), // 限制长度
                url: url,
                x: 25, // 固定在新增按钮右边（新增按钮宽度约0.5cm = 18.9px）
                y: 5, // 与新增按钮顶部对齐
                domain: url === 'back' ? 'back' : new URL(url).hostname
            };
            
            this.bookmarks.push(bookmark);
            this.saveBookmarks();
            this.renderBookmarks();
            this.hideAddModal();
            this.updateTriggerVisibility();
        }
        
        editBookmark() {
            const newName = document.getElementById('sb-edit-name').value.trim();
            
            if (!newName) {
                alert('请输入新的标签名称');
                return;
            }
            
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.name = newName.substring(0, 10);
                this.saveBookmarks();
                this.renderBookmarks();
            }
            
            this.hideEditModal();
        }
        
        deleteBookmark() {
            if (confirm('确定要删除这个标签吗？')) {
                // 先找到要删除的元素并清理其样式
                const elementToDelete = document.querySelector(`[data-bookmark-id="${this.currentBookmarkId}"]`);
                if (elementToDelete) {
                    // 强制清除硬件加速属性
                    elementToDelete.style.willChange = 'auto';
                    elementToDelete.style.transform = 'none';
                    elementToDelete.style.opacity = '0';
                    elementToDelete.offsetHeight; // 强制重排
                }
                
                this.bookmarks = this.bookmarks.filter(b => b.id !== this.currentBookmarkId);
                this.saveBookmarks();
                this.renderBookmarks();
                this.updateTriggerVisibility();
            }
        }
        
        setCurrentUrl() {
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.url = window.location.href;
                bookmark.domain = window.location.hostname;
                this.saveBookmarks();
                this.renderBookmarks();
            }
        }
        
        startDrag() {
            const element = document.querySelector(`[data-bookmark-id="${this.currentBookmarkId}"]`);
            if (element) {
                this.enableDrag(element);
            }
        }
        
        enableDrag(element) {
            // 进入拖拽模式
            element.classList.add('dragging');
            element.style.cursor = 'grab';
            
            // 创建一个视觉提示，表明原始位置
            const originalPos = document.createElement('div');
            originalPos.className = 'sb-bookmark-ghost';
            originalPos.style.cssText = `
                position: absolute;
                left: ${element.style.left};
                top: ${element.style.top};
                width: 0.5cm;
                height: 0.5cm;
                border: 2px dashed rgba(102, 126, 234, 0.5);
                border-radius: 8px;
                background: rgba(102, 126, 234, 0.1);
                pointer-events: none;
                z-index: 999996;
            `;
            document.getElementById('sb-container').appendChild(originalPos);
            
            const hint = document.getElementById('sb-drag-hint');
            hint.classList.add('show');
            
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };
            let originalClickHandler = null;
            
            // 暂时禁用标签的点击事件
            const disableClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
            
            // 禁用原有的点击功能
            element.style.pointerEvents = 'auto';
            element.addEventListener('click', disableClick, true);
            
            // 鼠标按下开始拖拽 - 直接绑定到标签元素
            const onElementMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isDragging = true;
                
                const rect = element.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                
                element.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing';
            };
            
            // 全局鼠标移动事件
            const onDocumentMouseMove = (e) => {
                if (isDragging) {
                    e.preventDefault();
                    const x = e.clientX - dragOffset.x;
                    const y = e.clientY - dragOffset.y;
                    
                    const maxX = window.innerWidth - element.offsetWidth;
                    const maxY = window.innerHeight - element.offsetHeight;
                    
                    element.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
                    element.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
                }
            };
            
            // 全局鼠标松开事件
            const onDocumentMouseUp = (e) => {
                if (isDragging) {
                    isDragging = false;
                    
                    // 立即清除拖拽样式并强制重排
                    element.style.cursor = 'grab';
                    element.style.transform = 'none'; // 完全清除transform
                    element.style.opacity = '1';
                    element.style.transition = 'none'; // 暂时禁用过渡效果
                    
                    // 强制重排以清除合成层缓存
                    element.offsetHeight;
                    
                    // 重新启用过渡效果
                    element.style.transition = 'all 0.2s ease';
                    
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                    
                    // 保存位置
                    const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
                    if (bookmark) {
                        bookmark.x = parseInt(element.style.left);
                        bookmark.y = parseInt(element.style.top);
                        this.saveBookmarks();
                        
                        // 强制清除合成层缓存
                        element.style.willChange = 'auto';
                        element.offsetHeight; // 触发重排
                        element.style.willChange = 'transform';
                    }
                }
            };
            
            // 触摸事件处理
            const onElementTouchStart = (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                isDragging = true;
                
                const rect = element.getBoundingClientRect();
                dragOffset.x = touch.clientX - rect.left;
                dragOffset.y = touch.clientY - rect.top;
            };
            
            const onDocumentTouchMove = (e) => {
                if (isDragging) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const x = touch.clientX - dragOffset.x;
                    const y = touch.clientY - dragOffset.y;
                    
                    const maxX = window.innerWidth - element.offsetWidth;
                    const maxY = window.innerHeight - element.offsetHeight;
                    
                    element.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
                    element.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
                }
            };
            
            const onDocumentTouchEnd = (e) => {
                if (isDragging) {
                    isDragging = false;
                    
                    // 立即清除拖拽样式并强制重排
                    element.style.transform = 'none'; // 完全清除transform
                    element.style.opacity = '1';
                    element.style.transition = 'none'; // 暂时禁用过渡效果
                    
                    // 强制重排以清除合成层缓存
                    element.offsetHeight;
                    
                    // 重新启用过渡效果
                    element.style.transition = 'all 0.2s ease';
                    
                    // 保存位置
                    const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
                    if (bookmark) {
                        bookmark.x = parseInt(element.style.left);
                        bookmark.y = parseInt(element.style.top);
                        this.saveBookmarks();
                        
                        // 强制清除合成层缓存
                        element.style.willChange = 'auto';
                        element.offsetHeight; // 触发重排
                        element.style.willChange = 'transform';
                    }
                }
            };
            
            // 退出拖拽模式
            const exitDragMode = () => {
                isDragging = false;
                
                // 强制清除所有拖拽相关样式
                element.classList.remove('dragging');
                element.style.cursor = 'pointer';
                element.style.transform = ''; // 清除transform
                element.style.opacity = ''; // 恢复透明度
                element.style.zIndex = ''; // 恢复层级
                element.style.transition = ''; // 恢复过渡效果
                element.style.boxShadow = ''; // 恢复阴影
                
                // 清除原始位置提示
                const ghost = document.querySelector('.sb-bookmark-ghost');
                if (ghost) {
                    ghost.remove();
                }
                
                hint.classList.remove('show');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                
                // 恢复标签的点击功能
                element.removeEventListener('click', disableClick, true);
                element.style.pointerEvents = '';
                
                // 移除所有事件监听器
                element.removeEventListener('mousedown', onElementMouseDown);
                element.removeEventListener('touchstart', onElementTouchStart);
                document.removeEventListener('mousemove', onDocumentMouseMove);
                document.removeEventListener('mouseup', onDocumentMouseUp);
                document.removeEventListener('touchmove', onDocumentTouchMove);
                document.removeEventListener('touchend', onDocumentTouchEnd);
                document.removeEventListener('click', onOutsideClick);
                document.removeEventListener('keydown', onKeyDown);
                
                // 强制重绘，确保视觉更新
                element.offsetHeight; // 触发重排
            };
            
            // 点击其他地方退出拖拽模式
            const onOutsideClick = (e) => {
                if (!element.contains(e.target) && !hint.contains(e.target)) {
                    exitDragMode();
                }
            };
            
            // 按ESC键退出拖拽模式
            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    exitDragMode();
                }
            };
            
            // 绑定事件监听器
            element.addEventListener('mousedown', onElementMouseDown);
            element.addEventListener('touchstart', onElementTouchStart, { passive: false });
            document.addEventListener('mousemove', onDocumentMouseMove);
            document.addEventListener('mouseup', onDocumentMouseUp);
            document.addEventListener('touchmove', onDocumentTouchMove, { passive: false });
            document.addEventListener('touchend', onDocumentTouchEnd);
            
            // 延迟添加退出事件，避免立即触发
            setTimeout(() => {
                document.addEventListener('click', onOutsideClick);
                document.addEventListener('keydown', onKeyDown);
            }, 300);
            
        }
        
        renderBookmarks() {
            const container = document.getElementById('sb-container');
            
            // 安全清理：只删除标签元素，保留其他UI
            const existing = document.querySelectorAll('.sb-bookmark');
            existing.forEach(item => {
                // 强制清除硬件加速属性
                item.style.willChange = 'auto';
                item.style.transform = 'none';
                item.style.opacity = '0'; // 先隐藏
                item.offsetHeight; // 强制重排
                
                // 清除所有样式
                item.style.cssText = '';
                item.classList.remove('dragging');
                item.remove();
            });
            
            // 二次清理：查找任何可能遗漏的标签元素
            const allDivs = container.querySelectorAll('div');
            allDivs.forEach(div => {
                if (div.classList && div.classList.contains('sb-bookmark')) {
                    // 同样的清理过程
                    div.style.willChange = 'auto';
                    div.style.transform = 'none';
                    div.style.opacity = '0';
                    div.offsetHeight;
                    div.remove();
                }
            });
            
            // 强制清除容器的合成层缓存
            container.style.willChange = 'auto';
            container.style.transform = 'none';
            container.offsetHeight; // 强制重排
            container.style.willChange = 'transform';
            container.style.transform = 'translateZ(0)';
            
            // 渲染新标签
            this.bookmarks.forEach(bookmark => {
                const element = this.createBookmarkElement(bookmark);
                container.appendChild(element);
            });
            
            // 验证关键UI元素是否还存在
            const menu = document.getElementById('sb-menu');
            const trigger = document.getElementById('sb-trigger');
            if (!menu || !trigger) {
                // 如果关键元素丢失，重新初始化
                this.init();
            }
        }
        
        createBookmarkElement(bookmark) {
            const element = document.createElement('div');
            element.className = 'sb-bookmark';
            element.setAttribute('data-bookmark-id', bookmark.id);
            element.style.left = `${bookmark.x}px`;
            element.style.top = `${bookmark.y}px`;
            element.textContent = bookmark.name;
            element.title = `${bookmark.name}\n${bookmark.url}`;
            
            // 点击打开链接
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.isContextMenuOpen) {
                    if (bookmark.url === 'back') {
                        window.history.back();
                    } else {
                        window.location.href = bookmark.url;
                    }
                }
            });
            
            // 右键菜单
            element.addEventListener('contextmenu', (e) => {
                this.showMenu(e, bookmark.id);
            });
            
            // 移动端长按
            let touchTimer;
            element.addEventListener('touchstart', (e) => {
                this.touchStartTime = Date.now();
                touchTimer = setTimeout(() => {
                    this.showMenu(e, bookmark.id);
                }, 500);
            });
            
            element.addEventListener('touchend', (e) => {
                clearTimeout(touchTimer);
                const touchDuration = Date.now() - this.touchStartTime;
                
                if (touchDuration < 500 && !this.isContextMenuOpen) {
                    if (bookmark.url === 'back') {
                        window.history.back();
                    } else {
                        window.location.href = bookmark.url;
                    }
                }
            });
            
            element.addEventListener('touchmove', () => {
                clearTimeout(touchTimer);
            });
            
            return element;
        }
        
        saveBookmarks() {
            GM_setValue(this.storageKey, JSON.stringify(this.bookmarks));
        }
        
        loadBookmarks() {
            const saved = GM_getValue(this.storageKey, '[]');
            try {
                this.bookmarks = JSON.parse(saved);
            } catch (e) {
                this.bookmarks = [];
            }
        }
    }
    
    // 等待页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new SimpleBookmarkManager();
        });
    } else {
        new SimpleBookmarkManager();
    }
    
    
})();