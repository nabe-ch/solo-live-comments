// 確認済みの食べ方・危険性から food-data.js を作る（使い方：node tools/build-food.js）
// 再確認の結果（verdict-recheck.tsv）は build-knowledge.js が読む
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'research');
const readTsv = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
const verdicts = new Map(readTsv('verdict-food.tsv').map(([id, verdict, corrected]) => [id, { verdict: (verdict || '').trim().toLowerCase(), corrected: (corrected || '').trim() }]));
const list = [];
const counts = { ok: 0, fix: 0, drop: 0, missing: [] };
for (const [id, name, field, text] of readTsv('claims-food.tsv')) {
  const v = verdicts.get(id);
  if (!v || !['ok', 'fix', 'drop'].includes(v.verdict) || (v.verdict === 'fix' && !v.corrected)) { counts.missing.push(id); continue; }
  counts[v.verdict] += 1;
  if (v.verdict !== 'drop') list.push([name.trim(), field.trim(), v.verdict === 'fix' ? v.corrected : text.trim()]);
}
fs.writeFileSync(path.join(__dirname, '..', 'food-data.js'), `// 自動生成（tools/build-food.js）。独立確認を通った事実だけ。手で書き換えない\n// [名前, eat=食べ方／danger=危険性, 説明]\nconst FOOD = ${JSON.stringify(list)};\n`, 'utf8');
console.log(JSON.stringify({ entries: list.length, ...counts }));
