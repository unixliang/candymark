// ==UserScript==
// @name         CandyMark - 移动端标签导航
// @namespace    https://github.com/unixliang/candymark
// @version      2.0.0
// @description  移动端网页标签导航工具，支持悬浮标签、拖拽移动、本地存储等功能
// @author       unixliang
// @match        *://game.granbluefantasy.jp/*
// @match        *://gbf.game.mbga.jp/*
// @run-at       document-start
// @updateURL    https://unixliang.github.io/candymark/candymark.user.js
// @supportURL   https://github.com/unixliang/candymark/issues
// ==/UserScript==
(function() {
    'use strict';

    // 避免重复执行
    if (window.CandyMarkLoaded) return;
    window.CandyMarkLoaded = true;
    

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
            autoHideTrigger: storage.getValue('sb_auto_hide_trigger', 'true') === 'true',
            bookmarkSize: parseInt(storage.getValue('sb_bookmark_size', '3')),
            bookmarkOpacity: parseInt(storage.getValue('sb_bookmark_opacity', '10')),
            bookmarksVisible: storage.getValue('sb_bookmarks_visible', 'true') === 'true',
            notifyFFJ: storage.getValue('sb_notify_ffj', 'false') === 'true',
            notifyHourglass: storage.getValue('sb_notify_hourglass', 'false') === 'true',
            autoBackTurnEnabled: storage.getValue('sb_auto_back_turn_enabled', 'false') === 'true',
            autoBackTurnCount: parseInt(storage.getValue('sb_auto_back_turn_count', '3')),
            autoBackDropEnabled: storage.getValue('sb_auto_back_drop_enabled', 'false') === 'true',
            autoBackSummonEnabled: storage.getValue('sb_auto_back_summon_enabled', 'false') === 'true',
            autoBackAbilityEnabled: storage.getValue('sb_auto_back_ability_enabled', 'false') === 'true'
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
            width: var(--sb-bookmark-size);
            height: var(--sb-bookmark-size);
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
            font-size: var(--sb-bookmark-font-size);
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
        .sb-bookmark--color-2 { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        .sb-bookmark--color-3 { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .sb-bookmark--color-4 { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
        
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
        
        #sb-add-menu {
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
        
        #sb-add-menu.show {
            display: block;
        }
        
        #sb-config-menu {
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
        
        #sb-config-menu.show {
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
        
        
        @media (max-width: 768px) {
            
            .sb-modal-content {
                width: 95%;
                padding: 20px;
            }
            
            .sb-menu-item {
                padding: 14px 16px;
                font-size: 16px;
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
            display: none !important;
        }
        
        /* 点击动画效果 */
        .sb-bookmark--clicking {
            transform: scale(0.95) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            transition: all 0.1s ease-in-out !important;
        }
        
        .sb-bookmark--click-release {
            transform: scale(1.05) !important;
            transition: all 0.15s ease-out !important;
        }
        
        /* 标签大小调整样式 */
        .sb-size-slider-container {
            padding: 20px 0;
        }
        
        .sb-size-preview {
            text-align: center;
            margin-bottom: 30px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .sb-size-preview-bookmark {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 2px solid #fff;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            color: white;
            font-weight: bold;
            text-align: center;
            line-height: 1.2;
            word-break: break-all;
            overflow: hidden;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            transition: all 0.2s ease;
            /* 默认第3档大小 */
            width: 26.5px;
            height: 26.5px;
            font-size: 14px;
        }
        
        .sb-size-slider-wrapper {
            position: relative;
            margin: 0 10px;
        }
        
        .sb-size-slider-track {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            position: relative;
            cursor: pointer;
        }
        
        .sb-size-slider-thumb {
            width: 20px;
            height: 20px;
            background: #667eea;
            border-radius: 50%;
            position: absolute;
            top: -7px;
            cursor: grab;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            transition: background 0.2s ease;
        }
        
        .sb-size-slider-thumb:hover {
            background: #5a6fd8;
        }
        
        .sb-size-slider-thumb:active {
            cursor: grabbing;
            background: #4f63d2;
        }
        
        .sb-size-slider-marks {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: none;
        }
        
        .sb-size-mark {
            width: 2px;
            height: 12px;
            background: #ccc;
            border-radius: 1px;
            position: relative;
        }
        
        .sb-size-mark:first-child,
        .sb-size-mark:last-child {
            background: #999;
            height: 14px;
        }
        
        .sb-size-mark:nth-child(5n) {
            background: #999;
            height: 10px;
        }
        
        .sb-size-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            font-size: 11px;
            color: #666;
            padding: 0 10px;
        }
        
        .sb-size-labels span {
            width: 20px;
            text-align: center;
            font-weight: 500;
        }
        
        /* 标签透明度调整样式 */
        .sb-opacity-slider-container {
            padding: 20px 0;
        }
        
        .sb-opacity-preview {
            text-align: center;
            margin-bottom: 30px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .sb-opacity-preview-bookmark {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 2px solid #fff;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            color: white;
            font-weight: bold;
            text-align: center;
            line-height: 1.2;
            word-break: break-all;
            overflow: hidden;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            transition: all 0.2s ease;
            width: 26.5px;
            height: 26.5px;
            font-size: 14px;
            opacity: 1;
        }
        
        .sb-opacity-slider-wrapper {
            position: relative;
            margin: 0 10px;
        }
        
        .sb-opacity-slider-track {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            position: relative;
            cursor: pointer;
        }
        
        .sb-opacity-slider-thumb {
            width: 20px;
            height: 20px;
            background: #667eea;
            border-radius: 50%;
            position: absolute;
            top: -7px;
            cursor: grab;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            transition: background 0.2s ease;
        }
        
        .sb-opacity-slider-thumb:hover {
            background: #5a6fd8;
        }
        
        .sb-opacity-slider-thumb:active {
            cursor: grabbing;
            background: #4f63d2;
        }
        
        .sb-opacity-slider-marks {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: none;
        }
        
        .sb-opacity-mark {
            width: 2px;
            height: 12px;
            background: #ccc;
            border-radius: 1px;
            position: relative;
        }
        
        .sb-opacity-mark:first-child,
        .sb-opacity-mark:last-child {
            background: #999;
            height: 14px;
        }
        
        .sb-opacity-mark:nth-child(5n) {
            background: #999;
            height: 10px;
        }
        
        .sb-opacity-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            font-size: 11px;
            color: #666;
            padding: 0 10px;
        }
        
        .sb-opacity-labels span {
            width: 20px;
            text-align: center;
            font-weight: 500;
        }
        
        .sb-drop-notify-options {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin: 20px 0;
        }
        
        .sb-checkbox-item {
            display: flex;
            align-items: center;
            cursor: pointer;
            padding: 8px;
            border-radius: 6px;
            transition: background 0.2s;
            font-size: 16px;
            font-weight: 500;
        }
        
        .sb-checkbox-item:hover {
            background: #f5f5f5;
        }
        
        .sb-checkbox-item input[type="checkbox"] {
            margin-right: 10px;
            width: 16px;
            height: 16px;
            margin-top: 0;
            margin-bottom: 0;
            align-self: center;
            flex-shrink: 0;
        }
        
        /* 数值调节器样式 */
        .sb-number-adjuster {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            margin: 0 10px;
        }
        
        /* 自动后退设置项分行样式 */
        .sb-auto-back-item {
            flex-direction: column;
            align-items: flex-start;
            padding-left: 50px; /* 为勾选框和图标留出空间 */
            position: relative;
            min-height: 60px;
        }
        
        .sb-auto-back-item input[type="checkbox"] {
            position: absolute;
            left: 8px;
            top: 50%;
            transform: translateY(-50%);
            margin: 0;
            z-index: 2; /* 确保勾选框在上层 */
        }
        
        /* 图标垂直居中容器 */
        .sb-auto-back-icon {
            position: absolute;
            left: 36px; /* 增加与勾选框的距离 */
            top: 50%;
            transform: translateY(-50%);
            font-size: 16px;
            z-index: 1; /* 确保图标在下层 */
        }
        
        /* 图标和控制元素容器 */
        .sb-auto-back-main {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        
        .sb-auto-back-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }
        
        .sb-number-adjuster-btn {
            width: 30px !important;
            height: 30px !important;
            min-width: 30px !important;
            min-height: 30px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            transition: background 0.2s;
            user-select: none;
            aspect-ratio: 1 / 1; /* 确保严格的正方形比例 */
            box-sizing: border-box; /* 确保边框和内边距包含在宽高内 */
        }
        
        .sb-number-adjuster-btn:hover {
            background: #5a6fd8;
        }
        
        .sb-number-adjuster-btn:active {
            background: #4f63d2;
        }
        
        .sb-number-adjuster-input {
            width: 50px !important;
            height: 30px !important;
            min-height: 30px !important;
            text-align: center;
            border: 2px solid #e0e0e0;
            border-radius: 4px;
            font-size: 16px;
            font-weight: 500;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 !important;
            margin: 0 !important;
        }
        
        .sb-number-adjuster-input:focus {
            outline: none;
            border-color: #667eea;
        }
    `;
    
    // 标签大小配置 (10档)
    const BOOKMARK_SIZES = [
        { size: '18.9px', fontSize: '10px' },  // 第1档 (0.5cm)
        { size: '22.7px', fontSize: '12px' },  // 第2档 (0.6cm)
        { size: '26.5px', fontSize: '14px' },  // 第3档 (0.7cm)
        { size: '30.2px', fontSize: '16px' },  // 第4档 (0.8cm)
        { size: '34.0px', fontSize: '18px' },  // 第5档 (0.9cm)
        { size: '37.8px', fontSize: '20px' },  // 第6档 (1.0cm)
        { size: '41.6px', fontSize: '22px' },  // 第7档 (1.1cm)
        { size: '45.4px', fontSize: '24px' },  // 第8档 (1.2cm)
        { size: '49.1px', fontSize: '26px' },  // 第9档 (1.3cm)
        { size: '52.9px', fontSize: '28px' }   // 第10档 (1.4cm)
    ];

    // 标签透明度配置 (10档: 0.1-1.0)
    const BOOKMARK_OPACITIES = [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0
    ];

    // 设置CSS变量
    function updateBookmarkSize(sizeLevel) {
        const sizeConfig = BOOKMARK_SIZES[sizeLevel - 1] || BOOKMARK_SIZES[0];
        document.documentElement.style.setProperty('--sb-bookmark-size', sizeConfig.size);
        document.documentElement.style.setProperty('--sb-bookmark-font-size', sizeConfig.fontSize);
    }

    // 设置标签透明度
    function updateBookmarkOpacity(opacityLevel) {
        const opacity = BOOKMARK_OPACITIES[opacityLevel - 1] || BOOKMARK_OPACITIES[9];
        document.documentElement.style.setProperty('--sb-bookmark-opacity', opacity);
        // 更新所有现有标签的透明度
        const bookmarks = document.querySelectorAll('.sb-bookmark');
        bookmarks.forEach(bookmark => {
            bookmark.style.opacity = opacity;
        });
    }

    // 创建样式表
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    
    // 初始化标签大小和透明度
    updateBookmarkSize(CONFIG.bookmarkSize);
    updateBookmarkOpacity(CONFIG.bookmarkOpacity);
    


    // 创建HTML结构
    const container = document.createElement('div');
    container.id = 'sb-container';
    container.innerHTML = `
        <div id="sb-trigger" title="点击添加标签 (${CONFIG.shortcutKey.replace('Key', 'Ctrl+')})"></div>
        <div id="sb-menu">
            <div class="sb-menu-item" data-action="drag">🖱️ 拖拽移动</div>
            <div class="sb-menu-item" data-action="set-url">📍 设置当前页面</div>
            <div class="sb-menu-item" data-action="set-back">⬅️ 设置后退</div>
            <div class="sb-menu-item" data-action="set-double-back">⏪ 设置两次后退</div>
            <div class="sb-menu-item" data-action="set-interval" id="sb-interval-menu">⏱️ 两次后退间隔【400ms】</div>
            <div class="sb-menu-item" data-action="edit">✏️ 修改名称</div>
            <div class="sb-menu-item" data-action="delete">🗑️ 删除标签</div>
            <div class="sb-menu-item" data-action="auto-back-global">🚪 自动后退【全局】</div>
            <div class="sb-menu-item" data-action="drop-notify-global">🔔 掉落通知【全局】</div>
            <div class="sb-menu-item" data-action="cancel">❌ 取消</div>
        </div>
        <div id="sb-add-menu">
            <div class="sb-menu-item" data-action="add-bookmark">➕ 增加标签</div>
            <div class="sb-menu-item" data-action="adjust-size">📏 调整标签大小</div>
            <div class="sb-menu-item" data-action="adjust-opacity">🌓 调整标签透明度</div>
            <div class="sb-menu-item" data-action="auto-back">🚪 自动后退</div>
            <div class="sb-menu-item" data-action="drop-notify">🔔 掉落通知</div>
            <div class="sb-menu-item" data-action="config-management">⚙️ 配置管理</div>
            <div class="sb-menu-item" data-action="cancel-add">❌ 取消</div>
        </div>
        <div id="sb-config-menu">
            <div class="sb-menu-item" data-action="export-to-file">📤 导出到文件</div>
            <div class="sb-menu-item" data-action="export-to-clipboard">📋 导出到剪贴板</div>
            <div class="sb-menu-item" data-action="import-from-file">📥 从文件导入</div>
            <div class="sb-menu-item" data-action="import-from-clipboard">📝 从剪贴板导入</div>
            <div class="sb-menu-item" data-action="config-cancel">❌ 返回</div>
        </div>
        <div id="sb-add-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>新增标签</h3>
                <input type="text" id="sb-name" placeholder="请输入标签名称(可选)" maxlength="10">
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
                <input type="text" id="sb-edit-name" placeholder="请输入新的标签名称(可选)" maxlength="10">
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
        <div id="sb-size-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>调整标签大小</h3>
                <div class="sb-size-slider-container">
                    <div class="sb-size-preview">
                        <div class="sb-size-preview-bookmark" id="sb-size-preview">📏</div>
                    </div>
                    <div class="sb-size-slider-wrapper">
                        <div class="sb-size-slider-track">
                            <div class="sb-size-slider-marks">
                                <div class="sb-size-mark" data-level="1"></div>
                                <div class="sb-size-mark" data-level="2"></div>
                                <div class="sb-size-mark" data-level="3"></div>
                                <div class="sb-size-mark" data-level="4"></div>
                                <div class="sb-size-mark" data-level="5"></div>
                                <div class="sb-size-mark" data-level="6"></div>
                                <div class="sb-size-mark" data-level="7"></div>
                                <div class="sb-size-mark" data-level="8"></div>
                                <div class="sb-size-mark" data-level="9"></div>
                                <div class="sb-size-mark" data-level="10"></div>
                            </div>
                            <div class="sb-size-slider-thumb" id="sb-size-slider-thumb"></div>
                        </div>
                        <div class="sb-size-labels">
                            <span>1</span>
                            <span>2</span>
                            <span>3</span>
                            <span>4</span>
                            <span>5</span>
                            <span>6</span>
                            <span>7</span>
                            <span>8</span>
                            <span>9</span>
                            <span>10</span>
                        </div>
                    </div>
                </div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-size-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-size-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-opacity-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>调整标签透明度</h3>
                <div class="sb-opacity-slider-container">
                    <div class="sb-opacity-preview">
                        <div class="sb-opacity-preview-bookmark" id="sb-opacity-preview">🌓</div>
                    </div>
                    <div class="sb-opacity-slider-wrapper">
                        <div class="sb-opacity-slider-track">
                            <div class="sb-opacity-slider-marks">
                                <div class="sb-opacity-mark" data-level="1"></div>
                                <div class="sb-opacity-mark" data-level="2"></div>
                                <div class="sb-opacity-mark" data-level="3"></div>
                                <div class="sb-opacity-mark" data-level="4"></div>
                                <div class="sb-opacity-mark" data-level="5"></div>
                                <div class="sb-opacity-mark" data-level="6"></div>
                                <div class="sb-opacity-mark" data-level="7"></div>
                                <div class="sb-opacity-mark" data-level="8"></div>
                                <div class="sb-opacity-mark" data-level="9"></div>
                                <div class="sb-opacity-mark" data-level="10"></div>
                            </div>
                            <div class="sb-opacity-slider-thumb" id="sb-opacity-slider-thumb"></div>
                        </div>
                        <div class="sb-opacity-labels">
                            <span>0.1</span>
                            <span>0.2</span>
                            <span>0.3</span>
                            <span>0.4</span>
                            <span>0.5</span>
                            <span>0.6</span>
                            <span>0.7</span>
                            <span>0.8</span>
                            <span>0.9</span>
                            <span>1.0</span>
                        </div>
                    </div>
                </div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-opacity-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-opacity-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-drag-hint" class="sb-drag-hint">
            按住标签拖拽到任意位置，松开鼠标完成移动
        </div>
        <div id="sb-auto-back-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>自动后退设置</h3>
                <div class="sb-drop-notify-options">
                    <label class="sb-checkbox-item sb-auto-back-item">
                        <input type="checkbox" id="sb-auto-back-turn">
                        <div class="sb-auto-back-icon">⚔️</div>
                        <div class="sb-number-adjuster" style="margin-bottom: 4px; margin-top: 8px; margin-left: 20px;">
                            <button class="sb-number-adjuster-btn" id="sb-auto-back-turn-decrease">-</button>
                            <input type="number" id="sb-auto-back-turn-count" class="sb-number-adjuster-input" min="1" max="99" value="3">
                            <button class="sb-number-adjuster-btn" id="sb-auto-back-turn-increase">+</button>
                        </div>
                        <div style="margin-left: 20px;">回合内攻击后</div>
                    </label>
                    <label class="sb-checkbox-item">
                        <input type="checkbox" id="sb-auto-back-drop">
                        🎯 结算后
                    </label>
                    <label class="sb-checkbox-item">
                        <input type="checkbox" id="sb-auto-back-summon">
                        🔮 召唤后
                    </label>
                    <label class="sb-checkbox-item">
                        <input type="checkbox" id="sb-auto-back-ability">
                        ⚡ 技能后
                    </label>
                </div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-auto-back-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-auto-back-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-drop-notify-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>掉落通知设置</h3>
                <div class="sb-drop-notify-options">
                    <label class="sb-checkbox-item">
                        <input type="checkbox" id="sb-notify-ffj">
                        🏅 FFJ
                    </label>
                    <label class="sb-checkbox-item">
                        <input type="checkbox" id="sb-notify-hourglass">
                        ⏳ 沙漏
                    </label>
                </div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-drop-notify-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-drop-notify-cancel">取消</button>
                </div>
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
    class CandyMarkManager {
        constructor() {
            // 预设5种对视觉友好的颜色
            this.colorPresets = [
                { id: 0, name: '蓝紫色', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
                { id: 1, name: '粉红色', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
                { id: 2, name: '橙粉色', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
                { id: 3, name: '蓝青色', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
                { id: 4, name: '绿青色', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }
            ];
            
            this.bookmarks = [];
            this.currentBookmarkId = null;
            this.storageKey = 'candymark-bookmarks-javascript';
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
            
            // 防抖存储 - 优化防抖延迟和立即保存条件
            this.saveTimeout = null;
            this.pendingSave = false;
            this.lastSaveTime = 0;
            
            // 掉落监听间隔
            this.dropCheckInterval = null;
            
            // 优化渲染性能的缓存
            this.bookmarkCache = new Map();
            
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
            // 移除了双击设置功能
        }
        
        // 导出标签数据
        exportBookmarks() {
            const data = JSON.stringify(this.bookmarks, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'candymark-data.json';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        // 导出配置
        exportConfig() {
            const configData = {
                version: '2.0.0',
                exportTime: new Date().toISOString(),
                bookmarks: this.bookmarks,
                settings: {
                    bookmarkSize: CONFIG.bookmarkSize,
                    bookmarkOpacity: CONFIG.bookmarkOpacity,
                    enabled: CONFIG.enabled,
                    showTrigger: CONFIG.showTrigger,
                    maxBookmarks: CONFIG.maxBookmarks,
                    shortcutKey: CONFIG.shortcutKey,
                    blacklist: CONFIG.blacklist,
                    notifyFFJ: CONFIG.notifyFFJ,
                    notifyHourglass: CONFIG.notifyHourglass,
                    bookmarksVisible: CONFIG.bookmarksVisible
                }
            };
            
            const data = JSON.stringify(configData, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'candymark-config.json';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        // 导入配置
        importConfig() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const importedData = JSON.parse(e.target.result);
                            
                            // 仅支持新格式：包含bookmarks和settings的对象
                            if (!importedData || typeof importedData !== 'object' || !importedData.bookmarks) {
                                throw new Error('数据格式不正确：必须是包含bookmarks字段的对象');
                            }
                            
                            const bookmarks = importedData.bookmarks;
                            const settings = importedData.settings || null;
                            
                            // 验证bookmarks数据格式
                            if (!Array.isArray(bookmarks)) {
                                throw new Error('bookmarks必须是数组');
                            }
                            
                            for (let i = 0; i < bookmarks.length; i++) {
                                const bookmark = bookmarks[i];
                                if (!bookmark || typeof bookmark !== 'object') {
                                    throw new Error(`标签数据格式不正确：第${i+1}个标签不是对象`);
                                }
                                if (!bookmark.hasOwnProperty('id')) {
                                    throw new Error(`标签数据格式不正确：第${i+1}个标签缺少id字段`);
                                }
                                if (!bookmark.hasOwnProperty('name')) {
                                    throw new Error(`标签数据格式不正确：第${i+1}个标签缺少name字段`);
                                }
                                if (bookmark.name === null || bookmark.name === undefined) {
                                    bookmark.name = '';
                                }
                                if (!bookmark.hasOwnProperty('url')) {
                                    throw new Error(`标签数据格式不正确：第${i+1}个标签缺少url字段`);
                                }
                                if (bookmark.url === null || bookmark.url === undefined) {
                                    throw new Error(`标签数据格式不正确：第${i+1}个标签的url不能为空`);
                                }
                            }
                            
                            if (confirm('确定要导入配置吗？这将替换现有的所有标签和设置。')) {
                                // 导入标签
                                this.bookmarks = bookmarks;
                                this.saveBookmarks(true);
                                
                                // 如果有设置信息，则导入设置
                                if (settings) {
                                    // 保存设置到localStorage
                                    if (settings.bookmarkSize) {
                                        storage.setValue('sb_bookmark_size', settings.bookmarkSize.toString());
                                        CONFIG.bookmarkSize = settings.bookmarkSize;
                                        updateBookmarkSize(settings.bookmarkSize);
                                    }
                                    if (typeof settings.bookmarkOpacity === 'number' && settings.bookmarkOpacity >= 1 && settings.bookmarkOpacity <= 10) {
                                        storage.setValue('sb_bookmark_opacity', settings.bookmarkOpacity.toString());
                                        CONFIG.bookmarkOpacity = settings.bookmarkOpacity;
                                        updateBookmarkOpacity(settings.bookmarkOpacity);
                                    }
                                    if (settings.enabled !== undefined) {
                                        storage.setValue('sb_enabled', settings.enabled.toString());
                                        CONFIG.enabled = settings.enabled;
                                    }
                                    if (settings.showTrigger !== undefined) {
                                        storage.setValue('sb_show_trigger', settings.showTrigger.toString());
                                        CONFIG.showTrigger = settings.showTrigger;
                                    }
                                    if (settings.maxBookmarks) {
                                        storage.setValue('sb_max_bookmarks', settings.maxBookmarks.toString());
                                        CONFIG.maxBookmarks = settings.maxBookmarks;
                                    }
                                    if (settings.shortcutKey) {
                                        storage.setValue('sb_shortcut_key', settings.shortcutKey);
                                        CONFIG.shortcutKey = settings.shortcutKey;
                                    }
                                    if (settings.blacklist && Array.isArray(settings.blacklist)) {
                                        storage.setValue('sb_blacklist', JSON.stringify(settings.blacklist));
                                        CONFIG.blacklist = settings.blacklist;
                                    }
                                    if (settings.notifyFFJ !== undefined) {
                                        storage.setValue('sb_notify_ffj', settings.notifyFFJ.toString());
                                        CONFIG.notifyFFJ = settings.notifyFFJ;
                                    }
                                    if (settings.notifyHourglass !== undefined) {
                                        storage.setValue('sb_notify_hourglass', settings.notifyHourglass.toString());
                                        CONFIG.notifyHourglass = settings.notifyHourglass;
                                    }
                                    if (settings.bookmarksVisible !== undefined) {
                                        storage.setValue('sb_bookmarks_visible', settings.bookmarksVisible.toString());
                                        CONFIG.bookmarksVisible = settings.bookmarksVisible;
                                    }
                                }
                                
                                updateBookmarkSize(CONFIG.bookmarkSize);
                                updateBookmarkOpacity(CONFIG.bookmarkOpacity);
                                this.renderBookmarks(true);
                                this.updateTriggerVisibility();
                                
                                const message = settings ? '导入成功！标签和设置已更新。' : '导入成功！仅标签数据已更新。';
                                alert(message);
                            }
                        } catch (error) {
                            alert('导入失败：' + error.message);
                        }
                    };
                    reader.readAsText(file);
                }
            });
            input.click();
        }
        
        // 导出到剪贴板
        async exportToClipboard() {
            try {
                const configData = {
                    version: '2.0.0',
                    exportTime: new Date().toISOString(),
                    bookmarks: this.bookmarks,
                    settings: {
                        bookmarkSize: CONFIG.bookmarkSize,
                        bookmarkOpacity: CONFIG.bookmarkOpacity,
                        enabled: CONFIG.enabled,
                        showTrigger: CONFIG.showTrigger,
                        maxBookmarks: CONFIG.maxBookmarks,
                        shortcutKey: CONFIG.shortcutKey,
                        blacklist: CONFIG.blacklist,
                        notifyFFJ: CONFIG.notifyFFJ,
                        notifyHourglass: CONFIG.notifyHourglass,
                        bookmarksVisible: CONFIG.bookmarksVisible,
                        autoBackTurnEnabled: CONFIG.autoBackTurnEnabled,
                        autoBackTurnCount: CONFIG.autoBackTurnCount,
                        autoBackDropEnabled: CONFIG.autoBackDropEnabled
                    }
                };
                
                const data = JSON.stringify(configData, null, 2);
                await navigator.clipboard.writeText(data);
                alert('配置已复制到剪贴板！');
            } catch (error) {
                //console.error('复制到剪贴板失败:', error);
                alert('复制到剪贴板失败，请使用文件导出功能。');
            }
        }
        
        // 从剪贴板导入
        async importFromClipboard() {
            try {
                const clipboardText = await navigator.clipboard.readText();
                if (!clipboardText.trim()) {
                    alert('剪贴板内容为空！');
                    return;
                }
                
                const importedData = JSON.parse(clipboardText);
                
                //console.log('导入的数据:', importedData);
                
                // 仅支持新格式：包含bookmarks和settings的对象
                if (!importedData || typeof importedData !== 'object' || !importedData.bookmarks) {
                    throw new Error('数据格式不正确：必须是包含bookmarks字段的对象');
                }
                
                const bookmarks = importedData.bookmarks;
                const settings = importedData.settings || null;
                
                //console.log('书签数据:', bookmarks);
                
                // 验证导入的数据
                if (!Array.isArray(bookmarks)) {
                    throw new Error('bookmarks必须是数组');
                }
                
                // 验证每个标签的数据结构
                for (let i = 0; i < bookmarks.length; i++) {
                    const bookmark = bookmarks[i];
                    if (!bookmark || typeof bookmark !== 'object') {
                        throw new Error(`第${i + 1}个标签不是有效的对象`);
                    }
                    if (!bookmark.id) {
                        throw new Error(`第${i + 1}个标签缺少 id 字段`);
                    }
                    if (bookmark.name === null || bookmark.name === undefined) {
                        bookmark.name = '';
                    }
                    if (!bookmark.url) {
                        throw new Error(`第${i + 1}个标签缺少 url 字段`);
                    }
                }
                
                if (confirm('确定要导入配置吗？这将替换现有的所有标签和设置。')) {
                    // 导入标签
                    this.bookmarks = bookmarks;
                    this.saveBookmarks(true);
                    
                    // 导入设置（如果有）
                    if (settings) {
                        if (typeof settings.bookmarkSize === 'number' && settings.bookmarkSize > 0) {
                            CONFIG.bookmarkSize = settings.bookmarkSize;
                            storage.setValue('sb_bookmark_size', settings.bookmarkSize.toString());
                        }
                        if (typeof settings.bookmarkOpacity === 'number' && settings.bookmarkOpacity >= 1 && settings.bookmarkOpacity <= 10) {
                            CONFIG.bookmarkOpacity = settings.bookmarkOpacity;
                            storage.setValue('sb_bookmark_opacity', settings.bookmarkOpacity.toString());
                        }
                        if (typeof settings.enabled === 'boolean') {
                            CONFIG.enabled = settings.enabled;
                            storage.setValue('sb_enabled', settings.enabled.toString());
                        }
                        if (typeof settings.showTrigger === 'boolean') {
                            CONFIG.showTrigger = settings.showTrigger;
                            storage.setValue('sb_show_trigger', settings.showTrigger.toString());
                        }
                        if (typeof settings.maxBookmarks === 'number' && settings.maxBookmarks > 0) {
                            CONFIG.maxBookmarks = settings.maxBookmarks;
                            storage.setValue('sb_max_bookmarks', settings.maxBookmarks.toString());
                        }
                        if (typeof settings.shortcutKey === 'string') {
                            CONFIG.shortcutKey = settings.shortcutKey;
                            storage.setValue('sb_shortcut_key', settings.shortcutKey);
                        }
                        if (Array.isArray(settings.blacklist)) {
                            CONFIG.blacklist = settings.blacklist;
                            storage.setValue('sb_blacklist', JSON.stringify(settings.blacklist));
                        }
                        if (typeof settings.notifyFFJ === 'boolean') {
                            CONFIG.notifyFFJ = settings.notifyFFJ;
                            storage.setValue('sb_notify_ffj', settings.notifyFFJ.toString());
                        }
                        if (typeof settings.notifyHourglass === 'boolean') {
                            CONFIG.notifyHourglass = settings.notifyHourglass;
                            storage.setValue('sb_notify_hourglass', settings.notifyHourglass.toString());
                        }
                        if (typeof settings.bookmarksVisible === 'boolean') {
                            CONFIG.bookmarksVisible = settings.bookmarksVisible;
                            storage.setValue('sb_bookmarks_visible', settings.bookmarksVisible.toString());
                        }
                    }
                    
                    // 先更新样式，再重新渲染
                    updateBookmarkSize(CONFIG.bookmarkSize);
                    updateBookmarkOpacity(CONFIG.bookmarkOpacity);
                    this.renderBookmarks(true);
                    this.updateTriggerVisibility();
                    
                    alert('配置导入成功！');
                }
            } catch (error) {
                //console.error('从剪贴板导入失败:', error);
                if (error.name === 'NotAllowedError') {
                    alert('无法访问剪贴板，请检查浏览器权限设置。');
                } else if (error instanceof SyntaxError) {
                    alert('剪贴板内容不是有效的JSON格式！');
                } else {
                    alert('从剪贴板导入失败：' + error.message);
                }
            }
        }
        
        bindEvents() {
            // 触发器长按处理
            let triggerPressTimer = null;
            let isLongPressing = false;
            let longPressCompleted = false;
            
            const triggerElement = document.getElementById('sb-trigger');
            
            const handleTriggerStart = (e) => {
                isLongPressing = false;
                longPressCompleted = false;
                
                // 设置长按定时器 (600ms)
                triggerPressTimer = setTimeout(() => {
                    isLongPressing = true;
                    longPressCompleted = true;
                    this.toggleAllBookmarks();
                }, 600);
            };
            
            const handleTriggerEnd = (e) => {
                if (triggerPressTimer) {
                    clearTimeout(triggerPressTimer);
                    triggerPressTimer = null;
                }
                
                // 如果是长按，阻止click事件
                if (isLongPressing) {
                    e.preventDefault();
                    e.stopPropagation();
                    // 不要立即重置，让click事件也能检测到
                }
            };
            
            const handleTriggerCancel = () => {
                if (triggerPressTimer) {
                    clearTimeout(triggerPressTimer);
                    triggerPressTimer = null;
                }
                isLongPressing = false;
                longPressCompleted = false;
            };
            
            // 绑定鼠标事件
            triggerElement.addEventListener('mousedown', handleTriggerStart);
            triggerElement.addEventListener('mouseup', handleTriggerEnd);
            triggerElement.addEventListener('mouseleave', handleTriggerCancel);
            
            // 绑定触摸事件
            triggerElement.addEventListener('touchstart', handleTriggerStart);
            triggerElement.addEventListener('touchend', handleTriggerEnd);
            triggerElement.addEventListener('touchcancel', handleTriggerCancel);
            
            // 触发器点击 - 只有在没有长按时才触发
            triggerElement.addEventListener('click', (e) => {
                if (longPressCompleted) {
                    e.preventDefault();
                    e.stopPropagation();
                    // 重置状态，延迟一点时间以确保阻止
                    setTimeout(() => {
                        longPressCompleted = false;
                        isLongPressing = false;
                    }, 100);
                    return;
                }
                
                e.stopPropagation();
                this.showAddMenu(e);
            });
            
            // 快捷键支持
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.code === CONFIG.shortcutKey) {
                    e.preventDefault();
                    // 在屏幕中心显示添加菜单
                    const fakeEvent = {
                        clientX: window.innerWidth / 2,
                        clientY: window.innerHeight / 2
                    };
                    this.showAddMenu(fakeEvent);
                }
                
                if (e.key === 'Escape') {
                    this.hideMenu();
                    this.hideAddMenu();
                    this.hideAddModal();
                    this.hideEditModal();
                    this.hideIntervalModal();
                    this.cancelSizeChange();
                    this.cancelOpacityChange();
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
            
            // 标签大小调整
            document.getElementById('sb-size-confirm').addEventListener('click', () => {
                this.confirmSizeChange();
            });
            
            document.getElementById('sb-size-cancel').addEventListener('click', () => {
                this.cancelSizeChange();
            });
            
            // 标签透明度调整
            document.getElementById('sb-opacity-confirm').addEventListener('click', () => {
                this.confirmOpacityChange();
            });
            
            document.getElementById('sb-opacity-cancel').addEventListener('click', () => {
                this.cancelOpacityChange();
            });
            
            // 掉落通知设置
            document.getElementById('sb-drop-notify-confirm').addEventListener('click', () => {
                this.confirmDropNotifyChange();
            });
            
            document.getElementById('sb-drop-notify-cancel').addEventListener('click', () => {
                this.hideDropNotifyModal();
            });

            // 自动后退设置
            document.getElementById('sb-auto-back-confirm').addEventListener('click', () => {
                this.confirmAutoBackChange();
            });
            
            document.getElementById('sb-auto-back-cancel').addEventListener('click', () => {
                this.hideAutoBackModal();
            });
            
            // 监听输入框变化限制，实时验证输入值范围(1-99)
            document.getElementById('sb-auto-back-turn-count').addEventListener('input', (e) => {
                let value = parseInt(e.target.value, 10);
                // 处理NaN情况，当输入非数字字符时不立即纠正，让用户完成输入
                if (isNaN(value)) {
                    return;
                }
                // 限制范围在1-99之间
                if (value < 1) value = 1;
                if (value > 99) value = 99;
                e.target.value = value;
            });
            
            // 失去焦点时确保值有效，处理空值或无效值情况
            document.getElementById('sb-auto-back-turn-count').addEventListener('blur', (e) => {
                let value = parseInt(e.target.value, 10);
                // 处理NaN或空值情况，设置默认值为1
                if (isNaN(value) || value < 1) value = 1;
                if (value > 99) value = 99;
                e.target.value = value;
            });
            
            // 为数值调节器增加事件监听
            document.getElementById('sb-auto-back-turn-decrease').addEventListener('click', () => {
                const input = document.getElementById('sb-auto-back-turn-count');
                let value = parseInt(input.value, 10);
                if (isNaN(value)) value = 4; // 默认值
                value = Math.max(1, value - 1);
                input.value = value;
            });
            
            document.getElementById('sb-auto-back-turn-increase').addEventListener('click', () => {
                const input = document.getElementById('sb-auto-back-turn-count');
                let value = parseInt(input.value, 10);
                if (isNaN(value)) value = 2; // 默认值
                value = Math.min(99, value + 1);
                input.value = value;
            });
            
            // 菜单事件
            document.getElementById('sb-menu').addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action) {
                    this.handleMenuAction(action);
                }
            });
            
            // 添加菜单事件
            document.getElementById('sb-add-menu').addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action) {
                    this.handleAddMenuAction(action);
                }
            });
            
            // 配置菜单事件
            document.getElementById('sb-config-menu').addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action) {
                    this.handleConfigMenuAction(action);
                }
            });
            
            // 全局点击关闭菜单
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#sb-menu') && !e.target.closest('#sb-add-menu') && !e.target.closest('#sb-config-menu') && !e.target.closest('.sb-modal')) {
                    this.hideMenu();
                    this.hideAddMenu();
                    this.hideConfigMenu();
                }
            });
            
            // 标签事件委托
            this.setupBookmarkEventDelegation();
            
            // 自动隐藏触发器功能已禁用
        }
        
        setupBookmarkEventDelegation() {
            const container = document.getElementById('sb-container');
            let touchTimer;
            
            // 统一的点击处理 - 使用被动事件监听器优化性能
            container.addEventListener('click', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark && !this.isContextMenuOpen) {
                    // 触发点击动画
                    this.triggerClickAnimation(bookmark);
                    
                    // 如果元素有onclick属性，让onclick自己处理
                    if (bookmark.hasAttribute('onclick')) {
                        return; // 不阻止事件，让onclick执行
                    }
                    
                    e.stopPropagation();
                    const url = bookmark.getAttribute('data-bookmark-url');
                    this.handleBookmarkClick(url, bookmark);
                }
            }, { passive: true });
            
            // 统一的右键菜单处理
            container.addEventListener('contextmenu', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark) {
                    const id = bookmark.getAttribute('data-bookmark-id');
                    this.showMenu(e, parseInt(id));
                }
            }, { passive: false });
            
            // 统一的触摸事件处理 - 优化触摸事件性能
            container.addEventListener('touchstart', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark) {
                    this.touchStartTime = Date.now();
                    const id = bookmark.getAttribute('data-bookmark-id');
                    touchTimer = setTimeout(() => {
                        this.showMenu(e, parseInt(id));
                    }, 600);
                }
            }, { passive: true });
            
            container.addEventListener('touchend', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark && touchTimer) {
                    clearTimeout(touchTimer);
                    const touchDuration = Date.now() - this.touchStartTime;
                    
                    if (touchDuration < 600 && !this.isContextMenuOpen) {
                        // 触发点击动画
                        this.triggerClickAnimation(bookmark);
                        
                        // 如果元素有onclick属性，让onclick自己处理
                        if (bookmark.hasAttribute('onclick')) {
                            return; // 不阻止事件，让onclick执行
                        }
                        
                        const url = bookmark.getAttribute('data-bookmark-url');
                        this.handleBookmarkClick(url, bookmark);
                    }
                }
            }, { passive: true });
            
            container.addEventListener('touchmove', () => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            }, { passive: true });
        }
        
        handleBookmarkClick(url, element) {
            // 触发点击动画
            this.triggerClickAnimation(element);
            
            // 特殊URL（back, reload等）已通过onclick属性处理
            // 这里只处理普通URL
            window.location.href = url;
        }
        
        triggerClickAnimation(element) {
            // 添加点击动画
            element.classList.add('sb-bookmark--clicking');
            
            // 移除动画类，准备下次动画
            setTimeout(() => {
                element.classList.remove('sb-bookmark--clicking');
                element.classList.add('sb-bookmark--click-release');
                
                setTimeout(() => {
                    element.classList.remove('sb-bookmark--click-release');
                }, 150);
            }, 100);
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
        
        toggleAllBookmarks() {
            CONFIG.bookmarksVisible = !CONFIG.bookmarksVisible;
            storage.setValue('sb_bookmarks_visible', CONFIG.bookmarksVisible ? 'true' : 'false');
            
            const bookmarks = document.querySelectorAll('.sb-bookmark');
            bookmarks.forEach(bookmark => {
                if (CONFIG.bookmarksVisible) {
                    bookmark.classList.remove('sb-bookmark--hidden');
                } else {
                    bookmark.classList.add('sb-bookmark--hidden');
                }
            });
        }
        
        showAddMenu(e) {
            const menu = document.getElementById('sb-add-menu');
            menu.classList.add('show');
            
            const x = e.clientX || 0;
            const y = e.clientY || 0;
            
            // 获取菜单的实际尺寸
            const menuRect = menu.getBoundingClientRect();
            const menuWidth = menuRect.width || 150;
            const menuHeight = menuRect.height || 80;
            
            // 计算最佳位置，确保菜单完全在屏幕内
            let menuX = x;
            let menuY = y;
            
            // 水平位置调整
            if (menuX + menuWidth > window.innerWidth) {
                menuX = window.innerWidth - menuWidth - 10;
            }
            if (menuX < 10) {
                menuX = 10;
            }
            
            // 垂直位置调整
            if (menuY + menuHeight > window.innerHeight) {
                menuY = window.innerHeight - menuHeight - 10;
            }
            if (menuY < 10) {
                menuY = 10;
            }
            
            // 使用transform优化菜单定位性能
            menu.style.transform = `translate(${menuX}px, ${menuY}px)`;
            menu.style.left = '0';
            menu.style.top = '0';
        }
        
        hideAddMenu() {
            const menu = document.getElementById('sb-add-menu');
            menu.classList.remove('show');
            // 重置transform以避免累积变换
            menu.style.transform = '';
        }
        
        showConfigMenu() {
            this.hideAddMenu();
            const menu = document.getElementById('sb-config-menu');
            const triggerRect = document.getElementById('sb-trigger').getBoundingClientRect();
            
            // 使用transform优化菜单定位性能
            menu.style.transform = `translate(${triggerRect.left}px, ${triggerRect.bottom + 5}px)`;
            menu.style.left = '0';
            menu.style.top = '0';
            menu.classList.add('show');
        }
        
        hideConfigMenu() {
            const menu = document.getElementById('sb-config-menu');
            menu.classList.remove('show');
            // 重置transform以避免累积变换
            menu.style.transform = '';
        }
        
        handleConfigMenuAction(action) {
            this.hideConfigMenu();
            
            switch (action) {
                case 'export-to-file':
                    this.exportConfig();
                    break;
                case 'export-to-clipboard':
                    this.exportToClipboard();
                    break;
                case 'import-from-file':
                    this.importConfig();
                    break;
                case 'import-from-clipboard':
                    this.importFromClipboard();
                    break;
                case 'config-cancel':
                    this.showAddMenu();
                    break;
            }
        }
        
        handleAddMenuAction(action) {
            this.hideAddMenu();
            
            switch (action) {
                case 'add-bookmark':
                    this.showAddModal();
                    break;
                case 'adjust-size':
                    this.showSizeModal();
                    break;
                case 'adjust-opacity':
                    this.showOpacityModal();
                    break;
                case 'auto-back':
                    this.showAutoBackModal();
                    break;
                case 'drop-notify':
                    this.showDropNotifyModal();
                    break;
                case 'config-management':
                    this.showConfigMenu();
                    break;
                case 'cancel-add':
                    // 什么都不做，只是关闭菜单
                    break;
            }
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
                // 保存当前要编辑的标签ID到modal的data属性中
                document.getElementById('sb-edit-modal').setAttribute('data-bookmark-id', this.currentBookmarkId);
                const modal = document.getElementById('sb-edit-modal');
                modal.classList.add('show');
            }
        }
        
        hideEditModal() {
            const modal = document.getElementById('sb-edit-modal');
            modal.classList.remove('show');
            modal.removeAttribute('data-bookmark-id');
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
        
        showSizeModal() {
            const modal = document.getElementById('sb-size-modal');
            modal.classList.add('show');
            
            // 保存原始大小用于取消时恢复
            this.originalSizeLevel = CONFIG.bookmarkSize;
            
            // 初始化滑动条位置
            this.currentSizeLevel = CONFIG.bookmarkSize;
            this.initSizeSlider();
            this.updateSizePreview(this.currentSizeLevel);
        }
        
        hideSizeModal() {
            const modal = document.getElementById('sb-size-modal');
            modal.classList.remove('show');
            this.cleanupSizeSlider();
        }
        
        initSizeSlider() {
            this.sliderDragging = false;
            const track = document.querySelector('.sb-size-slider-track');
            const thumb = document.getElementById('sb-size-slider-thumb');
            
            if (!track || !thumb) return;
            
            // 设置初始位置
            const trackWidth = track.offsetWidth - thumb.offsetWidth;
            const position = ((this.currentSizeLevel - 1) / 9) * trackWidth;
            thumb.style.left = `${position}px`;
            
            // 绑定事件
            thumb.addEventListener('mousedown', this.startSizeSliderDrag.bind(this));
            track.addEventListener('click', this.handleSizeSliderClick.bind(this));
            document.addEventListener('mousemove', this.handleSizeSliderMove.bind(this));
            document.addEventListener('mouseup', this.endSizeSliderDrag.bind(this));
            
            // 触摸事件支持
            thumb.addEventListener('touchstart', this.startSizeSliderDrag.bind(this), { passive: false });
            track.addEventListener('touchstart', this.handleSizeSliderClick.bind(this), { passive: false });
            document.addEventListener('touchmove', this.handleSizeSliderMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.endSizeSliderDrag.bind(this));
        }
        
        cleanupSizeSlider() {
            const thumb = document.getElementById('sb-size-slider-thumb');
            const track = document.querySelector('.sb-size-slider-track');
            
            if (thumb) {
                thumb.removeEventListener('mousedown', this.startSizeSliderDrag.bind(this));
                thumb.removeEventListener('touchstart', this.startSizeSliderDrag.bind(this));
            }
            if (track) {
                track.removeEventListener('click', this.handleSizeSliderClick.bind(this));
                track.removeEventListener('touchstart', this.handleSizeSliderClick.bind(this));
            }
            document.removeEventListener('mousemove', this.handleSizeSliderMove.bind(this));
            document.removeEventListener('mouseup', this.endSizeSliderDrag.bind(this));
            document.removeEventListener('touchmove', this.handleSizeSliderMove.bind(this));
            document.removeEventListener('touchend', this.endSizeSliderDrag.bind(this));
        }
        
        startSizeSliderDrag(e) {
            e.preventDefault();
            this.sliderDragging = true;
            const thumb = document.getElementById('sb-size-slider-thumb');
            if (thumb) {
                thumb.style.cursor = 'grabbing';
            }
        }
        
        endSizeSliderDrag(e) {
            this.sliderDragging = false;
            const thumb = document.getElementById('sb-size-slider-thumb');
            if (thumb) {
                thumb.style.cursor = 'grab';
            }
        }
        
        handleSizeSliderClick(e) {
            if (e.target.closest('#sb-size-slider-thumb')) return;
            
            const track = document.querySelector('.sb-size-slider-track');
            const thumb = document.getElementById('sb-size-slider-thumb');
            if (!track || !thumb) return;
            
            const rect = track.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const x = clientX - rect.left;
            
            this.updateSliderPosition(x, track, thumb);
        }
        
        handleSizeSliderMove(e) {
            if (!this.sliderDragging) return;
            
            const track = document.querySelector('.sb-size-slider-track');
            const thumb = document.getElementById('sb-size-slider-thumb');
            if (!track || !thumb) return;
            
            const rect = track.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const x = clientX - rect.left;
            
            this.updateSliderPosition(x, track, thumb);
        }
        
        updateSliderPosition(x, track, thumb) {
            const trackWidth = track.offsetWidth - thumb.offsetWidth;
            
            // 计算最接近的档位 (1-10)
            const percentage = Math.max(0, Math.min(x - thumb.offsetWidth / 2, trackWidth)) / trackWidth;
            const sizeLevel = Math.round(percentage * 9) + 1;
            
            // 将滑块精确定位到对应档位
            const targetPosition = ((sizeLevel - 1) / 9) * trackWidth;
            thumb.style.left = `${targetPosition}px`;
            
            if (sizeLevel !== this.currentSizeLevel) {
                this.currentSizeLevel = sizeLevel;
                this.updateSizePreview(sizeLevel);
                updateBookmarkSize(sizeLevel); // 实时更新所有标签大小
            }
        }
        
        updateSizePreview(sizeLevel) {
            const preview = document.getElementById('sb-size-preview');
            if (!preview) return;
            
            const sizeConfig = BOOKMARK_SIZES[sizeLevel - 1] || BOOKMARK_SIZES[0];
            preview.style.width = sizeConfig.size;
            preview.style.height = sizeConfig.size;
            preview.style.fontSize = sizeConfig.fontSize;
        }
        
        confirmSizeChange() {
            // 保存大小设置
            CONFIG.bookmarkSize = this.currentSizeLevel;
            storage.setValue('sb_bookmark_size', this.currentSizeLevel.toString());
            
            // 标记为已确认，避免hideSizeModal恢复原大小
            this.originalSizeLevel = this.currentSizeLevel;
            
            this.hideSizeModal();
        }
        
        cancelSizeChange() {
            const modal = document.getElementById('sb-size-modal');
            if (!modal.classList.contains('show')) {
                return; // 如果面板没有打开，直接返回
            }
            
            // 强制恢复原始大小
            if (this.originalSizeLevel) {
                updateBookmarkSize(this.originalSizeLevel);
                this.currentSizeLevel = this.originalSizeLevel;
            }
            
            this.hideSizeModal();
        }
        
        // 透明度调整相关方法
        showOpacityModal() {
            const modal = document.getElementById('sb-opacity-modal');
            modal.classList.add('show');
            
            // 保存原始透明度用于取消时恢复
            this.originalOpacityLevel = CONFIG.bookmarkOpacity;
            
            // 初始化滑动条位置
            this.currentOpacityLevel = CONFIG.bookmarkOpacity;
            this.initOpacitySlider();
            this.updateOpacityPreview(this.currentOpacityLevel);
        }
        
        hideOpacityModal() {
            const modal = document.getElementById('sb-opacity-modal');
            modal.classList.remove('show');
            this.cleanupOpacitySlider();
        }
        
        initOpacitySlider() {
            this.opacitySliderDragging = false;
            const track = document.querySelector('.sb-opacity-slider-track');
            const thumb = document.getElementById('sb-opacity-slider-thumb');
            
            if (!track || !thumb) return;
            
            // 设置初始位置
            const trackWidth = track.offsetWidth - thumb.offsetWidth;
            const position = ((this.currentOpacityLevel - 1) / 9) * trackWidth;
            thumb.style.left = `${position}px`;
            
            // 绑定事件
            thumb.addEventListener('mousedown', this.startOpacitySliderDrag.bind(this));
            track.addEventListener('click', this.handleOpacitySliderClick.bind(this));
            document.addEventListener('mousemove', this.handleOpacitySliderMove.bind(this));
            document.addEventListener('mouseup', this.endOpacitySliderDrag.bind(this));
            
            // 触摸事件支持
            thumb.addEventListener('touchstart', this.startOpacitySliderDrag.bind(this), { passive: false });
            track.addEventListener('touchstart', this.handleOpacitySliderClick.bind(this), { passive: false });
            document.addEventListener('touchmove', this.handleOpacitySliderMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.endOpacitySliderDrag.bind(this));
        }
        
        cleanupOpacitySlider() {
            const thumb = document.getElementById('sb-opacity-slider-thumb');
            const track = document.querySelector('.sb-opacity-slider-track');
            
            if (thumb) {
                thumb.removeEventListener('mousedown', this.startOpacitySliderDrag.bind(this));
                thumb.removeEventListener('touchstart', this.startOpacitySliderDrag.bind(this));
            }
            if (track) {
                track.removeEventListener('click', this.handleOpacitySliderClick.bind(this));
                track.removeEventListener('touchstart', this.handleOpacitySliderClick.bind(this));
            }
            document.removeEventListener('mousemove', this.handleOpacitySliderMove.bind(this));
            document.removeEventListener('mouseup', this.endOpacitySliderDrag.bind(this));
            document.removeEventListener('touchmove', this.handleOpacitySliderMove.bind(this));
            document.removeEventListener('touchend', this.endOpacitySliderDrag.bind(this));
        }
        
        startOpacitySliderDrag(e) {
            e.preventDefault();
            this.opacitySliderDragging = true;
            const thumb = document.getElementById('sb-opacity-slider-thumb');
            if (thumb) {
                thumb.style.cursor = 'grabbing';
            }
        }
        
        endOpacitySliderDrag(e) {
            this.opacitySliderDragging = false;
            const thumb = document.getElementById('sb-opacity-slider-thumb');
            if (thumb) {
                thumb.style.cursor = 'grab';
            }
        }
        
        handleOpacitySliderClick(e) {
            if (e.target.closest('#sb-opacity-slider-thumb')) return;
            
            const track = document.querySelector('.sb-opacity-slider-track');
            const thumb = document.getElementById('sb-opacity-slider-thumb');
            if (!track || !thumb) return;
            
            const rect = track.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const x = clientX - rect.left;
            
            this.updateOpacitySliderPosition(x, track, thumb);
        }
        
        handleOpacitySliderMove(e) {
            if (!this.opacitySliderDragging) return;
            
            const track = document.querySelector('.sb-opacity-slider-track');
            const thumb = document.getElementById('sb-opacity-slider-thumb');
            if (!track || !thumb) return;
            
            const rect = track.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const x = clientX - rect.left;
            
            this.updateOpacitySliderPosition(x, track, thumb);
        }
        
        updateOpacitySliderPosition(x, track, thumb) {
            const trackWidth = track.offsetWidth - thumb.offsetWidth;
            
            // 计算最接近的档位 (1-10)
            const percentage = Math.max(0, Math.min(x - thumb.offsetWidth / 2, trackWidth)) / trackWidth;
            const opacityLevel = Math.round(percentage * 9) + 1;
            
            // 将滑块精确定位到对应档位
            const targetPosition = ((opacityLevel - 1) / 9) * trackWidth;
            thumb.style.left = `${targetPosition}px`;
            
            if (opacityLevel !== this.currentOpacityLevel) {
                this.currentOpacityLevel = opacityLevel;
                this.updateOpacityPreview(opacityLevel);
                updateBookmarkOpacity(opacityLevel); // 实时更新所有标签透明度
            }
        }
        
        updateOpacityPreview(opacityLevel) {
            const preview = document.getElementById('sb-opacity-preview');
            if (!preview) return;
            
            const opacity = BOOKMARK_OPACITIES[opacityLevel - 1] || BOOKMARK_OPACITIES[9];
            preview.style.opacity = opacity;
        }
        
        confirmOpacityChange() {
            // 保存透明度设置
            CONFIG.bookmarkOpacity = this.currentOpacityLevel;
            storage.setValue('sb_bookmark_opacity', this.currentOpacityLevel.toString());
            
            // 标记为已确认，避免hideOpacityModal恢复原透明度
            this.originalOpacityLevel = this.currentOpacityLevel;
            
            this.hideOpacityModal();
        }
        
        cancelOpacityChange() {
            const modal = document.getElementById('sb-opacity-modal');
            if (!modal.classList.contains('show')) {
                return; // 如果面板没有打开，直接返回
            }
            
            // 强制恢复原始透明度
            if (this.originalOpacityLevel) {
                updateBookmarkOpacity(this.originalOpacityLevel);
                this.currentOpacityLevel = this.originalOpacityLevel;
            }
            
            this.hideOpacityModal();
        }
        
        // 掉落通知设置相关方法
        showDropNotifyModal() {
            const modal = document.getElementById('sb-drop-notify-modal');
            modal.classList.add('show');
            
            // 设置当前选项状态
            const ffjCheckbox = document.getElementById('sb-notify-ffj');
            const hourglassCheckbox = document.getElementById('sb-notify-hourglass');
            
            if (ffjCheckbox) {
                ffjCheckbox.checked = CONFIG.notifyFFJ;
            }
            if (hourglassCheckbox) {
                hourglassCheckbox.checked = CONFIG.notifyHourglass;
            }
        }
        
        hideDropNotifyModal() {
            const modal = document.getElementById('sb-drop-notify-modal');
            modal.classList.remove('show');
        }
        
        // 自动后退设置相关方法
        showAutoBackModal() {
            this.hideAddMenu();
            const modal = document.getElementById('sb-auto-back-modal');
            modal.classList.add('show');
            
            // 设置当前选项状态
            const turnCheckbox = document.getElementById('sb-auto-back-turn');
            const dropCheckbox = document.getElementById('sb-auto-back-drop');
            const summonCheckbox = document.getElementById('sb-auto-back-summon');
            const abilityCheckbox = document.getElementById('sb-auto-back-ability');
            const turnCount = document.getElementById('sb-auto-back-turn-count');
            
            if (turnCheckbox) {
                turnCheckbox.checked = CONFIG.autoBackTurnEnabled;
                turnCount.value = CONFIG.autoBackTurnCount;
            }
            if (dropCheckbox) {
                dropCheckbox.checked = CONFIG.autoBackDropEnabled;
            }
            if (summonCheckbox) {
                summonCheckbox.checked = CONFIG.autoBackSummonEnabled;
            }
            if (abilityCheckbox) {
                abilityCheckbox.checked = CONFIG.autoBackAbilityEnabled;
            }
        }
        
        hideAutoBackModal() {
            const modal = document.getElementById('sb-auto-back-modal');
            modal.classList.remove('show');
        }
        
        confirmAutoBackChange() {
            const turnCheckbox = document.getElementById('sb-auto-back-turn');
            const dropCheckbox = document.getElementById('sb-auto-back-drop');
            const summonCheckbox = document.getElementById('sb-auto-back-summon');
            const abilityCheckbox = document.getElementById('sb-auto-back-ability');
            const turnCountInput = document.getElementById('sb-auto-back-turn-count');
            
            // 更新配置
            CONFIG.autoBackTurnEnabled = turnCheckbox ? turnCheckbox.checked : false;
            CONFIG.autoBackDropEnabled = dropCheckbox ? dropCheckbox.checked : false;
            CONFIG.autoBackSummonEnabled = summonCheckbox ? summonCheckbox.checked : false;
            CONFIG.autoBackAbilityEnabled = abilityCheckbox ? abilityCheckbox.checked : false;
            
            // 验证并清理输入值，确保在有效范围(1-99)内
            let turnCount = parseInt(turnCountInput.value, 10);
            if (isNaN(turnCount) || turnCount < 1) {
                turnCount = 1;
            } else if (turnCount > 99) {
                turnCount = 99;
            }
            CONFIG.autoBackTurnCount = turnCount;
            
            // 保存到存储
            storage.setValue('sb_auto_back_turn_enabled', CONFIG.autoBackTurnEnabled.toString());
            storage.setValue('sb_auto_back_turn_count', CONFIG.autoBackTurnCount.toString());
            storage.setValue('sb_auto_back_drop_enabled', CONFIG.autoBackDropEnabled.toString());
            storage.setValue('sb_auto_back_summon_enabled', CONFIG.autoBackSummonEnabled.toString());
            storage.setValue('sb_auto_back_ability_enabled', CONFIG.autoBackAbilityEnabled.toString());
            
            this.hideAutoBackModal();
            //console.log(`✅ [CandyMark] 自动后退设置已更新：攻击=${CONFIG.autoBackTurnEnabled}(TURN≥${CONFIG.autoBackTurnCount})，结算=${CONFIG.autoBackDropEnabled}，召唤=${CONFIG.autoBackSummonEnabled}，技能=${CONFIG.autoBackAbilityEnabled}`);
        }
        
        confirmDropNotifyChange() {
            const ffjCheckbox = document.getElementById('sb-notify-ffj');
            const hourglassCheckbox = document.getElementById('sb-notify-hourglass');
            
            // 更新配置
            CONFIG.notifyFFJ = ffjCheckbox ? ffjCheckbox.checked : false;
            CONFIG.notifyHourglass = hourglassCheckbox ? hourglassCheckbox.checked : false;
            
            // 保存到存储
            storage.setValue('sb_notify_ffj', CONFIG.notifyFFJ.toString());
            storage.setValue('sb_notify_hourglass', CONFIG.notifyHourglass.toString());
            
            this.hideDropNotifyModal();
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
                intervalMenu.textContent = `⏱️ 两次后退间隔【${interval}ms】`;
            }
            
            const menu = document.getElementById('sb-menu');
            menu.classList.add('show');
            
            const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            
            // 获取菜单的实际尺寸 - 缓存尺寸以避免重复计算
            const menuRect = menu.getBoundingClientRect();
            const menuWidth = menuRect.width || 150; // 默认最小宽度
            const menuHeight = menuRect.height || 350; // 默认高度（现在10个菜单项）
            
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
            
            // 使用transform优化菜单定位性能
            menu.style.transform = `translate(${menuX}px, ${menuY}px)`;
            menu.style.left = '0';
            menu.style.top = '0';
        }
        
        hideMenu() {
            const menu = document.getElementById('sb-menu');
            menu.classList.remove('show');
            // 重置transform以避免累积变换
            menu.style.transform = '';
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
                case 'auto-back-global':
                    this.showAutoBackModal();
                    break;
                case 'drop-notify-global':
                    this.showDropNotifyModal();
                    break;
                case 'cancel':
                    // 什么都不做，只是关闭菜单
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
            
            // 从modal的data属性中获取要编辑的标签ID
            const bookmarkId = parseInt(document.getElementById('sb-edit-modal').getAttribute('data-bookmark-id'));
            const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
            if (bookmark) {
                bookmark.name = newName.substring(0, 10);
                this.saveBookmarks();
                this.renderBookmarks(true); // Force full re-render to ensure changes are applied
            }
            
            this.hideEditModal();
            this.currentBookmarkId = null; // Clear the current bookmark ID after editing
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
            
            // 创建原始位置指示器 - 优化创建过程
            if (!dragState.originalPos) {
                dragState.originalPos = document.createElement('div');
                dragState.originalPos.className = 'sb-bookmark-ghost';
                dragState.originalPos.style.cssText = `
                    position: absolute;
                    width: 0.5cm;
                    height: 0.5cm;
                    border: 2px dashed rgba(102, 126, 234, 0.5);
                    border-radius: 8px;
                    background: rgba(102, 126, 234, 0.1);
                    pointer-events: none;
                    z-index: 999996;
                    left: ${element.style.left};
                    top: ${element.style.top};
                `;
                document.getElementById('sb-container').appendChild(dragState.originalPos);
            }
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
            if (originalPos) {
                originalPos.remove();
                // 清理引用以避免内存泄漏
                dragState.originalPos = null;
            }
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
            
            // 更新或创建标签 - 使用缓存优化
            this.bookmarks.forEach(bookmark => {
                const id = bookmark.id.toString();
                const existingElement = existingElements.get(id);
                
                // 检查缓存是否需要更新
                const cachedBookmark = this.bookmarkCache.get(id);
                const needsUpdate = !cachedBookmark || 
                    cachedBookmark.x !== bookmark.x || 
                    cachedBookmark.y !== bookmark.y || 
                    cachedBookmark.name !== bookmark.name || 
                    cachedBookmark.url !== bookmark.url ||
                    cachedBookmark.colorIndex !== bookmark.colorIndex;
                
                if (existingElement && !needsUpdate) {
                    // 无变化，跳过更新
                    return;
                }
                
                if (existingElement) {
                    // 更新现有元素
                    this.updateBookmarkElement(existingElement, bookmark);
                } else {
                    // 创建新元素
                    const newElement = this.createBookmarkElement(bookmark);
                    container.appendChild(newElement);
                }
                
                // 更新缓存
                this.bookmarkCache.set(id, {...bookmark});
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
            
            // 更新透明度
            const expectedOpacity = BOOKMARK_OPACITIES[CONFIG.bookmarkOpacity - 1] || BOOKMARK_OPACITIES[9];
            if (parseFloat(element.style.opacity) !== expectedOpacity) {
                element.style.opacity = expectedOpacity;
            }
            
            // 更新可见性状态
            if (CONFIG.bookmarksVisible) {
                element.classList.remove('sb-bookmark--hidden');
            } else {
                element.classList.add('sb-bookmark--hidden');
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
            
            // 应用当前透明度设置
            const opacity = BOOKMARK_OPACITIES[CONFIG.bookmarkOpacity - 1] || BOOKMARK_OPACITIES[9];
            element.style.opacity = opacity;
            
            // 应用可见性状态
            if (!CONFIG.bookmarksVisible) {
                element.classList.add('sb-bookmark--hidden');
            }
            
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
            const now = Date.now();
            // 如果距离上次保存不足100ms，且不是立即保存，则跳过
            if (!immediate && now - this.lastSaveTime < 100) {
                return;
            }
            
            if (immediate) {
                // 立即保存
                if (this.saveTimeout) {
                    clearTimeout(this.saveTimeout);
                    this.saveTimeout = null;
                }
                localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
                this.pendingSave = false;
                this.lastSaveTime = now;
            } else {
                // 防抖保存 - 减少延迟到150ms
                this.pendingSave = true;
                if (this.saveTimeout) {
                    clearTimeout(this.saveTimeout);
                }
                this.saveTimeout = setTimeout(() => {
                    if (this.pendingSave) {
                        localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
                        this.pendingSave = false;
                        this.lastSaveTime = Date.now();
                    }
                    this.saveTimeout = null;
                }, 150); // 150ms防抖延迟
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
                // 初始化缓存
                this.bookmarkCache.clear();
                this.bookmarks.forEach(bookmark => {
                    this.bookmarkCache.set(bookmark.id.toString(), {...bookmark});
                });
            } catch (e) {
                this.bookmarks = [];
                this.bookmarkCache.clear();
            }
        }
    }
    
    // 游戏检测中心
    class GameDetector {
        constructor() {
            this.dropCheckInterval = null;
            this.resultMultiRegex = /https?:\/\/((game\.granbluefantasy)|(gbf\.game\.mbga))\.jp\/.*#(result_multi|result)\/(?!detail)[0-9]*/;
            this.previousTurn = null;
            this.turnChangeCallback = null;
            this.battleData = {
                currentTurn: 0,
                maxTurn: 0,
                startTime: null,
                lastUpdateTime: null
            };
            this.autoBackAfterDropCheck = {
                enabled: true, // 新功能开关
                lastProcessed: {
                    url: '',
                    timestamp: 0
                },
                timeoutId: null // 清理用
            };
            this.init();
        }
        
        init() {
            this.setupUrlMonitoring();
            
            // 页面加载时检查一次（处理直接刷新到掉落页面的情况）
            this.checkAndStartDetection();
        }
        
        setupUrlMonitoring() {
            // 监听hashchange事件
            window.addEventListener('hashchange', () => {
                this.checkAndStartDetection();
            });
            
            // 监听游戏数据更新，模拟Chrome-Extension-Tarou的做法
            this.monitorGameData();
        }
        
        checkAndStartDetection() {
            // 先停止之前的检测
            if (this.dropCheckInterval) {
                clearInterval(this.dropCheckInterval);
                this.dropCheckInterval = null;
            }
            
            // 检查是否匹配掉落页面
            if (window.location.href.match(this.resultMultiRegex)) {
                this.startDropDetection();
            }
        }

        /**
         * TURN计数变化回调系统 - 参照Chrome-Extension-Tarou的做法
         * 监听战斗数据变化并记录TURN计数的变化
         */
        monitorGameData() {
            const self = this;
            
            // 监控战斗API调用，类似Chrome-Extension的/dataCenter.ts中的做法
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const url = args[0];
                let promise = originalFetch.apply(this, args);
                
                // 检查是否是战斗相关的API调用
                if (url && (url.includes('/raid/') || url.includes('/multiraid/'))) {
                    promise = promise.then(response => {
                        // 创建新的响应以便我们能读取内容
                        const clonedResponse = response.clone();
                        clonedResponse.json().then(data => {
                            self.handleGameResponse(data, url);
                        }).catch(() => {
                            // 非JSON响应，忽略
                        });
                        return response;
                    });
                }
                
                return promise;
            };

            // 同时监控XHR请求，覆盖更多场景
            const originalXHRSend = XMLHttpRequest.prototype.send;
            const originalXHROpen = XMLHttpRequest.prototype.open;
            
            XMLHttpRequest.prototype.open = function(method, url) {
                this._url = url;
                return originalXHROpen.apply(this, arguments);
            };
            
            XMLHttpRequest.prototype.send = function(...args) {
                this.addEventListener('readystatechange', () => {
                    if (this.readyState === 4 && this._url) {
                        const url = this._url;
                        if (url.includes('/raid/') || url.includes('/multiraid/')) {
                            try {
                                const data = JSON.parse(this.responseText);
                                self.handleGameResponse(data, url);
                            } catch (e) {
                                // 解析失败，忽略
                            }
                        }
                    }
                });
                return originalXHRSend.apply(this, args);
            };
        }

        handleGameResponse(data, url) {
            // 分析响应数据，提取TURN信息，类似Chrome-Extension的处理方式
            if (data && typeof data === 'object') {
                let currentTurn = null;
                
                // 检查是否是战斗开始数据
                if (url.includes('/start.json') && data.boss && data.turn !== undefined) {
                    currentTurn = data.turn;
                    this.battleData.startTime = Date.now();
                    //console.log('🔮 [CandyMark] 战斗开始！初始TURN =', currentTurn);
                }
                
                // 检查是否是战斗结果数据
                if (url.includes('/result') && data.status && data.status.turn !== undefined) {
                    currentTurn = data.status.turn;
                }
                
                // 检查是否包含turn字段
                if (data.turn !== undefined) {
                    currentTurn = data.turn;
                } else if (data.status && data.status.turn !== undefined) {
                    currentTurn = data.status.turn;
                }

                if (currentTurn !== null) {
                    this.onTurnChange(currentTurn, url, data);
                }

                // 新增：召唤结果后的后退
                if (url.includes('summon_result')) {
                    const config = loadConfig();
                    if (config.autoBackSummonEnabled) {
                        //console.log('🔮 [CandyMark] 召唤完成，已触发返回...');
                        setTimeout(() => {
                            if (window.history.length > 1) {
                                history.back();
                            }
                        }, 50);
                    }
                }

                // 新增：能力结果后的后退
                if (url.includes('ability_result')) {
                    const config = loadConfig();
                    if (config.autoBackAbilityEnabled) {
                        //console.log('⚡ [CandyMark] 能力使用完成，已触发返回...');
                        setTimeout(() => {
                            if (window.history.length > 1) {
                                history.back();
                            }
                        }, 50);
                    }
                }
            }
        }

        /**
         * TURN计数变化处理 - 在TURN值变化时触发
         * @param {number} newTurn - 新的TURN值
         * @param {string} url - 触发变化的URL
         * @param {object} data - 完整的响应数据
         */
        onTurnChange(newTurn, url, data) {
            const oldTurn = this.battleData.currentTurn;
            this.battleData.currentTurn = newTurn;
            this.battleData.lastUpdateTime = Date.now();
            
            // 更新最大TURN记录
            if (newTurn > this.battleData.maxTurn) {
                this.battleData.maxTurn = newTurn;
            }

            // 获取当前配置
            const config = loadConfig();
            
            // 前N次攻击后自动后退
            if (config.autoBackTurnEnabled) {
                const isAttackResult = /attack_result/.test(window.location.href) || url.includes('attack_result');
                if (isAttackResult && newTurn <= config.autoBackTurnCount + 1) {
                    //console.log(`🚨 [CandyMark] 达到设定攻击次数限制！TURN=${newTurn}(≤${config.autoBackTurnCount})，执行撤退...`);
                    setTimeout(() => {
                        if (window.history.length > 1) {
                            history.back();
                            //console.log('✅ [CandyMark] 攻击次数限制达成，已自动返回');
                        }
                    }, 140);
                }
            }

            // 战斗日志记录
            const timestamp = new Date().toLocaleTimeString();
            //console.log(`🎮 [CandyMark] TURN更新 | ${timestamp} | 当前TURN: ${newTurn} | URL: ${url.split('/').pop()}`);

            if (oldTurn !== null && oldTurn !== newTurn) {
                //console.log(`⚡ [CandyMark] TURN变化报告: T${oldTurn} → T${newTurn} (变化: ${newTurn - oldTurn})`);
            } else if (oldTurn === null) {
                //console.log(`✅ [CandyMark] 初始化TURN: ${newTurn}`);
            }
        }

        /**
         * 设置TURN变化回调函数（已废弃，直接在内部处理）
         * @deprecated 后退逻辑已内置到onTurnChange中
         */
        setTurnChangeCallback(callback) {
            // 保持空方法以兼容旧代码
            if (typeof callback === 'function') {
                //console.log('⚠️ [CandyMark] TURN变化回调已废弃，使用内置后退逻辑');
            }
        }

        /**
         * 重置战斗数据
         */
        resetBattleData() {
            //console.log('🔄 [CandyMark] 重置战斗数据');
            this.previousTurn = null;
            this.battleData = {
                currentTurn: 0,
                maxTurn: 0,
                startTime: null,
                lastUpdateTime: null
            };
        }

        getBattleStats() {
            return {
                ...this.battleData,
                battleDuration: this.battleData.startTime ? (Date.now() - this.battleData.startTime) / 1000 : 0
            };
        }

        startDropDetection() {
            // 每500ms检查一次掉落
            this.dropCheckInterval = setInterval(() => {
                this.checkDrops();
                
                // 额外的返回触发机制：检查是否是新的结算页面
                if (this.autoBackAfterDropCheck.lastProcessed.url !== window.location.href) {
                    // 检查是否已经有结果画面加载完成
                    const resultLoaded = document.querySelector('#cnt-quest');
                    if (resultLoaded) {
                        // 延迟100ms后自动返回，即使没有找到特定掉落
                        setTimeout(() => {
                            this.triggerAutoBack();
                        }, 100);
                    }
                }
            }, 500);
        }
        
        checkDrops() {
            const config = loadConfig();
            const currentUrl = window.location.href;

    		// 大巴角 "[data-key='10_79']" (调试用)
		    // FFJ "[data-key='17_20004']"
		    // 沙漏 "[data-key='10_215']"

            // URL过滤：重复的URL不处理
            if (this.autoBackAfterDropCheck.lastProcessed.url === currentUrl) {
                return;
            }

            // 检查FFJ掉落
            if (config.notifyFFJ) {
                const ffjElement = document.querySelector("[data-key='17_20004']");
                if (ffjElement) {
                    clearInterval(this.dropCheckInterval);
                    this.showDropAlert('FFJ', 'gold');
                    this.triggerAutoBack();
                    return;
                }
            }
            
            // 检查沙漏掉落
            if (config.notifyHourglass) {
                const hourglassElement = document.querySelector("[data-key='10_215']");
                if (hourglassElement) {
                    clearInterval(this.dropCheckInterval);
                    this.showDropAlert('沙漏', 'brown');
                    this.triggerAutoBack();
                    return;
                }
            }
            
            // 检查是否有任何掉落物品（即使没有通知设置也触发返回）
            const dropElements = document.querySelectorAll('[data-key*="10_"], [data-key*="17_"], [data-key*="12_"]');
            if (dropElements.length > 0) {
                clearInterval(this.dropCheckInterval);
                this.triggerAutoBack();
                return;
            }
        }
        
        showDropAlert(itemName, colorType) {
            // 使用简单的 alert，在所有平台上都可靠
            const time = new Date().toLocaleTimeString();
            alert(`🎉 ${itemName}掉落了！🎉\n恭喜获得${itemName}！\n时间：${time}`);
        }
        
        triggerAutoBack() {
            const currentUrl = window.location.href;
            
            // 如果是相同的URL就不处理
            if (this.autoBackAfterDropCheck.lastProcessed.url === currentUrl) {
                return;
            }
            
            const config = loadConfig();
            if (!config.autoBackDropEnabled) {
                return;
            }
            
            // 更新最后处理的URL
            this.autoBackAfterDropCheck.lastProcessed.url = currentUrl;
            
            // 清理超时定时器
            if (this.autoBackAfterDropCheck.timeoutId) {
                clearTimeout(this.autoBackAfterDropCheck.timeoutId);
                this.autoBackAfterDropCheck.timeoutId = null;
            }
            
            // 延迟100ms确保UI稳定后返回
            setTimeout(() => {
                if (window.history.length > 1) {
                    history.back();
                }
            }, 100);
        }
    }

    // 实例引用
    let candyMarkManagerInstance = null;
    let gameDetectorInstance = null;

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
        
        candyMarkManagerInstance = new CandyMarkManager();
        gameDetectorInstance = new GameDetector();
        
        // 游戏检测已内置到GameDetector中，无需额外配置
        if (gameDetectorInstance) {
            //console.log('✨ [CandyMark] 游戏检测中心已激活！内置后退逻辑：attack_result且TURN≤N');
        }
    }
    
    // 等待页面加载完成后初始化
    if (document.readyState != 'loading') {
        main();
    } else {
        document.addEventListener('DOMContentLoaded', main);
    }
    
    
})();
