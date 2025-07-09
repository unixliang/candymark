#!/usr/bin/env python3
"""
简单的本地HTTP服务器，用于测试SimpleBookmark项目
运行方式：python server.py
默认端口：8000
"""

import http.server
import socketserver
import webbrowser
import os
import sys

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    
    # 确保在项目根目录
    if not os.path.exists('index.html'):
        print("错误：请在项目根目录运行此脚本")
        sys.exit(1)
    
    # 创建HTTP服务器
    handler = http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"🚀 SimpleBookmark 本地服务器已启动")
            print(f"📱 访问地址：http://localhost:{port}")
            print(f"🔗 移动端测试：http://你的IP地址:{port}")
            print(f"⌨️  按 Ctrl+C 停止服务器")
            print("-" * 50)
            
            # 自动打开浏览器
            webbrowser.open(f'http://localhost:{port}')
            
            # 启动服务器
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ 端口 {port} 已被占用，请尝试其他端口")
        else:
            print(f"❌ 启动服务器失败：{e}")

if __name__ == "__main__":
    main()