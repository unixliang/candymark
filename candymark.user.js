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
            bookmarkOpacity: parseInt(storage.getValue('sb_bookmark_opacity', '10'))
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
            opacity: 0;
            pointer-events: none;
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
            <div class="sb-menu-item" data-action="set-interval" id="sb-interval-menu">⏱️ 两次后退间隔(400ms)</div>
            <div class="sb-menu-item" data-action="edit">✏️ 修改名称</div>
            <div class="sb-menu-item" data-action="delete">🗑️ 删除标签</div>
            <div class="sb-menu-item" data-action="cancel">❌ 取消</div>
        </div>
        <div id="sb-add-menu">
            <div class="sb-menu-item" data-action="add-bookmark">➕ 增加标签</div>
            <div class="sb-menu-item" data-action="adjust-size">📏 调整标签大小</div>
            <div class="sb-menu-item" data-action="adjust-opacity">🌓 调整标签透明度</div>
            <div class="sb-menu-item" data-action="export-config">📤 导出配置</div>
            <div class="sb-menu-item" data-action="import-config">📥 导入配置</div>
            <div class="sb-menu-item" data-action="cancel-add">❌ 取消</div>
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
                    triggerPosition: CONFIG.triggerPosition,
                    maxBookmarks: CONFIG.maxBookmarks,
                    shortcutKey: CONFIG.shortcutKey,
                    blacklist: CONFIG.blacklist,
                    autoHideTrigger: CONFIG.autoHideTrigger
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
                            
                            let bookmarks, settings;
                            
                            // 检查是否是新格式（包含settings）还是旧格式（只有bookmarks数组）
                            if (Array.isArray(importedData)) {
                                // 旧格式：直接是bookmarks数组
                                bookmarks = importedData;
                                settings = null;
                            } else if (importedData && typeof importedData === 'object') {
                                if (importedData.bookmarks) {
                                    // 新格式：包含bookmarks和可选的settings
                                    bookmarks = importedData.bookmarks;
                                    settings = importedData.settings || null;
                                } else {
                                    throw new Error('数据格式不正确：对象中缺少bookmarks字段');
                                }
                            } else {
                                throw new Error('数据格式不正确：必须是数组或包含bookmarks的对象');
                            }
                            
                            // 验证bookmarks数据格式
                            if (!Array.isArray(bookmarks)) {
                                throw new Error('标签数据格式不正确：不是数组格式');
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
                                if (!bookmark.hasOwnProperty('url')) {
                                    throw new Error(`标签数据格式不正确：第${i+1}个标签缺少url字段`);
                                }
                                // 允许name或url为空字符串，但不能为null或undefined
                                if (bookmark.name === null || bookmark.name === undefined) {
                                    bookmark.name = '';
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
                                    if (settings.bookmarkOpacity) {
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
                                    if (settings.triggerPosition) {
                                        storage.setValue('sb_trigger_position', settings.triggerPosition);
                                        CONFIG.triggerPosition = settings.triggerPosition;
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
                                    if (settings.autoHideTrigger !== undefined) {
                                        storage.setValue('sb_auto_hide_trigger', settings.autoHideTrigger.toString());
                                        CONFIG.autoHideTrigger = settings.autoHideTrigger;
                                    }
                                }
                                
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
        
        bindEvents() {
            // 触发器点击
            document.getElementById('sb-trigger').addEventListener('click', (e) => {
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
            
            
            // 全局点击关闭菜单
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#sb-menu') && !e.target.closest('#sb-add-menu') && !e.target.closest('.sb-modal')) {
                    this.hideMenu();
                    this.hideAddMenu();
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
                    }, 800);
                }
            });
            
            container.addEventListener('touchend', (e) => {
                const bookmark = e.target.closest('.sb-bookmark');
                if (bookmark && touchTimer) {
                    clearTimeout(touchTimer);
                    const touchDuration = Date.now() - this.touchStartTime;
                    
                    if (touchDuration < 800 && !this.isContextMenuOpen) {
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
            });
            
            container.addEventListener('touchmove', () => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            });
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
            
            menu.style.left = `${menuX}px`;
            menu.style.top = `${menuY}px`;
        }
        
        hideAddMenu() {
            const menu = document.getElementById('sb-add-menu');
            menu.classList.remove('show');
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
                case 'export-config':
                    this.exportConfig();
                    break;
                case 'import-config':
                    this.importConfig();
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
                intervalMenu.textContent = `⏱️ 两次后退间隔(${interval}ms)`;
            }
            
            const menu = document.getElementById('sb-menu');
            menu.classList.add('show');
            
            const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            
            // 获取菜单的实际尺寸
            const menuRect = menu.getBoundingClientRect();
            const menuWidth = menuRect.width || 150; // 默认最小宽度
            const menuHeight = menuRect.height || 280; // 默认高度（现在8个菜单项）
            
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
            
            // 更新透明度
            const expectedOpacity = BOOKMARK_OPACITIES[CONFIG.bookmarkOpacity - 1] || BOOKMARK_OPACITIES[9];
            if (parseFloat(element.style.opacity) !== expectedOpacity) {
                element.style.opacity = expectedOpacity;
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
        
        new CandyMarkManager();
    }
    
    // 等待页面加载完成后初始化
    if (document.readyState != 'loading') {
        main();
    } else {
        document.addEventListener('DOMContentLoaded', main);
    }
    
    
})();
