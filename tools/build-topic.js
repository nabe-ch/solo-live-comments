// 確認済みの話題のうんちくから topic-data.js を作る（使い方：node tools/build-topic.js）
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'research');
const readTsv = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')) : []);
const verdicts = new Map([...readTsv('verdict-topic1.tsv'), ...readTsv('verdict-topic2.tsv'), ...readTsv('verdict-topic3.tsv'), ...readTsv('verdict-topic4.tsv'), ...readTsv('verdict-topic5.tsv')].map(([id, verdict, corrected]) => [id.trim(), { verdict: (verdict || '').trim().toLowerCase(), corrected: (corrected || '').trim() }]));
const list = [];
const counts = { ok: 0, fix: 0, drop: 0, missing: [] };
for (const [id, name, text] of readTsv('claims-topic.tsv')) {
  const v = verdicts.get(id);
  if (!v || !['ok', 'fix', 'drop'].includes(v.verdict) || (v.verdict === 'fix' && !v.corrected)) { counts.missing.push(id); continue; }
  counts[v.verdict] += 1;
  if (v.verdict !== 'drop') list.push([name.trim(), v.verdict === 'fix' ? v.corrected : text.trim()]);
}
fs.writeFileSync(path.join(__dirname, '..', 'topic-data.js'), `// 自動生成（tools/build-topic.js）。独立確認を通った事実だけ。手で書き換えない\n// [話題, うんちく]\nconst TOPIC_TRIVIA = ${JSON.stringify(list)};\n`, 'utf8');
console.log(JSON.stringify({ entries: list.length, topics: new Set(list.map((l) => l[0])).size, ...counts, missing: counts.missing.length }));
