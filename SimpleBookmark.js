// ==UserScript==
// @name         SimpleBookmark - 移动端标签导航
// @namespace    https://github.com/unixliang/simplebookmark
// @version      2.0.0
// @description  移动端网页标签导航工具，支持悬浮标签、拖拽移动、本地存储等功能
// @author       unixliang
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-start
// @updateURL    https://unixliang.github.io/simplebookmark/simplebookmark.js
// @supportURL   https://github.com/unixliang/simplebookmark/issues
// ==/UserScript==
(function() {
    'use strict';

    // 避免重复执行
    if (window.SimpleBookmarkLoaded) return;
    window.SimpleBookmarkLoaded = true;
    

    // localStorage 存储工具函数
    const storage = {
        setValue: (key, value) => {
            try {
                return localStorage.setItem(key, value);
            } catch (error) {
                return false;
            }
        },
        
        getValue: (key, defaultValue = null) => {
            try {
                const value = localStorage.getItem(key);
                return value !== null ? value : defaultValue;
            } catch (error) {
                return defaultValue;
            }
        },
        
        removeValue: (key) => {
            try {
                return localStorage.removeItem(key);
            } catch (error) {
                return false;
            }
        },
        
        getAllKeys: () => {
            try {
                return Object.keys(localStorage).filter(key => key.startsWith('sb_'));
            } catch (error) {
                return [];
            }
        }
    };
    
    // 配置选项 - 支持动态加载
    const loadConfig = () => {
        let blacklist;
        try {
            blacklist = JSON.parse(storage.getValue('sb_blacklist', '["greasyfork.org", "github.com"]'));
        } catch (e) {
            blacklist = ['greasyfork.org', 'github.com'];
        }
        
        return {
            enabled: storage.getValue('sb_enabled', 'true') === 'true',
            showTrigger: storage.getValue('sb_show_trigger', 'true') === 'true',
            triggerPosition: storage.getValue('sb_trigger_position', 'top-left'),
            maxBookmarks: parseInt(storage.getValue('sb_max_bookmarks', '20')),
            shortcutKey: storage.getValue('sb_shortcut_key', 'KeyB'),
            blacklist: blacklist,
            autoHideTrigger: storage.getValue('sb_auto_hide_trigger', 'true') === 'true'
        };
    };
    
    const CONFIG = loadConfig();

    
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
        
        .sb-bookmark--color-0 { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .sb-bookmark--color-1 { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .sb-bookmark--color-2 { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .sb-bookmark--color-3 { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
        .sb-bookmark--color-4 { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        
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
        
        /* 性能优化CSS类 */
        .sb-bookmark--dragging-prep {
            cursor: grab !important;
            will-change: transform, left, top;
        }
        
        .sb-bookmark--dragging-active {
            cursor: grabbing !important;
            transform: scale(1.05) !important;
            z-index: 999997 !important;
            transition: none !important;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
        }
        
        .sb-bookmark--updating {
            transition: all 0.2s ease;
        }
        
        .sb-bookmark--hidden {
            opacity: 0;
            pointer-events: none;
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
        <div id="sb-trigger" title="点击添加标签 (${CONFIG.shortcutKey.replace('Key', 'Ctrl+')})
双击打开设置"></div>
        <div id="sb-menu">
            <div class="sb-menu-item" data-action="drag">拖拽移动</div>
            <div class="sb-menu-item" data-action="set-url">设置当前页面</div>
            <div class="sb-menu-item" data-action="set-back">设置后退</div>
            <div class="sb-menu-item" data-action="set-double-back">设置两次后退</div>
            <div class="sb-menu-item" data-action="set-interval" id="sb-interval-menu">两次后退间隔(400ms)</div>
            <div class="sb-menu-item" data-action="edit">修改名称</div>
            <div class="sb-menu-item" data-action="delete">删除标签</div>
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
        <div id="sb-interval-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>设置两次后退间隔时间</h3>
                <input type="number" id="sb-interval-input" placeholder="请输入间隔时间(毫秒)" min="50" max="5000" value="400">
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-interval-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-interval-cancel">取消</button>
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
            <div style="margin-top: 10px; text-align: center; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="sb-btn-secondary" id="sb-export-data" style="flex: 1; min-width: 80px;">导出数据</button>
                <button class="sb-btn-secondary" id="sb-clear-all" style="flex: 1; min-width: 80px;">清空标签</button>
            </div>
        </div>
    `;
    
    // 确保body存在后再添加容器
    const appendContainer = () => {
        if (document.body) {
            document.body.appendChild(container);
        } else {
            // 等待body创建
            const observer = new MutationObserver((mutations, obs) => {
                if (document.body) {
                    obs.disconnect();
                    document.body.appendChild(container);
                }
            });
            observer.observe(document.documentElement, { childList: true });
        }
    };
    
    appendContainer();
    

    // 标签管理器类
    class SimpleBookmarkManager {
        constructor() {
            // 预设5种对视觉友好的颜色
            this.colorPresets = [
                { id: 0, name: '蓝紫色', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
                { id: 1, name: '粉红色', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
                { id: 2, name: '蓝青色', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
                { id: 3, name: '绿青色', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
                { id: 4, name: '橙粉色', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }
            ];
            
            this.bookmarks = [];
            this.currentBookmarkId = null;
            this.storageKey = 'simple-bookmarks-javascript';
            this.isContextMenuOpen = false;
            this.touchStartTime = 0;
            this.longPressTimeout = null;
            this.hasBookmarks = false;
            
            // 预绑定拖拽事件处理函数以避免重复创建
            this.boundDragHandlers = {
                mouseDown: null,
                mouseMove: null,
                mouseUp: null,
                touchStart: null,
                touchMove: null,
                touchEnd: null,
                outsideClick: null,
                keyDown: null
            };
            
            // 防抖存储
            this.saveTimeout = null;
            this.pendingSave = false;
            
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
            // 为非油猴环境创建替代菜单
            this.createAlternativeMenu();
        }
        
        // 创建替代菜单访问方式
        createAlternativeMenu() {
            // 添加双击触发器显示设置的功能
            const trigger = document.getElementById('sb-trigger');
            if (trigger) {
                trigger.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this.toggleSettings();
                });
                trigger.title += '\n双击打开设置';
            }
        }
        
        // 导出标签数据
        exportBookmarks() {
            const data = JSON.stringify(this.bookmarks, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'simplebookmark-data.json';
            a.click();
            URL.revokeObjectURL(url);
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
                    this.hideIntervalModal();
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
            
            // 设置间隔时间
            document.getElementById('sb-interval-confirm').addEventListener('click', () => {
                this.setBookmarkInterval();
            });
            
            document.getElementById('sb-interval-cancel').addEventListener('click', () => {
                this.hideIntervalModal();
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
            
            document.getElementById('sb-export-data').addEventListener('click', () => {
                this.exportBookmarks();
            });
            
            document.getElementById('sb-clear-all').addEventListener('click', () => {
                if (confirm('确定要清空所有标签吗？此操作不可撤销！')) {
                    this.bookmarks = [];
                    this.saveBookmarks(true);
                    this.renderBookmarks(true);
                    this.updateTriggerVisibility();
                    this.hideSettings();
                }
            });
            
            // 全局点击关闭菜单
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#sb-menu') && !e.target.closest('#sb-settings-panel')) {
                    this.hideMenu();
                    this.hideSettings();
                }
            });
            
            // 标签事件委托
            this.setupBookmarkEventDelegation();
            
            // 自动隐藏触发器功能已禁用
        }
        
        setupBookmarkEventDelegation() {
            const container = document.getElementById('sb-container');
            let touchTimer;
            
            // 统一的点击处理
            container.addEventListener('click', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark && !this.isContextMenuOpen) {
                    // 如果元素有onclick属性，让onclick自己处理
                    if (bookmark.hasAttribute('onclick')) {
                        return; // 不阻止事件，让onclick执行
                    }
                    
                    e.stopPropagation();
                    const url = bookmark.getAttribute('data-bookmark-url');
                    this.handleBookmarkClick(url);
                }
            });
            
            // 统一的右键菜单处理
            container.addEventListener('contextmenu', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark) {
                    const id = bookmark.getAttribute('data-bookmark-id');
                    this.showMenu(e, parseInt(id));
                }
            });
            
            // 统一的触摸事件处理
            container.addEventListener('touchstart', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark) {
                    this.touchStartTime = Date.now();
                    const id = bookmark.getAttribute('data-bookmark-id');
                    touchTimer = setTimeout(() => {
                        this.showMenu(e, parseInt(id));
                    }, 1000);
                }
            });
            
            container.addEventListener('touchend', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark && touchTimer) {
                    clearTimeout(touchTimer);
                    const touchDuration = Date.now() - this.touchStartTime;
                    
                    if (touchDuration < 1000 && !this.isContextMenuOpen) {
                        // 如果元素有onclick属性，让onclick自己处理
                        if (bookmark.hasAttribute('onclick')) {
                            return; // 不阻止事件，让onclick执行
                        }
                        
                        const url = bookmark.getAttribute('data-bookmark-url');
                        this.handleBookmarkClick(url);
                    }
                }
            });
            
            container.addEventListener('touchmove', () => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            });
        }
        
        handleBookmarkClick(url) {
            // 特殊URL（back, reload等）已通过onclick属性处理
            // 这里只处理普通URL
            window.location.href = url;
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
            
            storage.setValue('sb_show_trigger', showTrigger.toString());
            storage.setValue('sb_max_bookmarks', maxBookmarks.toString());
            storage.setValue('sb_auto_hide_trigger', autoHide.toString());
            
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
            }
        }
        
        hideEditModal() {
            const modal = document.getElementById('sb-edit-modal');
            modal.classList.remove('show');
            document.getElementById('sb-edit-name').value = '';
        }
        
        showIntervalModal() {
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                // 确保bookmark有doubleBackInterval属性，如果没有则设置默认值
                if (!bookmark.doubleBackInterval) {
                    bookmark.doubleBackInterval = 400;
                }
                document.getElementById('sb-interval-input').value = bookmark.doubleBackInterval;
                const modal = document.getElementById('sb-interval-modal');
                modal.classList.add('show');
                document.getElementById('sb-interval-input').focus();
            }
        }
        
        hideIntervalModal() {
            const modal = document.getElementById('sb-interval-modal');
            modal.classList.remove('show');
            document.getElementById('sb-interval-input').value = '';
        }
        
        showMenu(e, bookmarkId) {
            e.preventDefault();
            e.stopPropagation();
            
            this.currentBookmarkId = bookmarkId;
            this.isContextMenuOpen = true;
            
            // 更新菜单中的间隔时间显示
            const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
            if (bookmark) {
                const intervalMenu = document.getElementById('sb-interval-menu');
                const interval = bookmark.doubleBackInterval || 400;
                intervalMenu.textContent = `两次后退间隔(${interval}ms)`;
            }
            
            const menu = document.getElementById('sb-menu');
            menu.classList.add('show');
            
            const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            
            // 获取菜单的实际尺寸
            const menuRect = menu.getBoundingClientRect();
            const menuWidth = menuRect.width || 150; // 默认最小宽度
            const menuHeight = menuRect.height || 240; // 默认高度（现在6个菜单项）
            
            // 计算最佳位置，确保菜单完全在屏幕内
            let menuX = x;
            let menuY = y;
            
            // 水平位置调整
            if (menuX + menuWidth > window.innerWidth) {
                menuX = window.innerWidth - menuWidth - 10; // 留出10px间距
            }
            if (menuX < 10) {
                menuX = 10;
            }
            
            // 垂直位置调整
            if (menuY + menuHeight > window.innerHeight) {
                menuY = window.innerHeight - menuHeight - 10; // 留出10px间距
            }
            if (menuY < 10) {
                menuY = 10;
            }
            
            menu.style.left = `${menuX}px`;
            menu.style.top = `${menuY}px`;
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
                case 'set-back':
                    this.currentBookmarkId = bookmarkId;
                    this.setBackUrl();
                    this.currentBookmarkId = null;
                    break;
                case 'set-double-back':
                    this.currentBookmarkId = bookmarkId;
                    this.setDoubleBackUrl();
                    this.currentBookmarkId = null;
                    break;
                case 'set-interval':
                    this.currentBookmarkId = bookmarkId;
                    this.showIntervalModal();
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
            
            if (!url) {
                alert('请输入链接地址');
                return;
            }
            
            if (this.bookmarks.length >= CONFIG.maxBookmarks) {
                alert(`最多只能添加 ${CONFIG.maxBookmarks} 个标签`);
                return;
            }
            
            // 计算下一个颜色索引（循环使用）
            const colorIndex = this.bookmarks.length % this.colorPresets.length;
            
            const bookmark = {
                id: Date.now(),
                name: name.substring(0, 10), // 限制长度
                url: url,
                x: 25, // 固定在新增按钮右边（新增按钮宽度约0.5cm = 18.9px）
                y: 5, // 与新增按钮顶部对齐
                domain: url === 'back' ? 'back' : url === 'double-back' ? 'double-back' : new URL(url).hostname,
                doubleBackInterval: 400, // 默认间隔时间400ms
                colorIndex: colorIndex // 颜色索引
            };
            
            this.bookmarks.push(bookmark);
            this.saveBookmarks(true); // 新增标签立即保存
            this.renderBookmarks();
            this.hideAddModal();
            this.updateTriggerVisibility();
        }
        
        editBookmark() {
            const newName = document.getElementById('sb-edit-name').value.trim();
            
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.name = newName.substring(0, 10);
                this.saveBookmarks();
                this.renderBookmarks();
            }
            
            this.hideEditModal();
        }
        
        setBookmarkInterval() {
            const intervalValue = parseInt(document.getElementById('sb-interval-input').value);
            
            if (!intervalValue || intervalValue < 50 || intervalValue > 5000) {
                alert('请输入有效的间隔时间（50-5000毫秒）');
                return;
            }
            
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.doubleBackInterval = intervalValue;
                this.saveBookmarks();
                this.renderBookmarks();
            }
            
            this.hideIntervalModal();
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
                this.saveBookmarks(true); // 删除标签立即保存
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
        
        setBackUrl() {
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.url = 'back';
                bookmark.domain = 'back';
                this.saveBookmarks();
                this.renderBookmarks();
            }
        }
        
        setDoubleBackUrl() {
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.url = 'double-back';
                bookmark.domain = 'double-back';
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
            element.classList.add('dragging', 'sb-bookmark--dragging-prep');
            
            // 创建拖拽状态对象
            const dragState = {
                element: element,
                isDragging: false,
                dragOffset: { x: 0, y: 0 },
                originalPos: null,
                hint: document.getElementById('sb-drag-hint')
            };
            
            // 创建原始位置指示器
            dragState.originalPos = document.createElement('div');
            dragState.originalPos.className = 'sb-bookmark-ghost';
            dragState.originalPos.style.cssText = `
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
            document.getElementById('sb-container').appendChild(dragState.originalPos);
            dragState.hint.classList.add('show');
            
            // 创建并绑定预优化的事件处理函数
            this.createDragHandlers(dragState);
            this.bindDragEvents(dragState);
        }
        
        createDragHandlers(dragState) {
            const { element } = dragState;
            
            // 暂时禁用标签的点击事件
            this.boundDragHandlers.disableClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
            
            this.boundDragHandlers.mouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragState.isDragging = true;
                
                const rect = element.getBoundingClientRect();
                dragState.dragOffset.x = e.clientX - rect.left;
                dragState.dragOffset.y = e.clientY - rect.top;
                
                element.classList.add('sb-bookmark--dragging-active');
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing';
            };
            
            this.boundDragHandlers.mouseMove = (e) => {
                if (dragState.isDragging) {
                    e.preventDefault();
                    this.updateElementPosition(element, e.clientX, e.clientY, dragState.dragOffset);
                }
            };
            
            this.boundDragHandlers.mouseUp = (e) => {
                if (dragState.isDragging) {
                    dragState.isDragging = false;
                    this.finalizeDragPosition(element);
                }
            };
            
            this.boundDragHandlers.touchStart = (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                dragState.isDragging = true;
                
                const rect = element.getBoundingClientRect();
                dragState.dragOffset.x = touch.clientX - rect.left;
                dragState.dragOffset.y = touch.clientY - rect.top;
            };
            
            this.boundDragHandlers.touchMove = (e) => {
                if (dragState.isDragging) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    this.updateElementPosition(element, touch.clientX, touch.clientY, dragState.dragOffset);
                }
            };
            
            this.boundDragHandlers.touchEnd = (e) => {
                if (dragState.isDragging) {
                    dragState.isDragging = false;
                    this.finalizeDragPosition(element);
                }
            };
            
            this.boundDragHandlers.outsideClick = (e) => {
                if (!element.contains(e.target) && !dragState.hint.contains(e.target)) {
                    this.exitDragMode(dragState);
                }
            };
            
            this.boundDragHandlers.keyDown = (e) => {
                if (e.key === 'Escape') {
                    this.exitDragMode(dragState);
                }
            };
        }
        
        updateElementPosition(element, clientX, clientY, dragOffset) {
            const x = clientX - dragOffset.x;
            const y = clientY - dragOffset.y;
            
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            element.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
            element.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
        }
        
        finalizeDragPosition(element) {
            // 使用CSS类优化样式切换
            element.classList.remove('sb-bookmark--dragging-active');
            element.classList.add('sb-bookmark--updating');
            
            // 单次重排
            element.offsetHeight;
            
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            
            // 保存位置
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.x = parseInt(element.style.left);
                bookmark.y = parseInt(element.style.top);
                this.saveBookmarks();
            }
        }
        
        bindDragEvents(dragState) {
            const { element } = dragState;
            
            // 禁用原有的点击功能
            element.style.pointerEvents = 'auto';
            element.addEventListener('click', this.boundDragHandlers.disableClick, true);
            
            // 绑定拖拽事件
            element.addEventListener('mousedown', this.boundDragHandlers.mouseDown);
            element.addEventListener('touchstart', this.boundDragHandlers.touchStart, { passive: false });
            document.addEventListener('mousemove', this.boundDragHandlers.mouseMove);
            document.addEventListener('mouseup', this.boundDragHandlers.mouseUp);
            document.addEventListener('touchmove', this.boundDragHandlers.touchMove, { passive: false });
            document.addEventListener('touchend', this.boundDragHandlers.touchEnd);
            
            // 延迟添加退出事件
            setTimeout(() => {
                document.addEventListener('click', this.boundDragHandlers.outsideClick);
                document.addEventListener('keydown', this.boundDragHandlers.keyDown);
            }, 300);
        }
        
        exitDragMode(dragState) {
            const { element, originalPos, hint } = dragState;
            
            // 使用CSS类批量清除拖拽样式
            element.classList.remove('dragging', 'sb-bookmark--dragging-prep', 'sb-bookmark--dragging-active', 'sb-bookmark--updating');
            
            // 清理UI元素
            if (originalPos) originalPos.remove();
            hint.classList.remove('show');
            
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            
            // 恢复标签点击功能
            element.removeEventListener('click', this.boundDragHandlers.disableClick, true);
            element.style.pointerEvents = '';
            
            // 移除所有事件监听器
            this.unbindDragEvents(element);
            
            // 强制重绘
            element.offsetHeight;
        }
        
        unbindDragEvents(element) {
            element.removeEventListener('mousedown', this.boundDragHandlers.mouseDown);
            element.removeEventListener('touchstart', this.boundDragHandlers.touchStart);
            document.removeEventListener('mousemove', this.boundDragHandlers.mouseMove);
            document.removeEventListener('mouseup', this.boundDragHandlers.mouseUp);
            document.removeEventListener('touchmove', this.boundDragHandlers.touchMove);
            document.removeEventListener('touchend', this.boundDragHandlers.touchEnd);
            document.removeEventListener('click', this.boundDragHandlers.outsideClick);
            document.removeEventListener('keydown', this.boundDragHandlers.keyDown);
        }
        
        renderBookmarks(forceFullRender = false) {
            const container = document.getElementById('sb-container');
            
            if (forceFullRender) {
                // 完全重新渲染（仅在必要时使用）
                this.clearAllBookmarks(container);
                this.bookmarks.forEach(bookmark => {
                    const element = this.createBookmarkElement(bookmark);
                    container.appendChild(element);
                });
            } else {
                // 增量更新（默认模式）
                this.updateBookmarksIncremental(container);
            }
            
            // 验证关键UI元素是否还存在
            const menu = document.getElementById('sb-menu');
            const trigger = document.getElementById('sb-trigger');
            if (!menu || !trigger) {
                // 如果关键元素丢失，重新初始化
                this.init();
            }
        }
        
        clearAllBookmarks(container) {
            // 批量清理所有标签元素
            const existing = container.querySelectorAll('.sb-bookmark');
            if (existing.length === 0) return;
            
            // 批量应用清理样式
            existing.forEach(item => {
                item.style.cssText = 'opacity: 0; will-change: auto; transform: none;';
                item.classList.remove('dragging');
            });
            
            // 单次强制重排
            container.offsetHeight;
            
            // 批量删除
            existing.forEach(item => item.remove());
            
            // 清除容器合成层缓存
            container.style.transform = 'none';
            container.offsetHeight;
            container.style.transform = 'translateZ(0)';
        }
        
        updateBookmarksIncremental(container) {
            const existingElements = new Map();
            const currentElements = container.querySelectorAll('.sb-bookmark');
            
            // 建立现有元素映射
            currentElements.forEach(element => {
                const id = element.getAttribute('data-bookmark-id');
                if (id) existingElements.set(id, element);
            });
            
            const currentBookmarkIds = new Set(this.bookmarks.map(b => b.id.toString()));
            
            // 删除不再存在的标签
            existingElements.forEach((element, id) => {
                if (!currentBookmarkIds.has(id)) {
                    element.classList.add('sb-bookmark--hidden');
                    setTimeout(() => element.remove(), 150);
                }
            });
            
            // 更新或创建标签
            this.bookmarks.forEach(bookmark => {
                const id = bookmark.id.toString();
                const existingElement = existingElements.get(id);
                
                if (existingElement) {
                    // 更新现有元素
                    this.updateBookmarkElement(existingElement, bookmark);
                } else {
                    // 创建新元素
                    const newElement = this.createBookmarkElement(bookmark);
                    container.appendChild(newElement);
                }
            });
        }
        
        updateBookmarkElement(element, bookmark) {
            // 只更新发生变化的属性
            if (element.style.left !== `${bookmark.x}px`) {
                element.style.left = `${bookmark.x}px`;
            }
            if (element.style.top !== `${bookmark.y}px`) {
                element.style.top = `${bookmark.y}px`;
            }
            if (element.textContent !== bookmark.name) {
                element.textContent = bookmark.name;
            }
            if (element.title !== `${bookmark.name}\n${bookmark.url}`) {
                element.title = `${bookmark.name}\n${bookmark.url}`;
            }
            
            // 更新颜色类
            const colorIndex = bookmark.colorIndex !== undefined ? bookmark.colorIndex : 0;
            const expectedColorClass = `sb-bookmark--color-${colorIndex}`;
            if (!element.classList.contains(expectedColorClass)) {
                // 移除旧的颜色类
                for (let i = 0; i < this.colorPresets.length; i++) {
                    element.classList.remove(`sb-bookmark--color-${i}`);
                }
                // 添加新的颜色类
                element.classList.add(expectedColorClass);
            }
            if (element.getAttribute('data-bookmark-url') !== bookmark.url) {
                element.setAttribute('data-bookmark-url', bookmark.url);
                
                // 更新onclick属性
                if (bookmark.url === 'back') {
                    element.setAttribute('onclick', 'history.back()');
                    element.style.cursor = 'pointer';
                } else if (bookmark.url === 'double-back') {
                    const interval = bookmark.doubleBackInterval || 400;
                    element.setAttribute('onclick', `history.back(); setTimeout(() => history.back(), ${interval})`);
                    element.style.cursor = 'pointer';
                } else if (bookmark.url === 'reload') {
                    element.setAttribute('onclick', 'location.reload()');
                    element.style.cursor = 'pointer';
                } else {
                    element.removeAttribute('onclick');
                    element.style.cursor = '';
                }
            }
        }
        
        createBookmarkElement(bookmark) {
            const element = document.createElement('div');
            // 使用颜色索引设置颜色类
            const colorIndex = bookmark.colorIndex !== undefined ? bookmark.colorIndex : 0;
            element.className = `sb-bookmark sb-bookmark--color-${colorIndex}`;
            element.setAttribute('data-bookmark-id', bookmark.id);
            element.setAttribute('data-bookmark-url', bookmark.url);
            element.style.left = `${bookmark.x}px`;
            element.style.top = `${bookmark.y}px`;
            element.textContent = bookmark.name;
            element.title = `${bookmark.name}\n${bookmark.url}`;
            
            // 为特殊URL设置直接的onclick处理
            if (bookmark.url === 'back') {
                element.setAttribute('onclick', 'history.back()');
                element.style.cursor = 'pointer';
            } else if (bookmark.url === 'double-back') {
                const interval = bookmark.doubleBackInterval || 400;
                element.setAttribute('onclick', `history.back(); setTimeout(() => history.back(), ${interval})`);
                element.style.cursor = 'pointer';
            } else if (bookmark.url === 'reload') {
                element.setAttribute('onclick', 'location.reload()');
                element.style.cursor = 'pointer';
            }
            
            return element;
        }
        
        saveBookmarks(immediate = false) {
            if (immediate) {
                // 立即保存
                if (this.saveTimeout) {
                    clearTimeout(this.saveTimeout);
                    this.saveTimeout = null;
                }
                localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
                this.pendingSave = false;
            } else {
                // 防抖保存
                this.pendingSave = true;
                if (this.saveTimeout) {
                    clearTimeout(this.saveTimeout);
                }
                this.saveTimeout = setTimeout(() => {
                    if (this.pendingSave) {
                        localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
                        this.pendingSave = false;
                    }
                    this.saveTimeout = null;
                }, 300); // 300ms防抖延迟
            }
        }
        
        loadBookmarks() {
            const saved = localStorage.getItem(this.storageKey) || '[]';
            try {
                this.bookmarks = JSON.parse(saved);
                // 为现有标签添加默认间隔时间属性和颜色索引
                this.bookmarks.forEach((bookmark, index) => {
                    if (!bookmark.doubleBackInterval) {
                        bookmark.doubleBackInterval = 400;
                    }
                    // 为旧标签分配颜色索引（基于现有顺序）
                    if (bookmark.colorIndex === undefined) {
                        bookmark.colorIndex = index % this.colorPresets.length;
                    }
                });
            } catch (e) {
                this.bookmarks = [];
            }
        }
    }
    

    // 主函数 - 确保DOM就绪后执行
    function main() {
        
        // 确保容器已添加到DOM
        if (!document.getElementById('sb-container')) {
            if (document.body) {
                document.body.appendChild(container);
            } else {
                return; // body不存在就不继续
            }
        }
        
        new SimpleBookmarkManager();
    }
    
    // 等待页面加载完成后初始化
    if (document.readyState != 'loading') {
        main();
    } else {
        document.addEventListener('DOMContentLoaded', main);
    }
    
    
})();
