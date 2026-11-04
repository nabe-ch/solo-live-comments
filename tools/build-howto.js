// 確認済みの遊び方から howto-data.js を作る（使い方：node tools/build-howto.js）
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'research');
const readTsv = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')) : []);
const verdicts = new Map(readTsv('verdict-howto.tsv').map(([id, verdict, corrected]) => [id.trim(), { verdict: (verdict || '').trim().toLowerCase(), corrected: (corrected || '').trim() }]));
const list = [];
const counts = { ok: 0, fix: 0, drop: 0, missing: 0 };
for (const [id, name, text] of readTsv('claims-howto.tsv')) {
  const v = verdicts.get(id);
  if (!v || !['ok', 'fix', 'drop'].includes(v.verdict) || (v.verdict === 'fix' && !v.corrected)) { counts.missing += 1; continue; }
  counts[v.verdict] += 1;
  if (v.verdict !== 'drop') list.push([name.trim(), v.verdict === 'fix' ? v.corrected : text.trim()]);
}
fs.writeFileSync(path.join(__dirname, '..', 'howto-data.js'), `// 自動生成（tools/build-howto.js）。独立確認を通った事実だけ。手で書き換えない\n// [項目, 説明]\nconst HOWTO = ${JSON.stringify(list)};\n`, 'utf8');
console.log(JSON.stringify({ entries: list.length, ...counts }));
