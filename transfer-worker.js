importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');

let currentFileId = null;
let processedChunks = new Map();

self.onmessage = async function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'compress':
            const { chunks, workerId, channelId } = e.data;
            await processChunks(chunks, workerId, channelId);
            break;

        case 'processChunk':
            await handleReceivedChunk(data);
            break;
    }
};

async function processChunks(chunks, workerId, channelId) {
    for (const chunk of chunks) {
        const compressed = pako.deflate(new Uint8Array(chunk));
        
        // 创建二进制消息
        const message = new ArrayBuffer(compressed.length + 8);
        const view = new DataView(message);
        
        // 添加元数据头
        view.setUint32(0, workerId);
        view.setUint32(4, compressed.length);
        
        // 添加压缩数据
        new Uint8Array(message, 8).set(compressed);
        
        // 发送给主线程
        self.postMessage({
            type: 'sendChunk',
            channelId: channelId,
            data: message
        }, [message]);
    }
}

async function handleReceivedChunk(data) {
    const view = new DataView(data);
    const workerId = view.getUint32(0);
    const compressedLength = view.getUint32(4);
    
    // 提取压缩数据
    const compressedData = new Uint8Array(data, 8, compressedLength);
    
    // 解压数据
    const decompressed = pako.inflate(compressedData);
    
    // 发送回主线程
    self.postMessage({
        type: 'chunkProcessed',
        workerId: workerId,
        data: decompressed.buffer
    }, [decompressed.buffer]);
} 