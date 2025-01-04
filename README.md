# 局域网文件传输工具

一个基于 Web 的局域网文件传输工具，支持在同一局域网内的设备之间快速传输文件。

## 特性

- 🚀 快速传输：使用 WebSocket 进行实时传输
- 💬 即时通讯：支持发送文本消息
- 📁 文件传输：支持拖放文件和文件选择
- 🎯 设备发现：自动发现局域网内的其他设备
- 🔄 传输控制：支持暂停、继续和取消传输
- 📱 响应式设计：支持桌面和移动设备

## 安装

1. 确保已安装 [Node.js](https://nodejs.org/) (推荐 v14 或更高版本)

2. 克隆或下载本项目

3. 安装依赖
```bash
npm install
```

4. 启动服务器
```bash
npm start
```

5. 在浏览器中访问
```
http://localhost:3000
```

## 使用方法

1. 打开网页后，会自动生成一个设备ID
2. 其他设备也访问同样的地址
3. 在左侧设备列表中选择目标设备
4. 可以通过以下方式发送文件：
   - 点击右下角的文件按钮选择文件
   - 直接将文件拖放到聊天区域
   - 也可以发送文本消息

## 注意事项

- 确保所有设备都在同一个局域网内
- 如果使用防火墙，需要允许 3000 和 8080 端口的访问
- 建议使用现代浏览器（Chrome、Firefox、Safari、Edge 等）

## 技术栈

- 前端：原生 JavaScript、WebSocket、Web Workers
- 后端：Node.js、Express、ws
- 文件处理：pako（压缩）


### 如果你觉得有用
<p>
<img src="https://github.com/skci/VLPR/assets/31680619/2629fe59-24b6-464b-901a-6c63d332a083"  align = "left"  height="250" />
<img src="https://github.com/skci/VLPR/assets/31680619/003cf061-e4f6-478f-8e20-6b891a0255ff"  align = "center"  height="250" />
</p>
