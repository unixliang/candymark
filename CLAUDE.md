# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CandyMark is a mobile-optimized userscript (Greasemonkey/Tampermonkey) that provides floating bookmark navigation on any website. The project uses vanilla JavaScript with performance optimizations and is designed for automatic deployment to GitHub Pages.

## Development Commands

### Local Development
```bash
# Start local development server (preferred)
python server.py

# Alternative methods
npm start
python -m http.server 8000
```

### Deployment
```bash
# Deploy to GitHub Pages
npm run deploy

# Manual deployment
git add .
git commit -m "feat: update"
git push origin main
```

### Access URLs
- Main page: `http://localhost:8000`
- Manager: `http://localhost:8000/manager.html`
- Script file: `http://localhost:8000/candymark.user.js`

## Architecture Overview

### Core Class: CandyMarkManager
The main class manages all bookmark functionality with these key areas:

**State Management:**
- `bookmarks[]`: Array of bookmark objects with id, name, url, x, y, domain
- `currentBookmarkId`: Currently selected bookmark for operations
- `isContextMenuOpen`: Prevents conflicts between menu and click events

**Performance Optimizations:**
- **Event Delegation**: Container-level event handling instead of per-element listeners
- **Incremental Rendering**: Only updates changed bookmarks, not full re-render
- **Debounced Storage**: 300ms delay for frequent operations, immediate for critical ones
- **CSS Classes**: Replaces inline styles for better performance

### Userscript Integration
- **GM_setValue/GM_getValue**: Cross-domain persistent storage
- **GM_registerMenuCommand**: Script configuration access
- **Auto-execution**: Runs on all sites except blacklisted domains
- **Configuration System**: Runtime settings via CONFIG object

### Mobile Touch Optimization
- **Long Press Detection**: 1000ms (1 second) threshold for context menu
- **Touch Event Handling**: Unified touch/mouse event delegation
- **Gesture Prevention**: Disables conflicting browser gestures during drag

## Key Technical Features

### Configuration Management System
- **Export/Import**: Support for exporting and importing complete configurations
- **Multiple Formats**: File-based (.json) and clipboard-based transfer
- **Data Validation**: Comprehensive validation during import process
- **Settings Backup**: Includes bookmarks, visual settings, and behavioral settings

### Menu System Architecture
- **Hierarchical Menus**: Main menu with configuration management submenu
- **Touch/Click Delegation**: Unified event handling for mobile and desktop
- **Action Routing**: Centralized action handlers for menu interactions
- **Visual Feedback**: CSS-based menu animations and state management

### Special URL Handling
- URLs set to `"back"` trigger `window.history.back()` instead of navigation
- **Double Back**: Support for `"double-back"` with configurable intervals
- Domain extraction safely handles non-URL values

### Drag System Architecture
```javascript
// Drag state encapsulation
const dragState = {
    element: HTMLElement,
    isDragging: boolean,
    dragOffset: {x, y},
    originalPos: ghostElement,
    hint: hintElement
}
```

**Pre-bound Event Handlers**: Reduces memory allocation during drag operations
**State Management**: Centralized drag state prevents memory leaks
**Visual Feedback**: Ghost position indicator and drag hints

### Visual Customization System
- **Size Adjustment**: 10-level bookmark size scaling (0.3x to 1.2x)
- **Opacity Control**: 10-level transparency settings (0.1 to 1.0)
- **Real-time Preview**: Live preview during adjustment with modal controls
- **CSS Variables**: Dynamic style updates via CSS custom properties

### Notification System
- **Drop Notifications**: Configurable FFJ and hourglass drop alerts
- **Event Detection**: Monitors specific game events and triggers notifications
- **User Preferences**: Per-notification type enable/disable settings

### Storage Strategy
- **Immediate Save**: Critical operations (add/delete bookmarks)
- **Debounced Save**: Position updates and non-critical changes (300ms)
- **Data Structure**: JSON serialization with id, name, url, x, y, domain, colorIndex fields
- **Configuration Storage**: localStorage-based settings with validation

### Performance CSS Classes
```css
.sb-bookmark--dragging-prep     /* Pre-drag optimization */
.sb-bookmark--dragging-active   /* Active drag state */
.sb-bookmark--updating          /* Smooth transitions */
.sb-bookmark--hidden           /* Fade out animations */
```

## File Structure

### Core Files
- **candymark.user.js**: Production userscript (auto-updates from GitHub)
- **index.html**: Installation landing page with feature showcase
- **manager.html**: Standalone bookmark management interface
- **server.py**: Development server with auto-browser launch
- **style.css**: Stylesheet for the web interface
- **script.js**: Additional JavaScript functionality

### Configuration Files
- **package.json**: npm scripts and GitHub Pages deployment
- **GREASYFORK.md**: Greasyfork publishing guidelines and metadata

### Current Deployment
- Configured for specific GBF (Granblue Fantasy) domains in @match directives
- Update URL points to `unixliang.github.io/gbf-bookmark/`

## Development Notes

### Event Delegation Pattern
All bookmark interactions use container-level event delegation:
```javascript
container.addEventListener('click', (e) => {
    const bookmark = e.target.closest('.sb-bookmark');
    if (bookmark) {
        // Handle bookmark click
    }
});
```

### Incremental Rendering Logic
- `renderBookmarks()`: Default incremental mode
- `renderBookmarks(true)`: Force full re-render for major changes
- `updateBookmarksIncremental()`: Smart diff-based updates

### Memory Management
- Pre-bound drag handlers prevent closure recreation
- Timeout cleanup in drag exit handlers
- Event listener removal in cleanup methods

### Browser Compatibility
- Hardware acceleration with `transform: translateZ(0)`
- Backdrop filters for modern browsers
- Fallback interactions for touch devices

## Userscript Lifecycle

1. **Blacklist Check**: Exit early if domain blacklisted
2. **CSS Injection**: Inline styles for immediate rendering
3. **DOM Creation**: Container and UI elements
4. **Event Binding**: Delegation-based event setup
5. **Data Loading**: Restore bookmarks from GM storage
6. **Render**: Initial bookmark display

## Recent Feature Additions

### Configuration Management (v2.0+)
- **Unified Config Menu**: Access via "⚙️ 配置管理" in the main trigger menu
- **Export Options**: 
  - 📤 导出到文件 (Download JSON file)
  - 📋 导出到剪贴板 (Copy to clipboard)
- **Import Options**:
  - 📥 从文件导入 (Upload JSON file)  
  - 📝 从剪贴板导入 (Paste from clipboard)
- **Data Validation**: Ensures imported data integrity and compatibility

### Visual Customization Controls
- **Size Adjustment Modal**: 10-level scaling with real-time preview
- **Opacity Adjustment Modal**: 10-level transparency with live feedback
- **Menu Access**: Available through trigger menu "📏 调整标签大小" and "🌓 调整标签透明度"

### Enhanced Navigation Features
- **Double Back Support**: "⏪ 设置两次后退" for complex navigation patterns
- **Configurable Intervals**: "⏱️ 两次后退间隔" with user-defined timing
- **Smart URL Detection**: Handles special navigation commands

### Notification System Integration
- **Game Event Detection**: FFJ and hourglass drop notifications for supported games
- **Toggle Controls**: "🔔 掉落通知" menu for enabling/disabling alerts
- **Non-intrusive Design**: Notifications integrate with existing bookmark workflow

## Common Modification Patterns

### Adding New Configuration Options
1. Add to CONFIG object in `loadConfig()`
2. Include in export functions (`exportConfig()`, `exportToClipboard()`)
3. Add validation logic in import functions
4. Update storage keys with `sb_` prefix

### Extending Menu System
1. Add menu item to appropriate menu HTML structure
2. Define `data-action` attribute for the new action
3. Add case handler in corresponding `handleMenuAction()` function
4. Implement the actual functionality method

### Adding Visual Controls
1. Create modal HTML structure following existing patterns
2. Add CSS styles for the new modal
3. Implement show/hide modal functions
4. Add real-time preview capabilities with CSS variables

### Performance Tuning
- Use CSS classes instead of inline styles
- Leverage event delegation for new interactions
- Implement debouncing for frequent operations
- Pre-bind event handlers for drag operations

### Mobile Optimization
- Touch event duration thresholds in `setupBookmarkEventDelegation()`
- Responsive sizing in CSS media queries
- Hardware acceleration classes for smooth animations

## Project Governance and Documentation

### Specification Workflow
CandyMark follows a structured specification workflow for feature development:
- Requirements gathering and documentation
- Design documentation aligned with technical standards
- Task breakdown and implementation tracking
- All specs are stored in `.spec-workflow/specs/` directory

### Steering Documents
Project direction and standards are defined in steering documents located in `.spec-workflow/steering/`:
- **Product Vision** (`product.md`): Defines target users, key features, and business objectives
- **Technical Standards** (`tech.md`): Specifies technology stack, architecture patterns, and coding standards
- **Project Structure** (`structure.md`): Details code organization, naming conventions, and module boundaries

### Recent Feature Development
Latest feature development follows the specification workflow with documented:
- Requirements with acceptance criteria
- Design alignment with project architecture
- Task breakdown for implementation
- Integration with existing codebase patterns