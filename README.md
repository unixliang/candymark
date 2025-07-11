# CandyMark - 移动端标签导航

一个基于原生JavaScript开发的移动端网页标签导航**油猴脚本**，支持悬浮标签、拖拽移动、本地存储等功能。**安装一次，在任意网站自动运行！**

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

## 🎯 技术特点

- **原生JavaScript**：无依赖，纯原生JS开发
- **移动端优化**：完美适配移动端触摸交互
- **响应式设计**：自适应不同屏幕尺寸
- **现代CSS**：使用CSS3动画和渐变效果
- **GitHub Pages**：支持直接部署到GitHub Pages

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

## 🎨 自定义样式

### 标签颜色
项目内置了8种渐变色彩，标签会自动循环使用：
- 紫蓝渐变
- 粉红渐变
- 蓝青渐变
- 绿青渐变
- 橙黄渐变
- 青粉渐变
- 橙红渐变
- 红紫渐变

### 修改样式
在`style.css`中可以自定义：
- 标签大小（修改`.bookmark-item`的`width`和`height`）
- 颜色主题（修改`.bookmark-item:nth-child(n)`的`background`）
- 动画效果（修改`transition`和`animation`属性）

## 📁 项目结构

```
candymark/
├── index.html              # 油猴脚本安装主页面
├── candymark.user.js       # 油猴脚本核心文件
├── manager.html            # 标签管理器页面
├── style.css               # 演示页面样式
├── script.js               # 演示页面逻辑
├── server.py               # 本地开发服务器
├── package.json            # 项目配置文件
├── README.md               # 项目说明文档
└── .gitignore              # Git忽略文件
```

## 🔧 核心文件说明

### candymark.user.js
- 油猴脚本主文件，包含所有功能
- 支持自动运行、配置管理、数据同步
- 生产环境使用版本

### index.html
- 项目主页和脚本安装页面
- 功能介绍和使用指南
- 一键安装入口

### manager.html
- 独立的标签管理器界面
- 批量操作、数据导入导出
- 统计分析功能

## 🔧 开发细节

### 核心类：CandyMark

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

数据保存在`localStorage`中，键名为`candyMarkBookmarks`，数据结构：
```javascript
{
  id: 1677123456789,        // 唯一标识
  name: "标签名称",          // 显示名称
  url: "https://example.com", // 链接地址
  x: 100,                   // X坐标
  y: 200                    // Y坐标
}
```

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

### v1.0.0 (2025-07-07)
- 🎉 首次发布油猴脚本版本
- ✨ 支持自动运行和智能配置
- 📱 完善的移动端触摸优化
- 💾 跨网站数据同步功能

## 📞 支持与反馈

如有问题或建议，请通过以下方式联系：
- **Issues**: [GitHub Issues](https://github.com/unixliang/candymark/issues)
- **讨论**: [GitHub Discussions](https://github.com/unixliang/candymark/discussions)
- **邮箱**: your-email@example.com

## 🏆 致谢

感谢所有为项目贡献代码、反馈建议的用户！

---

⭐ **如果这个项目对你有帮助，请在GitHub上给个Star支持一下！**