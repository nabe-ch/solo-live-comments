// 確認済みの主張から knowledge-data.js を作る（使い方：node tools/build-knowledge.js）
// research/claims-*.tsv が主張の一覧、research/verdict-*.tsv が独立確認の結果。ok と fix だけを使い、drop は入れない
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'research');
const readTsv = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
const SETS = [['claims-museum.tsv', 'verdict-museum.tsv', '博物館'], ['claims-art.tsv', 'verdict-museum.tsv', '美術品'], ['claims-cafe.tsv', 'verdict-cafe.tsv', '暮らし'], ['claims-fire.tsv', 'verdict-fire.tsv', '消防']];
const entries = new Map();
const counts = { ok: 0, fix: 0, drop: 0, missing: [] };
for (const [claimFile, verdictFile, group] of SETS) {
  const verdicts = new Map(readTsv(verdictFile).map(([id, verdict, corrected]) => [id, { verdict: (verdict || '').trim().toLowerCase(), corrected: (corrected || '').trim() }]));
  for (const [id, topic, field, text] of readTsv(claimFile)) {
    const v = verdicts.get(id);
    if (!v) { counts.missing.push(id); continue; }
    if (v.verdict === 'drop') { counts.drop += 1; continue; }
    if (v.verdict === 'fix' && !v.corrected) { counts.missing.push(id + '（修正文なし）'); continue; }
    if (v.verdict !== 'ok' && v.verdict !== 'fix') { counts.missing.push(id + '（判定不明）'); continue; }
    counts[v.verdict] += 1;
    const key = topic.trim();
    if (!entries.has(key)) entries.set(key, { group, what: [], where: [], when: [], real: [] });
    const finalText = v.verdict === 'fix' ? v.corrected : text.trim();
    entries.get(key)[field === 'real' ? 'real' : field].push(finalText);
  }
}
// 世界三大は諸説あるので、並べて答える（語彙とれの調査と、今回の確認の両方を反映）
if (entries.has('世界三大博物館')) entries.get('世界三大博物館').what = ['公式の定義はなく、諸説ある。大英博物館・ルーブル美術館・メトロポリタン美術館を挙げる案内と、ルーブル・メトロポリタン・エルミタージュを挙げる案内がある'];
const list = [...entries].map(([name, e]) => [name, e.group, e.what, e.where, e.when, e.real]);
fs.writeFileSync(path.join(__dirname, '..', 'knowledge-data.js'), `// 自動生成（tools/build-knowledge.js）。独立確認を通った事実だけ。手で書き換えない\n// [話題, 分類, 説明, 場所, 時期, 美術品のモデル]\nconst KNOWLEDGE = ${JSON.stringify(list)};\n`, 'utf8');
console.log(JSON.stringify({ entries: list.length, ...counts }));
