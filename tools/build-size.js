// 集めた生息地と大きさから size-data.js を作る（使い方：node tools/build-size.js）
// 出典のURLがない行は入れない。size-fix.tsv は抜き取り確認の修正で、優先する
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'research');
const readTsv = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')) : []);
// 調査のメモ（「英語版は〜」「ページの〜」など）を除き、最初の一文だけにする
const tidy = (text) => (text || '').trim()
  .replace(/[（(][^）)]*(ページ|英語版|日本語版|資料|記事|出典|Wikipedia|記録が)[^）)]*[）)]/g, '')
  .split('。')[0]
  .trim();
const rows = new Map();
for (const f of ['size1.tsv', 'size2.tsv', 'size3.tsv', 'size4.tsv', 'size-fix.tsv']) {
  for (const [name, place, size, url] of readTsv(f)) {
    if (!name || !/^https?:/.test((url || '').trim())) continue;
    rows.set(name.trim(), [tidy(place), tidy(size)]);
  }
}
// 大型の個体の数字しかなく、ふつうの大きさと誤解されるものは外す
if (rows.has('ネコ')) rows.get('ネコ')[1] = '';
const list = [...rows].filter(([, [p, s]]) => p || s).map(([n, [p, s]]) => [n, p, s]);
fs.writeFileSync(path.join(__dirname, '..', 'size-data.js'), `// 自動生成（tools/build-size.js）。出典のURLがあるものだけ。手で書き換えない\n// [名前, 主な生息地, 体の大きさ]\nconst SIZE_DATA = ${JSON.stringify(list)};\n`, 'utf8');
console.log(JSON.stringify({ entries: list.length, noPlace: list.filter((r) => !r[1]).length, noSize: list.filter((r) => !r[2]).length }));
