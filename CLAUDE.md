# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在处理本仓库代码时提供指导。

## 项目概述

CandyMark 是一个移动端优化的用户脚本（Tampermonkey/Greasemonkey），用原生 JavaScript 编写，单文件 `candymark.user.js`。核心是浮动书签导航；并提供一组基于页面事件的自动导航与提醒功能（针对碧蓝幻想的单页应用）。

- `@match` 实际限定为碧蓝幻想域名：`game.granbluefantasy.jp`、`gbf.game.mbga.jp`（**不是任意网站**）。
- 通过 GitHub Pages 部署/分发，安装地址 `https://unixliang.github.io/candymark/candymark.user.js`。

## 部署

```bash
git add .
git commit -m "..."
git push github main      # 远程名是 github（不是 origin）
```

合并工作流（worktree → main）：在 worktree 提交后 `git -C <repo> merge <branch> --no-edit` 再 `git push github main`，通常是 fast-forward。

## 存储与配置（重要）

- **存储后端是 `localStorage`，不是 GM_setValue**。`storage.setValue/getValue` 是对 `localStorage` 的封装（见文件顶部 `const storage`）。
- 书签数组单独存：key `candymark-bookmarks-javascript`。每个书签可带 `shortcut`：键盘为 `{type:'keyboard',code,key,ctrlKey,altKey,shiftKey,metaKey}`（旧数据没有 `type` 也兼容），手柄为 `{type:'gamepad',button,label}`。因此快捷键随书签一起导入导出，不属于 `CONFIG`。
- 其余设置以 `sb_` 前缀存储。
- **前缀决定是否触发配置缓存失效**：`sb_*` 写入会 `invalidateConfigCache()`（见下）；`cm_*` 前缀**不会**（用于不进 `CONFIG` 的运行时状态，如 `cm_omen_log` 预兆浮层、`cm_chokuzen_target` 倒计时）。
- **配置缓存陷阱**：`loadConfig()` 带缓存 `_configCache`；**任何 `sb_*` 写入都会 `invalidateConfigCache()`**，下次 `loadConfig()` 会重建一个新对象。而 `const CONFIG = loadConfig()` 在启动时只求值一次，**永久绑定初始对象**。
  - manager（面板/导入导出）统一读写全局 `CONFIG`；GameDetector 的触发逻辑用 `loadConfig()` 只读取值。
  - **若要在后台写入、又希望面板立即可见，必须直接写 `CONFIG`**（不要先 `setValue` 再 `loadConfig()`，否则拿到的是重建副本，写入进不了面板读取的 `CONFIG`，要等整页 reload 才可见）。`recordQuestSnapshot` 就是踩过这个坑后改成直接写 `CONFIG` 的。

## 架构

### CandyMarkManager
管理书签、UI、菜单、所有模态框。状态：`bookmarks[]`（id/name/url/x/y/domain/colorIndex）、`currentBookmarkId`、`isContextMenuOpen`。

性能：事件委托、增量渲染（`renderBookmarks()` 增量 / `renderBookmarks(true)` 全量）、防抖存储（位置等 300ms，关键操作立即）、CSS 类替代内联样式。

### GameDetector
监听 jQuery ajax 响应（`handleGameResponse(data, url, requestBody)`），负责：
- 战斗数据采集：`start.json` → `cacheAbilityList` / `cacheSummonList`，填充 `battleData.{abilityList, summonList, supporterSummon, questId, currentTurn...}`（内存，每场战斗由 start.json 重填，不落盘）。
- 自动导航触发（见下）。
- 掉落检测（`/result(multi)/content/index` → `checkDropsFromResponse`）。
- 直前倒计时（参照 Tarou：`data.turn_waiting` 是未来 epoch ms，持久化到 `cm_chokuzen_target`）。
- 预兆解除检测（`detectOmen` → 底部浮层，见下）。

## 浮动书签导航

- 添加：左上角触发器 / `Ctrl+B`；菜单：移动端长按 600ms / PC 右键。
- 拖拽定位、10 级大小 / 透明度、配色循环。
- 菜单结构：
  - **书签长按菜单**（`sb-menu`）：拖拽 / 设置当前页 / 设置后退 / 设置刷新 / 设置穿透点击后退 / 穿透后退延迟 / 改名 / 删除 / **⚙️ 全局配置（打开左上角主菜单 `sb-add-menu`）** / 取消。
  - **主菜单**（`sb-add-menu`，点左上角触发器）：增加标签 / 调整大小 / 调整透明度 / ⌨️ 快捷键设置 / 🌐 辅助设置（常态）/ ⚔️ 辅助设置（战斗）/ 🔔 掉落通知 / ⚙️ 配置管理 / 取消。

### 标签快捷键

- UI：`#sb-shortcut-modal`。每个标签可配置一个物理键盘按键 `code` 及 Ctrl / Alt / Shift / Meta 修饰键，或一个 Gamepad 按钮；`Ctrl+B` 保留给主菜单，同来源的重复快捷键不能保存。
- 触发：document 捕获阶段监听 `keydown`，输入框 / textarea / select / contenteditable、其它模态框、拖拽状态下不触发，长按重复事件也不触发。
- 手柄：仅在正在录入或至少存在一个手柄快捷键时，用 `requestAnimationFrame` 轮询 `navigator.getGamepads()`；缓存上帧按钮状态，仅在 `false → true` 时触发，所以长按不连发。标准按钮索引 0/1/2/3 显示为 A/B/X/Y。
- 执行：`handleBookmarkShortcutEvent()` 命中后调用 `executeBookmarkAction(bookmark)`，直接执行 URL 导航、`history.back()` 或 `location.reload()`，不会调用 DOM `click()`。`click-through-back` 没有键盘坐标，快捷键只执行其延迟后退部分。

### 特殊链接
书签 `url` 除普通 URL 外支持动作值：
- `"back"` → `window.history.back()`
- `"reload"` → `location.reload()`
- `"click-through-back"` → 用 `pointer-events: none` 实现真正点击穿透到下层元素，延迟 `clickThroughDelay` 后 `history.back()`。仅在书签常态触发；菜单打开 / 拖拽模式 / 刚长按打开菜单时不触发。

## 自动导航（辅助设置）

把页面事件分成两组，每个时机可选一个动作：`none | back | refresh | jump`（`jump` 跳到全局唯一目标书签 `autoJumpTargetId`）。

### 常态（全局）
- `autoBattleEndAction`（战斗结束后）、`autoDropAction`（结算后）。存 `sb_auto_battle_end_action` / `sb_auto_drop_action`。
- UI：`#sb-auto-normal-modal`，方法 `showAutoNormalModal` 等，id 前缀 `sb-nm-`，`data-action="auto-normal"`。

### 战斗内（按副本）
- **副本标识 = `start.json` 的 `data.quest_id`**（参照 Tarou）。**副本图标用 boss 图**（部分副本无大厅图）：`boss.param[0].cjs`（形如 `enemy_8104023`）取末段为 enemy id，URL `…/sp/assets/enemy/m/{id}.png`（不再用大厅图）。
- `CONFIG.questSettings`（存 `sb_quest_settings`）是 map：
  ```
  { [questId]: {
      questImg,
      turnLte: { action, count },   // 前 N 回合攻击后（turnAtAttack <= count）
      turnEq:  { action, count },   // 第 N 回合攻击后（turnAtAttack === count）
      summon:  { action, ids:[{id,icon}] },   // ids 为 imageId 过滤
      ability: { action, ids:[{id,icon}] },   // ids 为 iconId 过滤
      summonChoices:  [{imageId, icon}],      // 候选快照（落盘，供脱离战斗时 UI 展示）
      abilityChoices: [{iconId,  icon}],
  } }
  ```
- `lastQuestId`（存 `sb_last_quest_id`）：最近进入的副本。
- UI：`#sb-auto-battle-modal`，副本用 boss 图标网格选择（标注 当前/上次/未设置；列表只展示 当前 + 上次 + 已配置过动作的副本）。`renderAutoBattleScene(questId)` 渲染 4 个场景；`recordQuestSnapshot()` 在进副本时把召唤/技能候选快照进该副本并落盘。

### 触发逻辑（`handleGameResponse`）
- `start.json` → 记 `battleData.questId` + `recordQuestSnapshot()`。
- 战斗结束（`attack/ability/summon_result` 的 `data.scenario` 含 `win && is_last_raid`）→ `runAutoAction(autoBattleEndAction)`。
- `attack_result` → 按当前副本设置：**`turnEq`（=N）优先于 `turnLte`（≤N）**。
- `summon_result` / `ability_result` → 按副本设置，`matchesSummonFilter` / `matchesAbilityFilter` 收窄（把请求体的栏位下标 / ability_id 用 **当前战斗的** battleData 翻译成 imageId / iconId 再比对——所以触发判断必须用内存实时列表，不能用落盘快照）。
- 结算（`result content/index`）→ 先检查掉落订阅命中（弹窗），否则 `triggerAutoBack()` 走 `autoDropAction`（按 raidId 去重）。
- 统一执行：`runAutoAction(action, config)` / `doAutoJump(config)`，所有动作统一延迟 130ms。

## 掉落提醒

`dropSubscriptions`（存 `sb_drop_subscriptions`，每项 `{itemId, kind, iconUrl}`）。用户从副本掉落预览页（`.prt-drop-item-list`）或战斗结算页（`.prt-item-list` 内 `data-key`）勾选订阅；结算响应命中时弹窗（`showDropHitModal`）。图标 URL 经 `imgSrcToKey` 归一化比对。

## 预兆浮层

战斗内底部浮层（`#sb-omen-log`），展示 boss 特殊技「预兆」的解除/未解除结果。落盘 `cm_omen_log`（`cm_` 前缀，不触发配置缓存失效），结构 `{ [raidId]: [{turn, text, preLabel, result, ts}] }`。每个战斗（raidId）只保留 2 条；每条出现/结算后 10min 过期；只在战斗页展示，后退/刷新后从落盘恢复。核心方法都在 GameDetector：`detectOmen` / `upsertOmen` / `resolveOmenByLabel` / `renderOmenLog`。

**结算逻辑（解除写存储、未解除靠渲染推断，刻意不对称）：**
- **解除** = `special_skill_interrupt`（带 `label`，如 `break_standby_A`）→ 去 `break_` 得被解除预兆的 `pre_label` → 找「最晚命中该 pre_label 且未结算」的行，写 `result='success'`。**这是唯一写入存储的结算结果**。按 pre_label 精确匹配（不靠回合归属），所以延迟解除（信号晚到别的回合，如土巫妖被动在奥义连锁后才发动）、pre_label 循环复用都不会标错。
- **未解除** = **渲染时推断，不写存储**。依据：解除是准确的，一个预兆只有解除/未解除两种结局；故「未标解除、且回合数 < 当前回合」的行即未解除。不依赖 `super`。**关键好处**：未解除只是渲染态、存储仍是 `null`，所以延迟到达的 `interrupt` 仍能按 pre_label 把该行改写为 `success`——界面原地从「未解除」翻成「解除」，无需任何覆盖逻辑。
- **当前** = `turn === 当前战斗回合`（`_omenCurTurn`，`detectOmen` 每个响应实时更新；它早于 `onTurnChange`，故不能用 `battleData.currentTurn`），与是否已解除独立。回合一推进，回合数对不上的旧预兆立即去掉「当前」。
- 边界：刷新/后退后、首个 ajax 响应到来前不知当前回合，暂以最大回合行充当「当前」，响应一到即校正。

## 配置导入导出

`exportConfig` / `exportToClipboard` 导出 `{bookmarks, settings}`；`importConfig`（文件）/ `importFromClipboard` 导入并逐项校验。settings 含书签视觉设置、`dropSubscriptions`、`autoBattleEndAction` / `autoDropAction` / `autoJumpTargetId` / `questSettings` / `lastQuestId`。**新增配置项时，导出两处 + 导入两处都要同步。**

## 常见修改模式

### 添加配置项
1. `loadConfig()` 的 `_configCache` 里加字段（读 `sb_` 键）。
2. 导出（`exportConfig` + `exportToClipboard`）和导入（`importConfig` + `importFromClipboard`）各两处同步。
3. 写入用 `storage.setValue('sb_...', ...)`；若需面板即时可见，注意上面的「配置缓存陷阱」。

### 扩展菜单 / 模态框
1. 菜单 HTML 加项 + `data-action`；在对应 `handleMenuAction` / `handleAddMenuAction` 加 case。
2. 模态框 HTML + CSS + show/hide/confirm 方法 + 事件绑定。

## 其它实现要点

- 拖拽：集中式 `dragState`，预绑定处理器减少分配，定时器与监听器清理防泄漏。
- 容器状态类：`.sb-container--menu-open` / `.sb-container--drag-mode`。
- 移动端：长按 600ms、手势防护、`transform: translateZ(0)` 硬件加速。
- 生命周期：黑名单检查 → CSS 注入 → DOM 创建 → 事件绑定（委托）→ 数据加载 → 渲染。

## 文件结构

- `candymark.user.js`：脚本主文件（全部功能）。
- `README.md`：项目说明（面向用户，已弱化辅助定位、注明仅供学习交流）。
- `CLAUDE.md`：本文件。
