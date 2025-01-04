const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket 服务器
const server = new WebSocket.Server({
    port: 8080,
    perMessageDeflate: false,
    maxPayload: 20 * 1024 * 1024
});

// 存储客户端连接
const clients = new Map();

// 广播设备列表
function broadcastDeviceList() {
    const deviceList = Array.from(clients.entries()).map(([deviceId, client]) => ({
        deviceId: deviceId,
        info: client.deviceInfo
    }));

    const message = JSON.stringify({
        type: 'deviceList',
        devices: deviceList
    });

    console.log('广播设备列表:', deviceList);
    
    for (const client of clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
        }
    }
}

server.on('connection', (ws) => {
    console.log('新客户端连接');
    
    // 处理二进制消息
    function handleBinaryMessage(data) {
        try {
            // 解析头信息
            const headerSize = data.readUInt32LE(0);
            const headerData = data.slice(4, 4 + headerSize);
            const header = JSON.parse(headerData.toString());

            // 转发给目标设备
            const targetClient = clients.get(header.to);
            if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                // 直接转发原始二进制数据
                targetClient.ws.send(data, { binary: true });
            } else {
                console.log('目标设备不存在或未连接:', header.to);
            }
        } catch (error) {
            console.error('处理二进制消息失败:', error);
        }
    }
    
    // 处理文本消息
    function handleTextMessage(message) {
        console.log('处理文本消息:', message);
        
        switch (message.type) {
            case 'register':
                // 注册设备
                console.log('注册设备:', message.deviceId);
                clients.set(message.deviceId, {
                    ws: ws,
                    deviceInfo: message.deviceInfo
                });
                // 广播设备列表
                broadcastDeviceList();
                break;

            case 'message':
                // 转发消息到目标设备
                console.log('转发消息:', message);
                const targetClient = clients.get(message.to);
                if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                    console.log('转发消息到:', message.to);
                    targetClient.ws.send(JSON.stringify(message));
                } else {
                    console.log('目标设备不存在或未连接:', message.to);
                }
                break;
                
            default:
                console.log('未知消息类型:', message.type);
        }
    }
    
    ws.on('message', (data) => {
        try {
            // 如果是字符串，直接作为JSON处理
            if (typeof data === 'string') {
                const message = JSON.parse(data);
                handleTextMessage(message);
                return;
            }
            
            // 尝试解析为JSON
            try {
                const message = JSON.parse(data.toString());
                handleTextMessage(message);
            } catch {
                // 如果解析JSON失败，则作为二进制消息处理
                handleBinaryMessage(data);
            }
        } catch (error) {
            console.error('处理消息时出错:', error);
        }
    });

    ws.on('close', () => {
        // 清理断开的连接
        for (const [deviceId, client] of clients.entries()) {
            if (client.ws === ws) {
                console.log('设备断开连接:', deviceId);
                clients.delete(deviceId);
                break;
            }
        }
        // 广播更新后的设备列表
        broadcastDeviceList();
    });
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    console.log(`WebSocket 服务器运行在 ws://localhost:8080`);
}); 