// game-data.js から、住民・生き物・化石ごとのコメントと、質問への答えを組み立てる
const SAGE = 'うんちく博士';
const ORACLE = '物知り島民';
const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 名前の判定：3文字以上はひらがな・カタカナ両方。2文字は書かれたとおりのみ。どちらも長いカタカナ語の一部には反応しない。1文字とひらがな2文字は誤反応が多いので使わない
function nameRegex(name) {
  if (name.length < 2 || (name.length === 2 && /^[ぁ-ゖ]+$/.test(name))) return null;
  // 長いカタカナ語の一部（トランプの「ラン」、ランキングの「キング」など）に反応しないよう、前後を見る
  const alone = (body) => new RegExp(`(^|[^ァ-ヶー])(${body})(?![ァ-ヶー])`);
  if (name.length === 2) return alone([name, ...(ALIASES[name] || [])].map(escapeRe).join('|'));
  const forms = [...new Set([name, toKata(name), toHira(name), ...(ALIASES[name] || [])])];
  return alone(forms.map(escapeRe).join('|'));
}
// ゲーム内の呼び名と、ふだんの呼び名が違うもの（音声認識は漢字に変換することがある）
const ALIASES = { Tレックス: ['ティラノサウルス', 'ティラノ'], さんようちゅう: ['三葉虫'], しそちょう: ['始祖鳥'], パキケファロ: ['パキケファロサウルス'], タイ: ['鯛'], サケ: ['鮭'], サメ: ['鮫'], マグロ: ['鮪'], コイ: ['鯉'], アユ: ['鮎'], タコ: ['蛸'], イカ: ['烏賊'], フグ: ['河豚'], アジ: ['鯵'], フナ: ['鮒'], ウニ: ['雲丹'], ハチ: ['蜂'], アリ: ['蟻'], クモ: ['蜘蛛'], ハエ: ['蝿'], ノミ: ['蚤'], スズキ: ['鈴木', '鱸'], ナマズ: ['鯰'], ドジョウ: ['泥鰌'], ニシキゴイ: ['錦鯉'], キンギョ: ['金魚'], ホタル: ['蛍'], セミ: ['蝉'], カブトムシ: ['兜虫'], クワガタ: ['鍬形'] };

// 現実の生き物・化石の豆知識（手書き）
const TRIVIA = {
  シーラカンス: ['シーラカンスは「生きた化石」と呼ばれる古代魚', '絶滅したと思われていたシーラカンスは1938年に南アフリカ沖で見つかった'],
  ジンベエザメ: ['ジンベエザメは世界最大の魚', 'ジンベエザメは大きいのに主にプランクトンを食べる'],
  マンボウ: ['マンボウはフグの仲間', 'マンボウは一度にとても多くの卵を産むことで有名'],
  ナポレオンフィッシュ: ['ナポレオンフィッシュの和名はメガネモチノウオ'],
  チョウチンアンコウ: ['チョウチンアンコウの光る部分は、背びれが変化したもの', 'チョウチンアンコウの仲間には、小さなオスがメスにくっついて暮らす種がいる'],
  リュウグウノツカイ: ['リュウグウノツカイは数メートルにもなる深海魚'],
  デメニギス: ['デメニギスは頭が透明で、中の目が見える深海魚'],
  ピラルク: ['ピラルクは世界最大級の淡水魚', 'ピラルクは空気呼吸もする'],
  サケ: ['サケは生まれた川に戻って産卵する'],
  チョウザメ: ['キャビアはチョウザメの卵', 'チョウザメはサメの仲間ではない'],
  ドジョウ: ['ドジョウは腸でも呼吸できる'],
  フグ: ['フグの毒はテトロドトキシン'],
  マグロ: ['マグロは泳ぎ続けないと呼吸ができない'],
  タツノオトシゴ: ['タツノオトシゴはオスがお腹の袋で子を育てる'],
  クマノミ: ['クマノミは群れの中でオスからメスに性転換する'],
  イトウ: ['イトウは日本最大級の淡水魚'],
  タランチュラ: ['タランチュラの毒は、人には弱い種が多い'],
  サソリ: ['サソリはブラックライトを当てると光る'],
  ホタル: ['ホタルは幼虫のころから光る種がいる'],
  ヘラクレスオオカブト: ['ヘラクレスオオカブトは世界最大級のカブトムシ'],
  アレキサンドラトリバネアゲハ: ['アレキサンドラトリバネアゲハは世界最大のチョウ'],
  ミツバチ: ['ミツバチはダンスで仲間に蜜の場所を伝える'],
  タガメ: ['タガメは日本最大級の水生昆虫'],
  アメンボ: ['アメンボは足の細かい毛で水に浮く'],
  クモ: ['クモは昆虫ではない。脚は8本'],
  ダンゴムシ: ['ダンゴムシは昆虫ではなく、エビやカニと同じ甲殻類'],
  タコ: ['タコには心臓が3つある'],
  カブトガニ: ['カブトガニは「生きた化石」で、血が青い'],
  ナマコ: ['ナマコは敵に襲われると内臓を吐き出すことがある'],
  ホタテ: ['ホタテには小さな目がたくさんある'],
  シャコ: ['シャコのパンチはとても強い'],
  Tレックス: ['ティラノサウルスは白亜紀後期の肉食恐竜'],
  トリケラトプス: ['トリケラトプスは角が3本ある草食恐竜'],
  ステゴサウルス: ['ステゴサウルスはジュラ紀の恐竜'],
  プテラノドン: ['プテラノドンは恐竜ではなく翼竜'],
  アンモナイト: ['アンモナイトはイカやタコに近い仲間で、すでに絶滅している'],
  サンヨウチュウ: ['三葉虫は古生代の海にいた節足動物'],
  アノマロカリス: ['アノマロカリスはカンブリア紀の海にいた生き物'],
  コハク: ['コハクは木の樹脂が化石になったもの'],
  マンモス: ['マンモスは氷河期に暮らしていたゾウの仲間']
};

const months = (m) => m ? (m.includes('&') ? m.replace(/ & /g, '、').replace(/-/g, '〜') + '月（南半球）' : m.replace('-', '〜') + '月（南半球）') : '一年中';

const villagerRule = ([n, sp, g, per, c, bd, hobby]) => ({
  re: nameRegex(n),
  a: [`また${n}に構ってもらってる`, `${n}に嫌われてそう`, `${n}の話長くない？`, ...(c ? [`「${c}」って言われてて草`] : []), `${n}を推しすぎ`],
  q: [`${n}のどこが好きなの？`, `${n}は推し？`, `${sp}の住民だと${n}が一番？`, `${n}にプレゼント何あげる？`, ...(c ? [`${n}の「${c}」って好き？`] : [])],
  d: [`なんで${n}が好きなの？`, `${n}みたいな友だちいる？`, `${n}と現実で会ったら何話す？`, `いや${n}より絶対かわいい子いるでしょ`],
  h: [`${n}いいよね`, `${n}かわいい`, `${n}とのやりとり好き`],
  u: [`ちなみに${n}は${sp}の${g}で、性格は${per}`, ...(c ? [`ちなみに${n}の口癖は「${c}」`] : []), `ちなみに${n}の誕生日は${bd}`, `ちなみに${n}の趣味は${hobby}`]
});

const creatureRule = ([n, kind, price, place, time, m]) => {
  const buyer = { 魚: 'ジャスティン', 虫: 'レックス' }[kind];
  return {
    re: nameRegex(n),
    a: [`${n}で喜びすぎ`, `${price}ベルで大はしゃぎ`, `また${n}かよ`, `${n}に逃げられろｗ`],
    q: [`${n}は売る？飾る？`, `${n}って現実で見たことある？`, `${n}は好き？`, `${n}はもう寄贈した？`],
    d: [`${n}に似てる知り合いいる？`, `${n}の思い出ってある？`, `${n}が現実で家に出たらどうする？`],
    h: [`${n}ゲットおめでとう`, `${n}いいね`, `${n}見られて嬉しい`],
    u: [`ちなみに${n}の売値は${price}ベル`, ...(buyer ? [`ちなみに${n}は${buyer}なら${Math.floor(price * 1.5)}ベルで売れる`] : []), ...(place ? [`ちなみに${n}の場所は${place}`] : []), `ちなみに${n}が出るのは${months(m)}`, ...(time ? [`ちなみに${n}の時間は${time}`] : []), ...(TRIVIA[n] || []).map((t) => `ちなみに${t}`)]
  };
};

// 化石は「ティラノサウルスのあたま」のように部位に分かれるので、種類ごとにまとめる
const fossilBase = (n) => n.split('の')[0];
const fossilGroups = new Map();
for (const [n, price] of FOSSILS) {
  const base = fossilBase(n);
  if (!fossilGroups.has(base)) fossilGroups.set(base, []);
  fossilGroups.get(base).push([n, price]);
}
const fossilRule = (base, parts) => ({
  re: nameRegex(base),
  a: [`また${base}でダブりそう`, `${base}で喜びすぎ`, `フータの解説飛ばすなよ`],
  q: [`${base}は寄贈する？`, `${base}は全部そろった？`, `${base}って好き？`],
  d: [`子どものころ${base}好きだった？`, `もし${base}が現実にいたら飼う？`, `恐竜図鑑って読んでた？`],
  h: [`${base}いいね`, `${base}かっこいい`],
  u: [...parts.map(([n, price]) => `ちなみに${n}は${price}ベルで売れる`), ...(TRIVIA[base] || TRIVIA[toKata(base)] || []).map((t) => `ちなみに${t}`)]
});

const gameRules = [...VILLAGERS.map(villagerRule), ...CREATURES.map(creatureRule), ...[...fossilGroups].map(([b, p]) => fossilRule(b, p))].filter((r) => r.re);
RULES.push(...gameRules);
// ときどき流れる雑談にも、うんちくを混ぜる
GENERIC.u = gameRules.flatMap((r) => r.u);

// 実況者の質問に、データをもとに答える
const ask = {
  catch: /口癖|くちぐせ|語尾/, birthday: /誕生日|いつ生まれ/, species: /種族|何の動物|なんの動物|何の生き物/, gender: /性別|男の子|女の子|オス|メス/, personality: /性格/, hobby: /趣味/,
  price: /いくら|値段|売値|何ベル|なんベル/, place: /どこ|場所/, when: /いつ|何時|なんじ|時間|何月|なんがつ|季節/, who: /誰|だれ|どんな|教えて|知ってる|って何|ってなに/
};
// ひらがな2文字の住民も、質問のときは「たまの」「たまは」の形で探す（全員に答えるため）
const villagerByName = VILLAGERS.map((v) => ({ v, re: nameRegex(v[0]) || new RegExp(`${escapeRe(v[0])}(の|は|って)`) }));
const creatureByName = CREATURES.map((c) => ({ c, re: nameRegex(c[0]) })).filter((x) => x.re);
const fossilByName = [...fossilGroups].map(([base, parts]) => ({ base, parts, re: nameRegex(base) })).filter((x) => x.re);
const speciesList = [...new Set(VILLAGERS.map((v) => v[1]))];
const personalityList = [...new Set(VILLAGERS.map((v) => v[3]))];
const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

// 直前に話した住民・生き物・化石を覚えておく
let lastName = null;
function rememberName(text) {
  const vil = villagerByName.find((x) => x.re.test(text));
  const cre = !vil && creatureByName.find((x) => x.re.test(text));
  const fos = !vil && !cre && fossilByName.find((x) => x.re.test(text));
  if (!vil && !cre && !fos) return null;
  lastName = { vil, cre, fos, at: Date.now() };
  return lastName;
}
// 月の範囲（"11-3" や "12-3 & 9-11"、空は一年中）に、その月が入るか
function inMonth(range, month) {
  if (!range) return true;
  return range.split('&').some((part) => {
    const [a, b = a] = part.trim().split('-').map(Number);
    return a <= b ? month >= a && month <= b : month >= a || month <= b;
  });
}
const GAME_FAQ = [
  [/(タヌキ商店|たぬき商店|まめきち|つぶきち).*(何時|なんじ|いつまで|いつから)/, 'タヌキ商店は8時〜22時'],
  [/(エイブル).*(何時|なんじ|いつまで|いつから)/, 'エイブルシスターズは9時〜21時'],
  [/カブ.*(いつ|何曜|どこ|誰).*(買|売)|カブ.*(買|売).*(いつ|何曜|どこ|誰)/, 'カブは日曜の朝5時〜12時にウリから買えて、タヌキ商店で売れる'],
  [/(住民|島民).*(何人|なんにん|最大)/, '島に住める住民は最大10人'],
  [/(離島|マイルチケット|マイル旅行).*(何マイル|なんマイル|いくら)/, 'マイル旅行券は2000マイル']
];

function answerQuestion(rawText) {
  const text = rawText.slice(-40);
  const listAnswer = (label, names) => `${label}は${names.length}人。たとえば${sample(names, 4).join('、')}`;
  if (/今日.*誕生日|誕生日.*今日/.test(text)) {
    const d = new Date(); const today = `${d.getMonth() + 1}月${d.getDate()}日`;
    const names = VILLAGERS.filter((v) => v[5] === today).map((v) => v[0]);
    return names.length ? `今日（${today}）が誕生日なのは${names.join('、')}` : `今日（${today}）が誕生日の住民はいないみたい`;
  }
  const kata = toKata(text);
  if (/住民|子|人/.test(text) && (ask.who.test(text) || /いる|何人/.test(text))) {
    const sp = speciesList.find((s) => kata.includes(toKata(`${s}の`)));
    if (sp) return listAnswer(`${sp}の住民`, VILLAGERS.filter((v) => v[1] === sp).map((v) => v[0]));
    const per = personalityList.find((p) => kata.includes(`${toKata(p)}`));
    if (per) return listAnswer(`性格が${per}の住民`, VILLAGERS.filter((v) => v[3] === per).map((v) => v[0]));
  }
  // ゲームの決まりごと
  for (const [re, line] of GAME_FAQ) if (re.test(text)) return line;
  // 今の時期に捕れるもの、一番高いもの
  const kindWord = /海の幸|潜/.test(text) ? '海の幸' : /魚|釣/.test(text) ? '魚' : /虫|捕れる|捕まえ/.test(text) ? '虫' : null;
  if (kindWord && /今月|今の時期|この時期|今.*(何が|なにが|何の|どんな)/.test(text)) {
    const month = new Date().getMonth() + 1;
    const names = CREATURES.filter((c) => c[1] === kindWord && inMonth(c[5], month));
    return `${month}月（南半球）の${kindWord}は${names.length}種類。たとえば${sample(names, 4).map((c) => c[0]).join('、')}（時間帯は別）`;
  }
  if (kindWord && /一番高い|いちばん高い|最高額|一番売れる/.test(text)) {
    const list = CREATURES.filter((c) => c[1] === kindWord);
    const top = Math.max(...list.map((c) => c[2]));
    return `一番高い${kindWord}は${list.filter((c) => c[2] === top).map((c) => c[0]).join('、')}で、${top}ベル`;
  }
  // 名前がなくても「これいくら」なら、直前に話した相手のことと考える
  const named = rememberName(text);
  const pointing = /これ|それ|この|その|こいつ|今の|さっきの/.test(text);
  const last = named || (lastName && Date.now() - lastName.at < 60000 && (pointing || ask.price.test(text)) ? lastName : null);
  const vil = last && last.vil;
  const cre = last && last.cre;
  const fos = last && last.fos;
  if (vil) {
    const [n, sp, g, per, c, bd, hobby] = vil.v;
    if (ask.catch.test(text)) return c ? `${n}の口癖は「${c}」` : `${n}の口癖はデータで食い違っていて、確かなことが言えない`;
    if (ask.birthday.test(text)) return `${n}の誕生日は${bd}`;
    if (ask.species.test(text)) return `${n}は${sp}`;
    if (ask.gender.test(text)) return `${n}は${g}`;
    if (ask.personality.test(text)) return `${n}の性格は${per}`;
    if (ask.hobby.test(text)) return `${n}の趣味は${hobby}`;
    if (ask.who.test(text)) return `${n}は${sp}の${g}で、性格は${per}${c ? `、口癖は「${c}」` : ''}、誕生日は${bd}`;
  }
  if (cre) {
    const [n, kind, price, place, time, m] = cre.c;
    if (ask.price.test(text)) return `${n}の売値は${price}ベル`;
    if (ask.place.test(text)) return place ? `${n}の場所は${place}` : `${n}は海に潜ると捕れる`;
    if (ask.when.test(text)) return `${n}が出るのは${months(m)}、${time || '一日中'}`;
    if (ask.who.test(text)) return `${n}は${kind}。売値は${price}ベル、出るのは${months(m)}`;
  }
  if (fos && (ask.price.test(text) || ask.who.test(text))) {
    const prices = fos.parts.map((p) => p[1]);
    return fos.parts.length === 1 ? `${fos.parts[0][0]}は${prices[0]}ベルで売れる` : `${fos.base}の化石は${fos.parts.length}つの部位で、${Math.min(...prices)}〜${Math.max(...prices)}ベル`;
  }
  return null;
}
