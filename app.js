// ひとり配信コメント：声を聞き取り、配信風のコメントを流す（すべてこの端末の画面だけに表示する）
const $ = (id) => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
// ホーム画面からアプリとして開いたか（iPhoneでは、この形だと声が使えないことがある）
const HOME_SCREEN = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
const COOLDOWN_MS = 8000;   // 同じ話題に続けて反応しない時間（聞き取り途中の文字で連発しないため）
const SILENCE_MS = 15000;   // これだけ黙ると「おーい」系を出す
const MAX_ROWS = 80;
const ANSWER_WAIT_MS = 1200;  // 話し終わったとみなすまでの時間
const THREAD_TIMEOUT_MS = 20000; // 質問に答えなかったら、会話を終わりにする時間
const ANSWER_REPEAT_MS = 15000; // 認識途中の文字で、同じ答えを続けない時間
const TATOE_COOLDOWN_MS = 5000;
const VIEWER_COOLDOWN_MS = 5000;
const PERSONA_SHARE = 0.3;
const STREAM_COOLDOWN_MS = 20000; // 始めと終わりのあいさつを続けて出さない時間
const ASK_PAUSE_MS = 900;    // 質問モードで、話し終わったとみなすまでの時間
const ASK_REPEAT_MS = 5000;  // 同じ質問に続けて答えない時間
const MISSED_MAX = 100;      // 残しておく「答えられなかった質問」の数

const START_TIMEOUT_MS = 4000;   // これだけ待っても認識が始まらなければ、作り直す
const END_TIMEOUT_MS = 1500;     // 終わるのをこれだけ待っても終わらなければ、強制的に終わらせる
const NO_RESULT_RESTART_MS = 25000; // 声が届かないまま、この時間がたったら音声認識を作り直す
const state = { reconnects: 0, lastError: '', lastResultAt: 0, recOpenedAt: 0, reconnectTimer: null, running: false, rec: null, lastText: '', lastHeard: 0, lastSilence: 0, lastGeneric: 0, lastAnswer: '', lastAnswerAt: 0, lastTatoe: 0, lastViewerReply: 0, lastStreamWord: 0, ruleAt: new Map(), recent: [], wakeLock: null, thread: null, ending: false, startTimer: null, startRetries: 0, mode: 'ask', askText: '', askDone: '', askFinal: false, askTimer: null, lastAsk: '', lastAskAt: 0 };
const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const amount = () => Number($('amount').value);

// 直近に出したコメントを避けて、あおり・質問・ほめから1つ選ぶ
function choose(group) {
  // 拾う練習になるよう、質問を多めにする。うんちくがある話題では、うんちく博士も出る
  const types = ['a', 'q', 'q', 'h', ...(group.u && group.u.length ? ['u'] : [])].filter((t) => group[t].length);
  const type = pickFrom(types);
  if (type === 'u') return { text: sageLine(pickFresh(group.u)), speaker: SAGE, cls: 'u' };
  // 3割は、話し方の決まった常連の視聴者が話す
  if (PERSONAS.length && Math.random() < PERSONA_SHARE) {
    const who = pickFrom(PERSONAS);
    const lines = type === 'q' && who.d.length && Math.random() < 0.5 ? who.d : who[type];
    if (lines.length) return { text: pickFresh(lines), isQuestion: type === 'q', group, speaker: who.name };
  }
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
  // 半分は、相づちで受け止めてから次を聞く
  if (Math.random() < 0.5) {
    post({ text: pickFresh(CATCH.ack) });
    setTimeout(() => { if (state.thread === t) post({ text, isQuestion: true }); }, 800);
  } else post({ text, isQuestion: true });
}

// 答えたあとは、ボールを実況者へ返す（話し始めていたら、割り込まない）
function throwBack(pool, delay) {
  if (Math.random() > 0.7) return;
  const askedAt = state.lastHeard;
  setTimeout(() => {
    if (!state.thread && state.lastHeard === askedAt) post({ text: pickFresh(pool), isQuestion: true });
  }, delay);
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
  if (cls === 'u' || cls === 'a') replyToExpert(cls);
}

// 博士や物知り島民の発言に、ほかの視聴者がツッコむ（ときどき博士が言い返す）
function replyToExpert(cls) {
  if (Math.random() > 0.5) return;
  const pool = cls === 'u' ? TSUKKOMI : ORACLE_TSUKKOMI;
  setTimeout(() => post({ text: pickFresh(pool) }), 900 + Math.random() * 1200);
  if (cls === 'u' && Math.random() < 0.15) setTimeout(() => post({ text: pickFresh(SAGE_COMEBACK), speaker: SAGE, cls: 'comeback' }), 2600 + Math.random() * 1000);
}

// 本物らしく、少し遅れて流す
const postLater = (group, delay) => setTimeout(() => post(choose(group)), delay);

// 聞き取った文字に反応する
function react(text, whole = text) {
  const now = Date.now();
  state.lastHeard = now;
  // 質問されたら、データをもとに答える（同じ答えは続けない）
  const answer = answerAny(whole);
  if (answer && (answer !== state.lastAnswer || now - state.lastAnswerAt > ANSWER_REPEAT_MS)) {
    state.lastAnswer = answer;
    state.lastAnswerAt = now;
    endThread();
    // 操作の質問には操作説明係が、それ以外は物知り島民が答える
    const isGuide = operationAnswer(whole) === answer;
    setTimeout(() => post({ text: answer, speaker: isGuide ? GUIDE : ORACLE, cls: isGuide ? 'g' : 'a' }), 700);
    throwBack(CATCH.afterAnswer, 3200);
    return;
  }
  // 実況の始めと終わりの言葉には、視聴者があいさつを返す
  if (now - state.lastStreamWord > STREAM_COOLDOWN_MS) {
    const said = (text + ' ' + whole.slice(-20));
    if (STREAM_SUB_RE.test(said)) {
      state.lastStreamWord = now; endThread();
      pickSome(STREAM.subscribe, 3).forEach((line, i) => setTimeout(() => post({ text: line }), 600 + i * 800));
      return;
    }
    if (STREAM_CLOSE_RE.test(said)) {
      state.lastStreamWord = now; endThread();
      pickSome(STREAM.close, 4).forEach((line, i) => setTimeout(() => post({ text: line }), 600 + i * 800));
      setTimeout(() => { if (state.lastHeard === now) post({ text: pickFresh(STREAM.closeAsk), isQuestion: true }); }, 4400);
      return;
    }
    if (STREAM_OPEN_RE.test(said)) {
      state.lastStreamWord = now; endThread();
      [...pickSome(STREAM.greet, 2), ...pickSome(greetingForNow(), 1)].forEach((line, i) => setTimeout(() => post({ text: line }), 500 + i * 800));
      setTimeout(() => { if (state.lastHeard === now) post({ text: pickFresh(STREAM.openAsk), isQuestion: true }); }, 3400);
      return;
    }
  }
  // データにない問いかけには、視聴者が返す
  const replies = !answer && now - state.lastViewerReply > VIEWER_COOLDOWN_MS ? viewerReplies(text, whole) : null;
  if (replies) {
    state.lastViewerReply = now;
    endThread();
    replies.forEach((line, i) => setTimeout(() => post({ text: line }), 700 + i * 900));
    throwBack(CATCH.afterReply, 3200);
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

// 質問モード：話し終わるのを待ってから、まだ処理していない部分に答える
function scheduleAsk(text, isFinal) {
  state.askText = text;
  state.askFinal = isFinal;
  clearTimeout(state.askTimer);
  state.askTimer = setTimeout(flushAsk, isFinal ? 0 : ASK_PAUSE_MS);
}
function flushAsk() {
  clearTimeout(state.askTimer);
  const text = state.askText;
  const question = text.startsWith(state.askDone) ? text.slice(state.askDone.length) : text;
  state.askDone = state.askFinal ? '' : text;
  if (question.trim()) askNow(question.trim());
}
function askNow(question) {
  const now = Date.now();
  if (question === state.lastAsk && now - state.lastAskAt < ASK_REPEAT_MS) return;
  const result = assist(question);
  if (!result) return;
  state.lastAsk = question;
  state.lastAskAt = now;
  document.querySelectorAll('#chat li.hint').forEach((h) => h.remove());
  showAnswer(question, result);
  if (result.type === 'unknown') addMissed(question);
}
function showAnswer(question, { type, text }) {
  const chat = $('chat');
  const li = document.createElement('li');
  li.className = `card ${type}`;
  const said = document.createElement('span');
  said.className = 'said';
  said.textContent = `「${question}」`;
  const reply = document.createElement('span');
  reply.className = 'reply';
  reply.textContent = text;
  li.append(said, reply);
  chat.append(li);
  while (chat.children.length > MAX_ROWS) chat.firstChild.remove();
  chat.scrollTop = chat.scrollHeight;
}

// 答えられなかった質問は、この端末の中にだけ残す（あとでデータを足す材料にする）
function readMissed() {
  try { return JSON.parse(localStorage.getItem('missedQuestions')) || []; } catch (e) { return []; }
}
function writeMissed(list) {
  try { localStorage.setItem('missedQuestions', JSON.stringify(list)); } catch (e) { /* 保存できない環境では画面に出すだけ */ }
  renderMissed(list);
}
function addMissed(question) {
  const list = readMissed().filter((q) => q !== question);
  writeMissed([...list, question].slice(-MISSED_MAX));
}
function renderMissed(list = readMissed()) {
  $('missedCount').textContent = list.length;
  $('missedCount').dataset.empty = String(list.length === 0);
  $('missedList').replaceChildren(...list.map((q) => { const li = document.createElement('li'); li.textContent = q; return li; }));
}

// 使い方の切り替え（質問／配信）
function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  document.querySelectorAll('.modeSwitch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  endThread();
  try { localStorage.setItem('mode', mode); } catch (e) { /* 保存できなくても動く */ }
}

// 認識途中の文字は何度も届くので、増えた部分だけを見る
function handleTranscript(text, isFinal = false) {
  if (state.mode === 'ask') {
    $('heard').textContent = text;
    scheduleAsk(text, isFinal);
    return;
  }
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
    state.lastResultAt = Date.now();
    state.lastError = '';
    setStatus('● 聞いています', true);
    const r = e.results[e.results.length - 1];
    handleTranscript(r[0].transcript, r.isFinal);
    if (r.isFinal) state.lastText = '';
  };
  rec.onstart = () => { clearTimeout(state.startTimer); state.recOpenedAt = Date.now(); setStatus('● 聞いています', true); };
  rec.onerror = (e) => {
    state.lastError = e.error;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      // 別のアプリから戻った直後にも出るので、画面が表に出ているときだけ止める
      if (document.visibilityState === 'visible') {
        stop(true);
        setStatus(HOME_SCREEN ? 'ホーム画面から開くと声が使えません。Safariで開いてください' : `許可されていません（${e.error}）。iPhoneの設定でマイクと音声認識を確認`, false);
      }
      return;
    }
    if (e.error !== 'no-speech' && e.error !== 'aborted') setStatus(`聞き取りエラー（${e.error}）。つなぎ直します`, false);
  };
  // iPhoneでは途中で止まることがあるので、動かしている間は自動でつなぎ直す
  rec.onend = () => { if (state.mode === 'ask') { flushAsk(); state.askDone = ''; state.askText = ''; } state.lastText = ''; if (state.rec === rec) state.rec = null; if (state.running) reconnect(); };
  state.rec = rec;
  // 始まらないまま止まっているときは、1回作り直し、それでもだめなら案内を出す
  clearTimeout(state.startTimer);
  state.startTimer = setTimeout(() => {
    if (!state.running || state.rec !== rec) return;
    if (state.startRetries >= 1) { setStatus('声の準備が止まりました。Safariのこのタブを閉じて開き直してください', false); return; }
    state.startRetries += 1;
    restartRecognition();
  }, START_TIMEOUT_MS);
  try { rec.start(); } catch (e) { state.lastError = e.name; state.rec = null; reconnect(); }
}

// 認識をきちんと終わらせる。iPhoneでは強制終了（abort）のあとに動かなくなることがあるので、まず stop で頼む
function endRecognition() {
  const rec = state.rec;
  state.rec = null;
  clearTimeout(state.startTimer);
  if (!rec) return;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    state.ending = false;
    // 終わるのを待っている間に開始されていたら、ここで始める
    if (state.running && !state.rec) startRecognition();
  };
  state.ending = true;
  rec.onresult = null;
  rec.onerror = null;
  rec.onend = finish;
  try { rec.stop(); } catch (e) { finish(); return; }
  setTimeout(() => {
    if (done) return;
    try { rec.abort(); } catch (e) { /* すでに止まっている */ }
    finish();
  }, END_TIMEOUT_MS);
}

function reconnect() {
  state.reconnects += 1;
  setStatus(`つなぎ直し中（${state.reconnects}回目${state.lastError ? '、' + state.lastError : ''}）`, false);
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = setTimeout(() => { if (state.running && !state.rec && !state.ending) startRecognition(); }, 300);
}

// 動いているように見えて止まっている場合に備える：声が届かない時間が続いたら、作り直す
function restartRecognition() {
  if (!state.running) return;
  state.reconnects += 1;
  setStatus(`つなぎ直し中（${state.reconnects}回目${state.lastError ? '、' + state.lastError : ''}）`, false);
  if (state.rec) endRecognition();
  else if (!state.ending) reconnect();
}

function setStatus(text, on) {
  $('status').textContent = text;
  $('status').className = on ? 'on' : '';
}

async function keepScreenOn() {
  try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 使えない機種ではそのまま続ける */ }
}

function start() {
  if (!SR) { setStatus(HOME_SCREEN ? 'ホーム画面から開くと声が使えません。Safariで開いてください' : 'この環境は声が使えません。文字で聞けます', false); return; }
  state.running = true;
  state.reconnects = 0;
  state.lastError = '';
  state.lastResultAt = Date.now();
  state.lastHeard = Date.now();
  $('toggleLabel').textContent = '停止';
  document.body.dataset.listening = 'true';
  state.startRetries = 0;
  state.askDone = '';
  state.askText = '';
  state.lastText = '';
  state.lastAsk = '';
  setStatus('準備中…', false);
  keepScreenOn();
  // 前の認識がまだ終わっていなければ、終わったあとに始まる
  if (!state.ending) startRecognition();
  if (state.mode === 'stream') streamBurst(pickSome(greetingForNow(), 2), pickSome(STREAM.open, 3), pickSome(STREAM.openAsk, 1));
}

// 実況の始めや終わりに、視聴者のコメントを少しずつ流す。最後の質問は会話になる
function pickSome(pool, n) { return [...pool].sort(() => Math.random() - 0.5).slice(0, n); }
function streamBurst(first, middle, asks) {
  const lines = [...first, ...middle].map((text) => ({ text }));
  const count = Math.max(2, Math.round(lines.length * amount()));
  const picked = lines.slice(0, count);
  picked.forEach((c, i) => setTimeout(() => post(c), 600 + i * (700 + Math.random() * 700)));
  asks.forEach((text, i) => setTimeout(() => { if (state.running) post({ text, isQuestion: true }); }, 900 + (picked.length + i) * 1100));
}

// silent：エラーで止まったときは、別れのコメントを出さない
function stop(silent = false) {
  const wasRunning = state.running && !silent && state.mode === 'stream';
  state.running = false;
  endThread();
  clearTimeout(state.reconnectTimer);
  // 話し終わりを待っている質問があれば、先に答える
  if (state.mode === 'ask' && state.askTimer) flushAsk();
  clearTimeout(state.askTimer);
  state.askDone = '';
  state.askText = '';
  state.lastText = '';
  endRecognition();
  if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; }
  $('toggleLabel').textContent = '開始';
  document.body.dataset.listening = 'false';
  setStatus('停止中', false);
  if (wasRunning) pickSome(STREAM.close, 4).forEach((text, i) => setTimeout(() => post({ text }), 300 + i * 800));
}

// 黙っているときと、ときどき流れる雑談コメント
setInterval(() => {
  const now = Date.now();
  if (state.thread && !state.thread.timer && now > state.thread.until) endThread(); // 答えがなければ会話を終える
  if (state.running && document.visibilityState === 'visible' && now - state.lastResultAt > NO_RESULT_RESTART_MS) {
    state.lastResultAt = now;
    restartRecognition();
  }
  if (!state.running || state.thread || state.mode === 'ask') return;
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
  if (state.mode === 'ask') askNow(text); else react(text);
  $('testInput').value = '';
});
document.querySelectorAll('.modeSwitch button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
// 文字で聞く欄の開閉
$('typeToggle').addEventListener('click', () => {
  const form = $('testForm');
  form.hidden = !form.hidden;
  $('typeToggle').setAttribute('aria-expanded', String(!form.hidden));
  if (!form.hidden) $('testInput').focus();
});
$('missedOpen').addEventListener('click', () => $('missed').showModal());
$('missedClose').addEventListener('click', () => $('missed').close());
$('missedCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(readMissed().join('\n')); setStatus('コピーしました', state.running); } catch (e) { setStatus('コピーできませんでした', state.running); }
});
$('missedClear').addEventListener('click', () => { if (confirm('答えられなかった質問の一覧を消しますか？')) writeMissed([]); });
// 前回の使い方を復元する（初めては質問モード）
{
  let saved = null;
  try { saved = localStorage.getItem('mode'); } catch (e) { /* 読めなければ質問モード */ }
  setMode(saved === 'stream' ? 'stream' : 'ask');
  renderMissed();
  if (state.mode === 'ask') {
    const hint = document.createElement('li');
    hint.className = 'hint';
    hint.append('下の丸いボタンを押して、声で聞いてください。');
    const example = document.createElement('b');
    example.textContent = '「タランチュラっていくら」';
    hint.append(example);
    $('chat').append(hint);
  }
}
// 別のアプリから戻ったら、画面をつけたままにする設定をかけ直す
document.addEventListener('visibilitychange', () => {
  if (!state.running || document.visibilityState !== 'visible') return;
  keepScreenOn();
  state.lastResultAt = Date.now();
  restartRecognition();
});
// ページを閉じたり更新したりするときは、マイクを手放す（次に開いたときに反応しなくなるのを防ぐ）
window.addEventListener('pagehide', () => {
  const rec = state.rec;
  state.running = false;
  state.rec = null;
  if (!rec) return;
  rec.onend = null;
  try { rec.abort(); } catch (e) { /* すでに止まっている */ }
});
// 2回目から速く開けるようにする
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
// プログラムのエラーも画面に出す（読み込みの失敗に気づけるように）
window.addEventListener('error', (e) => setStatus(`エラー：${e.message}`, false));
