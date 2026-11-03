// あつ森の公開データを取得し、アプリ用の game-data.js を作る（使い方：node tools/build-data.js）
// 住民：Norviah/animal-crossing（MIT、413人）／生き物・化石：alexislours/ACNHAPI
const fs = require('fs');
const path = require('path');
const NOR = 'https://raw.githubusercontent.com/Norviah/animal-crossing/master/json/data/Villagers.json';
const API = 'https://raw.githubusercontent.com/alexislours/ACNHAPI/master/';
const SPECIES = { Bird: 'トリ', Squirrel: 'リス', Pig: 'ブタ', Gorilla: 'ゴリラ', Alligator: 'ワニ', Koala: 'コアラ', Eagle: 'ワシ', Anteater: 'アリクイ', Bull: 'ウシ', Mouse: 'ネズミ', Cat: 'ネコ', Horse: 'ウマ', Hamster: 'ハムスター', Kangaroo: 'カンガルー', Wolf: 'オオカミ', Penguin: 'ペンギン', Chicken: 'ニワトリ', Elephant: 'ゾウ', Rhinoceros: 'サイ', Sheep: 'ヒツジ', Deer: 'シカ', Tiger: 'トラ', 'Bear cub': 'コグマ', Dog: 'イヌ', Bear: 'クマ', Hippo: 'カバ', Duck: 'アヒル', Goat: 'ヤギ', Ostrich: 'ダチョウ', Rabbit: 'ウサギ', Lion: 'ライオン', Frog: 'カエル', Octopus: 'タコ', Monkey: 'サル', Cow: 'ウシ' };
const PERSONALITY = { Jock: 'ハキハキ', Cranky: 'コワイ', Peppy: 'げんき', 'Big Sister': 'アネキ', Lazy: 'ぼんやり', Normal: 'ふつう', Snooty: 'オトナ', Smug: 'キザ' };
const HOBBY = { Nature: '自然', Fitness: '運動', Play: '遊び', Music: '音楽', Fashion: 'おしゃれ', Education: '勉強' };
const PLACE = { River: '川', Pond: '池', Sea: '海', 'River (Clifftop)': '崖の上の川', 'River (Mouth)': '河口', Pier: '桟橋', 'Sea (Rainy days)': '雨の日の海', Flying: '飛んでいる', 'Flying near flowers': '花の近くを飛んでいる', 'Flying near blue/purple/black flowers': '青・紫・黒の花の近くを飛んでいる', 'Flying near water': '水辺を飛んでいる', 'Flying near light sources': '明かりの近くを飛んでいる', 'On trees': '木', 'On the ground': '地面', 'On flowers': '花の上', 'On white flowers': '白い花の上', 'Shaking trees': '木をゆすると落ちてくる', Underground: '地中', 'On ponds and rivers': '池や川の水面', 'On tree stumps': '切り株', 'On palm trees': 'ヤシの木', 'Under trees': '木の下', 'Under rocks': '岩の下', 'On rocks/bushes': '岩や低木', 'On beach rocks': '海岸の岩', 'On the beach': '砂浜', 'River (clifftop)': '崖の上の川', 'River (mouth)': '河口', 'Sea (rainy days)': '雨の日の海', 'On trees (any kind)': '木', 'On rotten turnips or candy': '腐ったカブやアメのまわり', 'Shaking trees (hardwood or cedar only)': '広葉樹や針葉樹をゆすると落ちてくる', 'On hardwood/cedar trees': '広葉樹や針葉樹', 'On rivers/ponds': '川や池の水面', 'Pushing snowballs': '雪玉を転がすと出てくる', 'Flying near trash (boots, tires, cans, used fountain fireworks) or rotten turnips': 'ゴミや腐ったカブのまわりを飛んでいる', 'Underground (dig where noise is loudest)': '地中（音が一番大きい場所を掘る）', 'On villagers': '住民のまわり', 'On trash items': 'ゴミのまわり', 'On rotten food': '腐ったカブのまわり', 'On rocks and bush': '岩や低木', 'Hitting rocks': '岩を叩くと出てくる', 'Disguised under trees': '木の下で家具に化けている', 'Disguised on shoreline': '海岸で貝に化けている', 'Near trash': 'ゴミのまわり', 'Flying near trash': 'ゴミのまわりを飛んでいる', 'River (Clifftop) & Pond': '崖の上の川や池', 'Sea (when raining or snowing)': '雨や雪の日の海', 'Flying near hybrid flowers': '交配した花の近くを飛んでいる', 'Flying by light': '明かりの近くを飛んでいる', 'Flying (near water)': '水辺を飛んでいる', 'On rocks and bush (when raining)': '雨の日の岩や低木', 'From hitting rocks': '岩を叩くと出てくる' };

const SHADOW = { 'X-Small': '極小', Small: '小', Medium: '中', Large: '大', 'X-Large': '特大', 'XX-Large': '超特大', 'X-Large w/Fin': '背びれつきの特大', Long: '細長い' };
const DIFFICULTY = { 'Very Easy': 'とても釣りやすい', Easy: '釣りやすい', Medium: 'ふつう', Hard: '釣りにくい', 'Very Hard': 'とても釣りにくい' };
const SPEED = { Stationary: '動かない', 'Very slow': 'とても遅い', Slow: '遅い', Medium: 'ふつう', Fast: '速い', 'Very fast': 'とても速い' };
const WEATHER = { 'Any weather': '天気を問わず', 'Any except rain': '雨以外', 'Rain only': '雨の日だけ' };
const getJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return Object.values(await r.json()); };
const jaTime = (t) => String(t || '').replace(/(\d+)\s*(am|pm)/gi, (_, h, m) => (Number(h) % 12) + (m.toLowerCase() === 'pm' ? 12 : 0) + '時').replace(/\s*[-–]\s*/g, '〜').replace(/\s*&\s*/g, '、').replace(/All day/i, '一日中');

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
  // 生き物は詳しいデータ（Norviah/animal-crossing）を使い、ACNHAPI と売値・月を突き合わせる
  const NORC = 'https://raw.githubusercontent.com/Norviah/animal-crossing/master/json/data/';
  const creature = (kind) => (c) => {
    const s = c.hemispheres.south;
    const hours = s.timeArray.flat(); // 時間帯が2つある生き物は、配列が入れ子になっている
    const allDay = hours.length >= 24;
    const unlock = Number(c.totalCatchesToUnlock) || 0;
    const extra = kind === '魚' ? DIFFICULTY[c.catchDifficulty] : kind === '海の幸' ? SPEED[c.movementSpeed] : '';
    return [c.translations.jPja, kind, c.sell, c.whereHow ? (PLACE[c.whereHow] || c.whereHow) : '海の中', allDay ? '' : s.time.map(jaTime).join('、'), s.monthsArray.length === 12 ? [] : s.monthsArray, allDay ? [] : hours, c.shadow ? SHADOW[c.shadow] : '', c.weather ? WEATHER[c.weather] : '', unlock, extra];
  };
  const creatures = [
    ...(await getJson(NORC + 'Fish.json')).map(creature('魚')),
    ...(await getJson(NORC + 'Insects.json')).map(creature('虫')),
    ...(await getJson(NORC + encodeURIComponent('Sea Creatures.json'))).map(creature('海の幸'))
  ];
  // データ元で時間が食い違う魚は、断定しない（残りの食い違いは SPEC.md に記録）
  for (const c of creatures) if (['オオイワナ', 'ヤマメ'].includes(c[0])) c[4] = '時期によって変わる（16時〜9時の時期あり）';
  const apiCreatures = [...await getJson(API + 'fish.json'), ...await getJson(API + 'bugs.json'), ...await getJson(API + 'sea.json')];
  const apiByName = new Map(apiCreatures.map((c) => [c.name['name-JPja'], c]));
  const creatureDiff = [];
  for (const c of creatures) {
    const a = apiByName.get(c[0]);
    if (!a) { creatureDiff.push('名前なし ' + c[0]); continue; }
    if (a.price !== c[2]) creatureDiff.push(`売値 ${c[0]}: ${a.price} / ${c[2]}`);
    const sorted = (list) => [...new Set(list)].sort((x, y) => x - y).join();
    const am = sorted(a.availability['month-array-southern'] || []);
    const cm = sorted(c[5].length ? c[5] : Array.from({ length: 12 }, (_, i) => i + 1));
    if (am && am !== cm) creatureDiff.push(`月 ${c[0]}: ${am} / ${cm}`);
    if (a.availability['time-array'] && sorted(a.availability['time-array']) !== sorted(c[6].length ? c[6] : Array.from({ length: 24 }, (_, i) => i))) creatureDiff.push(`時間 ${c[0]}: ${a.availability.time} / ${c[4] || '一日中'}`);
  }
  const fossils = (await getJson(API + 'fossils.json')).map((f) => [f.name['name-JPja'], f.price]);
  const body = `// 自動生成（tools/build-data.js）。手で書き換えない\n// 住民：[名前, 種族, 性別, 性格, 口癖, 誕生日, 趣味]\nconst VILLAGERS = ${JSON.stringify(villagers)};\n// 生き物：[名前, 種類, 売値, 場所, 時間, 月（南半球。空は一年中）, 時（空は一日中）, 影, 天気, 解禁に必要な通算数, 釣りやすさ／動きの速さ]\nconst CREATURES = ${JSON.stringify(creatures)};\n// 化石：[名前, 売値]\nconst FOSSILS = ${JSON.stringify(fossils)};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'game-data.js'), body, 'utf8');
  const unmapped = [...new Set(creatures.map((c) => c[3]).filter((p) => /[A-Za-z]/.test(p)))];
  const empty = villagers.filter((v) => v.some((x) => !x)).length;
  console.log(JSON.stringify({ villagers: villagers.length, emptyFields: empty, comparedWithSecondSource: nor.filter((v) => byEn.has(v.name.toLowerCase())).length, differences: diff, creatureDiff, creatures: creatures.length, fossils: fossils.length, unmapped, bytes: Buffer.byteLength(body), shortNames: [...villagers.map((v) => v[0]), ...creatures.map((c) => c[0])].filter((n) => n.length <= 2).join(' ') }, null, 1));
})();
