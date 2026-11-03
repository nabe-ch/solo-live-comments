// 魚・虫・海の幸の、現実の食べ方と危険性（事実は research/ の独立確認を通ったものだけ）。うんちくと質問の答えに使う
const foodByName = new Map();
for (const [name, field, text] of FOOD) {
  if (!foodByName.has(name)) foodByName.set(name, { name, eat: [], danger: [], re: nameRegex(name) || new RegExp(`(^|[^ァ-ヶー])${escapeRe(name)}(?![ァ-ヶー])`) });
  foodByName.get(name)[field].push(text);
}
const foodEntries = [...foodByName.values()].sort((a, b) => b.name.length - a.name.length);
for (const f of foodEntries) {
  const lines = [...f.eat, ...f.danger].map((t) => `ちなみに${knowSay(f.name, t)}`);
  const asked = [...(f.eat.length ? [`${f.name}って食べたことある？`, `${f.name}はどう食べるのが好き？`] : []), ...(f.danger.length ? [`${f.name}に近づける？`, `現実で${f.name}に出会ったらどうする？`] : [])];
  const rule = gameRules.find((r) => r.re.test(f.name));
  if (rule) { rule.u.push(...lines); rule.q.push(...asked); }
  else RULES.push({ re: f.re, a: [`${f.name}の話は急やな`], q: asked, d: [`${f.name}の話、どこで聞いたの？`], h: [`${f.name}に詳しいのすごい`], u: lines });
  GENERIC.u.push(...lines);
}
const FOOD_EAT_RE = /食べ|たべ|おいし|美味し|うまい|味|料理|調理|レシピ|刺身|焼い/;
const FOOD_DANGER_RE = /危な|危険|あぶな|毒|噛|刺さ|刺す|凶暴|狂暴|怖い|こわい/;
function foodAnswer(rawText) {
  const text = rawText.slice(-30);
  const wantEat = FOOD_EAT_RE.test(text);
  const wantDanger = FOOD_DANGER_RE.test(text);
  if (!wantEat && !wantDanger) return null;
  const hit = foodEntries.find((f) => f.re.test(text));
  if (hit) {
    const pool = wantDanger && hit.danger.length ? hit.danger : wantEat && hit.eat.length ? hit.eat : [];
    return pool.length ? knowSay(hit.name, pool[Math.floor(Math.random() * pool.length)]) : null;
  }
  // 「これ食べられる？」は直前に話した生き物のこと
  if (/これ|それ|この|その|こいつ/.test(text) && lastName && lastName.cre && Date.now() - lastName.at < 60000) {
    const name = lastName.cre.c[0];
    const f = foodByName.get(name);
    const pool = f && (wantDanger && f.danger.length ? f.danger : wantEat && f.eat.length ? f.eat : []);
    return pool && pool.length ? knowSay(name, pool[0]) : `${name}の${wantDanger ? '危険性' : '食べ方'}は、確認できた情報がない`;
  }
  return null;
}
