// コメントデータの確認（使い方：node tools/check.js）。問題があれば終了コード1
// index.html に書かれた順にデータを読み込み、件数・重複・誤反応・質問への答えを調べる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const files = [...fs.readFileSync(path.join(dir, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== 'app.js');
const ctx = vm.createContext({});
vm.runInContext(files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';this.RULES=RULES;this.GENERIC=GENERIC;this.SILENCE=SILENCE;this.FOLLOW=FOLLOW;this.TATOE=TATOE;this.answerQuestion=answerQuestion;this.gameRules=gameRules;', ctx);
const { RULES, GENERIC, SILENCE, FOLLOW, TATOE, gameRules } = ctx;
const KEYS = ['a', 'q', 'h', 'd', 'u'];
const n = (g) => KEYS.reduce((s, k) => s + (g[k] ? g[k].length : 0), 0);
const hand = RULES.filter((r) => !gameRules.includes(r));
const texts = [...hand, { ...GENERIC, u: [] }, SILENCE].flatMap((g) => KEYS.flatMap((k) => g[k] || []));
const dup = [...new Set(texts.filter((t, i) => texts.indexOf(t) !== i))];
const handTotal = texts.length + Object.values(FOLLOW).flat().length + TATOE.echo.length + TATOE.say.length;
const gameTotal = gameRules.reduce((s, r) => s + n(r), 0);
// 実況でよく言う、話題に反応してほしくない言葉
const NEUTRAL = ['しました', 'いいえ', 'ちょうどいい', 'むしろ', '変わらない', 'よし行こう', 'そうなんですよ', 'やりたいです', 'わかりました', '今日は楽しかった', 'ありがとう', 'はい', 'ちょっと待って', 'これを置きます', 'それはあります', 'アイテムを取ります', 'パワーアップ', 'どうしようかな', 'なるほど', 'こっちに行きます', 'もう一回', 'すごいですね', 'いい感じです', 'できました', 'あれ', 'えっと', 'そうですね', 'たぶん', 'お願いします', 'だめだ', 'きました', 'ここです', '見てください', 'ドラゴンが来た', 'トランプで遊ぶ', 'タイミング', 'サービス', 'ガーデン', 'ピンク', 'アメリカ', 'サラダ', 'ゴリラ', 'ズボン', 'タイトル', 'リラックス', 'スムーズ', 'ロボット', 'ランキング', 'メールアドレス', 'ラジオを聞く', 'ちょっと失礼', 'ゴンドラに乗る'];
const misfire = NEUTRAL.filter((s) => RULES.some((r) => r.re.test(s)));
const QA = { タランチュラっていくら: '8000', ネコの住民って誰がいる: 'ネコの住民', ティラノサウルスっていくら: 'ベル', フェザーの口癖は何: 'でヤス', 今何が釣れる: '種類', 一番高い魚は何: 'ベル', 鯛っていくら: 'タイ', タヌキ商店って何時まで: '22時', カブっていつ買える: '日曜', 住民って何人まで: '10人' };
const badQa = Object.entries(QA).filter(([q, a]) => !String(ctx.answerQuestion(q)).includes(a)).map(([q]) => q);
// --topics：手書きの話題の判定語だけを表示する（新しい話題を考えるとき、全ファイルを読まずに済むように）
if (process.argv.includes('--topics')) { console.log(hand.map((r) => r.re.source).join('\n')); process.exit(0); }
console.log(JSON.stringify({ topics: RULES.length, handTotal, gameTotal, total: handTotal + gameTotal, duplicates: dup, misfire, badQa }, null, 1));
if (misfire.length || badQa.length) process.exit(1);
