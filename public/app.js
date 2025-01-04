let ws;
let selectedDevice = null;
let deviceId = generateDeviceId();
let deviceSuffix = generateDeviceSuffix();
let isTransferring = false;
let isPaused = false;
let shouldCancel = false;
let currentTransfer = null;
let isReceiving = false;
let isReceivingPaused = false;
let shouldCancelReceiving = false;
let currentReceiving = null;
let messageInput;
let sendMessageButton;
let chatHistory = [];

// 添加生成设备后缀的函数
function generateDeviceSuffix() {
    return Math.random().toString(36).substr(2, 4).toUpperCase();
}

// 初始化 WebSocket 连接
function initWebSocket() {
    ws = new WebSocket(`ws://${window.location.hostname}:8080`);
    
    // 设置为二进制类型
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
        console.log('WebSocket连接已建立');
        console.log('当前设备ID:', deviceId);
        
        // 发送设备信息（使用字符串）
        const registerMessage = {
            type: 'register',
            deviceId: deviceId,
            deviceInfo: {
                name: getDeviceName(),
                type: getDeviceType()
            }
        };
        
        // 确保以文本形式发送注册消息
        ws.send(JSON.stringify(registerMessage));
        console.log('已发送注册消息:', registerMessage);
    };

    ws.onmessage = (event) => {
        // 检查数据类型
        if (event.data instanceof ArrayBuffer) {
            try {
                // 创建一个DataView来读取二进制数据
                const dataView = new DataView(event.data);
                const headerSize = dataView.getUint32(0, true);
                
                // 解析头信息
                const decoder = new TextDecoder();
                const headerData = decoder.decode(new Uint8Array(event.data, 4, headerSize));
                const header = JSON.parse(headerData);
                
                // 如果是文件传输消息
                if (header.fileId) {
                    handleFileTransfer({
                        data: event.data
                    });
                }
            } catch (error) {
                console.error('处理二进制消息失败:', error);
            }
        } else {
            try {
                const message = JSON.parse(event.data);
                handleMessage(message);
            } catch (error) {
                console.error('解析消息出错:', error);
                console.error('原始消息内容:', event.data);
            }
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
    };

    ws.onclose = (event) => {
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        console.log('尝试重新连接...');
        setTimeout(initWebSocket, 3000);
    };
}

// 处理接收到的消息
function handleMessage(message) {
    console.log('处理消息:', message);
    switch (message.type) {
        case 'deviceList':
            console.log('设备列表:', message.devices);
            updateDeviceList(message.devices);
            break;
        case 'fileTransfer':
            handleFileTransfer(message);
            break;
        case 'message':
            // 处理文本消息
            console.log('收到文本消息:', message);
            console.log('当前设备ID:', deviceId);
            console.log('消息发送者ID:', message.from);
            
            // 统一去掉 @ 前缀再比较
            const fromId = (message.from || '').replace(/^@/, '');
            const currentId = deviceId.replace(/^@/, '');
            
            if (fromId !== currentId) {
                console.log('显示消息:', message.message);
                
                // 如果不是当前选中的对话，自动切换
                if (!selectedDevice || selectedDevice.deviceId !== message.from) {
                    const fromDevice = Array.from(document.querySelectorAll('.device-item'))
                        .find(item => item.getAttribute('data-device-id') === message.from);
                    if (fromDevice) {
                        // 获取设备信息并切换
                        const deviceInfo = {
                            deviceId: message.from,
                            info: { name: fromDevice.textContent }
                        };
                        selectDevice(deviceInfo);
                    }
                }
                
                addChatMessage(message.message, message.sender, false, message.from);
            } else {
                console.log('忽略自己发送的消息');
            }
            break;
        default:
            console.log('未知消息类型:', message.type);
    }
}

// 更新设备列表
function updateDeviceList(devices) {
    const devicesList = document.getElementById('devices');
    devicesList.innerHTML = '';
    
    // 更新设备名称显示
    const currentName = getDeviceName();
    document.getElementById('deviceName').textContent = `当前设备: ${currentName}`;
    
    console.log('当前设备ID:', deviceId);
    console.log('设备列表:', devices);
    
    let firstDevice = null; // 记录第一个可用设备
    
    devices.forEach(device => {
        // 确保设备ID格式一致
        const deviceIdA = device.deviceId.replace(/^@/, '');
        const currentIdA = deviceId.replace(/^@/, '');
        
        console.log('比较设备ID:', deviceIdA, currentIdA);
        
        if (deviceIdA !== currentIdA) {  // 不显示自己
            const deviceDiv = document.createElement('div');
            deviceDiv.className = 'device-item';
            deviceDiv.setAttribute('data-device-id', device.deviceId); // 添加设备ID属性
            
            // 如果是第一个设备且当前没有选中的设备，记录下来
            if (!firstDevice && !selectedDevice) {
                firstDevice = device;
            }
            
            // 如果当前有选中的设备，保持选中状态
            if (selectedDevice && selectedDevice.deviceId === device.deviceId) {
                deviceDiv.classList.add('selected');
            }
            
            deviceDiv.innerHTML = device.info.name;
            deviceDiv.onclick = () => selectDevice(device);
            devicesList.appendChild(deviceDiv);
        }
    });

    // 如果有第一个设备且当前没有选中的设备，自动选中第一个设备
    if (firstDevice && !selectedDevice) {
        selectDevice(firstDevice);
    }

    // 如果没有其他设备
    if (devicesList.children.length === 0) {
        const noDevice = document.createElement('div');
        noDevice.className = 'device-item no-device';
        noDevice.textContent = '没有找到其他设备';
        devicesList.appendChild(noDevice);
        selectedDevice = null; // 清除选中状态
    }
}

// 选择设备
function selectDevice(device) {
    console.log('选择设备:', device);
    selectedDevice = device;
    
    // 更新选中状态的样式
    const devices = document.querySelectorAll('.device-item');
    devices.forEach(item => {
        item.classList.remove('selected');
        if (item.textContent.includes(device.info.name)) {
            item.classList.add('selected');
        }
    });

    // 清空聊天区域
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    // 显示与当前设备的聊天记录
    chatHistory
        .filter(msg => msg.deviceId === device.deviceId)
        .forEach(msg => {
            displayMessage(msg.message, msg.sender, msg.isSelf);
        });
}

// 创建文件传输消息
function createFileMessage(file, isSelf = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isSelf ? 'self' : 'other'}`;
    
    const fileSize = formatFileSize(file.size);
    const fileMessage = document.createElement('div');
    fileMessage.className = 'file-message';
    
    // 根据文件类型选择图标
    const fileIcon = getFileIcon(file.name);
    
    fileMessage.innerHTML = `
        <div class="file-info">
            <div class="file-icon">${fileIcon}</div>
            <div class="file-details">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-size">${fileSize}</div>
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress"></div>
            </div>
            <span class="status">准备传输</span>
        </div>
        <div class="controls">
            <button class="control-button pause-resume">暂停</button>
            <button class="control-button cancel">取消</button>
        </div>
    `;
    
    messageDiv.appendChild(fileMessage);
    return messageDiv;
}

// 根据文件类型返回对应的图标
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        // 图片
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
        // 文档
        pdf: '📄', doc: '📄', docx: '📄', txt: '📄',
        // 表格
        xls: '📊', xlsx: '📊', csv: '📊',
        // 压缩包
        zip: '📦', rar: '📦', '7z': '📦',
        // 音频
        mp3: '🎵', wav: '🎵', ogg: '🎵',
        // 视频
        mp4: '🎬', mov: '🎬', avi: '🎬',
        // 代码
        js: '📝', css: '📝', html: '📝', json: '📝'
    };
    
    return iconMap[ext] || '📄';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

// 修改发送文件函数
async function sendFile(files) {
    if (!files.length || !selectedDevice) return;
    
    for (const file of files) {
        // 创建并添加文件消息到聊天区域
        const messageDiv = createFileMessage(file);
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 获取控制元素
        const fileMessage = messageDiv.querySelector('.file-message');
        const progress = fileMessage.querySelector('.progress');
        const status = fileMessage.querySelector('.status');
        const pauseResumeBtn = fileMessage.querySelector('.pause-resume');
        const cancelBtn = fileMessage.querySelector('.cancel');
        
        // 设置传输状态
        let isPaused = false;
        let shouldCancel = false;
        let transferComplete = false;
        
        // 设置按钮事件
        pauseResumeBtn.onclick = () => {
            isPaused = !isPaused;
            pauseResumeBtn.textContent = isPaused ? '继续' : '暂停';
            status.textContent = isPaused ? '已暂停' : '传输中...';
        };
        
        cancelBtn.onclick = () => {
            shouldCancel = true;
            status.textContent = '已取消';
            progress.style.width = '0%';
            pauseResumeBtn.disabled = true;
            cancelBtn.disabled = true;
        };
        
        // 开始传输文件
        try {
            const CHUNK_SIZE = 1024 * 1024; // 1MB
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            let processedChunks = 0;
            
            status.textContent = '传输中...';
            
            // 创建文件读取器
            const reader = new FileReader();
            const fileId = Math.random().toString(36).substring(7);
            
            // 分片读取并发送文件
            for (let start = 0; start < file.size && !shouldCancel; start += CHUNK_SIZE) {
                // 如果暂停，等待继续
                while (isPaused && !shouldCancel) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                if (shouldCancel) break;
                
                const chunk = file.slice(start, start + CHUNK_SIZE);
                const buffer = await chunk.arrayBuffer();
                
                // 发送文件块
                const message = {
                    type: 'fileTransfer',
                    to: selectedDevice.deviceId,
                    fileId: fileId,
                    fileName: file.name,
                    totalSize: file.size,
                    chunkIndex: processedChunks,
                    totalChunks: totalChunks,
                    data: buffer
                };
                
                try {
                    await sendChunk(message);
                    processedChunks++;
                    
                    // 更新进度
                    const percentComplete = (processedChunks / totalChunks) * 100;
                    progress.style.width = percentComplete + '%';
                    status.textContent = `已完成 ${percentComplete.toFixed(1)}%`;
                } catch (error) {
                    console.error('发送文件块失败:', error);
                    status.textContent = '传输失败';
                    break;
                }
            }
            
            if (shouldCancel) {
                status.textContent = '传输已取消';
            } else if (processedChunks === totalChunks) {
                status.textContent = '传输完成';
                progress.style.width = '100%';
                pauseResumeBtn.disabled = true;
                cancelBtn.disabled = true;
                transferComplete = true;
            }
        } catch (error) {
            console.error('文件传输错误:', error);
            status.textContent = '传输失败';
        }
    }
}

// 发送文件块
async function sendChunk(message) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket未连接'));
            return;
        }
        
        try {
            // 创建头信息
            const header = {
                to: message.to,
                fileId: message.fileId,
                fileName: message.fileName,
                totalSize: message.totalSize,
                chunkIndex: message.chunkIndex,
                totalChunks: message.totalChunks
            };
            
            // 将头信息转换为二进制
            const headerString = JSON.stringify(header);
            const headerBuffer = new TextEncoder().encode(headerString);
            
            // 创建完整的消息
            const fullMessage = new Uint8Array(4 + headerBuffer.length + message.data.byteLength);
            
            // 写入头部大小（4字节）
            new DataView(fullMessage.buffer).setUint32(0, headerBuffer.length, true);
            
            // 写入头信息
            fullMessage.set(headerBuffer, 4);
            
            // 写入文件数据
            fullMessage.set(new Uint8Array(message.data), 4 + headerBuffer.length);
            
            // 发送二进制消息
            ws.send(fullMessage);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

// 处理接收到的文件传输
function handleFileTransfer(message) {
    // 解析头信息
    const headerSize = new DataView(message.data).getUint32(0, true);
    const headerData = new TextDecoder().decode(new Uint8Array(message.data, 4, headerSize));
    const header = JSON.parse(headerData);
    
    // 提取文件数据
    const fileData = message.data.slice(4 + headerSize);
    
    // 如果是新文件传输，创建文件消息UI
    if (header.chunkIndex === 0) {
        const messageDiv = createFileMessage({ name: header.fileName, size: header.totalSize }, false);
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 存储文件传输状态
        currentReceiving = {
            fileId: header.fileId,
            fileName: header.fileName,
            totalSize: header.totalSize,
            chunks: new Array(header.totalChunks),
            messageDiv,
            isPaused: false,
            shouldCancel: false
        };
        
        // 设置接收控制按钮事件
        const fileMessage = messageDiv.querySelector('.file-message');
        const pauseResumeBtn = fileMessage.querySelector('.pause-resume');
        const cancelBtn = fileMessage.querySelector('.cancel');
        const status = fileMessage.querySelector('.status');
        
        pauseResumeBtn.onclick = () => {
            currentReceiving.isPaused = !currentReceiving.isPaused;
            pauseResumeBtn.textContent = currentReceiving.isPaused ? '继续' : '暂停';
            status.textContent = currentReceiving.isPaused ? '已暂停' : '接收中...';
        };
        
        cancelBtn.onclick = () => {
            currentReceiving.shouldCancel = true;
            status.textContent = '已取消接收';
            fileMessage.querySelector('.progress').style.width = '0%';
            pauseResumeBtn.disabled = true;
            cancelBtn.disabled = true;
            currentReceiving = null;
        };
    }
    
    // 更新进度
    if (currentReceiving && currentReceiving.fileId === header.fileId && !currentReceiving.shouldCancel) {
        const fileMessage = currentReceiving.messageDiv.querySelector('.file-message');
        const progress = fileMessage.querySelector('.progress');
        const status = fileMessage.querySelector('.status');
        
        // 如果暂停了，就不处理新的数据
        if (currentReceiving.isPaused) {
            return;
        }
        
        // 存储文件块
        currentReceiving.chunks[header.chunkIndex] = new Uint8Array(fileData);
        
        // 计算进度
        const receivedChunks = currentReceiving.chunks.filter(chunk => chunk !== undefined).length;
        const percentComplete = (receivedChunks / header.totalChunks) * 100;
        
        // 更新UI
        progress.style.width = percentComplete + '%';
        status.textContent = `已接收 ${percentComplete.toFixed(1)}%`;
        
        // 检查是否接收完成
        if (receivedChunks === header.totalChunks) {
            status.textContent = '接收完成';
            progress.style.width = '100%';
            fileMessage.querySelector('.pause-resume').disabled = true;
            fileMessage.querySelector('.cancel').disabled = true;
            
            // 合并文件块并下载
            const blob = new Blob(currentReceiving.chunks);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentReceiving.fileName;
            a.click();
            URL.revokeObjectURL(url);
            
            currentReceiving = null;
        }
    }
}

// 修改生成设备ID函数
function generateDeviceId() {
    return '@' + Math.random().toString(36).substr(2, 8);  // 添加 @ 前缀
}

// 获取设备名称
function getDeviceName() {
    const userAgent = navigator.userAgent;
    let name;
    
    // 优先检查移动设备，使用更精确的检测
    if (/iPhone/i.test(userAgent)) {
        name = 'iPhone';
    } else if (/iPad|Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 0) {
        // 新版 iPadOS 会显示为 Macintosh，但有触摸点
        name = 'iPad';
    } else if (/Android/i.test(userAgent)) {
        name = 'Android';
    } else if (/Windows/i.test(userAgent)) {
        name = 'Windows';
    } else if (/Macintosh|Mac OS/i.test(userAgent)) {
        name = 'Mac';
    } else {
        name = '未知设备';
    }

    // 使用固定的设备后缀
    return `${name} #${deviceSuffix}`;
}

// 获取设备类型
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    return 'Desktop';
}


// 取消传输
function cancelTransfer() {
    const statusElem = document.getElementById('status');
    const progressElem = document.getElementById('progress');
    const speedElem = document.getElementById('speed');
    
    if (isTransferring || isReceiving) {
        if (isTransferring) {
            shouldCancel = true;
            isPaused = false;
        } else {
            shouldCancelReceiving = true;
            isReceivingPaused = false;
        }
        
        document.getElementById('pauseResumeButton').disabled = true;
        document.getElementById('cancelButton').disabled = true;
        
        // 添加取消状态的视觉反馈
        statusElem.textContent = isTransferring ? '传输已取消' : '接收已取消';
        statusElem.style.color = 'var(--danger-color)';
        progressElem.style.width = '0%';
        speedElem.textContent = '';
        
        // 1秒后恢复状态文字颜色
        setTimeout(() => {
            statusElem.style.color = '';
            document.getElementById('sendButton').disabled = false;
        }, 1000);
        
        // 清理当前传输
        if (isReceiving && currentReceiving) {
            window.fileBuffers.delete(currentReceiving.fileId);
            currentReceiving = null;
        }
    }
}

// 处理二进制消息
function handleBinaryMessage(data) {
    // 解析头信息
    const headerSize = new Uint32Array(data.slice(0, 4))[0];
    const headerData = new TextDecoder().decode(data.slice(4, 4 + headerSize));
    const header = JSON.parse(headerData);
    const fileData = data.slice(4 + headerSize);

    // 构造文件传输消息
    const message = {
        type: 'fileTransfer',
        fileName: header.fileName,
        fileSize: header.fileSize,
        chunkIndex: header.chunkIndex,
        totalChunks: header.totalChunks,
        data: new Uint8Array(fileData)
    };

    handleFileTransfer(message);
}

// 添加 getMimeType 函数
function getMimeType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
        'txt': 'text/plain',
        'pdf': 'application/pdf',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml'
    };

    return mimeTypes[extension] || 'application/octet-stream';
}

// 添加文件选择处理函数
function handleFileSelect(event) {
    const fileInput = event.target;
    const fileLabel = document.querySelector('.file-input-label span:not(.icon)');
    
    if (fileInput.files.length > 0) {
        if (fileInput.files.length === 1) {
            fileLabel.textContent = fileInput.files[0].name;
        } else {
            fileLabel.textContent = `已选择 ${fileInput.files.length} 个文件`;
        }
    } else {
        fileLabel.textContent = '选择文件';
    }
    
    // 更新发送按钮状态
    document.getElementById('sendButton').disabled = !fileInput.files.length || !selectedDevice;
}

// 修改初始化代码，添加拖放处理
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    
    // 添加文件输入监听
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', async () => {
        if (fileInput.files.length > 0 && selectedDevice) {
            // 创建文件队列
            const files = Array.from(fileInput.files);
            
            // 依次发送每个文件
            for (const file of files) {
                await sendFile([file]); // 一次发送一个文件
                
                // 等待一小段时间再发送下一个文件，避免消息拥堵
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 清空文件选择
            fileInput.value = '';
        }
    });
    
    // 添加拖放处理
    const chatMessages = document.getElementById('chatMessages');
    
    // 阻止默认拖放行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        chatMessages.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    // 添加拖放视觉反馈
    chatMessages.addEventListener('dragenter', () => {
        chatMessages.classList.add('drag-over');
    });
    
    chatMessages.addEventListener('dragleave', (e) => {
        // 只有当离开聊天区域时才移除样式
        const rect = chatMessages.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX >= rect.right || 
            e.clientY < rect.top || e.clientY >= rect.bottom) {
            chatMessages.classList.remove('drag-over');
        }
    });
    
    chatMessages.addEventListener('drop', async (e) => {
        chatMessages.classList.remove('drag-over');
        
        if (!selectedDevice) {
            alert('请先选择一个设备');
            return;
        }
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            // 依次发送每个文件
            for (const file of files) {
                await sendFile([file]);
                // 等待一小段时间再发送下一个文件
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    });
    
    // 发送按钮处理文本消息
    const sendButton = document.getElementById('sendButton');
    const messageInput = document.getElementById('messageInput');
    
    // 添加调试日志
    console.log('发送按钮:', sendButton);
    console.log('消息输入框:', messageInput);
    
    // 回车发送
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter 换行，不做处理
                return;
            }
            
            e.preventDefault();
            if (selectedDevice) {
                const message = messageInput.value.trim();
                if (message) {
                    // 发送消息
                    ws.send(JSON.stringify({
                        type: 'message',
                        to: selectedDevice.deviceId,
                        from: deviceId,
                        message: message,
                        sender: getDeviceName()
                    }));
                    
                    // 添加到聊天区域
                    addChatMessage(message, getDeviceName(), true);
                    
                    // 清空输入框
                    messageInput.value = '';
                    // 重置输入框高度
                    messageInput.style.height = 'auto';
                }
            }
        }
    });

    // 添加自动调整高度的功能
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, parseInt(getComputedStyle(messageInput).maxHeight)) + 'px';
    });

    // 处理移动端键盘事件
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const messageInput = document.getElementById('messageInput');
        
        // 键盘弹出时滚动到底部
        messageInput.addEventListener('focus', () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
            }, 300);
        });

        // 键盘收起时重置滚动
        messageInput.addEventListener('blur', () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
            }, 300);
        });
    }
});

// 添加消息到聊天区域
function addChatMessage(message, sender, isSelf = false, deviceId = selectedDevice?.deviceId) {
    // 保存消息到历史记录
    chatHistory.push({
        message,
        sender,
        isSelf,
        deviceId,
        timestamp: Date.now()
    });
    
    // 如果是当前选中的设备的消息，则显示
    if (deviceId === selectedDevice?.deviceId) {
        displayMessage(message, sender, isSelf);
    }
}

// 修改显示消息的函数
function displayMessage(message, sender, isSelf) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isSelf ? 'self' : 'other'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
} 