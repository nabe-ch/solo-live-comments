// 確認済みの生き物のうんちくから creature-data.js を作る（使い方：node tools/build-creature.js）
// verdict-creature2.tsv は再確認の結果で、verdict-creature.tsv より優先する
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'research');
const readTsv = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')) : []);
const verdicts = new Map([...readTsv('verdict-creature.tsv'), ...readTsv('verdict-creature2.tsv')].map(([id, verdict, corrected]) => [id.trim(), { verdict: (verdict || '').trim().toLowerCase(), corrected: (corrected || '').trim() }]));
const list = [];
const counts = { ok: 0, fix: 0, drop: 0, missing: [] };
for (const [id, name, text] of readTsv('claims-creature.tsv')) {
  const v = verdicts.get(id);
  if (!v || !['ok', 'fix', 'drop'].includes(v.verdict) || (v.verdict === 'fix' && !v.corrected)) { counts.missing.push(id); continue; }
  counts[v.verdict] += 1;
  if (v.verdict !== 'drop') list.push([name.trim(), v.verdict === 'fix' ? v.corrected : text.trim()]);
}
fs.writeFileSync(path.join(__dirname, '..', 'creature-data.js'), `// 自動生成（tools/build-creature.js）。独立確認を通った事実だけ。手で書き換えない\n// [名前, うんちく]\nconst CREATURE_TRIVIA = ${JSON.stringify(list)};\n`, 'utf8');
console.log(JSON.stringify({ entries: list.length, species: new Set(list.map((l) => l[0])).size, ...counts }));
