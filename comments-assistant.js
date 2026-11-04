// 質問モード（Siri型）：聞いた言葉に「答え／聞き返し／知らない」のどれかで返す。質問でなければ null（何も出さない）
const ASSIST_FILLER = /^(えー+と?|えーっと|えっと|あのー+さ?|あのさ|ねえ|ねー|なあ|うーん|そういえば|ちょっと聞きたいんだけど)[、。 ]*/;
// 質問の言葉に見えるが、質問ではないもの
const NOT_ASK_WORDS = /なんです|なんでも|何か|何も|何回も|何度も|なんか|なんて|いつも|いつか|どこか|誰か|だれか|どうも|どうぞ|どうせ|どうしても|どうでもいい/g;
// 独り言は質問として扱わない
const SELF_TALK = /どうしよう|ようかな|なんでだよ|何でだよ|なにこれ|何これ|なにそれ|何それ|なんだこれ|なんだそれ|なんだよ|なんでやねん|何(して|やって)ん|どこ行こう|どこいこう|どうなってん/;
const ASK_RE = /いくら|何|なに|なんで|なんじ|なんの|なぜ|いつ|どこ|誰|だれ|どう|どれ|どの|どんな|教えて|おしえて|知ってる|だっけ|ですか|ますか|ねだん|値段|とは$|[ァ-ヶー]って$|(食べ|使い|やり)方|(る|い|た)の$|(の|って)[^、。 ]{1,8}は$|(今|いま).*(釣れる|捕れる|取れる|いる)$|[?？]$/;
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
  ...FOOD.map(([name, , t]) => [name, t])
];
function searchFacts(text, skipEat = false) {
  const words = (text.match(/[ァ-ヶー]{3,}|[一-龠々]{3,}/g) || []).filter((w) => !ASSIST_STOP.has(w)).sort((a, b) => b.length - a.length);
  for (const word of words) {
    const hit = assistFacts.find(([, t]) => t.includes(word) && !(skipEat && EAT_TEXTS.has(t)));
    if (hit) return `関連する話なら、${knowSay(hit[0], hit[1])}`;
  }
  return null;
}

// 「うんちく」「○○の豆知識」と頼まれたら、うんちくのデータから返す
const TRIVIA_ASK = /うんちく|ウンチク|蘊蓄|豆知識|まめちしき|トリビア|雑学|博士/;
const TRIVIA_FILLER = /うんちく|ウンチク|蘊蓄|豆知識|まめちしき|トリビア|雑学|博士|について|教えて|おしえて|聞かせて|きかせて|ちょうだい|ください|下さい|お願い|おねがい|言って|いって|して|ある|ない|いる|何か|なんか|なにか|何|なに|[のをはがってにもか、。 ？?]/g;
// 売値や場所より、話のネタになるものを先に出す
const notGameInfo = (t) => !/売値|ベルで売れる|の場所は|が出るのは|の時間は|の影は|似てるポケモン|通算|誕生日|性格|趣味|口癖|釣りにくい|釣りやすい|動きは|の女の子|の男の子/.test(t);
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
function triviaAnswer(said) {
  const fixed = fixKana(said);
  const topic = fixed.replace(TRIVIA_FILLER, '');
  if (!topic) return { type: 'answer', text: pickTrivia(GENERIC.u) };
  // 話題の判定は、助詞を消す前の文で行う（ひらがなの名前を崩さないため）
  const asked = fixed.replace(new RegExp(TRIVIA_ASK.source, 'g'), '');
  const pool = [
    ...RULES.filter((r) => r.u && r.u.length && r.re.test(asked)).flatMap((r) => r.u),
    ...knowledge.filter((k) => k.re.test(asked)).flatMap((k) => [...k.what, ...k.where, ...k.when].map((t) => knowSay(k.name, t)))
  ];
  const line = pickTrivia(pool);
  if (line) return { type: 'answer', text: line };
  const related = pool.length ? null : searchFacts(topic, true);
  return related ? { type: 'answer', text: related } : { type: 'unknown', text: `${topic}のうんちくは、まだ知りません。質問を残しました` };
}

function assist(raw) {
  const said = tidySpeech(raw);
  if (!said) return null;
  if (TRIVIA_ASK.test(said)) return triviaAnswer(said);
  const asking = isAsking(said);
  const text = asking ? fixKana(said) : said;
  if (asking) {
    const back = askBack(text);
    if (back) return { type: 'clarify', text: back };
  }
  // ゲームの登場人物は、役割で答える
  const npc = asking && /誰|だれ|何者|って何|ってなに|どんな/.test(text) && Object.keys(NPC_ROLE).find((n) => text.includes(n));
  if (npc) return { type: 'answer', text: `${npc}は、${NPC_ROLE[npc]}` };
  const answer = answerAny(text);
  if (answer) return { type: 'answer', text: answer };
  if (!asking) return null;
  // 聞き方に合う項目がなくても、話題が分かれば、持っている情報を出す
  const general = knowledgeAnswer(`${text.slice(-24)}。教えて`);
  if (general) return { type: 'answer', text: /いつ|何年/.test(text) && !/[0-9]|年|時代|世紀/.test(general) ? `いつかは確認できていません。${general}` : general };
  const related = searchFacts(text);
  if (related) return { type: 'answer', text: related };
  return { type: 'unknown', text: 'それはまだ知りません。質問を残しました' };
}
