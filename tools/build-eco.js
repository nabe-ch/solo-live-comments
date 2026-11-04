// 確認済みの生態から eco-data.js を作る（使い方：node tools/build-eco.js）
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'research');
const readTsv = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')) : []);
const verdicts = new Map(['verdict-eco1.tsv', 'verdict-eco2.tsv', 'verdict-eco3.tsv', 'verdict-topic7.tsv', 'verdict-topic8.tsv'].flatMap(readTsv).map(([id, verdict, corrected]) => [id.trim(), { verdict: (verdict || '').trim().toLowerCase(), corrected: (corrected || '').trim() }]));
const list = [];
const counts = { ok: 0, fix: 0, drop: 0, missing: [] };
for (const [id, name, text] of readTsv('claims-eco.tsv')) {
  const v = verdicts.get(id);
  if (!v || !['ok', 'fix', 'drop'].includes(v.verdict) || (v.verdict === 'fix' && !v.corrected)) { counts.missing.push(name); continue; }
  counts[v.verdict] += 1;
  if (v.verdict === 'drop') counts.missing.push(name);
  else list.push([name.trim(), v.verdict === 'fix' ? v.corrected : text.trim()]);
}
fs.writeFileSync(path.join(__dirname, '..', 'eco-data.js'), `// 自動生成（tools/build-eco.js）。独立確認を通った事実だけ。手で書き換えない\n// [名前, 生態]\nconst ECOLOGY = ${JSON.stringify(list)};\n`, 'utf8');
console.log(JSON.stringify({ entries: list.length, ok: counts.ok, fix: counts.fix, drop: counts.drop, missing: counts.missing.join(' ') }));
