// あつ森の公開データを取得し、アプリ用の game-data.js を作る（使い方：node tools/build-data.js）
// 住民：Norviah/animal-crossing（MIT、413人）／生き物・化石：alexislours/ACNHAPI
const fs = require('fs');
const path = require('path');
const NOR = 'https://raw.githubusercontent.com/Norviah/animal-crossing/master/json/data/Villagers.json';
const API = 'https://raw.githubusercontent.com/alexislours/ACNHAPI/master/';
const SPECIES = { Bird: 'トリ', Squirrel: 'リス', Pig: 'ブタ', Gorilla: 'ゴリラ', Alligator: 'ワニ', Koala: 'コアラ', Eagle: 'ワシ', Anteater: 'アリクイ', Bull: 'ウシ', Mouse: 'ネズミ', Cat: 'ネコ', Horse: 'ウマ', Hamster: 'ハムスター', Kangaroo: 'カンガルー', Wolf: 'オオカミ', Penguin: 'ペンギン', Chicken: 'ニワトリ', Elephant: 'ゾウ', Rhinoceros: 'サイ', Sheep: 'ヒツジ', Deer: 'シカ', Tiger: 'トラ', 'Bear cub': 'コグマ', Dog: 'イヌ', Bear: 'クマ', Hippo: 'カバ', Duck: 'アヒル', Goat: 'ヤギ', Ostrich: 'ダチョウ', Rabbit: 'ウサギ', Lion: 'ライオン', Frog: 'カエル', Octopus: 'タコ', Monkey: 'サル', Cow: 'ウシ' };
const PERSONALITY = { Jock: 'ハキハキ', Cranky: 'コワイ', Peppy: 'げんき', 'Big Sister': 'アネキ', Lazy: 'ぼんやり', Normal: 'ふつう', Snooty: 'オトナ', Smug: 'キザ' };
const HOBBY = { Nature: '自然', Fitness: '運動', Play: '遊び', Music: '音楽', Fashion: 'おしゃれ', Education: '勉強' };
const PLACE = { River: '川', Pond: '池', Sea: '海', 'River (Clifftop)': '崖の上の川', 'River (Mouth)': '河口', Pier: '桟橋', 'Sea (Rainy days)': '雨の日の海', Flying: '飛んでいる', 'Flying near flowers': '花の近くを飛んでいる', 'Flying near blue/purple/black flowers': '青・紫・黒の花の近くを飛んでいる', 'Flying near water': '水辺を飛んでいる', 'Flying near light sources': '明かりの近くを飛んでいる', 'On trees': '木', 'On the ground': '地面', 'On flowers': '花の上', 'On white flowers': '白い花の上', 'Shaking trees': '木をゆすると落ちてくる', Underground: '地中', 'On ponds and rivers': '池や川の水面', 'On tree stumps': '切り株', 'On palm trees': 'ヤシの木', 'Under trees': '木の下', 'Under rocks': '岩の下', 'On rocks/bushes': '岩や低木', 'On beach rocks': '海岸の岩', 'On the beach': '砂浜', 'On villagers': '住民のまわり', 'On trash items': 'ゴミのまわり', 'On rotten food': '腐ったカブのまわり', 'On rocks and bush': '岩や低木', 'Hitting rocks': '岩を叩くと出てくる', 'Disguised under trees': '木の下で家具に化けている', 'Disguised on shoreline': '海岸で貝に化けている', 'Near trash': 'ゴミのまわり', 'Flying near trash': 'ゴミのまわりを飛んでいる', 'River (Clifftop) & Pond': '崖の上の川や池', 'Sea (when raining or snowing)': '雨や雪の日の海', 'Flying near hybrid flowers': '交配した花の近くを飛んでいる', 'Flying by light': '明かりの近くを飛んでいる', 'Flying (near water)': '水辺を飛んでいる', 'On rocks and bush (when raining)': '雨の日の岩や低木', 'From hitting rocks': '岩を叩くと出てくる' };

const getJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return Object.values(await r.json()); };
const jaTime = (t) => String(t || '').replace(/(\d+)(am|pm)/g, (_, h, m) => (Number(h) % 12) + (m === 'pm' ? 12 : 0) + '時').replace(/ - /g, '〜').replace(/ & /g, '、');

(async () => {
  const nor = await getJson(NOR);
  const villagers = nor.map((v) => {
    const [m, d] = v.birthday.split('/');
    return [v.translations.jPja, SPECIES[v.species], v.gender === 'Male' ? '男の子' : '女の子', PERSONALITY[v.personality], v.catchphrases.jPja, m + '月' + d + '日', HOBBY[v.hobby]];
  });
  // 2つ目のデータ元と突き合わせる（登録されている住民のみ）
  const api = await getJson(API + 'villagers.json');
  const byEn = new Map(api.map((v) => [v.name['name-USen'].toLowerCase(), v]));
  const diff = [];
  for (const v of nor) {
    const a = byEn.get(v.name.toLowerCase());
    if (!a) continue;
    if (a.name['name-JPja'] !== v.translations.jPja) diff.push(`名前 ${v.name}: ${a.name['name-JPja']} / ${v.translations.jPja}`);
    if (a['catch-translations']['catch-JPja'] !== v.catchphrases.jPja) {
      diff.push(`口癖 ${v.name}: ${a['catch-translations']['catch-JPja']} / ${v.catchphrases.jPja}`);
      // データ元で食い違う口癖は、確かでないので使わない
      villagers.find((x) => x[0] === v.translations.jPja)[4] = '';
    }
    const sameSpecies = (x, y) => x.toLowerCase().replace('bear cub', 'cub').replace('rhinoceros', 'rhino') === y.toLowerCase().replace('bear cub', 'cub').replace('rhinoceros', 'rhino');
    if (!sameSpecies(a.species, v.species) || a.gender !== v.gender) diff.push(`種族・性別 ${v.name}: ${a.species}/${a.gender} / ${v.species}/${v.gender}`);
  }
  const creature = (kind) => (c) => [c.name['name-JPja'], kind, c.price, c.availability.location ? (PLACE[c.availability.location] || c.availability.location) : '', jaTime(c.availability.time), c.availability['month-southern'] || ''];
  const creatures = [
    ...(await getJson(API + 'fish.json')).map(creature('魚')),
    ...(await getJson(API + 'bugs.json')).map(creature('虫')),
    ...(await getJson(API + 'sea.json')).map(creature('海の幸'))
  ];
  const fossils = (await getJson(API + 'fossils.json')).map((f) => [f.name['name-JPja'], f.price]);
  const body = `// 自動生成（tools/build-data.js）。手で書き換えない\n// 住民：[名前, 種族, 性別, 性格, 口癖, 誕生日, 趣味]\nconst VILLAGERS = ${JSON.stringify(villagers)};\n// 生き物：[名前, 種類, 売値, 場所, 時間, 月（南半球）]\nconst CREATURES = ${JSON.stringify(creatures)};\n// 化石：[名前, 売値]\nconst FOSSILS = ${JSON.stringify(fossils)};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'game-data.js'), body, 'utf8');
  const unmapped = [...new Set(creatures.map((c) => c[3]).filter((p) => /[A-Za-z]/.test(p)))];
  const empty = villagers.filter((v) => v.some((x) => !x)).length;
  console.log(JSON.stringify({ villagers: villagers.length, emptyFields: empty, comparedWithSecondSource: nor.filter((v) => byEn.has(v.name.toLowerCase())).length, differences: diff, creatures: creatures.length, fossils: fossils.length, unmapped, bytes: Buffer.byteLength(body), shortNames: [...villagers.map((v) => v[0]), ...creatures.map((c) => c[0])].filter((n) => n.length <= 2).join(' ') }, null, 1));
})();
