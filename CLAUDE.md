# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimpleBookmark is a mobile-optimized userscript (Greasemonkey/Tampermonkey) that provides floating bookmark navigation on any website. The project uses vanilla JavaScript with performance optimizations and is designed for automatic deployment to GitHub Pages.

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
- Script file: `http://localhost:8000/SimpleBookmark.user.js`

## Architecture Overview

### Core Class: SimpleBookmarkManager
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

### Special URL Handling
- URLs set to `"back"` trigger `window.history.back()` instead of navigation
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

### Storage Strategy
- **Immediate Save**: Critical operations (add/delete bookmarks)
- **Debounced Save**: Position updates and non-critical changes (300ms)
- **Data Structure**: JSON serialization with id, name, url, x, y, domain fields

### Performance CSS Classes
```css
.sb-bookmark--dragging-prep     /* Pre-drag optimization */
.sb-bookmark--dragging-active   /* Active drag state */
.sb-bookmark--updating          /* Smooth transitions */
.sb-bookmark--hidden           /* Fade out animations */
```

## File Structure

### Core Files
- **SimpleBookmark.user.js**: Production userscript (auto-updates from GitHub)
- **index.html**: Installation landing page with feature showcase
- **manager.html**: Standalone bookmark management interface
- **server.py**: Development server with auto-browser launch

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

## Common Modification Patterns

### Adding New Bookmark Properties
1. Update bookmark object creation in `addBookmark()`
2. Modify `updateBookmarkElement()` for incremental updates
3. Update storage serialization if needed

### Performance Tuning
- Use CSS classes instead of inline styles
- Leverage event delegation for new interactions
- Implement debouncing for frequent operations

### Mobile Optimization
- Touch event duration thresholds in `setupBookmarkEventDelegation()`
- Responsive sizing in CSS media queries
- Hardware acceleration classes for smooth animations