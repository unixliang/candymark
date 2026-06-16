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
    

    // 配置缓存：loadConfig 在战斗响应里被高频调用，每次都做 ~22 次 storage.getValue + 多次 JSON.parse
    // 会卡主线程；任何 sb_* 写入都会让缓存失效，下次 loadConfig 重新读。
    let _configCache = null;
    const invalidateConfigCache = () => { _configCache = null; };

    // localStorage 存储工具函数
    const storage = {
        setValue: (key, value) => {
            try {
                if (typeof key === 'string' && key.startsWith('sb_')) invalidateConfigCache();
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
                if (typeof key === 'string' && key.startsWith('sb_')) invalidateConfigCache();
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
    
    // 配置选项 - 支持动态加载（带缓存，写入 sb_* 时自动失效）
    const loadConfig = () => {
        if (_configCache) return _configCache;
        let blacklist;
        try {
            blacklist = JSON.parse(storage.getValue('sb_blacklist', '["greasyfork.org", "github.com"]'));
        } catch (e) {
            blacklist = ['greasyfork.org', 'github.com'];
        }

        let dropSubscriptions;
        try {
            dropSubscriptions = JSON.parse(storage.getValue('sb_drop_subscriptions', '[]'));
        } catch (e) {
            dropSubscriptions = [];
        }

        _configCache = {
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
            // 非战斗辅助设置（全局）：battle-end / drop，动作 none|back|refresh|jump
            autoBattleEndAction: storage.getValue('sb_auto_battle_end_action', 'none'),
            autoDropAction: storage.getValue('sb_auto_drop_action', 'none'),
            // 跳转目标（全局单一，所有"跳转"动作共用同一个目标）
            autoJumpTargetId: (() => {
                const raw = storage.getValue('sb_auto_jump_target_id', '');
                const n = parseInt(raw, 10);
                return Number.isNaN(n) ? null : n;
            })(),
            // 战斗内辅助设置（按副本 quest_id 存）：
            // { [questId]: { questImg, turnLte:{action,count}, turnEq:{action,count},
            //                summon:{action,ids:[{id,icon}]}, ability:{action,ids:[{id,icon}]},
            //                summonChoices:[{imageId,icon}], abilityChoices:[{iconId,icon}] } }
            questSettings: (() => {
                try {
                    const obj = JSON.parse(storage.getValue('sb_quest_settings', '{}'));
                    return (obj && typeof obj === 'object') ? obj : {};
                } catch (e) {
                    return {};
                }
            })(),
            // 内存+持久化记录最近进入的副本，供"辅助设置（战斗）"默认选中
            lastQuestId: storage.getValue('sb_last_quest_id', ''),
            dropSubscriptions: dropSubscriptions
        };
        return _configCache;
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

        #sb-chokuzen-countdown {
            position: fixed;
            top: calc(1cm + 12px);
            left: 0;
            height: 0.5cm;
            padding: 0 6px;
            display: none;
            align-items: center;
            justify-content: center;
            color: #fff;
            background: rgba(0, 0, 0, 0.55);
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            line-height: 1;
            z-index: 999998;
            pointer-events: none;
            white-space: nowrap;
        }
        #sb-chokuzen-countdown.active { display: flex; }
        #sb-contribution-display {
            position: fixed;
            top: calc(0.5cm + 6px);
            left: 0;
            height: 0.5cm;
            padding: 0 6px;
            display: none;
            align-items: center;
            justify-content: center;
            color: #ffd76a;
            background: rgba(0, 0, 0, 0.55);
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            line-height: 1;
            z-index: 999998;
            pointer-events: none;
            white-space: nowrap;
        }
        #sb-contribution-display.active { display: flex; }
        /* 预兆信息浮层：底部 bar 上方，最多 2 行，新行在下，每行 10min 过期 */
        #sb-omen-log {
            position: fixed;
            left: 10px;
            bottom: 40px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: flex-start;
            z-index: -1; /* 低于书签(z-index:auto=0)，让标签盖在预兆之上；仍在 container(999999) 内、游戏 UI 之上 */
            pointer-events: none;
            max-width: 92vw;
        }
        .sb-omen-row {
            background: rgba(0, 0, 0, 0.72);
            color: #fff;
            font-size: 13px;
            line-height: 1.3;
            padding: 4px 10px;
            border-radius: 6px;
            max-width: 92vw;
            white-space: normal;
            word-break: break-word;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .sb-omen-row .sb-omen-turn {
            color: #ffd76a;
            margin-right: 4px;
        }
        .sb-omen-row .sb-omen-success {
            color: #46d369;
            font-weight: 700;
            margin-left: 6px;
        }
        .sb-omen-row .sb-omen-fail {
            color: #ff5a5a;
            font-weight: 700;
            margin-left: 6px;
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
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            animation: sbModalAppear 0.3s ease;
        }

        /* 标题 / 按钮粘在视口顶/底，中间区域滚动 */
        .sb-modal-content > h3 {
            position: sticky;
            top: 0;
            margin-top: 0;
            padding-bottom: 8px;
            background: white;
            z-index: 2;
        }
        .sb-modal-content > .sb-modal-buttons {
            position: sticky;
            bottom: 0;
            margin-top: 16px;
            padding-top: 12px;
            background: white;
            border-top: 1px solid #eee;
            z-index: 2;
        }
        /* 辅助设置两个长面板：改三段式——标题贴顶、按钮贴底、中间 body 单独滚动，
           避免 sticky 在带 padding 的滚动容器里露出 padding 区内容 */
        #sb-auto-battle-modal > .sb-modal-content,
        #sb-auto-normal-modal > .sb-modal-content {
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        #sb-auto-battle-modal .sb-modal-body,
        #sb-auto-normal-modal .sb-modal-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
        }
        #sb-auto-battle-modal > .sb-modal-content > h3,
        #sb-auto-normal-modal > .sb-modal-content > h3,
        #sb-auto-battle-modal > .sb-modal-content > .sb-modal-buttons,
        #sb-auto-normal-modal > .sb-modal-content > .sb-modal-buttons {
            flex: 0 0 auto;
        }
        /* 标题下方分割线，与底部按钮上方分割线一致 */
        #sb-auto-battle-modal > .sb-modal-content > h3,
        #sb-auto-normal-modal > .sb-modal-content > h3 {
            padding-bottom: 12px;
            border-bottom: 1px solid #eee;
        }
        /* body 统一滚动：取消内部网格各自的 max-height，避免嵌套双滚动条 */
        #sb-auto-battle-modal .sb-modal-body .sb-drop-subscribe-grid,
        #sb-auto-battle-modal .sb-modal-body .sb-ability-filter-grid,
        #sb-auto-battle-modal .sb-modal-body #sb-bt-quest-grid,
        #sb-auto-normal-modal .sb-modal-body .sb-drop-subscribe-grid {
            max-height: none;
            overflow-y: visible;
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

        /* 穿透点击后退书签 */
        .sb-bookmark--click-through {
            pointer-events: none !important;
        }

        /* 菜单打开或拖拽模式时恢复交互 */
        .sb-container--menu-open .sb-bookmark--click-through,
        .sb-container--drag-mode .sb-bookmark--click-through {
            pointer-events: auto !important;
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

        .sb-drop-subscribe-hint {
            font-size: 13px;
            color: #666;
            margin: 8px 0 12px;
            line-height: 1.4;
        }
        .sb-ability-filter-hint {
            font-size: 12px;
            color: #888;
            margin: 4px 0 4px 24px;
            line-height: 1.3;
        }
        .sb-ability-filter-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 0 0 8px 24px;
            max-height: 200px;
            overflow-y: auto;
        }
        .sb-ability-filter-grid .sb-drop-sub-item {
            padding: 2px;
        }
        .sb-ability-filter-grid img {
            width: 40px;
            height: 40px;
            display: block;
            border-radius: 4px;
            pointer-events: none;
        }
        .sb-ability-fallback {
            width: 40px;
            height: 40px;
            background: #ccc;
            color: #333;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            word-break: break-all;
            text-align: center;
            padding: 2px;
            box-sizing: border-box;
            pointer-events: none;
        }
        .sb-auto-jump-target-label {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin: 16px 0 4px;
        }
        .sb-bookmark-pick-icon {
            width: var(--sb-bookmark-size, 30.2px);
            height: var(--sb-bookmark-size, 30.2px);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 600;
            font-size: var(--sb-bookmark-font-size, 16px);
            line-height: 1.05;
            text-align: center;
            padding: 2px;
            box-sizing: border-box;
            word-break: break-all;
            overflow: hidden;
            text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
        }
        /* 跳转目标网格按真实标签大小排列，不用 4 列等分 */
        #sb-nm-jump-grid, #sb-bt-jump-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: flex-start;
            grid-template-columns: none;
            padding: 4px;
        }
        #sb-nm-jump-grid .sb-drop-sub-item, #sb-bt-jump-grid .sb-drop-sub-item {
            flex: 0 0 auto;
        }
        /* 辅助设置（新版）：场景行 + 动作单选 */
        .sb-auto-scene {
            padding: 8px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }
        .sb-auto-scene-title {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 6px;
        }
        .sb-auto-action-row {
            display: flex;
            gap: 6px;
            flex-wrap: nowrap;
        }
        .sb-auto-action-row label {
            flex: 1 1 0;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 2px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            background: #f7f7f7;
            cursor: pointer;
            font-size: 13px;
            line-height: 1.2;
            white-space: nowrap;
            text-align: center;
            transition: all 0.15s;
        }
        .sb-auto-action-row label:has(input:checked) {
            border-color: #667eea;
            background: #eef0ff;
            color: #4f56c8;
            font-weight: 600;
        }
        /* 隐藏原生 radio：移动端原生控件过大且会把文字挤成竖排，改用整块 label 高亮 */
        .sb-auto-action-row input[type="radio"] {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
            pointer-events: none;
        }
        /* 弱化「不启用」（每组第一个）：中性灰、降低权重，突出 后退/刷新/跳转 */
        .sb-auto-action-row label:first-child {
            color: #9aa0a6;
        }
        .sb-auto-action-row label:first-child:has(input:checked) {
            border-color: #c4c7cc;
            background: #f1f3f4;
            color: #80868b;
        }
        .sb-scene-stepper {
            display: inline-flex;
            align-items: center;
            justify-content: flex-start;
            gap: 2px;
            margin-bottom: 10px;
        }
        .sb-turn-n {
            display: inline-block;
            min-width: 1em;
            text-align: center;
            color: #667eea;
            font-weight: 700;
        }
        /* 副本选择器：大厅图网格，按真实比例横向排列 */
        #sb-bt-quest-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: flex-start;
            grid-template-columns: none;
            padding: 4px 4px 14px;
            max-height: 30vh;
            overflow-y: auto;
            border-bottom: 1px solid #e0e0e0;
            margin-bottom: 10px;
        }
        #sb-bt-quest-grid .sb-drop-sub-item {
            flex: 0 0 auto;
            width: 100px;
        }
        #sb-bt-quest-grid img {
            width: 100%;
            border-radius: 6px;
        }
        .sb-quest-tag {
            position: absolute;
            top: 3px;
            left: 3px;
            background: rgba(102, 126, 234, 0.92);
            color: #fff;
            font-size: 11px;
            padding: 1px 5px;
            border-radius: 4px;
        }
        .sb-bt-quest-hint {
            font-size: 12px;
            color: #888;
            margin: 4px 0;
        }
        .sb-drop-subscribe-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 12px 0 20px;
            max-height: 60vh;
            overflow-y: auto;
            padding: 4px;
        }
        .sb-drop-sub-item {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 2px solid transparent;
            border-radius: 6px;
            background: #f7f7f7;
            padding: 4px;
            transition: all 0.15s;
        }
        .sb-drop-sub-item img {
            width: 100%;
            height: auto;
            display: block;
            pointer-events: none;
        }
        /* 隐藏 checkbox / radio 本体，只靠 .checked 外框反馈，避免移动端原生控件遮挡图片 */
        .sb-drop-sub-item input[type="checkbox"],
        .sb-drop-sub-item input[type="radio"] {
            position: absolute;
            opacity: 0;
            pointer-events: none;
            width: 0;
            height: 0;
            margin: 0;
        }
        .sb-drop-sub-item.checked {
            border-color: #4caf50;
            background: #e8f5e9;
            box-shadow: 0 0 0 1px #4caf50; /* 外加 1px 环，不影响布局 */
        }
        .sb-drop-sub-item .sb-low-prob {
            position: absolute;
            bottom: 2px;
            right: 2px;
            background: rgba(255, 87, 34, 0.85);
            color: #fff;
            font-size: 10px;
            padding: 1px 4px;
            border-radius: 3px;
        }

        .sb-drop-hit-icon-wrap {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
            margin: 16px 0;
        }
        .sb-drop-hit-icon-wrap img {
            max-width: 120px;
            max-height: 120px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .sb-drop-hit-time {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-bottom: 12px;
        }
        
        /* 数值调节器样式 */
        .sb-number-adjuster {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            margin: 0 10px;
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
        <div id="sb-chokuzen-countdown"></div>
        <div id="sb-contribution-display"></div>
        <div id="sb-omen-log"></div>
        <div id="sb-menu">
            <div class="sb-menu-item" data-action="drag">🖱️ 拖拽移动</div>
            <div class="sb-menu-item" data-action="set-url">📍 设置当前页面</div>
            <div class="sb-menu-item" data-action="set-back">⬅️ 设置后退</div>
            <div class="sb-menu-item" data-action="set-reload">🔄 设置刷新</div>
            <div class="sb-menu-item" data-action="set-click-through-back">👆 设置穿透点击后退</div>
            <div class="sb-menu-item" data-action="set-click-through-delay" id="sb-interval-menu">⏱️ 穿透后退延迟【300ms】</div>
            <div class="sb-menu-item" data-action="edit">✏️ 修改名称</div>
            <div class="sb-menu-item" data-action="delete">🗑️ 删除标签</div>
            <div class="sb-menu-item" data-action="show-global-menu">⚙️ 全局配置</div>
            <div class="sb-menu-item" data-action="cancel">❌ 取消</div>
        </div>
        <div id="sb-add-menu">
            <div class="sb-menu-item" data-action="add-bookmark">➕ 增加标签</div>
            <div class="sb-menu-item" data-action="adjust-size">📏 调整标签大小</div>
            <div class="sb-menu-item" data-action="adjust-opacity">🌓 调整标签透明度</div>
            <div class="sb-menu-item" data-action="auto-normal">🌐 辅助设置（常态）</div>
            <div class="sb-menu-item" data-action="auto-battle">⚔️ 辅助设置（战斗）</div>
            <div class="sb-menu-item" data-action="subscribe-from-drop-list">🔔 掉落通知</div>
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
                <h3>设置穿透后退延迟时间</h3>
                <input type="number" id="sb-interval-input" placeholder="请输入延迟时间(毫秒)" min="50" max="5000" value="300">
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
        <div id="sb-auto-normal-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>辅助设置（常态）</h3>
                <div class="sb-modal-body">
                <div class="sb-drop-notify-options">
                    <div class="sb-auto-scene">
                        <div class="sb-auto-scene-title">🏆 战斗结束后</div>
                        <div class="sb-auto-action-row" data-scene="battleEnd">
                            <label><input type="radio" name="sb-nm-battleEnd" value="none">不启用</label>
                            <label><input type="radio" name="sb-nm-battleEnd" value="back">后退</label>
                            <label><input type="radio" name="sb-nm-battleEnd" value="refresh">刷新</label>
                            <label><input type="radio" name="sb-nm-battleEnd" value="jump">跳转</label>
                        </div>
                    </div>
                    <div class="sb-auto-scene">
                        <div class="sb-auto-scene-title">🎯 结算后</div>
                        <div class="sb-auto-action-row" data-scene="drop">
                            <label><input type="radio" name="sb-nm-drop" value="none">不启用</label>
                            <label><input type="radio" name="sb-nm-drop" value="back">后退</label>
                            <label><input type="radio" name="sb-nm-drop" value="refresh">刷新</label>
                            <label><input type="radio" name="sb-nm-drop" value="jump">跳转</label>
                        </div>
                    </div>
                </div>
                <div class="sb-auto-jump-target-label">跳转目标（全局，单选；任一时机选"跳转"都用它）</div>
                <div class="sb-drop-subscribe-hint" id="sb-nm-jump-hint"></div>
                <div class="sb-drop-subscribe-grid" id="sb-nm-jump-grid"></div>
                </div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-nm-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-nm-reset">重置</button>
                    <button class="sb-btn-secondary" id="sb-nm-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-auto-battle-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>辅助设置（战斗）</h3>
                <div class="sb-modal-body">
                <div class="sb-bt-quest-hint" id="sb-bt-quest-hint"></div>
                <div class="sb-drop-subscribe-grid" id="sb-bt-quest-grid"></div>

                <div class="sb-drop-notify-options">
                    <div class="sb-auto-scene">
                        <div class="sb-auto-scene-title">⚔️ 前 <span class="sb-turn-n" id="sb-bt-turnLte-n">3</span> 回合攻击后</div>
                        <div class="sb-scene-stepper">
                            <button class="sb-number-adjuster-btn" id="sb-bt-turnLte-decrease">-</button>
                            <input type="number" id="sb-bt-turnLte-count" class="sb-number-adjuster-input" min="1" max="99" value="3">
                            <button class="sb-number-adjuster-btn" id="sb-bt-turnLte-increase">+</button>
                        </div>
                        <div class="sb-auto-action-row" data-scene="turnLte">
                            <label><input type="radio" name="sb-bt-turnLte" value="none">不启用</label>
                            <label><input type="radio" name="sb-bt-turnLte" value="back">后退</label>
                            <label><input type="radio" name="sb-bt-turnLte" value="refresh">刷新</label>
                            <label><input type="radio" name="sb-bt-turnLte" value="jump">跳转</label>
                        </div>
                    </div>
                    <div class="sb-auto-scene">
                        <div class="sb-auto-scene-title">🎯 第 <span class="sb-turn-n" id="sb-bt-turnEq-n">1</span> 回合攻击后</div>
                        <div class="sb-scene-stepper">
                            <button class="sb-number-adjuster-btn" id="sb-bt-turnEq-decrease">-</button>
                            <input type="number" id="sb-bt-turnEq-count" class="sb-number-adjuster-input" min="1" max="99" value="1">
                            <button class="sb-number-adjuster-btn" id="sb-bt-turnEq-increase">+</button>
                        </div>
                        <div class="sb-auto-action-row" data-scene="turnEq">
                            <label><input type="radio" name="sb-bt-turnEq" value="none">不启用</label>
                            <label><input type="radio" name="sb-bt-turnEq" value="back">后退</label>
                            <label><input type="radio" name="sb-bt-turnEq" value="refresh">刷新</label>
                            <label><input type="radio" name="sb-bt-turnEq" value="jump">跳转</label>
                        </div>
                    </div>
                    <div class="sb-auto-scene">
                        <div class="sb-auto-scene-title">🔮 召唤后</div>
                        <div class="sb-auto-action-row" data-scene="summon">
                            <label><input type="radio" name="sb-bt-summon" value="none">不启用</label>
                            <label><input type="radio" name="sb-bt-summon" value="back">后退</label>
                            <label><input type="radio" name="sb-bt-summon" value="refresh">刷新</label>
                            <label><input type="radio" name="sb-bt-summon" value="jump">跳转</label>
                        </div>
                        <div class="sb-ability-filter-hint" id="sb-bt-summon-hint"></div>
                        <div class="sb-ability-filter-grid" id="sb-bt-summon-grid"></div>
                    </div>
                    <div class="sb-auto-scene">
                        <div class="sb-auto-scene-title">⚡ 技能后</div>
                        <div class="sb-auto-action-row" data-scene="ability">
                            <label><input type="radio" name="sb-bt-ability" value="none">不启用</label>
                            <label><input type="radio" name="sb-bt-ability" value="back">后退</label>
                            <label><input type="radio" name="sb-bt-ability" value="refresh">刷新</label>
                            <label><input type="radio" name="sb-bt-ability" value="jump">跳转</label>
                        </div>
                        <div class="sb-ability-filter-hint" id="sb-bt-ability-hint"></div>
                        <div class="sb-ability-filter-grid" id="sb-bt-ability-grid"></div>
                    </div>
                </div>
                <div class="sb-auto-jump-target-label">跳转目标（全局，单选；任一时机选"跳转"都用它）</div>
                <div class="sb-drop-subscribe-hint" id="sb-bt-jump-hint"></div>
                <div class="sb-drop-subscribe-grid" id="sb-bt-jump-grid"></div>
                </div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-bt-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-bt-delete">删除</button>
                    <button class="sb-btn-secondary" id="sb-bt-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-drop-subscribe-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>掉落通知</h3>
                <div class="sb-drop-subscribe-hint" id="sb-drop-subscribe-hint"></div>
                <div class="sb-drop-subscribe-grid" id="sb-drop-subscribe-grid"></div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-drop-subscribe-confirm">确认</button>
                    <button class="sb-btn-secondary" id="sb-drop-subscribe-cancel">取消</button>
                </div>
            </div>
        </div>
        <div id="sb-drop-hit-modal" class="sb-modal">
            <div class="sb-modal-content">
                <h3>🎉 物品掉落了！🎉</h3>
                <div class="sb-drop-hit-icon-wrap" id="sb-drop-hit-icons"></div>
                <div class="sb-drop-hit-time">时间：<span id="sb-drop-hit-time"></span></div>
                <div class="sb-modal-buttons">
                    <button class="sb-btn-primary" id="sb-drop-hit-ok">好的</button>
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
            this.setupClickThroughDetection();
        }
        
        registerMenuCommands() {
            // 为非油猴环境创建替代菜单
            this.createAlternativeMenu();
        }
        
        // 创建替代菜单访问方式
        createAlternativeMenu() {
            // 移除了双击设置功能
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
                    bookmarksVisible: CONFIG.bookmarksVisible,
                    dropSubscriptions: CONFIG.dropSubscriptions,
                    autoBattleEndAction: CONFIG.autoBattleEndAction,
                    autoDropAction: CONFIG.autoDropAction,
                    autoJumpTargetId: CONFIG.autoJumpTargetId,
                    questSettings: CONFIG.questSettings,
                    lastQuestId: CONFIG.lastQuestId
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
                                if (bookmark.url === null || bookmark.url === undefined || bookmark.url === '') {
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
                                    if (typeof settings.bookmarkSize === 'number' && settings.bookmarkSize >= 1 && settings.bookmarkSize <= 10) {
                                        storage.setValue('sb_bookmark_size', settings.bookmarkSize.toString());
                                        CONFIG.bookmarkSize = settings.bookmarkSize;
                                        updateBookmarkSize(settings.bookmarkSize);
                                    }
                                    if (typeof settings.bookmarkOpacity === 'number' && settings.bookmarkOpacity >= 1 && settings.bookmarkOpacity <= 10) {
                                        storage.setValue('sb_bookmark_opacity', settings.bookmarkOpacity.toString());
                                        CONFIG.bookmarkOpacity = settings.bookmarkOpacity;
                                        updateBookmarkOpacity(settings.bookmarkOpacity);
                                    }
                                    if (typeof settings.enabled === 'boolean') {
                                        storage.setValue('sb_enabled', settings.enabled.toString());
                                        CONFIG.enabled = settings.enabled;
                                    }
                                    if (typeof settings.showTrigger === 'boolean') {
                                        storage.setValue('sb_show_trigger', settings.showTrigger.toString());
                                        CONFIG.showTrigger = settings.showTrigger;
                                    }
                                    if (typeof settings.maxBookmarks === 'number' && settings.maxBookmarks > 0) {
                                        storage.setValue('sb_max_bookmarks', settings.maxBookmarks.toString());
                                        CONFIG.maxBookmarks = settings.maxBookmarks;
                                    }
                                    if (typeof settings.shortcutKey === 'string' && settings.shortcutKey) {
                                        storage.setValue('sb_shortcut_key', settings.shortcutKey);
                                        CONFIG.shortcutKey = settings.shortcutKey;
                                    }
                                    if (Array.isArray(settings.blacklist)) {
                                        storage.setValue('sb_blacklist', JSON.stringify(settings.blacklist));
                                        CONFIG.blacklist = settings.blacklist;
                                    }
                                    if (typeof settings.bookmarksVisible === 'boolean') {
                                        storage.setValue('sb_bookmarks_visible', settings.bookmarksVisible.toString());
                                        CONFIG.bookmarksVisible = settings.bookmarksVisible;
                                    }
                                    if (Array.isArray(settings.dropSubscriptions)) {
                                        const subs = settings.dropSubscriptions.filter(s => s && s.itemId && s.kind);
                                        storage.setValue('sb_drop_subscriptions', JSON.stringify(subs));
                                        CONFIG.dropSubscriptions = subs;
                                    }
                                    if (typeof settings.autoBattleEndAction === 'string') {
                                        CONFIG.autoBattleEndAction = settings.autoBattleEndAction;
                                        storage.setValue('sb_auto_battle_end_action', settings.autoBattleEndAction);
                                    }
                                    if (typeof settings.autoDropAction === 'string') {
                                        CONFIG.autoDropAction = settings.autoDropAction;
                                        storage.setValue('sb_auto_drop_action', settings.autoDropAction);
                                    }
                                    if (settings.autoJumpTargetId === null || typeof settings.autoJumpTargetId === 'number') {
                                        CONFIG.autoJumpTargetId = settings.autoJumpTargetId;
                                        storage.setValue('sb_auto_jump_target_id', settings.autoJumpTargetId == null ? '' : String(settings.autoJumpTargetId));
                                    }
                                    if (settings.questSettings && typeof settings.questSettings === 'object') {
                                        CONFIG.questSettings = settings.questSettings;
                                        storage.setValue('sb_quest_settings', JSON.stringify(settings.questSettings));
                                    }
                                    if (typeof settings.lastQuestId === 'string') {
                                        CONFIG.lastQuestId = settings.lastQuestId;
                                        storage.setValue('sb_last_quest_id', settings.lastQuestId);
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
                        bookmarksVisible: CONFIG.bookmarksVisible,
                        dropSubscriptions: CONFIG.dropSubscriptions,
                        autoBattleEndAction: CONFIG.autoBattleEndAction,
                        autoDropAction: CONFIG.autoDropAction,
                        autoJumpTargetId: CONFIG.autoJumpTargetId,
                        questSettings: CONFIG.questSettings,
                        lastQuestId: CONFIG.lastQuestId
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
                    if (bookmark.id === null || bookmark.id === undefined) {
                        throw new Error(`第${i + 1}个标签缺少 id 字段`);
                    }
                    if (bookmark.name === null || bookmark.name === undefined) {
                        bookmark.name = '';
                    }
                    if (bookmark.url === null || bookmark.url === undefined || bookmark.url === '') {
                        throw new Error(`第${i + 1}个标签缺少 url 字段`);
                    }
                }
                
                if (confirm('确定要导入配置吗？这将替换现有的所有标签和设置。')) {
                    // 导入标签
                    this.bookmarks = bookmarks;
                    this.saveBookmarks(true);
                    
                    // 导入设置（如果有）
                    if (settings) {
                        if (typeof settings.bookmarkSize === 'number' && settings.bookmarkSize >= 1 && settings.bookmarkSize <= 10) {
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
                        if (typeof settings.shortcutKey === 'string' && settings.shortcutKey) {
                            CONFIG.shortcutKey = settings.shortcutKey;
                            storage.setValue('sb_shortcut_key', settings.shortcutKey);
                        }
                        if (Array.isArray(settings.blacklist)) {
                            CONFIG.blacklist = settings.blacklist;
                            storage.setValue('sb_blacklist', JSON.stringify(settings.blacklist));
                        }
                        if (typeof settings.bookmarksVisible === 'boolean') {
                            CONFIG.bookmarksVisible = settings.bookmarksVisible;
                            storage.setValue('sb_bookmarks_visible', settings.bookmarksVisible.toString());
                        }
                        if (Array.isArray(settings.dropSubscriptions)) {
                            const subs = settings.dropSubscriptions.filter(s => s && s.itemId && s.kind);
                            CONFIG.dropSubscriptions = subs;
                            storage.setValue('sb_drop_subscriptions', JSON.stringify(subs));
                        }
                        if (typeof settings.autoBattleEndAction === 'string') {
                            CONFIG.autoBattleEndAction = settings.autoBattleEndAction;
                            storage.setValue('sb_auto_battle_end_action', settings.autoBattleEndAction);
                        }
                        if (typeof settings.autoDropAction === 'string') {
                            CONFIG.autoDropAction = settings.autoDropAction;
                            storage.setValue('sb_auto_drop_action', settings.autoDropAction);
                        }
                        if (settings.autoJumpTargetId === null || typeof settings.autoJumpTargetId === 'number') {
                            CONFIG.autoJumpTargetId = settings.autoJumpTargetId;
                            storage.setValue('sb_auto_jump_target_id', settings.autoJumpTargetId == null ? '' : String(settings.autoJumpTargetId));
                        }
                        if (settings.questSettings && typeof settings.questSettings === 'object') {
                            CONFIG.questSettings = settings.questSettings;
                            storage.setValue('sb_quest_settings', JSON.stringify(settings.questSettings));
                        }
                        if (typeof settings.lastQuestId === 'string') {
                            CONFIG.lastQuestId = settings.lastQuestId;
                            storage.setValue('sb_last_quest_id', settings.lastQuestId);
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
            // 触发器长按处理：用时间戳替代 boolean 状态机，避免
            //  1) 触屏 PC 上 mouse + touch 双事件各起一个 timer 互相覆盖泄漏，
            //     导致短按时仍有 600ms 旧 timer 后台触发 toggleAllBookmarks；
            //  2) iOS 长按 touchend 后追发的合成 mousedown 把 boolean 清掉，
            //     紧随其后的合成 click 误判为短按。
            let triggerPressTimer = null;
            let lastLongPressTime = 0;
            const LONG_PRESS_GUARD_MS = 800; // 长按触发后这段时间内的 click 一律阻止

            const triggerElement = document.getElementById('sb-trigger');

            const handleTriggerStart = () => {
                // 触屏 PC 上 touchstart 和 mousedown 会相继触发，必须先清掉前一个
                if (triggerPressTimer) {
                    clearTimeout(triggerPressTimer);
                }
                triggerPressTimer = setTimeout(() => {
                    triggerPressTimer = null;
                    lastLongPressTime = Date.now();
                    this.toggleAllBookmarks();
                }, 600);
            };

            const handleTriggerEnd = (e) => {
                if (triggerPressTimer) {
                    clearTimeout(triggerPressTimer);
                    triggerPressTimer = null;
                }
                // 长按刚触发：阻断本轮 mouseup/touchend
                if (Date.now() - lastLongPressTime < LONG_PRESS_GUARD_MS) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };

            const handleTriggerCancel = () => {
                if (triggerPressTimer) {
                    clearTimeout(triggerPressTimer);
                    triggerPressTimer = null;
                }
            };

            // 绑定鼠标事件
            triggerElement.addEventListener('mousedown', handleTriggerStart);
            triggerElement.addEventListener('mouseup', handleTriggerEnd);
            triggerElement.addEventListener('mouseleave', handleTriggerCancel);

            // 绑定触摸事件
            triggerElement.addEventListener('touchstart', handleTriggerStart);
            triggerElement.addEventListener('touchend', handleTriggerEnd);
            triggerElement.addEventListener('touchcancel', handleTriggerCancel);

            // 触发器点击 - 长按窗口内的 click 一律阻止
            triggerElement.addEventListener('click', (e) => {
                if (Date.now() - lastLongPressTime < LONG_PRESS_GUARD_MS) {
                    e.preventDefault();
                    e.stopPropagation();
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
            
            // 从掉落列表订阅
            document.getElementById('sb-drop-subscribe-confirm').addEventListener('click', () => {
                this.confirmDropSubscribe();
            });

            document.getElementById('sb-drop-subscribe-cancel').addEventListener('click', () => {
                this.hideDropSubscribeModal();
            });

            // 辅助设置（常态）
            document.getElementById('sb-nm-confirm').addEventListener('click', () => { this.confirmAutoNormal(); });
            document.getElementById('sb-nm-cancel').addEventListener('click', () => { this.hideAutoNormalModal(); });
            document.getElementById('sb-nm-reset').addEventListener('click', () => { this.resetAutoNormalForm(); });

            // 辅助设置（战斗）
            document.getElementById('sb-bt-confirm').addEventListener('click', () => { this.confirmAutoBattle(); });
            document.getElementById('sb-bt-cancel').addEventListener('click', () => { this.hideAutoBattleModal(); });
            document.getElementById('sb-bt-delete').addEventListener('click', () => { this.deleteAutoBattleQuest(); });

            // 战斗内两个回合数调节器（≤N 与 =N），范围 1-99
            ['turnLte', 'turnEq'].forEach(scene => {
                const countId = `sb-bt-${scene}-count`;
                const syncN = () => {
                    const n = document.getElementById(`sb-bt-${scene}-n`);
                    if (n) n.textContent = document.getElementById(countId).value;
                };
                document.getElementById(countId).addEventListener('input', (e) => {
                    let v = parseInt(e.target.value, 10);
                    if (isNaN(v)) return;
                    if (v < 1) v = 1;
                    if (v > 99) v = 99;
                    e.target.value = v;
                    syncN();
                });
                document.getElementById(countId).addEventListener('blur', (e) => {
                    let v = parseInt(e.target.value, 10);
                    if (isNaN(v) || v < 1) v = 1;
                    if (v > 99) v = 99;
                    e.target.value = v;
                    syncN();
                });
                document.getElementById(`sb-bt-${scene}-decrease`).addEventListener('click', () => {
                    const input = document.getElementById(countId);
                    let v = parseInt(input.value, 10);
                    if (isNaN(v)) v = 4;
                    input.value = Math.max(1, v - 1);
                    syncN();
                });
                document.getElementById(`sb-bt-${scene}-increase`).addEventListener('click', () => {
                    const input = document.getElementById(countId);
                    let v = parseInt(input.value, 10);
                    if (isNaN(v)) v = 2;
                    input.value = Math.min(99, v + 1);
                    syncN();
                });
            });

            // 菜单事件
            document.getElementById('sb-menu').addEventListener('click', (e) => {
                // 吞掉长按弹出菜单后浏览器在原位置补发的那一次合成click（幽灵点击），避免误点首项
                if (this.suppressNextMenuClick) {
                    this.suppressNextMenuClick = false;
                    e.stopPropagation();
                    return;
                }
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
                    this.handleBookmarkClick(url);
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
                        this.handleBookmarkClick(url);
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
        
        handleBookmarkClick(url) {
            // 点击动画由事件委托处调用方触发，这里不再重复
            // 特殊URL（back, reload等）已通过onclick属性处理
            // 这里只处理普通URL；若已经在目标 URL，直接刷新以更新页面状态
            if (url === window.location.href) {
                window.location.reload();
            } else {
                window.location.href = url;
            }
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

        // 检查是否在拖拽模式
        isDragMode() {
            const container = document.getElementById('sb-container');
            return container && container.classList.contains('sb-container--drag-mode');
        }

        // 穿透点击检测 - 在document级别监听，检测命中穿透书签
        setupClickThroughDetection() {
            // 长按检测状态
            this.clickThroughTouchState = {
                timer: null,
                startX: 0,
                startY: 0,
                active: false,
                handledByTouch: false // 防止touchend和click重复触发
            };

            // 触摸开始 - 用于长按检测
            document.addEventListener('touchstart', (e) => {
                if (this.isContextMenuOpen || this.isDragMode()) return;

                const touch = e.touches[0];
                const hitBookmark = this.findClickThroughBookmarkAtPoint(touch.clientX, touch.clientY);

                if (hitBookmark) {
                    this.clickThroughTouchState.startX = touch.clientX;
                    this.clickThroughTouchState.startY = touch.clientY;
                    this.clickThroughTouchState.active = true;
                    this.clickThroughTouchState.handledByTouch = false;

                    // 600ms长按触发菜单
                    this.clickThroughTouchState.timer = setTimeout(() => {
                        if (this.clickThroughTouchState.active) {
                            const id = hitBookmark.element.getAttribute('data-bookmark-id');
                            // 创建模拟事件对象
                            const fakeEvent = {
                                preventDefault: () => {},
                                stopPropagation: () => {},
                                clientX: touch.clientX,
                                clientY: touch.clientY,
                                touches: [{ clientX: touch.clientX, clientY: touch.clientY }]
                            };
                            this.showMenu(fakeEvent, parseInt(id));
                            // 长按弹菜单后手指抬起，浏览器会在原位置补发一次合成click，
                            // 标记吞掉这一次，避免落到菜单首项造成误点
                            this.suppressNextMenuClick = true;
                        }
                        this.clickThroughTouchState.active = false;
                    }, 600);
                }
            }, true);

            // 触摸移动 - 取消长按
            document.addEventListener('touchmove', (e) => {
                if (this.clickThroughTouchState.timer) {
                    const touch = e.touches[0];
                    const dx = Math.abs(touch.clientX - this.clickThroughTouchState.startX);
                    const dy = Math.abs(touch.clientY - this.clickThroughTouchState.startY);
                    // 移动超过10px取消长按
                    if (dx > 10 || dy > 10) {
                        clearTimeout(this.clickThroughTouchState.timer);
                        this.clickThroughTouchState.timer = null;
                        this.clickThroughTouchState.active = false;
                    }
                }
            }, true);

            // 触摸结束 - 处理短触发穿透点击
            document.addEventListener('touchend', (e) => {
                if (this.clickThroughTouchState.timer) {
                    clearTimeout(this.clickThroughTouchState.timer);
                    this.clickThroughTouchState.timer = null;
                }

                // 如果是长按触发了菜单，不处理短点击
                if (!this.clickThroughTouchState.active) return;
                this.clickThroughTouchState.active = false;

                if (this.isContextMenuOpen || this.isDragMode()) return;

                const touch = e.changedTouches[0];
                const hitBookmark = this.findClickThroughBookmarkAtPoint(touch.clientX, touch.clientY);

                if (hitBookmark) {
                    // 标记已由触摸事件处理，防止后续click事件重复触发
                    this.clickThroughTouchState.handledByTouch = true;
                    // 300ms后重置标记（足够让合成的click事件通过）
                    setTimeout(() => {
                        this.clickThroughTouchState.handledByTouch = false;
                    }, 300);

                    // 前一次后退还在延迟等待中，忽略本次点击，避免连点一路后退
                    if (this.backPending) return;
                    this.backPending = true;

                    // 触发点击动画
                    this.triggerClickAnimation(hitBookmark.element);

                    // 延迟后退
                    const delay = hitBookmark.bookmark.clickThroughDelay || 300;
                    setTimeout(() => {
                        this.backPending = false;
                        history.back();
                    }, delay);
                }
            }, true);

            // 桌面端：右键菜单检测
            document.addEventListener('contextmenu', (e) => {
                if (this.isContextMenuOpen || this.isDragMode()) return;

                const hitBookmark = this.findClickThroughBookmarkAtPoint(e.clientX, e.clientY);
                if (hitBookmark) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = hitBookmark.element.getAttribute('data-bookmark-id');
                    this.showMenu(e, parseInt(id));
                }
            }, true);

            // 桌面端：点击检测（移动端由touchend处理）
            document.addEventListener('click', (e) => {
                if (this.isContextMenuOpen || this.isDragMode()) return;

                // 如果已由触摸事件处理，跳过（防止移动端重复触发）
                if (this.clickThroughTouchState.handledByTouch) return;

                const hitBookmark = this.findClickThroughBookmarkAtPoint(e.clientX, e.clientY);
                if (hitBookmark) {
                    // 前一次后退还在延迟等待中，忽略本次点击，避免连点一路后退
                    if (this.backPending) return;
                    this.backPending = true;

                    // 触发点击动画
                    this.triggerClickAnimation(hitBookmark.element);

                    // 延迟后退
                    const delay = hitBookmark.bookmark.clickThroughDelay || 300;
                    setTimeout(() => {
                        this.backPending = false;
                        history.back();
                    }, delay);
                }
            }, true);
        }

        // 通过坐标查找命中的穿透书签
        findClickThroughBookmarkAtPoint(x, y) {
            // 只查找穿透类型的书签
            const clickThroughBookmarks = document.querySelectorAll('.sb-bookmark--click-through');

            for (const element of clickThroughBookmarks) {
                const rect = element.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    const id = element.getAttribute('data-bookmark-id');
                    const bookmark = this.bookmarks.find(b => b.id === parseInt(id));
                    if (bookmark) {
                        return { element, bookmark };
                    }
                }
            }
            return null;
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
            
            const x = (e && e.clientX) || 0;
            const y = (e && e.clientY) || 0;

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
                case 'auto-normal':
                    this.showAutoNormalModal();
                    break;
                case 'auto-battle':
                    this.showAutoBattleModal();
                    break;
                case 'subscribe-from-drop-list':
                    this.showDropSubscribeModal();
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
                // 确保bookmark有clickThroughDelay属性，如果没有则设置默认值
                if (!bookmark.clickThroughDelay) {
                    bookmark.clickThroughDelay = 300;
                }
                document.getElementById('sb-interval-input').value = bookmark.clickThroughDelay;
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

            // handler 只 bind 一次，保证 cleanup 时能用同一引用解绑
            if (!this.sizeSliderHandlers) {
                this.sizeSliderHandlers = {
                    start: this.startSizeSliderDrag.bind(this),
                    click: this.handleSizeSliderClick.bind(this),
                    move: this.handleSizeSliderMove.bind(this),
                    end: this.endSizeSliderDrag.bind(this)
                };
            }
            const h = this.sizeSliderHandlers;

            // 绑定事件
            thumb.addEventListener('mousedown', h.start);
            track.addEventListener('click', h.click);
            document.addEventListener('mousemove', h.move);
            document.addEventListener('mouseup', h.end);

            // 触摸事件支持
            thumb.addEventListener('touchstart', h.start, { passive: false });
            track.addEventListener('touchstart', h.click, { passive: false });
            document.addEventListener('touchmove', h.move, { passive: false });
            document.addEventListener('touchend', h.end);
        }

        cleanupSizeSlider() {
            if (!this.sizeSliderHandlers) return;
            const h = this.sizeSliderHandlers;
            const thumb = document.getElementById('sb-size-slider-thumb');
            const track = document.querySelector('.sb-size-slider-track');

            if (thumb) {
                thumb.removeEventListener('mousedown', h.start);
                thumb.removeEventListener('touchstart', h.start);
            }
            if (track) {
                track.removeEventListener('click', h.click);
                track.removeEventListener('touchstart', h.click);
            }
            document.removeEventListener('mousemove', h.move);
            document.removeEventListener('mouseup', h.end);
            document.removeEventListener('touchmove', h.move);
            document.removeEventListener('touchend', h.end);
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
            
            // handler 只 bind 一次，保证 cleanup 时能用同一引用解绑
            if (!this.opacitySliderHandlers) {
                this.opacitySliderHandlers = {
                    start: this.startOpacitySliderDrag.bind(this),
                    click: this.handleOpacitySliderClick.bind(this),
                    move: this.handleOpacitySliderMove.bind(this),
                    end: this.endOpacitySliderDrag.bind(this)
                };
            }
            const h = this.opacitySliderHandlers;

            // 绑定事件
            thumb.addEventListener('mousedown', h.start);
            track.addEventListener('click', h.click);
            document.addEventListener('mousemove', h.move);
            document.addEventListener('mouseup', h.end);

            // 触摸事件支持
            thumb.addEventListener('touchstart', h.start, { passive: false });
            track.addEventListener('touchstart', h.click, { passive: false });
            document.addEventListener('touchmove', h.move, { passive: false });
            document.addEventListener('touchend', h.end);
        }

        cleanupOpacitySlider() {
            if (!this.opacitySliderHandlers) return;
            const h = this.opacitySliderHandlers;
            const thumb = document.getElementById('sb-opacity-slider-thumb');
            const track = document.querySelector('.sb-opacity-slider-track');

            if (thumb) {
                thumb.removeEventListener('mousedown', h.start);
                thumb.removeEventListener('touchstart', h.start);
            }
            if (track) {
                track.removeEventListener('click', h.click);
                track.removeEventListener('touchstart', h.click);
            }
            document.removeEventListener('mousemove', h.move);
            document.removeEventListener('mouseup', h.end);
            document.removeEventListener('touchmove', h.move);
            document.removeEventListener('touchend', h.end);
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
        
        // ===== 辅助设置（新版）：公共辅助 =====
        defaultQuestSetting() {
            return {
                questImg: '',
                turnLte: { action: 'none', count: 3 },
                turnEq: { action: 'none', count: 1 },
                summon: { action: 'none', ids: [] },
                ability: { action: 'none', ids: [] },
                summonChoices: [],
                abilityChoices: []
            };
        }

        getRadioAction(name) {
            const el = document.querySelector(`input[name="${name}"]:checked`);
            return el ? el.value : 'none';
        }

        setRadioAction(name, action) {
            const a = action || 'none';
            const el = document.querySelector(`input[name="${name}"][value="${a}"]`)
                || document.querySelector(`input[name="${name}"][value="none"]`);
            if (el) el.checked = true;
        }

        // 跳转目标网格（全局单一目标，多个模态框共用 CONFIG.autoJumpTargetId）
        renderJumpTargetGrid(gridId, hintId) {
            const grid = document.getElementById(gridId);
            const hint = document.getElementById(hintId);
            if (!grid || !hint) return;
            const candidates = (this.bookmarks || []).filter(b =>
                b && b.url && b.url !== 'back' && b.url !== 'click-through-back' && b.url !== 'reload'
            );
            if (candidates.length === 0) {
                hint.textContent = '请先添加 URL 标签后再来设置跳转目标。';
                grid.innerHTML = '';
                return;
            }
            hint.textContent = '勾选一个标签作为跳转目标；不勾选则"跳转"动作不生效。';
            const escAttr = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const radioName = gridId + '-radio';
            grid.innerHTML = candidates.map(b => {
                const isTarget = b.id === CONFIG.autoJumpTargetId;
                const checked = isTarget ? 'checked' : '';
                const cls = isTarget ? 'checked' : '';
                const colorIndex = (b.colorIndex !== undefined ? b.colorIndex : 0) % this.colorPresets.length;
                const name = escAttr(b.name);
                const tip = escAttr(`${b.name || ''}\n${b.url || ''}`);
                return `<label class="sb-drop-sub-item ${cls}" data-bookmark-id="${b.id}">
                    <input type="radio" name="${radioName}" value="${b.id}" ${checked}>
                    <div class="sb-bookmark-pick-icon sb-bookmark--color-${colorIndex}" title="${tip}">${name}</div>
                </label>`;
            }).join('');
            grid.querySelectorAll('input[type="radio"]').forEach(rb => {
                rb.addEventListener('change', () => {
                    grid.querySelectorAll('.sb-drop-sub-item').forEach(el => el.classList.remove('checked'));
                    if (rb.checked) rb.closest('.sb-drop-sub-item').classList.add('checked');
                });
            });
            grid.querySelectorAll('.sb-drop-sub-item').forEach(label => {
                label.addEventListener('click', (e) => {
                    const rb = label.querySelector('input[type="radio"]');
                    if (!rb) return;
                    if (rb.checked && e.target !== rb) {
                        setTimeout(() => { rb.checked = false; label.classList.remove('checked'); }, 0);
                    }
                });
            });
        }

        collectJumpTarget(gridId) {
            const chosen = document.querySelector(`#${gridId} input[type="radio"]:checked`);
            return chosen ? parseInt(chosen.value, 10) : null;
        }

        saveJumpTargetFromGrid(gridId) {
            const target = this.collectJumpTarget(gridId);
            CONFIG.autoJumpTargetId = target;
            storage.setValue('sb_auto_jump_target_id', target == null ? '' : String(target));
        }

        // ===== 辅助设置（常态）=====
        showAutoNormalModal() {
            this.hideAddMenu();
            this.setRadioAction('sb-nm-battleEnd', CONFIG.autoBattleEndAction);
            this.setRadioAction('sb-nm-drop', CONFIG.autoDropAction);
            this.renderJumpTargetGrid('sb-nm-jump-grid', 'sb-nm-jump-hint');
            document.getElementById('sb-auto-normal-modal').classList.add('show');
        }

        hideAutoNormalModal() {
            document.getElementById('sb-auto-normal-modal').classList.remove('show');
        }

        confirmAutoNormal() {
            CONFIG.autoBattleEndAction = this.getRadioAction('sb-nm-battleEnd');
            CONFIG.autoDropAction = this.getRadioAction('sb-nm-drop');
            storage.setValue('sb_auto_battle_end_action', CONFIG.autoBattleEndAction);
            storage.setValue('sb_auto_drop_action', CONFIG.autoDropAction);
            this.saveJumpTargetFromGrid('sb-nm-jump-grid');
            this.hideAutoNormalModal();
        }

        resetAutoNormalForm() {
            this.setRadioAction('sb-nm-battleEnd', 'none');
            this.setRadioAction('sb-nm-drop', 'none');
            const grid = document.getElementById('sb-nm-jump-grid');
            if (grid) {
                grid.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = false; });
                grid.querySelectorAll('.sb-drop-sub-item').forEach(el => el.classList.remove('checked'));
            }
        }

        // ===== 辅助设置（战斗，按副本）=====
        showAutoBattleModal() {
            this.hideAddMenu();
            const qs = CONFIG.questSettings || {};
            const current = (gameDetectorInstance && gameDetectorInstance.battleData && gameDetectorInstance.battleData.questId) || '';
            const last = CONFIG.lastQuestId || '';
            // 只展示：当前副本、上次副本、以及配置过动作的副本（进过但没配过的不展示）
            const ids = [];
            if (current) ids.push(current);
            if (last && last !== current) ids.push(last);
            Object.keys(qs).forEach(id => {
                if (this.isQuestConfigured(qs[id]) && !ids.includes(id)) ids.push(id);
            });
            const defaultId = current || last || (ids[0] || '');
            this.renderQuestPicker(ids, defaultId, current, last);
            this.renderAutoBattleScene(defaultId);
            this.renderJumpTargetGrid('sb-bt-jump-grid', 'sb-bt-jump-hint');
            document.getElementById('sb-auto-battle-modal').classList.add('show');
        }

        // 副本选择器：每个副本一张大厅图，单选切换；角标标注 当前 / 上次 / 未设置
        renderQuestPicker(ids, selectedId, currentId, lastId) {
            const grid = document.getElementById('sb-bt-quest-grid');
            const hint = document.getElementById('sb-bt-quest-hint');
            const qs = CONFIG.questSettings || {};
            if (!grid || !hint) return;
            if (ids.length === 0) {
                hint.textContent = '暂无副本：进入一场战斗后再来设置。';
                grid.innerHTML = '';
                return;
            }
            hint.textContent = '点选要设置的副本（图为 boss 图标）。';
            grid.innerHTML = ids.map(id => {
                const sel = id === selectedId;
                const img = (qs[id] && qs[id].questImg) || '';
                let tag = qs[id] ? '' : '未设置';
                if (id === currentId) tag = '当前';
                else if (id === lastId) tag = '上次';
                const tagHtml = tag ? `<div class="sb-quest-tag">${tag}</div>` : '';
                return `<label class="sb-drop-sub-item ${sel ? 'checked' : ''}" data-quest-id="${id}">
                    <input type="radio" name="sb-bt-quest" value="${id}" ${sel ? 'checked' : ''}>
                    <img src="${img}" alt="${id}">
                    ${tagHtml}
                </label>`;
            }).join('');
            grid.querySelectorAll('input[type="radio"]').forEach(rb => {
                rb.addEventListener('change', () => {
                    grid.querySelectorAll('.sb-drop-sub-item').forEach(el => el.classList.remove('checked'));
                    if (rb.checked) {
                        rb.closest('.sb-drop-sub-item').classList.add('checked');
                        this.renderAutoBattleScene(rb.value);
                    }
                });
            });
        }

        selectedBattleQuestId() {
            const el = document.querySelector('#sb-bt-quest-grid input[name="sb-bt-quest"]:checked');
            return el ? el.value : '';
        }

        // 是否配置过动作（任一场景动作 ≠ none）。仅"进过副本"的自动快照不算已设置。
        isQuestConfigured(q) {
            if (!q) return false;
            return (q.turnLte && q.turnLte.action !== 'none')
                || (q.turnEq && q.turnEq.action !== 'none')
                || (q.summon && q.summon.action !== 'none')
                || (q.ability && q.ability.action !== 'none');
        }

        // 按选中副本渲染 4 个场景的动作单选 + 召唤/技能候选过滤
        renderAutoBattleScene(questId) {
            const qs = (CONFIG.questSettings && CONFIG.questSettings[questId]) || this.defaultQuestSetting();
            this.setRadioAction('sb-bt-turnLte', qs.turnLte && qs.turnLte.action);
            const lteCount = (qs.turnLte && qs.turnLte.count) || 3;
            document.getElementById('sb-bt-turnLte-count').value = lteCount;
            document.getElementById('sb-bt-turnLte-n').textContent = lteCount;
            this.setRadioAction('sb-bt-turnEq', qs.turnEq && qs.turnEq.action);
            const eqCount = (qs.turnEq && qs.turnEq.count) || 1;
            document.getElementById('sb-bt-turnEq-count').value = eqCount;
            document.getElementById('sb-bt-turnEq-n').textContent = eqCount;
            this.setRadioAction('sb-bt-summon', qs.summon && qs.summon.action);
            this.setRadioAction('sb-bt-ability', qs.ability && qs.ability.action);
            this._renderFilterGrid('sb-bt-summon-grid', 'sb-bt-summon-hint',
                (qs.summon && qs.summon.ids) || [], qs.summonChoices || [], 'imageId',
                '该副本暂无召唤候选（进入一次该副本后会自动记录）。不选则任意召唤都满足条件。',
                '勾选要监听的召唤石；不选则任意召唤都满足条件。');
            this._renderFilterGrid('sb-bt-ability-grid', 'sb-bt-ability-hint',
                (qs.ability && qs.ability.ids) || [], qs.abilityChoices || [], 'iconId',
                '该副本暂无技能候选（进入一次该副本后会自动记录）。不选则任意技能都满足条件。',
                '勾选要监听的技能；不选则任意技能都满足条件。');
        }

        hideAutoBattleModal() {
            document.getElementById('sb-auto-battle-modal').classList.remove('show');
        }

        confirmAutoBattle() {
            const questId = this.selectedBattleQuestId();
            if (!questId) { this.hideAutoBattleModal(); return; }
            if (!CONFIG.questSettings) CONFIG.questSettings = {};
            const prev = CONFIG.questSettings[questId] || this.defaultQuestSetting();
            const clampCount = (v) => {
                let n = parseInt(v, 10);
                if (isNaN(n) || n < 1) n = 1; else if (n > 99) n = 99;
                return n;
            };
            // 候选为空（没进过该副本）时 grid 无勾选项，_collectFilter 返回 null，保留旧过滤器
            const summonIds = this._collectFilter('sb-bt-summon-grid', prev.summonChoices || [], 'imageId');
            const abilityIds = this._collectFilter('sb-bt-ability-grid', prev.abilityChoices || [], 'iconId');
            CONFIG.questSettings[questId] = {
                questImg: prev.questImg || '',
                turnLte: { action: this.getRadioAction('sb-bt-turnLte'), count: clampCount(document.getElementById('sb-bt-turnLte-count').value) },
                turnEq: { action: this.getRadioAction('sb-bt-turnEq'), count: clampCount(document.getElementById('sb-bt-turnEq-count').value) },
                summon: { action: this.getRadioAction('sb-bt-summon'), ids: summonIds === null ? ((prev.summon && prev.summon.ids) || []) : summonIds },
                ability: { action: this.getRadioAction('sb-bt-ability'), ids: abilityIds === null ? ((prev.ability && prev.ability.ids) || []) : abilityIds },
                summonChoices: prev.summonChoices || [],
                abilityChoices: prev.abilityChoices || []
            };
            storage.setValue('sb_quest_settings', JSON.stringify(CONFIG.questSettings));
            this.saveJumpTargetFromGrid('sb-bt-jump-grid');
            this.hideAutoBattleModal();
        }

        deleteAutoBattleQuest() {
            const questId = this.selectedBattleQuestId();
            if (questId && CONFIG.questSettings && CONFIG.questSettings[questId]) {
                if (!confirm(`确定删除副本 ${questId} 的战斗内辅助设置吗？`)) return;
                delete CONFIG.questSettings[questId];
                storage.setValue('sb_quest_settings', JSON.stringify(CONFIG.questSettings));
            }
            this.hideAutoBattleModal();
        }

        // 通用过滤器网格渲染。
        // savedFilter: [{id, icon}]，id 字段是可视唯一键（iconId / imageId）
        // currentList: 当前战斗对应类别的列表（abilityList 或 summonList）
        // keyField: 在 currentList 项里取唯一键的字段名（'iconId' 或 'imageId'）
        _renderFilterGrid(gridId, hintId, savedFilter, currentList, keyField, emptyHint, normalHint) {
            const grid = document.getElementById(gridId);
            const hint = document.getElementById(hintId);
            if (!grid || !hint) return;
            const savedArr = Array.isArray(savedFilter) ? savedFilter : [];

            const cells = [];
            const rendered = new Set();
            for (const item of savedArr) {
                const key = String(item && item.id != null ? item.id : item);
                if (!key || rendered.has(key)) continue;
                cells.push({ key, icon: (item && item.icon) || '', checked: true });
                rendered.add(key);
            }
            for (const cur of currentList) {
                const key = String(cur && cur[keyField] || '');
                if (!key || rendered.has(key)) continue;
                cells.push({ key, icon: cur.icon, checked: false });
                rendered.add(key);
            }

            if (cells.length === 0) {
                hint.textContent = emptyHint;
                grid.innerHTML = '';
                return;
            }

            hint.textContent = normalHint;
            grid.innerHTML = cells.map(c => {
                const checkedAttr = c.checked ? 'checked' : '';
                const cls = c.checked ? 'checked' : '';
                const visual = c.icon
                    ? `<img src="${c.icon}" alt="${c.key}">`
                    : `<div class="sb-ability-fallback">${c.key}</div>`;
                const iconAttr = c.icon ? c.icon.replace(/"/g, '&quot;') : '';
                return `<label class="sb-drop-sub-item ${cls}" data-filter-key="${c.key}">
                    <input type="checkbox" data-filter-key="${c.key}" data-filter-icon="${iconAttr}" ${checkedAttr}>
                    ${visual}
                </label>`;
            }).join('');

            grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    cb.closest('.sb-drop-sub-item').classList.toggle('checked', cb.checked);
                });
            });
        }

        _collectFilter(gridId, currentList, keyField) {
            const grid = document.getElementById(gridId);
            if (!grid) return null;
            const inputs = grid.querySelectorAll('input[type="checkbox"]');
            if (inputs.length === 0) return null;

            const battleIcons = new Map((currentList || []).map(c => [String(c && c[keyField]), c && c.icon]));
            const items = [];
            inputs.forEach(cb => {
                if (cb.checked) {
                    const key = cb.dataset.filterKey;
                    const dataIcon = cb.dataset.filterIcon || '';
                    const fallbackIcon = battleIcons.get(String(key)) || '';
                    items.push({ id: key, icon: dataIcon || fallbackIcon });
                }
            });
            return items;
        }

        showDropSubscribeModal() {
            const modal = document.getElementById('sb-drop-subscribe-modal');
            const grid = document.getElementById('sb-drop-subscribe-grid');
            const hint = document.getElementById('sb-drop-subscribe-hint');

            // 来源 A：副本掉落预览页
            const previewList = document.querySelector('.prt-drop-item-list');
            const previewItems = previewList ? Array.from(previewList.querySelectorAll('.btn-drop-item-image')) : [];

            // 来源 B：战斗结算页
            const resultList = document.querySelector('.prt-item-list');
            const resultItems = resultList ? Array.from(resultList.querySelectorAll('[data-key]')) : [];

            // 渲染单元：已订阅在前，DOM 新增项在后，按 kind_id 去重
            const renderedKeys = new Set();
            const cells = [];

            for (const sub of CONFIG.dropSubscriptions) {
                if (!sub || !sub.itemId || !sub.kind) continue;
                const key = `${sub.kind}_${sub.itemId}`;
                if (renderedKeys.has(key)) continue;
                cells.push({
                    itemId: sub.itemId,
                    kind: sub.kind,
                    iconUrl: sub.iconUrl || '',
                    isLowProb: false,
                    checked: true
                });
                renderedKeys.add(key);
            }

            // 副本掉落预览页：data-item-kind / data-item-id
            for (const el of previewItems) {
                const id = el.dataset.itemId || '';
                const kind = el.dataset.itemKind || '';
                const key = `${kind}_${id}`;
                if (!id || !kind || renderedKeys.has(key)) continue;
                cells.push({
                    itemId: id,
                    kind: kind,
                    iconUrl: el.querySelector('img')?.src || '',
                    isLowProb: !!el.querySelector('.txt-low-probability'),
                    checked: false
                });
                renderedKeys.add(key);
            }

            // 战斗结算页：data-key="kind_id"
            for (const el of resultItems) {
                const m = (el.dataset.key || '').match(/^(\d+)_(.+)$/);
                if (!m) continue;
                const kind = m[1];
                const id = m[2];
                const key = `${kind}_${id}`;
                if (renderedKeys.has(key)) continue;
                cells.push({
                    itemId: id,
                    kind: kind,
                    iconUrl: el.querySelector('.img-treasure-item')?.src || el.querySelector('img')?.src || '',
                    isLowProb: false,
                    checked: false
                });
                renderedKeys.add(key);
            }

            const hasNewSource = previewItems.length > 0 || resultItems.length > 0;
            if (cells.length === 0) {
                hint.textContent = '当前未开启任何掉落通知，且本页面也没有可添加的物品。请到副本掉落预览页或战斗结算页再打开本对话框以添加。';
            } else if (!hasNewSource) {
                hint.textContent = '本页面没有可添加的新物品，仅显示已开启通知的物品。取消勾选并确认即可移除。';
            } else {
                hint.textContent = '已开启通知的物品已勾选；勾选新项添加，取消勾选移除。';
            }

            grid.innerHTML = cells.map(c => {
                const checkedAttr = c.checked ? 'checked' : '';
                const lowProb = c.isLowProb ? '<div class="sb-low-prob">低</div>' : '';
                return `<label class="sb-drop-sub-item ${c.checked ? 'checked' : ''}" data-key="${c.kind}_${c.itemId}">
                    <input type="checkbox" data-item-id="${c.itemId}" data-kind="${c.kind}" data-icon="${c.iconUrl}" ${checkedAttr}>
                    <img src="${c.iconUrl}" alt="${c.kind}_${c.itemId}">
                    ${lowProb}
                </label>`;
            }).join('');

            grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    cb.closest('.sb-drop-sub-item').classList.toggle('checked', cb.checked);
                });
            });

            modal.classList.add('show');
        }

        hideDropSubscribeModal() {
            document.getElementById('sb-drop-subscribe-modal').classList.remove('show');
        }

        confirmDropSubscribe() {
            const grid = document.getElementById('sb-drop-subscribe-grid');
            const checked = grid.querySelectorAll('input[type="checkbox"]:checked');
            const newSubs = [];
            checked.forEach(cb => {
                newSubs.push({
                    itemId: cb.dataset.itemId,
                    kind: cb.dataset.kind,
                    iconUrl: cb.dataset.icon
                });
            });

            CONFIG.dropSubscriptions = newSubs;
            storage.setValue('sb_drop_subscriptions', JSON.stringify(newSubs));
            this.hideDropSubscribeModal();
        }

        showMenu(e, bookmarkId) {
            e.preventDefault();
            e.stopPropagation();

            this.currentBookmarkId = bookmarkId;
            this.isContextMenuOpen = true;

            // 添加菜单打开状态类（恢复穿透书签的pointer-events）
            const container = document.getElementById('sb-container');
            container.classList.add('sb-container--menu-open');

            // 更新菜单中的延迟时间显示
            const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
            if (bookmark) {
                const intervalMenu = document.getElementById('sb-interval-menu');
                const delay = bookmark.clickThroughDelay || 300;
                intervalMenu.textContent = `⏱️ 穿透后退延迟【${delay}ms】`;
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

            // 移除菜单打开状态类
            const container = document.getElementById('sb-container');
            container.classList.remove('sb-container--menu-open');
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
                case 'set-reload':
                    this.currentBookmarkId = bookmarkId;
                    this.setReloadUrl();
                    this.currentBookmarkId = null;
                    break;
                case 'set-click-through-back':
                    this.currentBookmarkId = bookmarkId;
                    this.setClickThroughBack();
                    this.currentBookmarkId = null;
                    break;
                case 'set-click-through-delay':
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
                case 'show-global-menu':
                    this.showAddMenu();
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
                domain: url === 'back' ? 'back' : url === 'click-through-back' ? 'click-through-back' : new URL(url).hostname,
                clickThroughDelay: 300, // 默认延迟时间300ms
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
            const input = document.getElementById('sb-interval-input');
            const intervalValue = input.valueAsNumber;

            if (isNaN(intervalValue) || intervalValue < 50 || intervalValue > 5000) {
                alert('请输入有效的延迟时间（50-5000毫秒）');
                return;
            }

            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.clickThroughDelay = intervalValue;
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

        setReloadUrl() {
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.url = 'reload';
                bookmark.domain = 'reload';
                this.saveBookmarks();
                this.renderBookmarks();
            }
        }
        
        setClickThroughBack() {
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.url = 'click-through-back';
                bookmark.domain = 'click-through-back';
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
            // 添加拖拽模式状态类（恢复穿透书签的pointer-events）
            const container = document.getElementById('sb-container');
            container.classList.add('sb-container--drag-mode');
            
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
            
            // 延迟添加退出事件；记下 timer 与已挂载标记，exitDragMode 时按需取消 / 移除
            dragState.exitListenersAttached = false;
            dragState.exitBindTimer = setTimeout(() => {
                dragState.exitBindTimer = null;
                document.addEventListener('click', this.boundDragHandlers.outsideClick);
                document.addEventListener('keydown', this.boundDragHandlers.keyDown);
                dragState.exitListenersAttached = true;
            }, 300);
        }
        
        exitDragMode(dragState) {
            const { element, originalPos, hint } = dragState;

            // 使用CSS类批量清除拖拽样式
            element.classList.remove('dragging', 'sb-bookmark--dragging-prep', 'sb-bookmark--dragging-active', 'sb-bookmark--updating');
            // 移除拖拽模式状态类
            const container = document.getElementById('sb-container');
            container.classList.remove('sb-container--drag-mode');

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
            this.unbindDragEvents(element, dragState);

            // 强制重绘
            element.offsetHeight;
        }

        unbindDragEvents(element, dragState) {
            element.removeEventListener('mousedown', this.boundDragHandlers.mouseDown);
            element.removeEventListener('touchstart', this.boundDragHandlers.touchStart);
            document.removeEventListener('mousemove', this.boundDragHandlers.mouseMove);
            document.removeEventListener('mouseup', this.boundDragHandlers.mouseUp);
            document.removeEventListener('touchmove', this.boundDragHandlers.touchMove);
            document.removeEventListener('touchend', this.boundDragHandlers.touchEnd);
            // 若挂起的 300ms 定时器还没 fire，必须取消，否则之后会挂上无人卸载的 listener
            if (dragState && dragState.exitBindTimer) {
                clearTimeout(dragState.exitBindTimer);
                dragState.exitBindTimer = null;
            }
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

                // 更新onclick属性和穿透类
                if (bookmark.url === 'back') {
                    element.setAttribute('onclick', 'history.back()');
                    element.style.cursor = 'pointer';
                    element.classList.remove('sb-bookmark--click-through');
                } else if (bookmark.url === 'click-through-back') {
                    // 穿透点击后退：不设置onclick，由document级检测处理
                    element.removeAttribute('onclick');
                    element.style.cursor = 'pointer';
                    element.classList.add('sb-bookmark--click-through');
                } else if (bookmark.url === 'reload') {
                    element.setAttribute('onclick', 'location.reload()');
                    element.style.cursor = 'pointer';
                    element.classList.remove('sb-bookmark--click-through');
                } else {
                    element.removeAttribute('onclick');
                    element.style.cursor = '';
                    element.classList.remove('sb-bookmark--click-through');
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
            } else if (bookmark.url === 'click-through-back') {
                // 穿透点击后退：不设置onclick，由document级检测处理
                element.style.cursor = 'pointer';
                element.classList.add('sb-bookmark--click-through');
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
                // 为现有标签添加默认属性和颜色索引
                this.bookmarks.forEach((bookmark, index) => {
                    // 迁移旧的doubleBackInterval到clickThroughDelay
                    if (bookmark.doubleBackInterval && !bookmark.clickThroughDelay) {
                        bookmark.clickThroughDelay = bookmark.doubleBackInterval;
                        delete bookmark.doubleBackInterval;
                    }
                    if (!bookmark.clickThroughDelay) {
                        bookmark.clickThroughDelay = 300;
                    }
                    // 迁移旧的double-back到click-through-back
                    if (bookmark.url === 'double-back') {
                        bookmark.url = 'click-through-back';
                        bookmark.domain = 'click-through-back';
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
            this.battleData = {
                currentTurn: 0,
                maxTurn: 0,
                startTime: null,
                lastUpdateTime: null,
                questId: '',         // 当前副本标识（start.json 的 data.quest_id）
                abilityList: [],     // {id, iconId, icon}[]
                summonList: [],      // {id, imageId, icon}[]，按 summon_id 1-based 顺序排列
                supporterSummon: null // {id, imageId, icon} —— 友方借召
            };
            // "结算后" 触发去重 —— 按 raidId 记录已经触发过的战斗
            // 同一场在 result_multi/N ↔ result_multi/empty/N 之间反复切 hash 时不会重复触发；
            // 连续收菜（多场不同 raidId）时每场会各自触发一次；不依赖 start.json
            // 用 Set 而不是 last-1，避免 A→B→A 这种回访场景被漏掉去重
            this.firedDropBackRaidIds = new Set();
            this.autoBackAfterDropCheck = {
                enabled: true, // 新功能开关
                lastProcessed: {
                    url: '',
                    timestamp: 0
                },
                timeoutId: null // 清理用
            };
            // 直前倒计时（参照 Tarou：turn_waiting 是服务端给的未来 ms 时间戳）
            this.chokuzenTimer = null;
            // 贡献值浮层：显示本次响应增加的 contribution.amount，显示 10s
            this.contributionTimer = null;
            // 预兆信息浮层：信息落盘 cm_omen_log（按 raidId 分组，每战斗≤2 条，每条 10min 过期）
            this._omenRenderTimer = null;
            this.init();
        }

        init() {
            this.setupUrlMonitoring();
            this.restoreChokuzen();
            this.restoreContributionDisplay();
            this.renderOmenLog();   // 后退/刷新后从落盘恢复展示当前战斗的预兆
        }

        // ====== 贡献值浮层 ======
        loadContributionState() {
            try {
                const obj = JSON.parse(storage.getValue('cm_contribution_state', '{}'));
                return (obj && typeof obj === 'object') ? obj : {};
            } catch (e) {
                return {};
            }
        }

        saveContributionState(amount, expiresAt) {
            const state = {
                amount: amount || 0,
                expiresAt: expiresAt || 0
            };
            if (!state.amount) {
                storage.removeValue('cm_contribution_state');
                return;
            }
            storage.setValue('cm_contribution_state', JSON.stringify(state));
        }

        restoreContributionDisplay() {
            const state = this.loadContributionState();
            const amount = Number(state.amount) || 0;
            const expiresAt = Number(state.expiresAt) || 0;
            if (amount <= 0 || expiresAt <= Date.now()) return;

            this.showContribution(amount, expiresAt);
        }

        collectContribution(data) {
            if (!data || !Array.isArray(data.scenario)) return;
            let amount = 0;
            for (const action of data.scenario) {
                if (!action || action.cmd !== 'contribution') continue;
                const n = Number(action.amount);
                if (isFinite(n) && n > 0) amount += n;
            }
            if (amount <= 0) return;

            const expiresAt = Date.now() + 10000;
            this.saveContributionState(amount, expiresAt);
            this.showContribution(amount, expiresAt);
        }

        showContribution(amount, expiresAt) {
            const el = document.getElementById('sb-contribution-display');
            if (!el) return;

            const n = Math.floor(Number(amount) || 0);
            if (n <= 0) return;

            el.textContent = `+ ${n.toLocaleString()}`;
            el.classList.add('active');

            if (this.contributionTimer) {
                clearTimeout(this.contributionTimer);
                this.contributionTimer = null;
            }

            const delay = Math.max(0, (Number(expiresAt) || 0) - Date.now());
            this.contributionTimer = setTimeout(() => {
                this.hideContribution();
            }, delay);
        }

        hideContribution() {
            if (this.contributionTimer) {
                clearTimeout(this.contributionTimer);
                this.contributionTimer = null;
            }
            const el = document.getElementById('sb-contribution-display');
            if (el) {
                el.classList.remove('active');
                el.textContent = '';
            }
            storage.removeValue('cm_contribution_state');
        }

        // ====== 直前倒计时 ======
        // Tarou 的做法：把 start.json 里的 data.turn_waiting 直接喂给 ElCountdown 的 value
        // （ElCountdown 把 value 当作未来的 epoch 毫秒时间戳，每帧渲染 value - Date.now()）
        // 因为是绝对时间戳，离开战斗页 / 跨 SPA hash 切换 / 用户脚本重注入都不会重置——
        // 只要持久化一次，恢复后继续走即可。
        setChokuzenTarget(target) {
            if (typeof target !== 'number' || !isFinite(target) || target <= Date.now()) return;
            storage.setValue('cm_chokuzen_target', String(target));
            this.startChokuzenTick(target);
        }

        restoreChokuzen() {
            const raw = storage.getValue('cm_chokuzen_target', null);
            if (raw == null) return;
            const target = Number(raw);
            if (!isFinite(target) || target <= Date.now()) {
                storage.removeValue('cm_chokuzen_target');
                return;
            }
            this.startChokuzenTick(target);
        }

        startChokuzenTick(target) {
            const el = document.getElementById('sb-chokuzen-countdown');
            if (!el) return;
            if (this.chokuzenTimer) {
                clearInterval(this.chokuzenTimer);
                this.chokuzenTimer = null;
            }
            const render = () => {
                const remainSec = (target - Date.now()) / 1000;
                if (remainSec <= 0) {
                    this.stopChokuzen();
                    return;
                }
                el.textContent = remainSec.toFixed(1);
                el.classList.add('active');
            };
            render();
            this.chokuzenTimer = setInterval(render, 100);
        }

        stopChokuzen() {
            if (this.chokuzenTimer) {
                clearInterval(this.chokuzenTimer);
                this.chokuzenTimer = null;
            }
            const el = document.getElementById('sb-chokuzen-countdown');
            if (el) {
                el.classList.remove('active');
                el.textContent = '';
            }
            storage.removeValue('cm_chokuzen_target');
        }

        // 从 URL 里抽出 raidId。优先从 hash 取（结算页 URL），避免和 query 里的
        // opensocial_viewer_id 等长 ID 撞车
        extractRaidIdFromUrl(url) {
            if (!url || typeof url !== 'string') return null;
            const hashIdx = url.indexOf('#');
            const target = hashIdx >= 0 ? url.substring(hashIdx) : url;
            const m = target.match(/\d{8,}/);
            return m ? m[0] : null;
        }
        
        setupUrlMonitoring() {
            // 现在所有掉落检测都走 ajax 响应（/result(?:multi)?/content/index 直接给 reward_list），
            // 不再需要 hashchange 触发 DOM 轮询
            this.monitorGameData();
        }

        /**
         * TURN计数变化回调系统 - 参照Chrome-Extension-Tarou的做法
         * 监听战斗数据变化并记录TURN计数的变化
         */
        monitorGameData() {
            const self = this;

            // settings.data 在 jQuery 里可能是 JSON 字符串、URL-encoded form 字符串，或对象
            // 统一解析成普通对象，只为了拿 ability_id / summon_id
            const extractRequestFields = (raw) => {
                if (!raw) return null;
                try {
                    if (typeof raw === 'string') {
                        try { return JSON.parse(raw); } catch (e) {}
                        if (raw.includes('=')) {
                            const params = new URLSearchParams(raw);
                            const obj = {};
                            for (const [k, v] of params) obj[k] = v;
                            return obj;
                        }
                        return null;
                    }
                    if (typeof FormData !== 'undefined' && raw instanceof FormData) {
                        const obj = {};
                        raw.forEach((v, k) => { obj[k] = v; });
                        return obj;
                    }
                    if (typeof URLSearchParams !== 'undefined' && raw instanceof URLSearchParams) {
                        const obj = {};
                        raw.forEach((v, k) => { obj[k] = v; });
                        return obj;
                    }
                    if (typeof raw === 'object') return raw;
                } catch (e) {}
                return null;
            };

            // 把 ajaxSuccess 监听注入到页面上下文（Tarou inject.ts 同款做法）
            // userscript 自身的 window 在某些 Tampermonkey 配置 / iframe 场景下和页面隔离，
            // 直接 jq(document).ajaxSuccess 可能挂不到游戏真正用的那个 jQuery；
            // 用 <script> 注入能保证拿到页面 jQuery，再 CustomEvent 回传给 userscript。
            const EVENT_NAME = '__candymark_ajax_success';

            // userscript 侧收到事件后还原响应数据并继续处理
            document.addEventListener(EVENT_NAME, (e) => {
                let payload;
                try {
                    payload = JSON.parse(e.detail);
                } catch (err) {
                    return;
                }
                if (!payload || !payload.url) return;
                const body = extractRequestFields(payload.requestData) || {};
                self.handleGameResponse(payload.responseData, payload.url, body);
            });

            if (window.__candymarkAjaxHooked) return;
            window.__candymarkAjaxHooked = true;

            // 注入到页面上下文：等 jQuery 出现 → 订阅 ajaxSuccess → 把数据 dispatch 给 userscript
            const script = document.createElement('script');
            script.textContent = `(function(){
                var attempts = 0;
                var maxAttempts = 100;
                var timer = setInterval(function(){
                    var jq = window.jQuery || window.$;
                    if (typeof jq === 'function') {
                        clearInterval(timer);
                        jq(document).ajaxSuccess(function(event, xhr, settings, data){
                            try {
                                document.dispatchEvent(new CustomEvent('${EVENT_NAME}', {
                                    detail: JSON.stringify({
                                        url: settings && settings.url,
                                        requestData: settings && settings.data,
                                        responseData: data
                                    })
                                }));
                            } catch(e) {}
                        });
                    } else if (++attempts > maxAttempts) {
                        clearInterval(timer);
                    }
                }, 100);
            })();`;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        }

        handleGameResponse(data, url, requestBody) {
            // requestBody 由 ajaxSuccess 的 settings.data 解析而来，已和本次响应绑定（无并发覆盖问题）
            const req = requestBody || {};
            // 分析响应数据，提取TURN信息，类似Chrome-Extension的处理方式
            if (data && typeof data === 'object') {
                this.detectOmen(data);
                let currentTurn = null;
                
                // 检查是否是战斗开始数据
                if (url.includes('/start.json') && data.boss && data.turn !== undefined) {
                    currentTurn = data.turn;
                    this.battleData.startTime = Date.now();
                    this.battleData.questId = String(data.quest_id || '');
                    // boss 图标 id（参照 Tarou：boss.param[0].cjs 形如 "enemy_8104023"，取末段）。
                    // 用 boss 图替代副本大厅图——部分副本无大厅图。
                    const bcjs = data.boss && data.boss.param && data.boss.param[0] && data.boss.param[0].cjs;
                    this.battleData.bossImgId = bcjs ? String(bcjs).split('_').pop() : '';
                    // 缓存当前战斗的技能 / 召唤列表，供"技能后" / "召唤后"过滤器使用
                    this.cacheAbilityList(data);
                    this.cacheSummonList(data);
                    // 记录"上次副本"，并把本场召唤/技能候选快照进该副本配置（供"辅助设置（战斗）"展示）
                    this.recordQuestSnapshot();
                    // 直前倒计时（参照 Tarou）：data.turn_waiting 是未来 ms 时间戳
                    if (data.turn_waiting != null) {
                        this.setChokuzenTarget(Number(data.turn_waiting));
                    }
                }
                
                // 检查是否是战斗结果数据
                if (url.includes('/result') && data.status && data.status.turn !== undefined) {
                    currentTurn = data.status.turn;
                }

                // 结算 API 响应 → 直接读 result_data.rewards.reward_list 解析掉落
                // 不再轮询 DOM；按 raidId 去重在 triggerAutoBack 内部完成
                if (/\/result(?:multi)?\/content\/index/.test(url)) {
                    this.checkDropsFromResponse(data);
                }


                // 检查是否包含turn字段
                if (data.turn !== undefined) {
                    currentTurn = data.turn;
                } else if (data.status && data.status.turn !== undefined) {
                    currentTurn = data.status.turn;
                }

                // Tarou 同款来源：直接读取 scenario 中服务端返回的 contribution.amount，
                // 不用伤害估算；这里只显示本次增加值，离开战斗后仍按 10s 计时消失。
                this.collectContribution(data);

                // 战斗结束（Tarou: scenario.some(item => item.cmd === 'win' && item.is_last_raid)）
                // 只看 attack/ability/summon 三个动作响应里的 data.scenario。
                // 不需要闸门：GBF 一次击杀只对应一次回包，串行处理，不会重复触发。
                // 命中后会短路同一响应里的 turn/summon/ability 分支，避免双触发。
                let battleEndHandled = false;
                const isAttackLikeUrl = url.includes('attack_result')
                    || url.includes('ability_result')
                    || url.includes('summon_result');
                if (isAttackLikeUrl
                        && Array.isArray(data.scenario)
                        && data.scenario.some(item => item && item.cmd === 'win' && item.is_last_raid)) {
                    const config = loadConfig();
                    if (this.runAutoAction(config.autoBattleEndAction, config)) {
                        battleEndHandled = true;
                    }
                }

                // 攻击后的战斗内自动动作（按副本设置）
                // 用 battleData.currentTurn（这次响应到来"之前"的回合数 = 攻击发起时的那一回合）
                // 这样即便击杀导致响应里没有 newTurn，也能用上一次记录的回合触发。
                //   回合内攻击后（turnLte）：turnAtAttack <= count，第 1..N 回合都触发
                //   该回合攻击后（turnEq）：turnAtAttack === count，只在第 N 回合那次触发，且优先于 turnLte
                if (!battleEndHandled && url.includes('attack_result')) {
                    const config = loadConfig();
                    const qs = this.currentQuestSetting(config);
                    const turnAtAttack = this.battleData.currentTurn;
                    if (qs && turnAtAttack > 0) {
                        // =N（该回合）优先于 ≤N（回合内）
                        if (qs.turnEq && qs.turnEq.action !== 'none' && turnAtAttack === qs.turnEq.count) {
                            this.runAutoAction(qs.turnEq.action, config);
                        } else if (qs.turnLte && qs.turnLte.action !== 'none' && turnAtAttack <= qs.turnLte.count) {
                            this.runAutoAction(qs.turnLte.action, config);
                        }
                    }
                }

                if (currentTurn !== null) {
                    this.onTurnChange(currentTurn, url, data);
                }

                // 新增：召唤结果后的后退/跳转，可被召唤过滤器收窄
                if (!battleEndHandled && url.includes('summon_result')) {
                    const config = loadConfig();
                    const qs = this.currentQuestSetting(config);
                    if (qs && qs.summon && qs.summon.action !== 'none') {
                        const usedId = req.summon_id != null ? String(req.summon_id) : null;
                        if (this.matchesSummonFilter(qs.summon.ids, usedId)) {
                            this.runAutoAction(qs.summon.action, config);
                        }
                    }
                }

                // 新增：能力结果后的后退/跳转，可被技能过滤器收窄
                if (!battleEndHandled && url.includes('ability_result')) {
                    const config = loadConfig();
                    const qs = this.currentQuestSetting(config);
                    if (qs && qs.ability && qs.ability.action !== 'none') {
                        const usedId = req.ability_id != null ? String(req.ability_id) : null;
                        if (this.matchesAbilityFilter(qs.ability.ids, usedId)) {
                            this.runAutoAction(qs.ability.action, config);
                        }
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

            // 攻击后的后退/跳转已移至 handleGameResponse，使用攻击发起时的回合数判断
            // （避免击杀导致响应里没有 newTurn 时漏触发）

            // 战斗日志记录
            const timestamp = new Date().toLocaleTimeString();
            //console.log(`🎮 [CandyMark] TURN更新 | ${timestamp} | 当前TURN: ${newTurn} | URL: ${url.split('/').pop()}`);

            if (oldTurn !== null && oldTurn !== newTurn) {
                //console.log(`⚡ [CandyMark] TURN变化报告: T${oldTurn} → T${newTurn} (变化: ${newTurn - oldTurn})`);
            } else if (oldTurn === null) {
                //console.log(`✅ [CandyMark] 初始化TURN: ${newTurn}`);
            }
        }

        getBattleStats() {
            return {
                ...this.battleData,
                battleDuration: this.battleData.startTime ? (Date.now() - this.battleData.startTime) / 1000 : 0
            };
        }

        // 从 /result(?:multi)?/content/index 响应里直接解析掉落，替代之前的 DOM 轮询
        // schema 参考 Tarou useDataCenter.ts:961 handleResultContent
        //   result_data.rewards.reward_list = { <bucket>: { <slot>: { type, thumbnail_img, id, count } } }
        // 拼出和 DOM <img src> 形态一致的 URL，再过 imgSrcToKey 得到和订阅图标统一的 key
        checkDropsFromResponse(data) {
            const result_data = data && data.option && data.option.result_data;
            const rewardList = result_data && result_data.rewards && result_data.rewards.reward_list;

            const droppedKeys = new Set();
            if (rewardList && typeof rewardList === 'object') {
                Object.values(rewardList).forEach(bucket => {
                    if (!bucket || typeof bucket !== 'object') return;
                    Object.values(bucket).forEach(value => {
                        if (!value || !value.type) return;
                        const imgName = value.thumbnail_img || value.id;
                        if (!imgName) return;
                        const url = `https://prd-game-a-granbluefantasy.akamaized.net/assets/img/sp/assets/${value.type}/m/${imgName}.jpg`;
                        const key = this.imgSrcToKey(url);
                        if (key) droppedKeys.add(key);
                    });
                });
            }

            // 用户订阅匹配
            const config = loadConfig();
            const subs = config.dropSubscriptions || [];
            const hitIcons = [];
            for (const sub of subs) {
                if (!sub || !sub.iconUrl) continue;
                const subKey = this.imgSrcToKey(sub.iconUrl);
                if (subKey && droppedKeys.has(subKey)) {
                    hitIcons.push(sub.iconUrl);
                }
            }
            if (hitIcons.length > 0) {
                this.showDropHitModal(hitIcons);
                return;
            }

            // 没命中订阅 → 走自动后退/跳转（含"纯经验场次"，reward_list 为空也走这里）
            this.triggerAutoBack();
        }

        // 把 GBF 图片 URL 归一化成一个稳定 key（参考 Tarou imgSrcToKey）
        // 例如 https://X.akamaized.net/assets/img_mid/sp/assets/item/article/m/215.jpg
        //      → /item/article/s/215.jpg
        imgSrcToKey(src) {
            if (!src || typeof src !== 'string') return '';
            const arr = src.split(/\/assets(?:_en)?\/img(?:_low|_mid)?\/sp\/assets/);
            if (arr.length !== 2) return '';
            return arr[1]
                .replace(/\/(?:m|b)\//, '/s/')
                .replace(/\.png(?:\?.*)?$/, '.jpg')
                .replace(/\?.*$/, '');
        }
        
        showDropHitModal(iconUrls) {
            const urls = (Array.isArray(iconUrls) ? iconUrls : [iconUrls]).filter(Boolean);
            const formatDropTime = (d) => {
                const pad = (n) => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };
            const modal = document.getElementById('sb-drop-hit-modal');
            if (!modal) {
                // 兜底：UI 还没建好就退化成 alert
                alert(`🎉 物品掉落了！🎉\n时间：${formatDropTime(new Date())}`);
                this.triggerAutoBack();
                return;
            }
            const wrap = document.getElementById('sb-drop-hit-icons');
            wrap.innerHTML = urls.map(u => `<img src="${u}" alt="掉落物">`).join('');
            document.getElementById('sb-drop-hit-time').textContent = formatDropTime(new Date());
            const okBtn = document.getElementById('sb-drop-hit-ok');
            okBtn.onclick = () => {
                modal.classList.remove('show');
                this.triggerAutoBack();
            };
            modal.classList.add('show');
        }

        triggerAutoBack() {
            const currentUrl = window.location.href;

            // 按 raidId 去重：同一场战斗在 result_multi/N ↔ result_multi/empty/N 之间反复切
            // 时不会重复触发；连续收菜（多场不同 raidId）每场会各自触发一次
            const raidId = this.extractRaidIdFromUrl(currentUrl);
            if (raidId && this.firedDropBackRaidIds.has(raidId)) {
                return;
            }

            // 同 URL 短窗口去重（兜底，应对 extractRaidId 失败的极端情况）
            if (this.autoBackAfterDropCheck.lastProcessed.url === currentUrl) {
                return;
            }

            const config = loadConfig();
            const action = config.autoDropAction;
            if (action === 'none') {
                return;
            }

            this.autoBackAfterDropCheck.lastProcessed.url = currentUrl;
            if (raidId) this.firedDropBackRaidIds.add(raidId);

            if (this.autoBackAfterDropCheck.timeoutId) {
                clearTimeout(this.autoBackAfterDropCheck.timeoutId);
                this.autoBackAfterDropCheck.timeoutId = null;
            }

            this.runAutoAction(action, config);
        }

        /**
         * 尝试执行自动跳转。若该时机已开启且配置了合法目标，跳转并返回 true；否则返回 false。
         * @param {'turn'|'drop'|'summon'|'ability'} timing
         * @param {object} [cachedConfig] 可选，已 loadConfig 过的结果
         */
        cacheAbilityList(data) {
            if (!data || !data.ability) return;
            const list = [];
            try {
                Object.values(data.ability).forEach(charAbility => {
                    if (!charAbility || !charAbility.list) return;
                    Object.values(charAbility.list).forEach(slot => {
                        const first = Array.isArray(slot) ? slot[0] : slot;
                        if (!first) return;
                        const id = first['ability-id'];
                        if (!id) return;
                        const cls = first['class'] || '';
                        // GBF 的 class 是 "ico-ability1921_1"（注意：ability 后没有连字符）
                        const iconClass = cls.split(/\s+/).find(c => c.startsWith('ico-ability'));
                        const iconId = iconClass ? iconClass.substring('ico-ability'.length) : '';
                        list.push({
                            id: String(id),
                            iconId,
                            icon: iconId
                                ? `https://prd-game-a-granbluefantasy.akamaized.net/assets/img_low/sp/ui/icon/ability/m/${iconId}.png`
                                : ''
                        });
                    });
                });
            } catch (e) {
                // 数据结构若有变化就静默放弃
                return;
            }
            // 按 id 去重，避免不同角色的同名技能重复
            const seen = new Set();
            this.battleData.abilityList = list.filter(a => {
                if (seen.has(a.id)) return false;
                seen.add(a.id);
                return true;
            });
        }

        // 从 start.json 的 data.summon 数组里提取召唤石列表：{id, imageId, icon}
        // 注意：召唤请求体里的 summon_id 是 1-based 栏位下标（"1"~"5"）或 "supporter"，
        // 不是召唤石本身的 id（如 "2040368000"）。matchesSummonFilter 走相应翻译。
        cacheSummonList(data) {
            if (!data) return;
            const buildEntry = (s) => {
                if (!s || !s.id) return null;
                const imageId = String(s.image_id || s.id || '');
                if (!imageId) return null;
                return {
                    id: String(s.id),
                    imageId,
                    icon: `https://prd-game-a-granbluefantasy.akamaized.net/assets/img_low/sp/assets/summon/m/${imageId}.jpg`
                };
            };

            if (Array.isArray(data.summon)) {
                this.battleData.summonList = data.summon.map(buildEntry).filter(Boolean);
            } else {
                this.battleData.summonList = [];
            }

            // 友方借召（请求体里 summon_id === "supporter"）
            this.battleData.supporterSummon = buildEntry(data.supporter);
        }

        // filter 里的 id 字段是 iconId；usedAbilityId 是 ability_result 请求体里的 ability_id，
        // 需要先翻译成 iconId 再比对。
        matchesAbilityFilter(filter, usedAbilityId) {
            if (!Array.isArray(filter) || filter.length === 0) return true;
            if (usedAbilityId == null) return false;
            const abilityList = (this.battleData && this.battleData.abilityList) || [];
            const hit = abilityList.find(a => String(a.id) === String(usedAbilityId));
            if (!hit || !hit.iconId) return false;
            const target = String(hit.iconId);
            return filter.some(item => {
                const id = (typeof item === 'string' || typeof item === 'number') ? item : (item && item.id);
                return String(id) === target;
            });
        }

        // filter 里的 id 字段是 imageId（如 "2040065000_02"）；
        // 请求体里的 summon_id 是 1-based 栏位下标（"1"~"5"）或 "supporter"，
        // 需要先翻译成 imageId 再比对。
        matchesSummonFilter(filter, usedSummonId) {
            if (!Array.isArray(filter) || filter.length === 0) return true;
            if (usedSummonId == null) return false;
            const bd = this.battleData || {};
            let hit = null;
            if (String(usedSummonId) === 'supporter') {
                hit = bd.supporterSummon;
            } else {
                const idx = parseInt(usedSummonId, 10);
                if (!isNaN(idx) && idx >= 1) {
                    hit = (bd.summonList || [])[idx - 1];
                }
            }
            if (!hit || !hit.imageId) return false;
            const target = String(hit.imageId);
            return filter.some(item => {
                const id = (typeof item === 'string' || typeof item === 'number') ? item : (item && item.id);
                return String(id) === target;
            });
        }

        // 取当前副本（进战斗时记录的 quest_id）的战斗内辅助设置；无则 null
        currentQuestSetting(cachedConfig) {
            const config = cachedConfig || loadConfig();
            const qid = this.battleData && this.battleData.questId;
            if (!qid) return null;
            return (config.questSettings || {})[qid] || null;
        }

        // 执行一个自动动作：jump/refresh/back/none。返回是否执行了动作。所有动作统一延迟 130ms。
        runAutoAction(action, cachedConfig) {
            if (action === 'jump') return this.doAutoJump(cachedConfig);
            if (action === 'refresh') {
                setTimeout(() => { location.reload(); }, 130);
                return true;
            }
            if (action === 'back') {
                setTimeout(() => { if (window.history.length > 1) history.back(); }, 130);
                return true;
            }
            return false;
        }

        // 跳转到全局跳转目标（若已配置且合法）。返回是否触发。
        doAutoJump(cachedConfig) {
            const config = cachedConfig || loadConfig();
            if (config.autoJumpTargetId == null) return false;
            let target = null;
            try {
                const bookmarks = JSON.parse(localStorage.getItem('candymark-bookmarks-javascript') || '[]');
                target = bookmarks.find(b => b && b.id === config.autoJumpTargetId);
            } catch (e) {
                return false;
            }
            if (!target || !target.url) return false;
            if (target.url === 'back' || target.url === 'click-through-back' || target.url === 'reload') return false;
            setTimeout(() => { location.href = target.url; }, 130);
            return true;
        }

        // 进入副本时：记录"上次副本"，并把本场召唤/技能候选快照进该副本配置
        recordQuestSnapshot() {
            const qid = this.battleData.questId;
            if (!qid) return;
            // 直接写 manager 持有的 CONFIG（而非 loadConfig() 的重建副本）：
            // storage.setValue 任何 sb_* 都会让 _configCache 失效，loadConfig() 会返回一个
            // 新对象，本次快照就进不了打开面板时读取的 CONFIG，要等整页 reload 才可见。
            CONFIG.lastQuestId = qid;
            if (!CONFIG.questSettings) CONFIG.questSettings = {};
            const summonChoices = (this.battleData.summonList || []).slice();
            if (this.battleData.supporterSummon) summonChoices.push(this.battleData.supporterSummon);
            const abilityChoices = (this.battleData.abilityList || []).slice();
            const base = CONFIG.questSettings[qid] || {
                questImg: '',
                turnLte: { action: 'none', count: 3 },
                turnEq: { action: 'none', count: 1 },
                summon: { action: 'none', ids: [] },
                ability: { action: 'none', ids: [] },
                summonChoices: [],
                abilityChoices: []
            };
            // boss 图标（部分副本无大厅图，故不用大厅图）
            base.questImg = this.battleData.bossImgId
                ? `https://prd-game-a-granbluefantasy.akamaized.net/assets/img/sp/assets/enemy/m/${this.battleData.bossImgId}.png`
                : base.questImg;
            base.summonChoices = summonChoices.map(s => ({ imageId: s.imageId, icon: s.icon }));
            base.abilityChoices = abilityChoices.map(a => ({ iconId: a.iconId, icon: a.icon }));
            CONFIG.questSettings[qid] = base;
            storage.setValue('sb_quest_settings', JSON.stringify(CONFIG.questSettings));
            storage.setValue('sb_last_quest_id', qid);
        }

        // ===== 预兆信息浮层（落盘版）=====
        // 落盘在 cm_omen_log（cm_ 前缀，不触发配置缓存失效），结构 { [raidId]: [{turn,text,preLabel,result,ts}] }
        // 每个战斗(raidId)只保留 2 条；每条出现/结算后 10min 过期；只在战斗页展示，后退/刷新后从落盘恢复。
        //
        // 结算逻辑（解除写存储、未解除靠渲染推断）：
        //   解除 = special_skill_interrupt（带 label，如 "break_standby_A"）→ 去 break_ 得被解除预兆的
        //          pre_label → 找「最晚命中该 pre_label 且未结算」的行，写 result='success'。精确：延迟解除
        //          （信号晚到别的回合，如奥义连锁后才发动的被动技伤）、pre_label 循环复用都不会标错。
        //          这是唯一写入存储的结算结果。
        //   未解除 = 渲染时推断，不写存储。依据：解除是准确的，一个预兆只有「解除 / 未解除」两种结局，每回合
        //          都应落到其一。所以「未被标解除、且回合数已对不上当前回合（回合已推进过它）」的行即未解除。
        //          不依赖 super（未解除未必伴随 super）。延迟解除也安全——未解除只是渲染推断，存储仍是 null，
        //          迟到的 interrupt 仍能按 pre_label 把该行改写为 success，渲染随之从「未解除」变「解除」。
        //   当前 = 回合数 === 当前战斗回合（_omenCurTurn，detectOmen 实时更新），与解除结果独立。回合一推进，
        //          回合数对不上的旧预兆立即去掉「当前」（不靠下一个预兆来顶）。
        //   登记新预兆 → 用 status.turn 当回合。
        //
        // 边界：刷新/后退后首个 ajax 响应到来前不知当前回合，暂以最大回合行充当「当前」，响应一到即校正。
        currentRaidId() {
            const url = window.location.href;
            if (!/[#/]raid/i.test(url)) return null;   // 不在战斗页则不展示/不记录
            return this.extractRaidIdFromUrl(url);
        }

        loadOmenStore() {
            try {
                const obj = JSON.parse(storage.getValue('cm_omen_log', '{}'));
                return (obj && typeof obj === 'object') ? obj : {};
            } catch (e) { return {}; }
        }

        saveOmenStore(store) {
            storage.setValue('cm_omen_log', JSON.stringify(store));
        }

        // 删除所有过期(>10min)记录；返回是否有改动
        pruneOmenStore(store) {
            const now = Date.now();
            let changed = false;
            for (const rid of Object.keys(store)) {
                const orig = store[rid] || [];
                const kept = orig.filter(r => r && (now - r.ts) <= 600000);
                if (kept.length !== orig.length) changed = true;
                if (kept.length) store[rid] = kept;
                else { delete store[rid]; changed = true; }
            }
            return changed;
        }

        detectOmen(data) {
            const raidId = this.currentRaidId();
            if (!raidId) return;   // 战斗以外不记录
            const prevTurn = this.battleData.currentTurn || 0;
            const newTurn = (data.status && data.status.turn != null) ? Number(data.status.turn)
                : (data.turn != null ? Number(data.turn) : prevTurn);

            // 记录「当前战斗回合」供渲染判定「当前」：回合推进后，回合数对不上的旧预兆即非当前
            // （不靠下一个预兆来顶）。detectOmen 早于 onTurnChange，battleData.currentTurn 还是上一拍，
            // 故单独存 _omenCurTurn。
            const turnChanged = (this._omenCurTurn !== newTurn);
            this._omenCurTurn = newTurn;

            // 1) 结算「解除」：special_skill_interrupt.label 形如 "break_standby_A"，去掉 break_ 得被解除
            //    预兆的 pre_label → 按 pre_label 精确匹配那一行（不靠回合归属），解决延迟解除（信号晚到别
            //    的回合）。「未解除」不在此标——改由渲染推断（见 renderOmenLog）。
            let rendered = false;
            if (Array.isArray(data.scenario)) {
                const interruptItem = data.scenario.find(i => i && i.cmd === 'special_skill_interrupt');
                if (interruptItem) { this.resolveOmenByLabel(raidId, interruptItem.label, 'success'); rendered = true; }
            }

            // 2) 登记新预兆（归属操作后回合，结果留空，显示「当前」），带 pre_label 供解除时精确匹配
            const ind = (data.status && data.status.special_skill_indicate) || data.special_skill_indicate;
            const p = ind && ind[0];
            const text = (p && Array.isArray(p.interrupt_display_text))
                ? p.interrupt_display_text.filter(Boolean).join(' / ') : '';
            if (text) { this.upsertOmen(raidId, newTurn, text, (p && p.pre_label) || ''); rendered = true; }

            // 回合推进但本响应没动到任何记录时，也要重渲染，让旧「当前」按新回合落位
            if (turnChanged && !rendered) this.renderOmenLog();
        }

        upsertOmen(raidId, turn, text, preLabel) {
            const store = this.loadOmenStore();
            const rows = store[raidId] || (store[raidId] = []);
            const row = rows.find(r => r.turn === turn);
            if (row) { row.text = text; row.preLabel = preLabel; row.ts = Date.now(); }
            else {
                rows.push({ turn, text, preLabel, result: null, ts: Date.now() });
                rows.sort((a, b) => a.turn - b.turn);   // 最新回合在最下
                while (rows.length > 2) rows.shift();    // 每个战斗只保留 2 条
            }
            this.saveOmenStore(store);
            this.renderOmenLog();
        }

        // 解除：按 pre_label 找「最晚命中且未结算」的那行（rows 按 turn 升序，从后往前取第一个匹配）。
        // 这样即使 pre_label 循环复用，旧的同 pre_label 早已结算/过期，只会标到当前正在解的那个。
        resolveOmenByLabel(raidId, label, result) {
            const store = this.loadOmenStore();
            const rows = store[raidId];
            if (!rows) return;
            const target = (typeof label === 'string') ? label.replace(/^break_/, '') : '';
            let row = null;
            if (target) {
                for (let k = rows.length - 1; k >= 0; k--) {
                    if (rows[k].result == null && rows[k].preLabel === target) { row = rows[k]; break; }
                }
            }
            if (!row) row = rows.find(r => r.result == null);   // 兜底：label 缺失/未匹配 → 退回最早一个未结算
            if (!row) return;
            row.result = result;
            row.ts = Date.now();
            this.saveOmenStore(store);
            this.renderOmenLog();
        }

        renderOmenLog() {
            const el = document.getElementById('sb-omen-log');
            if (!el) return;
            if (this._omenRenderTimer) { clearTimeout(this._omenRenderTimer); this._omenRenderTimer = null; }
            const store = this.loadOmenStore();
            if (this.pruneOmenStore(store)) this.saveOmenStore(store);
            const raidId = this.currentRaidId();
            const rows = (raidId && store[raidId]) ? store[raidId] : [];
            if (!rows.length) { el.innerHTML = ''; return; }
            const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            // 逐行结果：解除（存储 result='success'）准确直显；「当前」只看战斗回合，与解除结果独立——
            // 回合数 === 当前回合 → 「当前」（若已解除，则同时显示「解除」）；
            // 回合数 < 当前回合且未标解除 → 「未解除」（回合已推进过它，反向推断必为未解除）。
            // _omenCurTurn 为当前回合（detectOmen 实时更新）；刷新后首个响应到来前回退到最大回合行。
            const curTurn = (this._omenCurTurn != null) ? this._omenCurTurn : rows[rows.length - 1].turn;
            el.innerHTML = rows.map(r => {
                const cur = (r.turn === curTurn) ? '（当前）' : '';
                let resultHtml = '';
                if (r.result === 'success') resultHtml = '<span class="sb-omen-success">解除</span>';
                else if (r.turn !== curTurn) resultHtml = '<span class="sb-omen-fail">未解除</span>';
                return `<div class="sb-omen-row"><span class="sb-omen-turn">第${r.turn}回合${cur}</span>${esc(r.text)}${resultHtml}</div>`;
            }).join('');
            // 定时重渲染清理过期：取最近一条的剩余时间（≥1s，≤5s 兜底）
            const now = Date.now();
            let minLeft = 600000;
            rows.forEach(r => { minLeft = Math.min(minLeft, 600000 - (now - r.ts)); });
            this._omenRenderTimer = setTimeout(() => this.renderOmenLog(), Math.max(1000, Math.min(minLeft, 5000)));
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
