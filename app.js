// ひとり配信コメント：声を聞き取り、配信風のコメントを流す（すべてこの端末の画面だけに表示する）
const $ = (id) => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const COOLDOWN_MS = 8000;   // 同じ話題に続けて反応しない時間（聞き取り途中の文字で連発しないため）
const SILENCE_MS = 15000;   // これだけ黙ると「おーい」系を出す
const MAX_ROWS = 80;
const ANSWER_WAIT_MS = 1200;  // 話し終わったとみなすまでの時間
const THREAD_TIMEOUT_MS = 20000; // 質問に答えなかったら、会話を終わりにする時間
const ANSWER_REPEAT_MS = 15000; // 認識途中の文字で、同じ答えを続けない時間
const TATOE_COOLDOWN_MS = 5000;

const state = { running: false, rec: null, lastText: '', lastHeard: 0, lastSilence: 0, lastGeneric: 0, lastAnswer: '', lastAnswerAt: 0, lastTatoe: 0, ruleAt: new Map(), recent: [], wakeLock: null, thread: null };
const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const amount = () => Number($('amount').value);

// 直近に出したコメントを避けて、あおり・質問・ほめから1つ選ぶ
function choose(group) {
  // 拾う練習になるよう、質問を多めにする。うんちくがある話題では、うんちく博士も出る
  const types = ['a', 'q', 'q', 'h', ...(group.u && group.u.length ? ['u'] : [])].filter((t) => group[t].length);
  const type = pickFrom(types);
  if (type === 'u') return { text: pickFresh(group.u), speaker: SAGE, cls: 'u' };
  // 2割は話題を問わない言い方（正統派・ユーモア）を混ぜる。質問の残りの6割は、話を広げやすいものから選ぶ
  let pool = group[type];
  if (Math.random() < 0.2) pool = STYLE[type];
  else if (type === 'q' && group.d && Math.random() < 0.6) pool = group.d;
  return { text: pickFresh(pool), isQuestion: type === 'q', group };
}

function pickFresh(pool) {
  const fresh = pool.filter((t) => !state.recent.includes(t));
  const text = pickFrom(fresh.length ? fresh : pool);
  state.recent.push(text);
  if (state.recent.length > 30) state.recent.shift();
  return text;
}

// 質問が流れたら、答えを待つ（答えの内容までは理解しない。話したら答えたとみなす）
function startThread(group) {
  if (!state.thread) state.thread = { group, depth: 0, answer: '', timer: null, until: Date.now() + THREAD_TIMEOUT_MS };
}

// 質問とは別の話題の言葉が出たら、質問を拾わなかったとみなす（soft は答えの中にも出やすい言葉の話題なので除く）
const changedTopic = (text) => RULES.some((r) => r !== state.thread.group && !r.soft && r.re.test(text));

function endThread() {
  if (state.thread) clearTimeout(state.thread.timer);
  state.thread = null;
}

// 話している間は待ち、話し終わったら続きのコメントを流す
function listenAnswer(text) {
  const t = state.thread;
  t.answer += text;
  t.until = Date.now() + THREAD_TIMEOUT_MS;
  clearTimeout(t.timer);
  t.timer = setTimeout(followUp, ANSWER_WAIT_MS);
}

function followUp() {
  const t = state.thread;
  if (!t) return;
  t.timer = null;
  if (t.depth >= 3) { // 4回目で会話を締める
    endThread();
    post({ text: pickFresh(FOLLOW.close), isQuestion: false });
    return;
  }
  const said = t.answer.trim();
  let text;
  if (t.depth === 2) text = pickFresh(FOLLOW.deeper);
  else if (t.depth === 1) text = pickFresh(FOLLOW.detail);
  // 短い答えは、言葉を引用すると会話らしくなる
  else if (said.length >= 2 && said.length <= 14 && Math.random() < 0.6) text = pickFresh(FOLLOW.echo).replace('{x}', said);
  else text = pickFresh(FOLLOW.why);
  t.depth += 1;
  t.answer = '';
  t.until = Date.now() + THREAD_TIMEOUT_MS;
  post({ text, isQuestion: true });
}

function post({ text, isQuestion, group, speaker, cls }) {
  const chat = $('chat');
  const li = document.createElement('li');
  if (isQuestion) li.className = 'q';
  if (cls) li.className = cls;
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = speaker || pickFrom(NAMES);
  li.append(name, text);
  chat.append(li);
  while (chat.children.length > MAX_ROWS) chat.firstChild.remove();
  chat.scrollTop = chat.scrollHeight;
  if (isQuestion) startThread(group);
}

// 本物らしく、少し遅れて流す
const postLater = (group, delay) => setTimeout(() => post(choose(group)), delay);

// 聞き取った文字に反応する
function react(text, whole = text) {
  const now = Date.now();
  state.lastHeard = now;
  // 質問されたら、データをもとに答える（同じ答えは続けない）
  const answer = answerQuestion(whole);
  if (answer && (answer !== state.lastAnswer || now - state.lastAnswerAt > ANSWER_REPEAT_MS)) {
    state.lastAnswer = answer;
    state.lastAnswerAt = now;
    endThread();
    setTimeout(() => post({ text: answer, speaker: ORACLE, cls: 'a' }), 700);
    return;
  }
  // たとえボケには、会話の途中でも反応する
  // 「やってみたい」は、たとえではないので除く
  if (TATOE.re.test(text.replace(/[てで]みたい/g, '')) && now - state.lastTatoe > TATOE_COOLDOWN_MS) {
    state.lastTatoe = now;
    const clause = (whole.replace(/[てで]みたい/g, '').slice(-30).match(/.{2,12}?(みたい|のような|のようだ|かよ|にしか見えない)/) || [''])[0];
    const line = clause && Math.random() < 0.5 ? pickFresh(TATOE.echo).replace('{x}', clause) : pickFresh(TATOE.say);
    setTimeout(() => post({ text: line }), 500);
  }
  // 会話中は、ほかの話題のコメントを止めて、答えを聞く
  if (state.thread) {
    if (!changedTopic(text)) { listenAnswer(text); return; }
    endThread();
  }
  // 細かい話題（住民や生き物の名前）を優先し、一度に反応するのは2つまで
  const hits = RULES.filter((r) => r.re.test(text)).reverse().slice(0, 2);
  const matched = hits.length > 0;
  for (const rule of hits) {
    if (now - (state.ruleAt.get(rule) || 0) < COOLDOWN_MS) continue;
    state.ruleAt.set(rule, now);
    const count = Math.max(1, Math.round((1 + Math.random() * 2) * amount()));
    for (let i = 0; i < count; i++) postLater(rule, 500 + Math.random() * 2500);
  }
  if (!matched && now - state.lastGeneric > 6000 / amount() && Math.random() < 0.5) {
    state.lastGeneric = now;
    postLater(GENERIC, 800 + Math.random() * 1500);
  }
}

// 認識途中の文字は何度も届くので、増えた部分だけを見る
function handleTranscript(text) {
  const added = text.startsWith(state.lastText) ? text.slice(state.lastText.length) : text;
  state.lastText = text;
  $('heard').textContent = text;
  if (added.trim()) react(added, text);
}

function startRecognition() {
  const rec = new SR();
  rec.lang = 'ja-JP';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    handleTranscript(r[0].transcript);
    if (r.isFinal) state.lastText = '';
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stop();
      setStatus('マイクか音声認識が許可されていません', false);
    }
  };
  // iPhoneでは途中で止まることがあるので、動かしている間は自動でつなぎ直す
  rec.onend = () => { state.lastText = ''; if (state.running) setTimeout(() => { if (state.running) startRecognition(); }, 300); };
  rec.start();
  state.rec = rec;
}

function setStatus(text, on) {
  $('status').textContent = text;
  $('status').className = on ? 'on' : '';
}

async function keepScreenOn() {
  try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 使えない機種ではそのまま続ける */ }
}

function start() {
  if (!SR) { setStatus('この環境は音声認識に未対応（試し入力は使えます）', false); return; }
  state.running = true;
  state.lastHeard = Date.now();
  $('toggle').textContent = '停止';
  setStatus('● 聞いています', true);
  keepScreenOn();
  startRecognition();
}

function stop() {
  state.running = false;
  endThread();
  if (state.rec) { state.rec.onend = null; state.rec.abort(); state.rec = null; }
  if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; }
  $('toggle').textContent = '開始';
  setStatus('停止中', false);
}

// 黙っているときと、ときどき流れる雑談コメント
setInterval(() => {
  const now = Date.now();
  if (state.thread && !state.thread.timer && now > state.thread.until) endThread(); // 答えがなければ会話を終える
  if (!state.running || state.thread) return;
  if (now - state.lastHeard > SILENCE_MS && now - state.lastSilence > SILENCE_MS) {
    state.lastSilence = now;
    post(choose(SILENCE));
  } else if (Math.random() < 0.04 * amount()) {
    post(choose(GENERIC));
  }
}, 1000);

$('toggle').addEventListener('click', () => { if (state.running) stop(); else start(); });
$('testForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('testInput').value.trim();
  if (!text) return;
  $('heard').textContent = text;
  react(text);
  $('testInput').value = '';
});
// 別のアプリから戻ったら、画面をつけたままにする設定をかけ直す
document.addEventListener('visibilitychange', () => { if (state.running && document.visibilityState === 'visible') keepScreenOn(); });
