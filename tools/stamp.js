// 読み込むファイルの版番号を上げる（使い方：node tools/stamp.js）。古いファイルが混ざって動かなくなるのを防ぐ
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'index.html');
const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 12);
fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\?v=[^"]*"/g, '?v=' + stamp + '"'), 'utf8');
console.log('v=' + stamp);
