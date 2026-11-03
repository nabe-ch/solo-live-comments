// ひとり配信コメント：声を聞き取り、配信風のコメントを流す（すべてこの端末の画面だけに表示する）
const $ = (id) => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const COOLDOWN_MS = 8000;   // 同じ話題に続けて反応しない時間（聞き取り途中の文字で連発しないため）
const SILENCE_MS = 15000;   // これだけ黙ると「おーい」系を出す
const MAX_ROWS = 80;
const ANSWER_WAIT_MS = 1200;  // 話し終わったとみなすまでの時間
const THREAD_TIMEOUT_MS = 20000; // 質問に答えなかったら、会話を終わりにする時間

const state = { running: false, rec: null, lastText: '', lastHeard: 0, lastSilence: 0, lastGeneric: 0, ruleAt: new Map(), recent: [], wakeLock: null, thread: null };
const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const amount = () => Number($('amount').value);

// 直近に出したコメントを避けて、あおり・質問・ほめから1つ選ぶ
function choose(group) {
  const type = pickFrom(['a', 'q', 'q', 'h']); // 拾う練習になるよう、質問を多めにする
  // 質問のうち6割は、話を広げやすいものから選ぶ
  const pool = type === 'q' && group.d && Math.random() < 0.6 ? group.d : group[type];
  return { text: pickFresh(pool), isQuestion: type === 'q' };
}

function pickFresh(pool) {
  const fresh = pool.filter((t) => !state.recent.includes(t));
  const text = pickFrom(fresh.length ? fresh : pool);
  state.recent.push(text);
  if (state.recent.length > 30) state.recent.shift();
  return text;
}

// 質問が流れたら、答えを待つ（答えの内容までは理解しない。話したら答えたとみなす）
function startThread() {
  if (!state.thread) state.thread = { depth: 0, answer: '', timer: null, until: Date.now() + THREAD_TIMEOUT_MS };
}

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

function post({ text, isQuestion }) {
  const chat = $('chat');
  const li = document.createElement('li');
  if (isQuestion) li.className = 'q';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = pickFrom(NAMES);
  li.append(name, text);
  chat.append(li);
  while (chat.children.length > MAX_ROWS) chat.firstChild.remove();
  chat.scrollTop = chat.scrollHeight;
  if (isQuestion) startThread();
}

// 本物らしく、少し遅れて流す
const postLater = (group, delay) => setTimeout(() => post(choose(group)), delay);

// 聞き取った文字に反応する
function react(text) {
  const now = Date.now();
  state.lastHeard = now;
  // 会話中は、ほかの話題のコメントを止めて、答えを聞く
  if (state.thread) { listenAnswer(text); return; }
  let matched = false;
  for (const rule of RULES) {
    if (!rule.re.test(text)) continue;
    matched = true;
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
  if (added.trim()) react(added);
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
