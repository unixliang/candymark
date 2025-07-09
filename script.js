class SimpleBookmark {
    constructor() {
        this.bookmarks = [];
        this.currentBookmarkId = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isContextMenuOpen = false;
        this.touchStartTime = 0;
        this.longPressTimeout = null;
        
        this.init();
    }
    
    init() {
        this.loadBookmarks();
        this.bindEvents();
        this.renderBookmarks();
    }
    
    // 绑定事件
    bindEvents() {
        // 左上角触发区域点击
        document.getElementById('trigger-area').addEventListener('click', () => {
            this.showAddBookmarkModal();
        });
        
        // 模态框事件
        document.getElementById('confirm-add').addEventListener('click', () => {
            this.addBookmark();
        });
        
        document.getElementById('cancel-add').addEventListener('click', () => {
            this.hideAddBookmarkModal();
        });
        
        document.getElementById('confirm-edit').addEventListener('click', () => {
            this.editBookmarkName();
        });
        
        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.hideEditBookmarkModal();
        });
        
        // 菜单事件
        document.getElementById('drag-bookmark').addEventListener('click', () => {
            this.startDragMode();
        });
        
        document.getElementById('set-current-url').addEventListener('click', () => {
            this.setCurrentUrl();
        });
        
        document.getElementById('edit-bookmark').addEventListener('click', () => {
            this.showEditBookmarkModal();
        });
        
        document.getElementById('delete-bookmark').addEventListener('click', () => {
            this.deleteBookmark();
        });
        
        // 全局事件
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });
        
        // 阻止右键菜单
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.bookmark-item')) {
                e.preventDefault();
            }
        });
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
                this.hideAddBookmarkModal();
                this.hideEditBookmarkModal();
            }
        });
    }
    
    // 显示新增标签模态框
    showAddBookmarkModal() {
        const modal = document.getElementById('add-bookmark-modal');
        modal.classList.add('show');
    }
    
    // 隐藏新增标签模态框
    hideAddBookmarkModal() {
        const modal = document.getElementById('add-bookmark-modal');
        modal.classList.remove('show');
        document.getElementById('bookmark-name').value = '';
        document.getElementById('bookmark-url').value = '';
    }
    
    // 显示编辑标签模态框
    showEditBookmarkModal() {
        const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
        if (bookmark) {
            document.getElementById('edit-bookmark-name').value = bookmark.name;
            const modal = document.getElementById('edit-bookmark-modal');
            modal.classList.add('show');
        }
        this.hideContextMenu();
    }
    
    // 隐藏编辑标签模态框
    hideEditBookmarkModal() {
        const modal = document.getElementById('edit-bookmark-modal');
        modal.classList.remove('show');
        document.getElementById('edit-bookmark-name').value = '';
    }
    
    // 添加标签
    addBookmark() {
        const name = document.getElementById('bookmark-name').value.trim();
        const url = document.getElementById('bookmark-url').value.trim();
        
        if (!url) {
            alert('请输入链接地址');
            return;
        }
        
        const bookmark = {
            id: Date.now(),
            name: name,
            url: url,
            x: Math.random() * (window.innerWidth - 100) + 50,
            y: Math.random() * (window.innerHeight - 100) + 50
        };
        
        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.renderBookmarks();
        this.hideAddBookmarkModal();
    }
    
    // 编辑标签名称
    editBookmarkName() {
        const newName = document.getElementById('edit-bookmark-name').value.trim();
        
        const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
        if (bookmark) {
            bookmark.name = newName;
            this.saveBookmarks();
            this.renderBookmarks();
        }
        
        this.hideEditBookmarkModal();
    }
    
    // 删除标签
    deleteBookmark() {
        if (confirm('确定要删除这个标签吗？')) {
            this.bookmarks = this.bookmarks.filter(b => b.id !== this.currentBookmarkId);
            this.saveBookmarks();
            this.renderBookmarks();
        }
        this.hideContextMenu();
    }
    
    // 设置当前页面URL
    setCurrentUrl() {
        const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
        if (bookmark) {
            bookmark.url = window.location.href;
            this.saveBookmarks();
            this.renderBookmarks();
        }
        this.hideContextMenu();
    }
    
    // 开始拖拽模式
    startDragMode() {
        this.hideContextMenu();
        const bookmarkElement = document.querySelector(`[data-id="${this.currentBookmarkId}"]`);
        if (bookmarkElement) {
            this.enableDragMode(bookmarkElement);
        }
    }
    
    // 启用拖拽模式
    enableDragMode(element) {
        element.style.zIndex = '10000';
        element.classList.add('dragging');
        
        // 创建拖拽提示
        const hint = document.createElement('div');
        hint.className = 'drag-hint show';
        hint.textContent = '拖拽标签到任意位置，点击任意处完成';
        document.body.appendChild(hint);
        
        const onMouseMove = (e) => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.width / 2;
            const y = e.clientY - rect.height / 2;
            
            element.style.left = `${Math.max(0, Math.min(x, window.innerWidth - rect.width))}px`;
            element.style.top = `${Math.max(0, Math.min(y, window.innerHeight - rect.height))}px`;
        };
        
        const onTouchMove = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = element.getBoundingClientRect();
            const x = touch.clientX - rect.width / 2;
            const y = touch.clientY - rect.height / 2;
            
            element.style.left = `${Math.max(0, Math.min(x, window.innerWidth - rect.width))}px`;
            element.style.top = `${Math.max(0, Math.min(y, window.innerHeight - rect.height))}px`;
        };
        
        const finishDrag = () => {
            element.classList.remove('dragging');
            element.style.zIndex = '';
            
            // 更新标签位置
            const bookmark = this.bookmarks.find(b => b.id === this.currentBookmarkId);
            if (bookmark) {
                bookmark.x = parseInt(element.style.left);
                bookmark.y = parseInt(element.style.top);
                this.saveBookmarks();
            }
            
            // 移除事件监听器
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('click', finishDrag);
            document.removeEventListener('touchend', finishDrag);
            
            // 移除提示
            hint.remove();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        
        // 延迟添加点击事件，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', finishDrag);
            document.addEventListener('touchend', finishDrag);
        }, 100);
    }
    
    // 显示右键菜单
    showContextMenu(e, bookmarkId) {
        e.preventDefault();
        e.stopPropagation();
        
        this.currentBookmarkId = bookmarkId;
        this.isContextMenuOpen = true;
        
        const menu = document.getElementById('context-menu');
        menu.classList.add('show');
        
        const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        
        // 确保菜单不超出屏幕
        const rect = menu.getBoundingClientRect();
        const menuX = Math.min(x, window.innerWidth - rect.width - 10);
        const menuY = Math.min(y, window.innerHeight - rect.height - 10);
        
        menu.style.left = `${menuX}px`;
        menu.style.top = `${menuY}px`;
    }
    
    // 隐藏右键菜单
    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        menu.classList.remove('show');
        this.isContextMenuOpen = false;
        this.currentBookmarkId = null;
    }
    
    // 渲染所有标签
    renderBookmarks() {
        const container = document.getElementById('bookmark-container');
        container.innerHTML = '';
        
        this.bookmarks.forEach(bookmark => {
            const element = this.createBookmarkElement(bookmark);
            container.appendChild(element);
        });
    }
    
    // 创建标签元素
    createBookmarkElement(bookmark) {
        const element = document.createElement('div');
        element.className = 'bookmark-item';
        element.setAttribute('data-id', bookmark.id);
        element.style.left = `${bookmark.x}px`;
        element.style.top = `${bookmark.y}px`;
        
        const text = document.createElement('div');
        text.className = 'bookmark-text';
        text.textContent = bookmark.name;
        element.appendChild(text);
        
        // 点击事件
        element.addEventListener('click', (e) => {
            if (!this.isContextMenuOpen) {
                window.open(bookmark.url, '_blank');
            }
        });
        
        // PC端右键事件
        element.addEventListener('contextmenu', (e) => {
            this.showContextMenu(e, bookmark.id);
        });
        
        // 移动端长按事件
        element.addEventListener('touchstart', (e) => {
            this.touchStartTime = Date.now();
            this.longPressTimeout = setTimeout(() => {
                this.showContextMenu(e, bookmark.id);
            }, 500);
        });
        
        element.addEventListener('touchend', (e) => {
            clearTimeout(this.longPressTimeout);
            const touchDuration = Date.now() - this.touchStartTime;
            
            if (touchDuration < 500 && !this.isContextMenuOpen) {
                window.open(bookmark.url, '_blank');
            }
        });
        
        element.addEventListener('touchmove', () => {
            clearTimeout(this.longPressTimeout);
        });
        
        return element;
    }
    
    // 保存标签到本地存储
    saveBookmarks() {
        localStorage.setItem('simpleBookmarks', JSON.stringify(this.bookmarks));
    }
    
    // 从本地存储加载标签
    loadBookmarks() {
        const saved = localStorage.getItem('simpleBookmarks');
        if (saved) {
            this.bookmarks = JSON.parse(saved);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new SimpleBookmark();
});