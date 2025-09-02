# CandyMark - 移动端标签导航

一个基于原生JavaScript开发的移动端网页标签导航**油猴脚本**，支持悬浮标签、拖拽移动、本地存储等功能。**安装一次，在任意网站自动运行！**

## 📋 项目概述

CandyMark是一款专为移动端优化的书签导航工具，以用户脚本形式运行在网页上。它解决了移动设备浏览网页时难以快速访问常用页面的问题，提供了一种直观、易用的浮动标签解决方案。通过支持悬浮标签、拖拽移动、本地存储等功能，让用户能够自定义和管理个人网页导航。

### 目标用户
1. 移动端网页重度使用者，特别是游戏玩家（如碧蓝幻想用户）
2. 需要在多个网页间频繁切换的用户
3. 对浏览器书签管理不够便捷的用户
4. 希望个性化定制网页浏览体验的技术爱好者

### 核心原则
- **移动端优先**：所有设计和优化都以移动设备使用体验为核心
- **简洁易用**：界面简单直观，操作符合用户直觉
- **隐私保护**：所有数据本地存储，不收集用户隐私信息
- **性能优化**：轻量级实现，不影响网页正常加载和使用
- **兼容性强**：支持主流移动浏览器和用户脚本管理器

## 🚀 在线体验

- **主页安装**：[https://unixliang.github.io/candymark/](https://unixliang.github.io/candymark/)
- **直接安装**：[https://unixliang.github.io/candymark/candymark.user.js](https://unixliang.github.io/candymark/candymark.user.js)
- **标签管理器**：[https://unixliang.github.io/candymark/manager.html](https://unixliang.github.io/candymark/manager.html)

## ✨ 核心功能

### 📌 基础功能
- **1cm×1cm正方形标签**：精美的悬浮标签设计
- **智能添加**：点击页面左上角透明区域快速新增
- **跨平台交互**：移动端长按、PC端右键菜单
- **自由拖拽**：标签可拖拽到页面任意位置
- **本地存储**：数据自动保存，永不丢失

### 🌟 高级功能
- **自动运行**：油猴脚本自动在所有网站运行，无需手动激活
- **智能配置**：支持网站黑名单、快捷键、触发器显隐设置
- **URL智能管理**：一键设置当前页面为标签链接
- **快捷操作**：支持Ctrl+B快捷键和右键菜单管理
- **配置管理**：完整的导入导出系统，支持文件和剪贴板操作
- **视觉定制**：10级大小调整和透明度控制，实时预览
- **增强导航**：支持双击后退和可配置时间间隔
- **通知系统**：游戏掉落提醒功能（FFJ、沙漏等）
- **自动后退**：支持基于攻击次数、掉落、召唤、技能的自动后退功能

## 🎯 技术架构

### 核心技术
- **原生JavaScript**：无依赖，纯原生JS开发 (ES6+)
- **移动端优化**：完美适配移动端触摸交互
- **响应式设计**：自适应不同屏幕尺寸
- **现代CSS**：使用CSS3动画和渐变效果
- **GitHub Pages**：支持直接部署到GitHub Pages

### 架构特点
- **事件委托架构**：减少事件监听器数量，提升移动端性能
- **增量渲染策略**：避免频繁DOM操作导致的性能问题
- **防抖机制**：减少存储操作频率
- **模块化设计**：核心功能通过类和独立函数模块化组织
- **面向对象设计**：CandyMarkManager类封装核心功能

### 数据存储
- **Primary storage**：Browser localStorage
- **Caching**：内存缓存(bookmarkCache Map对象)
- **Data formats**：JSON序列化存储书签数据

## 🚀 快速开始

### 方式一：一键安装（推荐）

1. **安装Tampermonkey**
   - Chrome/Edge: [Chrome网上应用店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Firefox附加组件](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)
   - Safari: [App Store](https://apps.apple.com/app/tampermonkey/id1482490089)

2. **安装脚本**
   - 访问：[https://unixliang.github.io/candymark/](https://unixliang.github.io/candymark/)
   - 点击"🚀 安装脚本"按钮
   - 在弹出页面点击"安装"确认

3. **开始使用**
   - 访问任意网站，脚本自动运行
   - 点击左上角蓝色区域或按Ctrl+B添加标签
   - 长按标签（移动端）或右键（PC端）打开菜单

### 方式二：本地开发

1. **克隆项目**
   ```bash
   git clone https://github.com/unixliang/candymark.git
   cd candymark
   ```

2. **启动本地服务器**
   ```bash
   # 使用Python（推荐）
   python server.py
   
   # 或使用Python内置服务器
   python -m http.server 8000
   ```

3. **访问项目**
   - 演示页面：`http://localhost:8000`
   - 安装工具：`http://localhost:8000/bookmarklet.html`
   - 管理器：`http://localhost:8000/manager.html`

### 部署到GitHub Pages

1. **推送到GitHub并启用Pages**
   ```bash
   git add .
   git commit -m "feat: 初始化CandyMark项目"
   git push origin main
   ```

2. **修改URL配置**
   - 编辑相关文件中的用户名为你的GitHub用户名
   - 编辑 `README.md` 中的链接地址

3. **访问在线版本**
   - 访问：`https://unixliang.github.io/candymark/`

## 📱 使用指南

### 添加标签
- **方法一**：点击页面左上角的蓝色触发区域
- **方法二**：按快捷键 `Ctrl + B`
- 在弹出的对话框中输入标签名称和链接地址
- 点击"确认"按钮

### 管理标签
- **移动端**：长按标签（500ms）弹出菜单
- **PC端**：右键点击标签弹出菜单
- **设置**：右键Tampermonkey图标选择"CandyMark设置"

### 菜单功能

#### 📚 主菜单（点击左上角触发器）
- **➕ 增加标签**：添加新的书签
- **📏 调整标签大小**：10级大小调整（0.3x-1.2x）
- **🌓 调整标签透明度**：10级透明度控制（0.1-1.0）
- **🔔 掉落通知**：游戏事件通知设置
- **⚙️ 配置管理**：导入导出配置数据
- **❌ 取消**：关闭菜单

#### 📋 配置管理子菜单
- **📤 导出到文件**：下载配置JSON文件
- **📋 导出到剪贴板**：复制配置到剪贴板
- **📥 从文件导入**：上传配置文件
- **📝 从剪贴板导入**：从剪贴板粘贴配置
- **❌ 返回**：返回主菜单

#### 🎯 标签右键菜单
- **🖱️ 拖拽移动**：进入拖拽模式，标签可移动到任意位置
- **📍 设置当前页面**：将标签链接设置为当前页面URL
- **⬅️ 设置后退**：设置为浏览器后退功能
- **⏪ 设置两次后退**：双击后退，可配置时间间隔
- **⏱️ 两次后退间隔**：调整双击后退的时间间隔
- **✏️ 修改名称**：修改标签显示名称（最长10字符）
- **🗑️ 删除标签**：删除选中的标签
- **❌ 取消**：关闭菜单

### 高级功能
- **配置备份与恢复**：完整的配置导入导出系统，支持跨设备同步
- **视觉定制**：实时调整标签大小和透明度，满足个人喜好
- **智能导航**：支持单击后退、双击后退，时间间隔可调
- **游戏增强**：针对特定游戏的掉落通知功能
- **网站黑名单**：灵活的网站过滤，精确控制脚本运行范围
- **数据安全**：本地存储与云端备份双重保障
- **自动后退**：支持基于攻击次数、掉落、召唤、技能的自动后退功能

## 🎨 自定义样式

### 标签颜色
项目内置了5种渐变色彩，标签会自动循环使用：
- 蓝紫色渐变
- 粉红色渐变
- 橙粉色渐变
- 蓝青色渐变
- 绿青色渐变

### 修改样式
在`candymark.user.js`中可以自定义：
- 标签大小（修改配置中的`bookmarkSize`）
- 透明度（修改配置中的`bookmarkOpacity`）
- 颜色主题（修改`colorPresets`数组）

## 📁 项目结构

```
candymark/
├── candymark.user.js          # 生产环境用户脚本文件
├── index.html                 # 安装页面和功能展示
├── manager.html               # 独立书签管理界面
├── style.css                  # 网页界面样式表
├── script.js                  # 网页界面额外JavaScript功能
├── server.py                  # 开发服务器脚本
├── package.json               # npm脚本和GitHub Pages部署配置
├── GREASYFORK.md              # Greasyfork发布指南和元数据
├── CLAUDE.md                  # Claude Code项目指导文件
├── .spec-workflow/            # 规范文档目录
│   ├── steering/              # 项目指导文件
│   │   ├── product.md         # 产品愿景文档
│   │   ├── tech.md            # 技术架构文档
│   │   └── structure.md       # 代码结构文档
│   └── [feature]/             # 特性规范文档目录
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── README.md                  # 项目说明文档
└── .gitignore                 # Git忽略文件
```

## 🔧 核心文件说明

### candymark.user.js
- 油猴脚本主文件，包含所有功能
- 支持自动运行、配置管理、数据同步
- 生产环境使用版本
- 包含CandyMarkManager核心类和GameDetector游戏检测类

### index.html
- 项目主页和脚本安装页面
- 功能介绍和使用指南
- 一键安装入口

### manager.html
- 独立的标签管理器界面
- 批量操作、数据导入导出
- 统计分析功能

## 🔧 开发细节

### 核心类：CandyMarkManager

主要方法：
- `init()` - 初始化应用
- `addBookmark()` - 添加新标签
- `deleteBookmark()` - 删除标签
- `editBookmarkName()` - 修改标签名称
- `setCurrentUrl()` - 设置当前页面URL
- `enableDragMode()` - 启用拖拽模式
- `saveBookmarks()` - 保存到本地存储
- `loadBookmarks()` - 加载本地数据

### 本地存储

数据保存在`localStorage`中，键名为`candymark-bookmarks-javascript`，数据结构：
```javascript
{
  id: 1677123456789,        // 唯一标识
  name: "标签名称",          // 显示名称
  url: "https://example.com", // 链接地址
  x: 100,                   // X坐标
  y: 200                    // Y坐标
}
```

### 配置管理

所有配置项都存储在localStorage中，可通过配置管理菜单进行导入导出：
- `sb_enabled`: 脚本是否启用
- `sb_show_trigger`: 是否显示触发器
- `sb_bookmark_size`: 标签大小级别(1-10)
- `sb_bookmark_opacity`: 标签透明度级别(1-10)
- `sb_notify_ffj`: FFJ掉落通知
- `sb_notify_hourglass`: 沙漏掉落通知
- `sb_auto_back_turn_enabled`: 攻击自动后退启用
- `sb_auto_back_turn_count`: 攻击次数阈值
- `sb_auto_back_drop_enabled`: 掉落自动后退启用
- `sb_auto_back_summon_enabled`: 召唤自动后退启用
- `sb_auto_back_ability_enabled`: 技能自动后退启用

## 🌟 功能演示

1. **添加标签**：点击左上角触发区域
2. **拖拽移动**：右键菜单选择"拖拽移动"
3. **设置URL**：右键菜单选择"设置当前页面"
4. **修改名称**：右键菜单选择"修改名称"
5. **删除标签**：右键菜单选择"删除标签"

## 📥 安装渠道

- **GitHub**: [https://github.com/unixliang/candymark](https://github.com/unixliang/candymark)
- **Greasyfork**: [https://greasyfork.org/scripts/xxxxx](https://greasyfork.org/scripts/xxxxx)
- **项目主页**: [https://unixliang.github.io/candymark/](https://unixliang.github.io/candymark/)

## 🔮 未来计划

- [ ] 支持标签分组功能
- [ ] 添加自定义标签图标
- [ ] 增加标签搜索和筛选
- [ ] 支持多种主题皮肤
- [ ] 添加标签使用统计
- [ ] 云端数据同步功能
- [ ] 键盘快捷键扩展
- [ ] 标签批量操作
- [ ] 更多游戏事件支持

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork项目到自己的GitHub
2. 创建新的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🔍 更新日志

### v2.0.0 (2025-07-11)
- 🆕 **配置管理系统**：完整的导入导出功能，支持文件和剪贴板
- 🎨 **视觉定制控制**：10级标签大小和透明度调整，实时预览
- 🚀 **增强导航功能**：双击后退支持，可配置时间间隔
- 🔔 **通知系统集成**：游戏事件通知（FFJ、沙漏掉落）
- 📋 **菜单系统重构**：层级化菜单设计，更好的用户体验
- 🔧 **代码优化**：移除无用配置项，提升性能和稳定性
- ⚙️ **自动后退功能**：支持基于攻击次数、掉落、召唤、技能的自动后退

### v1.0.0 (2025-07-07)
- 🎉 首次发布油猴脚本版本
- ✨ 支持自动运行和智能配置
- 📱 完善的移动端触摸优化
- 💾 跨网站数据同步功能

## 📋 项目治理与开发流程

CandyMark采用结构化的项目治理和开发流程，确保代码质量和功能开发的一致性。

### 规范文档体系
项目采用三层规范文档体系：
- **Steering文档**：定义产品愿景、技术标准和代码结构
  - `product.md`：产品目标、用户群体和关键特性
  - `tech.md`：技术栈、架构决策和开发环境
  - `structure.md`：代码组织、命名约定和模块边界
- **特性规范文档**：每个新功能都需经过完整的规范流程
  - `requirements.md`：功能需求和验收标准
  - `design.md`：技术设计和架构对齐
  - `tasks.md`：实施任务分解和跟踪

### 开发原则
- **移动端优先**：所有设计和优化都以移动设备使用体验为核心
- **简洁易用**：界面简单直观，操作符合用户直觉
- **隐私保护**：所有数据本地存储，不收集用户隐私信息
- **性能优化**：轻量级实现，不影响网页正常加载和使用
- **兼容性强**：支持主流移动浏览器和用户脚本管理器

### 技术架构
- **原生JavaScript**：无外部依赖，保证最小体积和最大兼容性
- **事件委托架构**：减少事件监听器数量，提升移动端性能
- **增量渲染策略**：避免频繁DOM操作导致的性能问题
- **模块化设计**：核心功能通过类和独立函数模块化组织

## 📞 支持与反馈

如有问题或建议，请通过以下方式联系：
- **Issues**: [GitHub Issues](https://github.com/unixliang/candymark/issues)
- **讨论**: [GitHub Discussions](https://github.com/unixliang/candymark/discussions)
- **邮箱**: your-email@example.com

## 🏆 致谢

感谢所有为项目贡献代码、反馈建议的用户！

---

⭐ **如果这个项目对你有帮助，请在GitHub上给个Star支持一下！**