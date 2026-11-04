// 質問モード（Siri型）：聞いた言葉に「答え／聞き返し／知らない」のどれかで返す。質問でなければ null（何も出さない）
const ASSIST_FILLER = /^(えー+と?|えーっと|えっと|あのー+さ?|あのさ|ねえ|ねー|なあ|うーん|そういえば|ちょっと聞きたいんだけど)[、。 ]*/;
// 質問の言葉に見えるが、質問ではないもの
const NOT_ASK_WORDS = /そうなんです|なんですよ|なんですけど|なんでも|何か|何も|何回も|何度も|なんか|なんて|いつも|いつか|どこか|誰か|だれか|どうも|どうぞ|どうせ|どうしても|どうでもいい/g;
// 独り言は質問として扱わない
const SELF_TALK = /(今日|きょう|ご飯|ごはん|昼|夜|朝|晩).*(何|なに)を?食べ|(何|なに)を?食べよう|どうしよう|ようかな|なんでだよ|何でだよ|なにこれ|何これ|なにそれ|何それ|なんだこれ|なんだそれ|なんだよ|なんでやねん|何(して|やって)ん|どこ行こう|どこいこう|どうなってん/;
const ASK_RE = /いくら|何|なに|なんで|なんじ|なんの|なぜ|いつ|どこ|誰|だれ|どう|どれ|どの|どんな|教えて|おしえて|知ってる|だっけ|ですか|ますか|ねだん|値段|とは$|[ァ-ヶー]って$|(食べ|使い|やり|釣り|捕まえ|取り|出し|探し|見つけ|行き|増やし|貯め)方|[ぁ-ん]方$|方法|仕方|対処|するには|行くには|止めたい|好きな|肉食|草食|雑食|生態|暮らし|何を?食べ|なに(を)?食べ|餌|エサ|えさ|すんでる|住んでる|棲んでる|すみか|イベント$|について|のこと|の話|の情報|の詳細|くわしく|詳しく|知りたい|聞きたい|聞かせて|わかる|分かる|ですか$|とは|すごいの|有名なの|人気あるの|高いの|安いの|レアなの|珍しいの|(る|い|た)の$|(の|って)[^、。 ]{1,8}は$|(今|いま).*(釣れる|捕れる|取れる|いる)$|[?？]$/;
const isAsking = (text) => !SELF_TALK.test(text) && ASK_RE.test(text.replace(NOT_ASK_WORDS, ''));

// 音声認識がひらがなで書いた言葉を、データの表記にそろえる
const ASSIST_WORDS = [[/ねだん/g, '値段'], [/おしえて/g, '教えて'], [/じき/g, '時期'], [/たべかた/g, '食べ方']];
const hiraNames = [...new Set([...CREATURES.map((c) => c[0]), ...foodEntries.map((f) => f.name), ...knowledge.map((k) => k.name)])]
  .filter((n) => /^[ァ-ヶー]{3,}$/.test(n) && !n.includes('ー'))
  .map((n) => [toHira(n), n])
  .sort((a, b) => b[0].length - a[0].length);
function tidySpeech(raw) {
  let text = raw.trim();
  for (let before = ''; before !== text;) { before = text; text = text.replace(ASSIST_FILLER, ''); }
  return text;
}
function fixKana(text) {
  let fixed = text;
  for (const [re, word] of ASSIST_WORDS) fixed = fixed.replace(re, word);
  // 「たぬきち」の「たぬき」のように、長い言葉の一部は置きかえない
  for (const [hira, name] of hiraNames) if (fixed.includes(hira)) fixed = fixed.replace(new RegExp(`${hira}(?![ぁ-んー](?<![のはってがをにともで]))`, 'g'), name);
  return fixed;
}

// 「この魚」「さっきのやつ」など、名前がない質問は、分かるものだけ答えて、あとは聞き返す
function askBack(text) {
  const named = rememberName(text) || pokeList.some((p) => p.re.test(text)) || knowledge.some((k) => k.re.test(text)) || foodEntries.some((f) => f.re.test(text));
  if (named) return null;
  const fresh = lastName && Date.now() - lastName.at < 60000;
  const label = fresh && (lastName.vil ? lastName.vil.v[0] : lastName.cre ? lastName.cre.c[0] : lastName.fos.base);
  // 画面は見えないので、目の前のものは当てられない
  if (/(この|その)(魚|さかな|虫|むし)/.test(text)) return '画面は見えないので、名前で聞いてください';
  const kind = /魚|さかな/.test(text) ? '魚' : /虫|むし/.test(text) ? '虫' : null;
  if (kind && /さっき|あの(魚|さかな|虫|むし)/.test(text)) return fresh && lastName.cre && lastName.cre.c[1] === kind ? null : `どの${kind}？名前で聞いてください`;
  if (/さっき.*(やつ|何だっけ|なんだっけ)/.test(text)) return fresh ? `${label}のことですか？` : '何のことですか？名前で聞いてください';
  if (/^(これ|それ|あれ|こいつ|この|その)/.test(text) && !fresh) return '何のことですか？名前で聞いてください';
  return null;
}

// 話題の名前では見つからないとき、説明文の中から探す（「スズメバチ」→ハチの説明、など）
const ASSIST_STOP = new Set(['ゲーム', 'アイテム', 'ボタン', 'イベント', 'データ', 'おすすめ']);
// 食べ方の説明。うんちくを頼まれたときは使わない（料理の話はうんちくとして出さない）
const EAT_TEXTS = new Set(FOOD.filter((f) => f[1] === 'eat').map((f) => f[2]));
const assistFacts = [
  ...knowledge.flatMap((k) => [...k.what, ...k.where, ...k.when, ...k.real].map((t) => [k.name, t])),
  ...FOOD.map(([name, , t]) => [name, t]),
  ...CREATURE_TRIVIA,
  ...TOPIC_TRIVIA,
  ...ECOLOGY
];
function searchFacts(text, skipEat = false) {
  const words = (text.match(/[ァ-ヶー]{3,}|[一-龠々]{3,}/g) || []).filter((w) => !ASSIST_STOP.has(w)).sort((a, b) => b.length - a.length);
  for (const word of words) {
    if (/半球|有名|定番|一番|最大/.test(word)) continue;
    const hit = assistFacts.find(([, t]) => t.includes(word) && !(skipEat && EAT_TEXTS.has(t)));
    if (hit) return `関連する話なら、${knowSay(hit[0], hit[1])}`;
  }
  return null;
}

// 「うんちく」「○○の豆知識」と頼まれたら、うんちくのデータから返す
const TRIVIA_ASK = /うんちく|ウンチク|蘊蓄|豆知識|まめちしき|トリビア|雑学|博士/;
const TRIVIA_FILLER = /うんちく|ウンチク|蘊蓄|豆知識|まめちしき|トリビア|雑学|博士|について|教えて|おしえて|聞かせて|きかせて|ちょうだい|ください|下さい|お願い|おねがい|言って|いって|して|ある|ない|いる|何か|なんか|なにか|何|なに|[のをはがってにもか、。 ？?]/g;
// 売値や場所より、話のネタになるものを先に出す
const notGameInfo = (t) => !/売値|ベルで売れる|の場所は|が出るのは|の時間は|の影は|似てるポケモン|通算|誕生日|性格|趣味|口癖|釣りにくい|釣りやすい|動きは|の女の子|の男の子|図鑑[0-9]+番|タイプは|に出る$/.test(t);
const triviaRecent = [];
const isEatLine = (t) => [...EAT_TEXTS].some((e) => t.includes(e));
function pickTrivia(pool) {
  const base = [...new Set(pool)].filter((t) => notGameInfo(t) && !isEatLine(t));
  if (!base.length) return null;
  const fresh = base.filter((t) => !triviaRecent.includes(t));
  const line = pickRandom(fresh.length ? fresh : base);
  triviaRecent.push(line);
  if (triviaRecent.length > 30) triviaRecent.shift();
  return line.replace(/^ちなみに[、 ]*/, '');
}
// 話題の名前が文にあるか（カタカナは長い言葉の一部に反応させない。漢字1文字は、その言葉だけのときに限る）
// ふだんの呼び方や、音声認識の表記ゆれ
const TOPIC_ALIASES = {
  始祖鳥: ['しそちょう'], 足跡の化石: ['あしあと'], コプロライト: ['ウンコ', 'うんこの化石', 'ふんの化石'], パキケファロサウルス: ['パキケファロ'], Tレックス: ['ティラノサウルス', 'ティラノ'], フタバサウルス: ['フタバスズキリュウ', 'フタバ竜'], 三葉虫: ['さんようちゅう'], サメの歯: ['サメのは'], 幽霊: ['ゆうたろう'], かぼちゃ: ['パンプキング'], サンタクロース: ['ジングル', 'サンタ'],
  ワンピース: ['ONE PIECE', 'one piece'], 僕のヒーローアカデミア: ['ヒロアカ', 'ヒーローアカデミア'], BLEACH: ['ブリーチ'], 鬼滅の刃: ['鬼滅', 'きめつ'], 呪術廻戦: ['呪術', 'じゅじゅつ'],
  チェンソーマン: ['チェーンソーマン', 'チェンソー'], 進撃の巨人: ['進撃'], 'SPY×FAMILY': ['スパイファミリー', 'スパイ×ファミリー', 'スパイ家族'], 葬送のフリーレン: ['フリーレン'], 推しの子: ['おしのこ'],
  薬屋のひとりごと: ['薬屋'], NARUTO: ['ナルト'], 名探偵コナン: ['コナン'], ジョジョの奇妙な冒険: ['ジョジョ'], 'HUNTER×HUNTER': ['ハンターハンター', 'ハンタ'], 'ゆるキャン△': ['ゆるキャン'],
  'Dr.STONE': ['ドクターストーン'], 'SAKAMOTO DAYS': ['サカモトデイズ', 'SAKAMOTO'], 週刊少年ジャンプ: ['少年ジャンプ', 'ジャンプの歴史'], 自動販売機: ['自販機'], お寿司: ['寿司', 'すし'], ガチャガチャ: ['ガチャポン', 'カプセルトイ'], 住宅ローン: ['ローン'], 陸上競技: ['陸上'], 歯磨き: ['歯みがき'], 無人島: ['無人島生活']
};
function topicHit(name, topic, asked) {
  if ((TOPIC_ALIASES[name] || []).some((a) => asked.includes(a))) return true;
  if (/^[ァ-ヶー]+$/.test(name)) return new RegExp(`(^|[^ァ-ヶー])${name}(?![ァ-ヶー])`).test(asked);
  return name.length === 1 ? topic === name : asked.includes(name);
}
const MANGA_TOPICS = new Set(['ワンピース', '僕のヒーローアカデミア', 'BLEACH', 'トリコ', '鬼滅の刃', '呪術廻戦', 'チェンソーマン', '進撃の巨人', 'SPY×FAMILY', '葬送のフリーレン', '推しの子', 'ブルーロック', '薬屋のひとりごと', 'ちいかわ', 'NARUTO', 'ドラゴンボール', '銀魂', '名探偵コナン', 'ジョジョの奇妙な冒険', 'HUNTER×HUNTER', 'キングダム', 'ゆるキャン△', 'Dr.STONE', 'SAKAMOTO DAYS', 'メダリスト', '週刊少年ジャンプ']);
const speciesNames = new Set(VILLAGERS.map((v) => v[1]));
const kindOf = new Map(CREATURES.map((c) => [c[0], c[1]]));
// 「魚のうんちく」のように分野で頼まれたときの候補
function triviaCategory(asked) {
  const byKind = (kind) => CREATURE_TRIVIA.filter(([n]) => kindOf.get(n) === kind).map(([n, t]) => knowSay(n, t));
  if (/海の幸|うみのさち/.test(asked)) return byKind('海の幸');
  if (/魚|さかな/.test(asked)) return [...byKind('魚'), ...TOPIC_TRIVIA.filter(([n]) => n === '魚').map(topicSay)];
  if (/虫|むし/.test(asked)) return [...byKind('虫'), ...TOPIC_TRIVIA.filter(([n]) => n === '虫').map(topicSay)];
  // 漫画は、作者の名前が入っている話題をまとめて出す
  if (/漫画|マンガ|まんが|アニメ/.test(asked)) return TOPIC_TRIVIA.filter(([n]) => MANGA_TOPICS.has(n)).map(topicSay);
  if (/お金|おかね/.test(asked)) return TOPIC_TRIVIA.filter(([n]) => ['株', '保険', '住宅ローン', '税金', '宝くじ'].includes(n)).map(topicSay);
  if (/動物|どうぶつ|住民/.test(asked)) return TOPIC_TRIVIA.filter(([n]) => speciesNames.has(n)).map(topicSay);
  if (/花|はな/.test(asked)) return [...TOPIC_TRIVIA.filter(([n]) => n === '花').map(topicSay), ...knowledge.filter((k) => ['チューリップ', 'バラ', 'コスモス', 'ユリ', 'パンジー', 'ヒヤシンス', 'キク', 'スズラン', 'アネモネ', 'ソメイヨシノ', '花言葉'].includes(k.name)).flatMap((k) => k.what.map((t) => knowSay(k.name, t)))];
  if (/島|しま/.test(asked)) return knowledge.filter((k) => /島/.test(k.name)).flatMap((k) => k.what.map((t) => knowSay(k.name, t)));
  return [];
}
function triviaAnswer(said) {
  const fixed = fixKana(said);
  const topic = fixed.replace(TRIVIA_FILLER, '');
  if (!topic) return { type: 'answer', text: pickTrivia(GENERIC.u) };
  // 話題の判定は、助詞を消す前の文で行う（ひらがなの名前を崩さないため）
  const asked = fixed.replace(new RegExp(TRIVIA_ASK.source, 'g'), '');
  const pool = [
    ...RULES.filter((r) => r.u && r.u.length && r.re.test(asked)).flatMap((r) => r.u),
    ...knowledge.filter((k) => k.re.test(asked)).flatMap((k) => [...k.what, ...k.where, ...k.when].map((t) => knowSay(k.name, t))),
    ...TOPIC_TRIVIA.filter(([n]) => topicHit(n, topic, asked)).map(topicSay)
  ];
  // 登場キャラなら、その動物のうんちくも候補にする
  const npcLine = npcAnimalAnswer(asked);
  if (npcLine) return { type: 'answer', text: npcLine };
  // 話題で見つからなければ、分野で探す
  // うんちくを頼まれたら、話題の生態も添える
  const eco = ecoHit(asked);
  if (eco) {
    const trivia = pickTrivia(pool.filter((t) => !t.includes(eco[1]) && !overlaps(t, eco[1], eco[0])));
    return { type: 'answer', text: joinLines(trivia || knowSay(eco[0], eco[1]), trivia ? knowSay(eco[0], eco[1]) : null, eco[0]) };
  }
  const line = pickTrivia(pool) || pickTrivia(triviaCategory(asked));
  if (line) return { type: 'answer', text: line };
  // うんちくがなければ、持っている情報を出す
  const info = hasKnownName(asked) ? explainName(asked) : null;
  if (info) return { type: 'answer', text: info };
  const related = pool.length ? null : searchFacts(topic, true);
  return related ? { type: 'answer', text: related } : { type: 'unknown', text: `${topic}のうんちくは、まだ知りません。質問を残しました` };
}

// 聞き方の言葉を除いて、話題の言葉だけにする
const ASK_FILLER = /のこと|^あの|とは|なんですか|何ですか|なんだっけ|何だっけ|だったっけ|だっけ|知ってる|知りたい|聞きたい|聞かせて|話して|の話|の情報|の詳細|情報|詳細|くわしく|詳しく|わかる|分かる|ですか|どんな|どういう|もの|感じ|やつ|すごいの|有名なの|人気あるの|なんだけど|んだけど|ってさ/g;
const bareTopic = (text) => text.replace(ASK_FILLER, '').replace(TRIVIA_FILLER, '');
// 「○○は」「○○って」だけの言葉は、知っている名前のときだけ質問とみなす
const isBareName = (text) => /(は|って|ってさ)$/.test(text) && text.length <= 14;
function hasKnownName(text) {
  return !!(rememberName(text) || pokeList.some((p) => p.re.test(text)) || knowledge.some((k) => k.re.test(text)) || foodEntries.some((f) => f.re.test(text)) || TOPIC_TRIVIA.some(([n]) => topicHit(n, bareTopic(text), text)) || EVENTS.some((e) => e.re.test(text)) || Object.keys(NPC_ROLE).some((n) => text.includes(n)) || /カブ|マイル/.test(text));
}
// 細かい言い回しに当てはまらなくても、名前が分かれば説明を返す
function explainName(text) {
  const asked = text.slice(-24);
  const npc = Object.keys(NPC_ROLE).find((n) => text.includes(n));
  if (npc) return `${npc}は、${NPC_ROLE[npc]}${NPC_ANIMAL.has(npc) ? `。動物は${NPC_ANIMAL.get(npc)}` : ''}`;
  if (/カブ(?!ト)/.test(text) && !/カブト/.test(text)) { const faq = answerAny(`カブとは${text.includes('値段') ? 'カブの値段いつ' : ''}`); if (faq) return faq; }
  const direct = answerAny(`${asked}。教えて`) || answerAny(`${asked}。どんな`);
  if (direct) return direct;
  const lines = TOPIC_TRIVIA.filter(([n]) => topicHit(n, bareTopic(text), text)).map(topicSay);
  const places = /どこ|場所/.test(text) ? lines.filter((t) => /すむ|半球|原産|産地|県|国/.test(t)) : [];
  return pickTrivia(places.length ? places : lines);
}

// 今日の日付と時刻
function clockAnswer(text) {
  const d = new Date();
  if (/何時|なんじ/.test(text) && /今|いま/.test(text)) return `今は${d.getHours()}時${d.getMinutes()}分`;
  if (/何曜|なん曜/.test(text)) return `今日は${'日月火水木金土'[d.getDay()]}曜日`;
  if (/(今日|きょう).*(何日|なんにち)|(今|いま).*何月何日/.test(text)) return `今日は${d.getMonth() + 1}月${d.getDate()}日`;
  if (/(今|いま).*(何月|なんがつ)/.test(text)) return `今は${d.getMonth() + 1}月（南半球の${SEASON_SOUTH(d.getMonth() + 1)}）`;
  return null;
}
// 「有名な○○」は、持っている話題の名前を並べる（名前で聞けば詳しく答える）
const LIST_ANSWERS = [
  [/有名な(絵|絵画|美術品|名画)|名画/, '有名な絵なら、モナ・リザ、夜警、星月夜、ひまわり、真珠の耳飾りの少女、神奈川沖浪裏など。名前で聞くと詳しく答えます'],
  [/喫茶店.*(定番|メニュー)|定番メニュー/, '喫茶店の定番なら、ナポリタン、クリームソーダ、小倉トースト、プリンアラモード、ホットケーキなど。名前で聞くと詳しく答えます'],
  [/有名な(恐竜|化石)/, '有名な恐竜なら、Tレックス、トリケラトプス、ステゴサウルス、ブラキオサウルス、スピノサウルスなど。名前で聞くと詳しく答えます'],
  [/有名な(漫画|マンガ|アニメ)/, '話せる漫画は、ワンピース、鬼滅の刃、呪術廻戦、ドラゴンボール、ジョジョなど。名前で聞くと詳しく答えます'],
  [/(南半球|北半球).*(違い|ちがい)|違い.*(南半球|北半球)/, '南半球と北半球は季節が逆で、魚や虫の出る時期も半年ずれる。この島は南半球']
];
const listAnswer = (text) => { const hit = LIST_ANSWERS.find(([re]) => re.test(text)); return hit ? hit[1] : null; };
// 月ごとのイベント（南半球。日付の詳細は EVENTS の答えに任せる）
const MONTH_EVENTS = { 1: ['釣り大会', 'ムシとり大会'], 2: ['カーニバル', 'バレンタインデー', 'ムシとり大会'], 4: ['釣り大会', 'メーデー'], 5: ['メーデー', '国際博物館の日'], 6: ['ジューンブライド'], 7: ['釣り大会'], 8: ['花火大会'], 10: ['釣り大会', 'ハロウィン'], 11: ['ムシとり大会', 'サンクスギビング'], 12: ['ムシとり大会', 'クリスマスイブ', 'カウントダウン'] };
function calendarAnswer(text) {
  if (!/イベント|行事/.test(text) || !/次|今月|来月|今度/.test(text)) return null;
  const now = new Date().getMonth() + 1;
  if (/来月/.test(text)) { const m = now % 12 + 1; return `${m}月のイベントは${(MONTH_EVENTS[m] || ['特になし']).join('、')}`; }
  if (/今月/.test(text)) return `${now}月のイベントは${(MONTH_EVENTS[now] || ['特になし']).join('、')}`;
  for (let i = 0; i < 12; i++) { const m = (now - 1 + i) % 12 + 1; if (MONTH_EVENTS[m]) return `${i === 0 ? '今月' : `${m}月`}は${MONTH_EVENTS[m].join('、')}。名前で聞くと日付を答えます`; }
  return null;
}
// 遊び方（事実は research/ の独立確認を通ったものだけ。howto-data.js）
const HOWTO_RE = {
  住民を増やす: /住民.*(増やし|増やす|呼|誘|迎え|招)/, 住民を追い出す: /住民.*(追い出|出ていか|引っ越させ)/, 引っ越しを止める: /引っ越し.*(止め|とめ|防|阻止)/, 島の評判を上げる: /(評判|評価).*(上げ|あげ|どう|確認)/, 星3にする: /(星|ほし)(3|三|みっつ)/,
  花を交配する: /交配|花.*(増やし|色違い|新しい色)|青いバラ/, ベルを増やす: /(ベル|お金).*(増やし|稼|かせ|貯め|ため)|金策/, 金のなる木を作る: /(金|かね)のなる木/, 金の道具を作る: /金の(オノ|斧|スコップ|ジョウロ|網|釣り竿|道具|パチンコ)/, カブを売る: /カブ.*(売り方|売る|売れ|腐)/,
  離島に行く: /離島.*(行|どう)|マイル旅行.*(行|どう)/, 橋を作る: /橋.*(作|架|かけ|どう)/, 坂を作る: /坂.*(作|どう)/, レシピを集める: /レシピ.*(集|入手|もら|どこ)/, 写真を撮る: /(写真|カメラ).*(撮|どう)/, 家を増築する: /(家|部屋).*(増築|改築|広げ|増やし|大きく)/,
  ローンを返す: /ローン.*(返|払|どう)/, 口癖を変える: /口癖.*(変え|かえ)/, 道具を作る: /(網|釣り竿|スコップ|ジョウロ|オノ|斧|道具).*(作り方|作る|どう作|作れ)/, 鉄鉱石を集める: /鉄鉱石/, 博物館を建てる: /博物館.*(建て|作|どう)/, タヌキ商店を建てる: /(タヌキ商店|たぬき商店).*(建て|作)/,
  服を買う: /服.*(買|どこ)/, 流れ星に願う: /流れ星.*(願|どう|祈|かけら)|星のかけら/, 花を買う: /花.*(買|種|どこ)/
};
function howtoAnswer(text) {
  const hit = HOWTO.find(([name]) => HOWTO_RE[name] && HOWTO_RE[name].test(text));
  return hit ? hit[1] : null;
}

// 現実の生態を聞かれたら、ゲームの情報より先に答える（「○○の生態」「○○は何を食べるの」）
// 文の中の名前から、生態のデータを探す（長い名前を優先）
function ecoHit(text) {
  const hits = ECOLOGY.filter(([n]) => (TOPIC_ALIASES[n] || []).some((a) => text.includes(a)) || (n.length === 1 ? text.startsWith(`${n}の`) || text.startsWith(`${n}は`) || text.startsWith(`${n}って`) : new RegExp(`(^|[^ァ-ヶー])${n}(?![ァ-ヶー])`).test(text)));
  return hits.length ? hits.sort((a, b) => b[0].length - a[0].length)[0] : null;
}
// 2つの文をつなぐ。同じ主語は繰り返さない
const joinLines = (a, b, name = '') => {
  if (!b) return a;
  const second = name && b.startsWith(`${name}は`) ? b.slice(name.length + 1).replace(/^、/, '') : b;
  return `${a.replace(/。$/, '')}。${second}`;
};
// 2文字ずつ見て、内容が重なる文かどうかを調べる（「南半球にすむ」が2回出ないように）
const pairsOf = (t) => { const s = new Set(); for (let i = 0; i < t.length - 1; i++) s.add(t.slice(i, i + 2)); return s; };
const overlaps = (a, b, name = '') => {
  const clean = (t) => t.split(name).join('').replace(/[、。は]/g, '');
  const x = pairsOf(clean(a)), y = pairsOf(clean(b));
  const same = [...x].filter((p) => y.has(p)).length;
  // 同じ言葉が3文字以上続いて2回あるか、全体の3割が同じなら重なりとみなす
  const a2 = clean(a), b2 = clean(b);
  let runs = 0;
  for (let i = 0; i < a2.length - 2; i++) if (b2.includes(a2.slice(i, i + 3))) runs += 1;
  return runs >= 2 || same / Math.min(x.size || 1, y.size || 1) > 0.3;
};
// 登場キャラなら、動物の種類に、その動物のうんちくと生態を添える
function npcAnimalAnswer(text) {
  const npc = [...NPC_ANIMAL.keys()].find((n) => text.includes(n));
  if (!npc) return null;
  const animal = NPC_ANIMAL.get(npc);
  const eco = ECOLOGY.find(([n]) => n === animal);
  const known = knowledge.filter((k) => k.name === animal).flatMap((k) => k.what.map((t) => knowSay(k.name, t)));
  const trivia = pickTrivia([...TOPIC_TRIVIA.filter(([n, t]) => n === animal && !/^動物は/.test(t)).map(topicSay), ...known].filter((t) => !eco || !overlaps(t, eco[1], animal)));
  const head = `${npc}の動物は${animal}`;
  return joinLines(joinLines(head, trivia), eco ? knowSay(animal, eco[1]) : null, trivia && trivia.startsWith(animal) ? animal : '');
}
const ECO_ASK = /生態|暮らし|何を?食べ|なに(を)?食べ|何食べ|餌|エサ|えさ|肉食|草食|雑食|すんでる|住んでる|棲んでる|すみか|現実|リアル|本物|実際/;
function ecoAnswer(text) {
  if (!ECO_ASK.test(text) || /食べ方|食べられる|おいし|うまい/.test(text)) return null;
  const npcLine = npcAnimalAnswer(text);
  if (npcLine) return npcLine;
  const hit = ecoHit(text);
  if (!hit) return null;
  const eco = knowSay(hit[0], hit[1]);
  // うんちくがあれば添える
  const extra = pickTrivia([...RULES.filter((r) => r.u && r.u.length && r.re.test(hit[0])).flatMap((r) => r.u), ...TOPIC_TRIVIA.filter(([n]) => n === hit[0]).map(topicSay)].filter((t) => !t.includes(hit[1]) && !overlaps(t, hit[1], hit[0])));
  return joinLines(eco, extra, hit[0]);
}

function assist(raw) {
  const said = tidySpeech(raw);
  if (!said) return null;
  if (TRIVIA_ASK.test(said)) return triviaAnswer(said);
  const asking = isAsking(said) || (isBareName(said) && hasKnownName(fixKana(said)));
  const text = asking ? fixKana(said) : said;
  if (asking) {
    const back = askBack(text);
    if (back) return { type: 'clarify', text: back };
  }
  // ゲームの登場人物は、役割で答える
  const npc = asking && /誰|だれ|何者|って何|ってなに|どんな/.test(text) && Object.keys(NPC_ROLE).find((n) => text.includes(n));
  if (npc) return { type: 'answer', text: /動物|種族|生き物/.test(text) && NPC_ANIMAL.has(npc) ? `${npc}の動物は${NPC_ANIMAL.get(npc)}` : `${npc}は、${NPC_ROLE[npc]}${NPC_ANIMAL.has(npc) ? `。動物は${NPC_ANIMAL.get(npc)}` : ''}` };
  const special = asking ? ecoAnswer(text) || clockAnswer(text) || calendarAnswer(text) || listAnswer(text) || howtoAnswer(text) : null;
  if (special) return { type: 'answer', text: special };
  const answer = answerAny(text);
  if (answer) return { type: 'answer', text: answer };
  if (!asking) return null;
  // 聞き方に合う項目がなくても、話題が分かれば、持っている情報を出す
  const general = knowledgeAnswer(`${text.slice(-24)}。教えて`);
  if (general) return { type: 'answer', text: /いつ|何年/.test(text) && !/[0-9]|年|時代|世紀/.test(general) ? `いつかは確認できていません。${general}` : general };
  // 名前が分かれば、細かい言い回しによらず説明する（「ネコって何」「ジャックの情報」など）
  const known = hasKnownName(text) ? explainName(text) : null;
  if (known) return { type: 'answer', text: known };
  const related = searchFacts(text);
  if (related) return { type: 'answer', text: related };
  return { type: 'unknown', text: 'それはまだ知りません。質問を残しました' };
}
