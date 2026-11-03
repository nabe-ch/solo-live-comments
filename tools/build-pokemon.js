// ポケモンの公開データ（PokeAPI、CSV）から pokemon-data.js を作る（使い方：node tools/build-pokemon.js）
const fs = require('fs');
const path = require('path');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const JA = 11; // PokeAPI の日本語（カタカナ・漢字混じり）の言語番号
const csv = async (name) => {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(name + ' ' + r.status);
  const [head, ...lines] = (await r.text()).trim().split('\n').map((l) => l.replace(/\r$/, '').split(','));
  return lines.map((l) => Object.fromEntries(head.map((h, i) => [h, l[i]])));
};
(async () => {
  const species = await csv('pokemon_species.csv');
  const names = await csv('pokemon_species_names.csv');
  const typeNames = await csv('type_names.csv');
  const pokemon = await csv('pokemon.csv');
  const types = await csv('pokemon_types.csv');
  const jaName = new Map(names.filter((n) => Number(n.local_language_id) === JA).map((n) => [n.pokemon_species_id, n.name]));
  const jaType = new Map(typeNames.filter((n) => Number(n.local_language_id) === JA).map((n) => [n.type_id, n.name]));
  // 各ポケモンの基本の姿（is_default）のタイプ
  const defaultForm = new Map(pokemon.filter((p) => p.is_default === '1').map((p) => [p.species_id, p.id]));
  const typesOf = (sid) => types.filter((t) => t.pokemon_id === defaultForm.get(sid)).sort((a, b) => a.slot - b.slot).map((t) => jaType.get(t.type_id));
  const list = species.map((s) => [Number(s.id), jaName.get(s.id), typesOf(s.id), Number(s.generation_id), s.evolves_from_species_id ? jaName.get(s.evolves_from_species_id) : '']);
  const broken = list.filter((p) => !p[1] || !p[2].length || p[2].some((t) => !t));
  const body = `// 自動生成（tools/build-pokemon.js）。手で書き換えない\n// [図鑑番号, 名前, タイプ, 世代, 進化前]\nconst POKEMON = ${JSON.stringify(list)};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'pokemon-data.js'), body, 'utf8');
  console.log(JSON.stringify({ count: list.length, maxId: Math.max(...list.map((p) => p[0])), generations: Math.max(...list.map((p) => p[3])), broken: broken.length, brokenSample: broken.slice(0, 5), bytes: Buffer.byteLength(body), sample: [list[0], list[24], list[129], list[list.length - 1]], twoChar: list.filter((p) => p[1] && p[1].length <= 2).map((p) => p[1]).join(' ') }));
})();
