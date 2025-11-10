#!/usr/bin/env node
// Quick WebSocket test script
// Usage: node test-websocket.js

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:3001/ws';

console.log(`🔌 Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

let messageCount = 0;
let startTime = Date.now();

ws.on('open', () => {
  console.log('✅ Connected! Waiting for messages...\n');
});

ws.on('message', (data) => {
  messageCount++;
  
  if (!(data instanceof Buffer)) {
    console.error('❌ Expected binary data, got:', typeof data);
    return;
  }
  
  const view = new DataView(data.buffer);
  const timestamp = Number(view.getBigUint64(0, true));
  const numBoids = view.getUint32(8, true);
  
  const elapsed = Date.now() - startTime;
  const fps = (messageCount / elapsed) * 1000;
  
  if (messageCount % 60 === 0) {
    console.log(`📦 Message ${messageCount}: ${numBoids} boids | FPS: ${fps.toFixed(1)} | Size: ${data.length} bytes`);
  }
  
  if (messageCount >= 300) {
    console.log(`\n✅ Test complete! Received ${messageCount} messages in ${elapsed}ms`);
    console.log(`📊 Average FPS: ${fps.toFixed(1)}`);
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 Connection closed');
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  if (messageCount === 0) {
    console.error('❌ No messages received within 10 seconds');
    process.exit(1);
  }
}, 10000);

