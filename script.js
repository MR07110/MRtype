// words.js dagi mavjud SOUNDS
// script.js - MR TYPE with CENTER CARET (Monkeytype style)
// Words scroll from right to left, caret always centered

let audioCtx = null;
let currentSound = 'blue';

let gameState = {
  words: [],
  curWord: 0,
  typedBuf: '',
  extraChars: '',
  isRunning: false,
  isFinished: false,
  startTime: 0,
  totalKeys: 0,
  correctKeys: 0,
  wrongKeys: 0,
  wordsCompleted: 0,
  timerInt: null,
  errorMap: {},
  wordTyped: []
};

let settings = {
  mode: 'time',
  duration: 30,
  wordsGoal: 50,
  lang: 'en',
  theme: 'default',
  showKeyboard: true,
  soundEnabled: true,
  smoothCaret: true,
  zenMode: false,
  fontSize: '1.65rem',
  fontHeight: '2.2rem'
};

let userHistory = [];
let userName = 'mrtype user';

const dom = {
  wordsContainer: document.getElementById('wordsContainer'),
  typingArea: document.getElementById('typingArea'),
  hiddenInput: document.getElementById('hiddenInput'),
  caret: document.getElementById('caret'),
  liveWpm: document.getElementById('liveWpm'),
  liveAcc: document.getElementById('liveAcc'),
  liveTimer: document.getElementById('liveTimer'),
  timerLabel: document.getElementById('timerLabel'),
  liveWords: document.getElementById('liveWords'),
  progressFill: document.getElementById('progressFill'),
  progressPercent: document.getElementById('progressPercent'),
  subOptions: document.getElementById('subOptions'),
  keyboardSection: document.getElementById('keyboardSection'),
  rankName: document.getElementById('rankName'),
  rankStars: document.getElementById('rankStars'),
  rankNext: document.getElementById('rankNext'),
  toastContainer: document.getElementById('toastContainer'),
  soundName: document.getElementById('soundName')
};

let wordSpans = [];
let currentWordSpan = null;

// ============ UTILITIES ============
function playSound(type) {
  if (!settings.soundEnabled) return;
  
  // AudioContextni tayyorlash
  if (!audioCtx) {
    try { 
      audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
    } catch(e) { 
      console.log('Audio not supported'); 
      return; 
    }
  }
  
  // AudioContext "suspended" holatda bo'lsa - resume qilish
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      playSoundInternal(type);
    });
    return;
  }
  
  playSoundInternal(type);
}

function playSoundInternal(type) {
  const sound = SOUNDS[currentSound];
  if (!sound) return;
  
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.frequency.value = type === 'correct' ? sound.correct : sound.error;
    osc.type = sound.type;
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.dur);
    
    osc.start(now);
    osc.stop(now + sound.dur);
  } catch(e) {
    console.log('Play sound error:', e);
  }
}
function highlightKey(key, status) {
  const el = document.querySelector(`.key[data-key="${key}"]`);
  if (!el) return;
  el.classList.remove('pressed', 'pressed-correct', 'pressed-error');
  if (status === 'press') el.classList.add('pressed');
  else if (status === 'correct') el.classList.add('pressed-correct');
  else if (status === 'error') el.classList.add('pressed-error');
  setTimeout(() => el.classList.remove('pressed', 'pressed-correct', 'pressed-error'), 60);
}

function getRank(wpm) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (wpm >= RANKS[i].min) return RANKS[i];
  }
  return RANKS[0];
}

function updateRankBadge() {
  const best = userHistory.length ? Math.max(...userHistory.map(h => h.wpm)) : 0;
  const rank = getRank(best);
  dom.rankName.textContent = rank.name;
  dom.rankStars.textContent = '★'.repeat(rank.stars) + '☆'.repeat(5 - rank.stars);
  dom.rankNext.textContent = rank.next ? `Keyingi: ${rank.next} WPM` : 'Maksimal daraja';
}

function generateWords() {
  if (settings.mode === 'quote') return [];
  if (settings.mode === 'dev') return [...DEV_WORDS];
  if (settings.mode === 'custom') return [''];
  const pool = WORD_POOLS[settings.lang] || WORD_POOLS.en;
  const needed = settings.mode === 'words' ? settings.wordsGoal + 20 : 60;
  return Array.from({ length: needed }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function generateQuote() {
  const pool = QUOTES[settings.lang] || QUOTES.en;
  return pool[Math.floor(Math.random() * pool.length)].split(' ');
}

// ============ RENDER ENGINE ============
function renderWords() {
  const words = gameState.words;
  const curWord = gameState.curWord;

  if (wordSpans.length !== words.length) {
    dom.wordsContainer.innerHTML = '';
    wordSpans = [];
    for (let i = 0; i < words.length; i++) {
      const span = document.createElement('span');
      span.className = 'word';
      if (i === curWord) span.classList.add('current-word');
      dom.wordsContainer.appendChild(span);
      wordSpans[i] = span;
    }
    currentWordSpan = wordSpans[curWord];
  }

  for (let i = 0; i < curWord; i++) {
    const span = wordSpans[i];
    if (!span.classList.contains('completed')) {
      const typed = gameState.wordTyped?.[i] || '';
      const original = words[i];
      span.textContent = typed === original ? original : typed;
      span.classList.add(typed === original ? 'word-correct' : 'word-incorrect', 'completed');
      span.classList.remove('current-word');
    }
  }

  if (currentWordSpan) {
    if (settings.mode === 'custom') {
      const typed = gameState.typedBuf;
      let html = '';
      for (let i = 0; i < typed.length; i++) {
        html += `<span class="char correct">${typed[i] === ' ' ? '&nbsp;' : typed[i]}</span>`;
      }
      html += '<span class="char pending">&nbsp;</span>';
      if (currentWordSpan.innerHTML !== html) currentWordSpan.innerHTML = html;
      currentWordSpan.style.borderBottom = '2px solid var(--accent)';
    } else {
      const word = words[curWord];
      const typed = gameState.typedBuf;
      const extra = gameState.extraChars;
      let html = '';
      for (let i = 0; i < word.length; i++) {
        let cls = 'char';
        if (i < typed.length) {
          cls += typed[i] === word[i] ? ' correct' : ' incorrect';
        } else {
          cls += ' pending';
        }
        html += `<span class="${cls}">${word[i]}</span>`;
      }
      for (let i = 0; i < extra.length; i++) {
        html += `<span class="char extra">${extra[i]}</span>`;
      }
      if (currentWordSpan.innerHTML !== html) currentWordSpan.innerHTML = html;
    }
  }

  for (let i = curWord + 1; i < Math.min(curWord + 30, words.length); i++) {
    const span = wordSpans[i];
    if (span.textContent !== words[i]) {
      span.textContent = words[i];
      span.classList.add('word-future');
    }
  }

  updateCaret();
}

function updateCurrentWordDisplayFast() {
  if (!currentWordSpan) return;

  if (settings.mode === 'custom') {
    const typed = gameState.typedBuf;
    let html = '';
    for (let i = 0; i < typed.length; i++) {
      html += `<span class="char correct">${typed[i] === ' ' ? '&nbsp;' : typed[i]}</span>`;
    }
    html += '<span class="char pending">&nbsp;</span>';
    if (currentWordSpan.innerHTML !== html) currentWordSpan.innerHTML = html;
    return;
  }

  const word = gameState.words[gameState.curWord];
  if (!word) return;

  const typed = gameState.typedBuf;
  const extra = gameState.extraChars;
  let html = '';
  for (let i = 0; i < word.length; i++) {
    let cls = 'char';
    if (i < typed.length) {
      cls += typed[i] === word[i] ? ' correct' : ' incorrect';
    } else {
      cls += ' pending';
    }
    html += `<span class="${cls}">${word[i]}</span>`;
  }
  for (let i = 0; i < extra.length; i++) {
    html += `<span class="char extra">${extra[i]}</span>`;
  }
  if (currentWordSpan.innerHTML !== html) currentWordSpan.innerHTML = html;
}

// ============ CARET ============
// ============ CARET ============
function updateCaret() {
  if (!currentWordSpan) {
    dom.caret.style.opacity = '0';
    return;
  }
  
  const word = gameState.words[gameState.curWord];
  if (!word) {
    dom.caret.style.opacity = '0';
    return;
  }
  
  const chars = currentWordSpan.querySelectorAll('.char');
  const typedLen = gameState.typedBuf.length;
  
  let targetChar = null;
  const aheadIndex = typedLen; // typedLen + 1 emas
  
  if (aheadIndex < word.length) {
    targetChar = chars[aheadIndex];
  } else if (chars.length > 0) {
    targetChar = chars[chars.length - 1];
  }
  
  if (!targetChar) {
    dom.caret.style.opacity = '0';
    return;
  }
  
  const areaRect = dom.typingArea.getBoundingClientRect();
  const caretTargetLeft = areaRect.width / 2;
  
  const containerRect = dom.wordsContainer.getBoundingClientRect();
  const charRect = targetChar.getBoundingClientRect();
  
  const caretWidth = 3;
  let charOffsetInContainer = charRect.left - containerRect.left;
  
  if (aheadIndex >= word.length) {
    charOffsetInContainer += targetChar.offsetWidth + 6;
  } else {
    charOffsetInContainer -= 6;
  }
  
  const translateX = caretTargetLeft - charOffsetInContainer;
  
  dom.wordsContainer.style.transition = 'transform 0.12s cubic-bezier(0.25, 0.8, 0.25, 1.2)';
  dom.wordsContainer.style.transform = `translateX(${translateX}px)`;
  
  dom.caret.style.left = caretTargetLeft + 'px';
  dom.caret.style.top = (charRect.top - areaRect.top) + 'px';
  dom.caret.style.height = charRect.height + 'px';
  dom.caret.style.width = '3px';
  dom.caret.style.opacity = '1';
  dom.caret.style.background = '#e2b714';
  dom.caret.style.boxShadow = '0 0 10px rgba(226, 183, 20, 0.6)';
  dom.caret.style.borderRadius = '1px';
}
// ============ GAME CORE ============
function updateStatsDisplay() {
  if (!gameState.isRunning && gameState.startTime === 0) return;

  let wpm = 0;
  if (gameState.isRunning) {
    const elapsed = (Date.now() - gameState.startTime) / 60000;
    wpm = elapsed > 0 ? Math.round((gameState.correctKeys / 5) / elapsed) : 0;
  }
  const acc = gameState.totalKeys === 0 ? 100 : Math.round((gameState.correctKeys / gameState.totalKeys) * 100);

  dom.liveWpm.textContent = wpm;
  dom.liveAcc.textContent = acc + '%';

  if (settings.mode === 'custom') {
    dom.liveTimer.textContent = gameState.isRunning ? Math.floor((Date.now() - gameState.startTime) / 1000) + 's' : '0s';
    dom.liveWords.textContent = `${gameState.typedBuf.length}/∞`;
    return;
  }

  if (settings.mode === 'time') {
    if (gameState.isRunning) {
      const left = Math.max(0, settings.duration - Math.floor((Date.now() - gameState.startTime) / 1000));
      dom.liveTimer.textContent = left;
      const pct = ((settings.duration - left) / settings.duration) * 100;
      dom.progressFill.style.width = pct + '%';
      dom.progressPercent.textContent = Math.round(pct) + '%';
      if (left <= 0) finishGame();
    } else {
      dom.liveTimer.textContent = settings.duration;
    }
  } else if (settings.mode === 'words') {
    dom.liveTimer.textContent = `${gameState.curWord}/${settings.wordsGoal}`;
    const pct = (gameState.curWord / settings.wordsGoal) * 100;
    dom.progressFill.style.width = pct + '%';
    dom.progressPercent.textContent = Math.round(pct) + '%';
    if (gameState.curWord >= settings.wordsGoal && gameState.isRunning) finishGame();
  } else if (settings.mode === 'quote') {
    dom.liveTimer.textContent = `${gameState.curWord}/${gameState.words.length}`;
    const pct = (gameState.curWord / gameState.words.length) * 100;
    dom.progressFill.style.width = pct + '%';
    dom.progressPercent.textContent = Math.round(pct) + '%';
    if (gameState.curWord >= gameState.words.length && gameState.isRunning) finishGame();
  }

  const total = settings.mode === 'words' ? settings.wordsGoal :
                settings.mode === 'quote' ? gameState.words.length : '∞';
  dom.liveWords.textContent = `${gameState.wordsCompleted}/${total}`;
}

function startGame() {
  if (gameState.isRunning) return;
  gameState.isRunning = true;
  gameState.startTime = Date.now();
  if (gameState.timerInt) clearInterval(gameState.timerInt);
  gameState.timerInt = setInterval(() => {
    updateStatsDisplay();
    if (settings.mode === 'time' && Date.now() - gameState.startTime >= settings.duration * 1000) finishGame();
    if (settings.mode === 'words' && gameState.curWord >= settings.wordsGoal && gameState.isRunning) finishGame();
    if (settings.mode === 'quote' && gameState.curWord >= gameState.words.length && gameState.isRunning) finishGame();
  }, 100);
  dom.caret.classList.remove('blink');
  dom.caret.classList.add('typing');
}

function finishGame() {
  if (gameState.isFinished) return;
  gameState.isFinished = true;
  gameState.isRunning = false;
  if (gameState.timerInt) clearInterval(gameState.timerInt);

  const elapsed = Date.now() - gameState.startTime;
  const netWpm = elapsed > 0 ? Math.round((gameState.correctKeys / 5) / (elapsed / 60000)) : 0;
  const rawWpm = elapsed > 0 ? Math.round((gameState.totalKeys / 5) / (elapsed / 60000)) : 0;
  const acc = gameState.totalKeys === 0 ? 100 : Math.round((gameState.correctKeys / gameState.totalKeys) * 100);

  const entry = {
    wpm: netWpm, raw: rawWpm, acc: acc,
    words: settings.mode === 'custom' ? Math.round(gameState.correctKeys / 5) : gameState.wordsCompleted,
    time: Math.round(elapsed / 1000), mode: settings.mode, date: Date.now()
  };

  userHistory.unshift(entry);
  if (userHistory.length > 200) userHistory.pop();
  localStorage.setItem('mrtype_history', JSON.stringify(userHistory));
  updateRankBadge();
  showResultModal(entry);
  playSound('correct');
}

function showResultModal(entry) {
  document.getElementById('resultWpm').textContent = entry.wpm;
  document.getElementById('resultStats').innerHTML = `
    <div class="result-stat-card"><div class="result-stat-value" style="color:var(--success)">${entry.acc}%</div><div class="result-stat-label">Aniqlik</div></div>
    <div class="result-stat-card"><div class="result-stat-value" style="color:var(--info)">${entry.raw}</div><div class="result-stat-label">Raw WPM</div></div>
    <div class="result-stat-card"><div class="result-stat-value">${entry.words}</div><div class="result-stat-label">Sozlar</div></div>
    <div class="result-stat-card"><div class="result-stat-value">${entry.time}s</div><div class="result-stat-label">Vaqt</div></div>
  `;
  window._lastEntry = entry;
  document.getElementById('resultOverlay').classList.add('open');
}

function fullResetWithNewWords() {
  if (gameState.timerInt) clearInterval(gameState.timerInt);
  gameState.words = settings.mode === 'quote' ? generateQuote() : generateWords();
  gameState.curWord = 0;
  gameState.typedBuf = '';
  gameState.extraChars = '';
  gameState.isRunning = false;
  gameState.isFinished = false;
  gameState.startTime = 0;
  gameState.totalKeys = 0;
  gameState.correctKeys = 0;
  gameState.wrongKeys = 0;
  gameState.wordsCompleted = 0;
  gameState.wordTyped = [];
  wordSpans = [];
  renderWords();
  updateStatsDisplay();
  dom.hiddenInput.value = '';
  dom.hiddenInput.focus();
  dom.typingArea.classList.remove('blurred');
  dom.caret.classList.remove('typing');
  dom.caret.classList.add('blink');
  dom.caret.style.opacity = '1';
  document.getElementById('resultOverlay').classList.remove('open');
}

function sameWordsRestart() {
  if (settings.mode === 'custom') { fullResetWithNewWords(); return; }
  if (gameState.timerInt) clearInterval(gameState.timerInt);
  gameState.curWord = 0;
  gameState.typedBuf = '';
  gameState.extraChars = '';
  gameState.isRunning = false;
  gameState.isFinished = false;
  gameState.startTime = 0;
  gameState.totalKeys = 0;
  gameState.correctKeys = 0;
  gameState.wrongKeys = 0;
  gameState.wordsCompleted = 0;
  gameState.wordTyped = [];
  for (let i = 0; i < wordSpans.length; i++) {
    const span = wordSpans[i];
    if (!span) continue;
    span.textContent = gameState.words[i];
    span.classList.remove('completed', 'word-correct', 'word-incorrect', 'current-word', 'word-future');
    span.innerHTML = '';
  }
  currentWordSpan = wordSpans[0];
  if (currentWordSpan) currentWordSpan.classList.add('current-word');
  renderWords();
  updateStatsDisplay();
  dom.hiddenInput.value = '';
  dom.hiddenInput.focus();
  dom.typingArea.classList.remove('blurred');
  dom.caret.classList.remove('typing');
  dom.caret.classList.add('blink');
  dom.caret.style.opacity = '1';
  document.getElementById('resultOverlay').classList.remove('open');
  updateCaret();
}

function handleChar(char) {
  if (gameState.isFinished) return;

  // CUSTOM MODE - erkin yozish
  if (settings.mode === 'custom') {
    if (!gameState.isRunning) startGame();
    gameState.totalKeys++;
    gameState.correctKeys++;
    gameState.typedBuf += char;
    playSound('correct');
    highlightKey(char, 'correct');
    updateCurrentWordDisplayFast();
    updateCaret();
    updateStatsDisplay();
    return;
  }

  if (!gameState.isRunning && gameState.typedBuf.length === 0 && char !== ' ') startGame();
  const word = gameState.words[gameState.curWord];
  if (!word) return;
  gameState.totalKeys++;
  if (gameState.typedBuf.length < word.length) {
    const expected = word[gameState.typedBuf.length];
    if (char === expected) { gameState.correctKeys++; gameState.typedBuf += char; playSound('correct'); highlightKey(char, 'correct'); }
    else { gameState.wrongKeys++; gameState.typedBuf += char; playSound('error'); highlightKey(char, 'error'); }
  } else {
    if (gameState.extraChars.length < 15) { gameState.extraChars += char; gameState.wrongKeys++; playSound('error'); highlightKey(char, 'error'); }
  }
  updateCurrentWordDisplayFast();
  updateCaret();
  updateStatsDisplay();
}

function handleBackspace() {
  if (gameState.isFinished) return;

  // CUSTOM MODE
  if (settings.mode === 'custom') {
    if (gameState.typedBuf.length > 0) {
      gameState.typedBuf = gameState.typedBuf.slice(0, -1);
      updateCurrentWordDisplayFast();
      updateCaret();
    }
    return;
  }

  if (gameState.extraChars.length > 0) { gameState.extraChars = gameState.extraChars.slice(0, -1); updateCurrentWordDisplayFast(); updateCaret(); return; }
  if (gameState.typedBuf.length > 0) { gameState.typedBuf = gameState.typedBuf.slice(0, -1); updateCurrentWordDisplayFast(); updateCaret(); }
}

function handleSpace() {
  if (gameState.isFinished) return;

  // CUSTOM MODE - probel qo'shish
  if (settings.mode === 'custom') {
    if (!gameState.isRunning) startGame();
    gameState.totalKeys++;
    gameState.correctKeys++;
    gameState.typedBuf += ' ';
    highlightKey(' ', 'correct');
    updateCurrentWordDisplayFast();
    updateCaret();
    updateStatsDisplay();
    return;
  }

  if (gameState.typedBuf.length === 0) return;
  if (!gameState.isRunning) startGame();
  const word = gameState.words[gameState.curWord];
  const typed = gameState.typedBuf + gameState.extraChars;
  const isCorrect = typed === word;
  if (isCorrect) gameState.correctKeys++;
  if (!gameState.wordTyped) gameState.wordTyped = [];
  gameState.wordTyped[gameState.curWord] = typed;
  gameState.wordsCompleted++;
  if (wordSpans[gameState.curWord]) {
    wordSpans[gameState.curWord].textContent = isCorrect ? word : typed;
    wordSpans[gameState.curWord].classList.add(isCorrect ? 'word-correct' : 'word-incorrect', 'completed');
    wordSpans[gameState.curWord].classList.remove('current-word');
  }
  gameState.curWord++;
  gameState.typedBuf = '';
  gameState.extraChars = '';
  if (gameState.curWord < wordSpans.length) { currentWordSpan = wordSpans[gameState.curWord]; currentWordSpan.classList.add('current-word'); updateCurrentWordDisplayFast(); }
  updateCaret();
  updateStatsDisplay();
  if (settings.mode === 'words' && gameState.curWord >= settings.wordsGoal) finishGame();
  if (settings.mode === 'quote' && gameState.curWord >= gameState.words.length) finishGame();
}

// ============ STATISTICS ============
function getStatsData() {
  if (!userHistory.length) return null;
  const total = userHistory.length;
  const bestWpm = Math.max(...userHistory.map(h => h.wpm));
  const avgWpm = Math.round(userHistory.reduce((a,b) => a + b.wpm, 0) / total);
  const avgAcc = Math.round(userHistory.reduce((a,b) => a + b.acc, 0) / total);
  const totalTime = userHistory.reduce((a,b) => a + b.time, 0);
  const totalWords = userHistory.reduce((a,b) => a + b.words, 0);
  return { total, bestWpm, avgWpm, avgAcc, totalTime, totalWords };
}

function getWeeklyStats() {
  const weekData = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayName = date.toLocaleDateString('uz-UZ', { weekday: 'short' });
    const dayResults = userHistory.filter(h => new Date(h.date).toDateString() === date.toDateString());
    const avgWpm = dayResults.length ? Math.round(dayResults.reduce((a,b) => a + b.wpm, 0) / dayResults.length) : 0;
    weekData.push({ day: dayName, wpm: avgWpm });
  }
  return weekData;
}

function getProgressionStats() {
  return userHistory.slice(0, 30).reverse().map((h, i) => ({ test: i + 1, wpm: h.wpm, acc: h.acc }));
}

function getDistributionStats() {
  const ranges = [
    { min: 0, max: 20, label: '0-20', count: 0 }, { min: 20, max: 40, label: '20-40', count: 0 },
    { min: 40, max: 60, label: '40-60', count: 0 }, { min: 60, max: 80, label: '60-80', count: 0 },
    { min: 80, max: 100, label: '80-100', count: 0 }, { min: 100, max: 120, label: '100-120', count: 0 },
    { min: 120, max: 150, label: '120-150', count: 0 }, { min: 150, max: 999, label: '150+', count: 0 }
  ];
  userHistory.forEach(h => { for (const r of ranges) { if (h.wpm >= r.min && h.wpm < r.max) { r.count++; break; } } });
  return ranges;
}

function drawProgressionChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data || data.length === 0) return;
  const container = canvas.parentElement;
  const width = container.clientWidth - 40, height = 200;
  canvas.width = width; canvas.height = height;
  canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
  const values = data.map(d => d.wpm);
  const maxWpm = Math.max(...values, 50), minWpm = Math.min(...values, 0), range = maxWpm - minWpm || 1;
  const padL = 35, padR = 15, padT = 15, padB = 25, chartW = width - padL - padR, chartH = height - padT - padB;
  ctx.beginPath(); ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) { const y = padT + (chartH * i / 4); ctx.moveTo(padL, y); ctx.lineTo(width - padR, y); ctx.stroke(); ctx.fillStyle = '#6a6a8a'; ctx.font = '9px monospace'; ctx.textAlign = 'right'; ctx.fillText(Math.round(maxWpm - (range * i / 4)), padL - 5, y + 3); }
  if (data.length > 1) { ctx.beginPath(); ctx.strokeStyle = '#e2b714'; ctx.lineWidth = 2.5; data.forEach((p, i) => { const x = padL + (i / (data.length - 1)) * chartW; const y = padT + chartH - ((p.wpm - minWpm) / range) * chartH; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); }
  data.forEach((p, i) => { const x = padL + (i / (data.length - 1)) * chartW; const y = padT + chartH - ((p.wpm - minWpm) / range) * chartH; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = '#e2b714'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#0a0a0c'; ctx.fill(); });
  ctx.fillStyle = '#6a6a8a'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; const step = Math.ceil(data.length / 6);
  for (let i = 0; i < data.length; i += step) { const x = padL + (i / (data.length - 1)) * chartW; ctx.fillText(data[i].test, x, height - padB + 12); }
}

function drawWeeklyChart(canvasId, data) {
  const canvas = document.getElementById(canvasId); if (!canvas || !data || data.length === 0) return;
  const container = canvas.parentElement; const width = container.clientWidth - 40, height = 200;
  canvas.width = width; canvas.height = height; canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
  const maxWpm = Math.max(...data.map(d => d.wpm), 50); const barWidth = (width - 50) / data.length - 6;
  const colors = ['#e2b714', '#f0c830', '#d0a010', '#4ec9a0', '#7eb8f7', '#f06a6a', '#b89ef7'];
  data.forEach((item, i) => { const barH = (item.wpm / maxWpm) * (height - 50); const x = 30 + i * (barWidth + 6); const y = height - 25 - barH; ctx.fillStyle = item.wpm > 0 ? colors[i % colors.length] : '#2a2a3a'; ctx.fillRect(x, y, barWidth, barH); if (item.wpm > 0) { ctx.fillStyle = '#d0d0ea'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText(item.wpm, x + barWidth/2, y - 4); } ctx.fillStyle = '#6a6a8a'; ctx.font = '8px monospace'; ctx.fillText(item.day, x + barWidth/2, height - 10); });
}

function drawDistributionChart(canvasId, data) {
  const canvas = document.getElementById(canvasId); if (!canvas || !data || data.length === 0) return;
  const container = canvas.parentElement; const width = container.clientWidth - 40, height = 200;
  canvas.width = width; canvas.height = height; canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
  const total = data.reduce((a,b) => a + b.count, 0); if (total === 0) return;
  const maxCount = Math.max(...data.map(d => d.count), 1); const barWidth = (width - 50) / data.length - 4;
  const colors = ['#e2b714', '#f0c830', '#d0a010', '#4ec9a0', '#7eb8f7', '#f06a6a', '#b89ef7', '#88c0d0'];
  data.forEach((item, i) => { const barH = (item.count / maxCount) * (height - 50); const x = 30 + i * (barWidth + 4); const y = height - 25 - barH; ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(x, y, barWidth, barH); if (item.count > 0) { ctx.fillStyle = '#d0d0ea'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(item.count, x + barWidth/2, y - 3); } ctx.fillStyle = '#6a6a8a'; ctx.font = '7px monospace'; ctx.fillText(item.label, x + barWidth/2, height - 8); });
}

function drawAccuracyChart(canvasId, data) {
  const canvas = document.getElementById(canvasId); if (!canvas || !data || data.length === 0) return;
  const container = canvas.parentElement; const width = container.clientWidth - 40, height = 200;
  canvas.width = width; canvas.height = height; canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
  const values = data.map(d => d.acc); const maxAcc = 100; const minAcc = Math.min(...values, 80); const range = maxAcc - minAcc;
  const padL = 35, padR = 15, padT = 15, padB = 25, chartW = width - padL - padR, chartH = height - padT - padB;
  ctx.beginPath(); ctx.strokeStyle = '#2a2a3a';
  for (let i = 0; i <= 4; i++) { const y = padT + (chartH * i / 4); ctx.moveTo(padL, y); ctx.lineTo(width - padR, y); ctx.stroke(); ctx.fillStyle = '#6a6a8a'; ctx.font = '8px monospace'; ctx.textAlign = 'right'; ctx.fillText(Math.round(maxAcc - (range * i / 4)) + '%', padL - 5, y + 3); }
  if (data.length > 1) { ctx.beginPath(); ctx.strokeStyle = '#4ec9a0'; ctx.lineWidth = 2; data.forEach((p, i) => { const x = padL + (i / (data.length - 1)) * chartW; const y = padT + chartH - ((p.acc - minAcc) / range) * chartH; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); }
  ctx.beginPath(); data.forEach((p, i) => { const x = padL + (i / (data.length - 1)) * chartW; const y = padT + chartH - ((p.acc - minAcc) / range) * chartH; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.lineTo(padL + chartW, height - padB); ctx.lineTo(padL, height - padB); ctx.fillStyle = 'rgba(78, 201, 160, 0.1)'; ctx.fill();
  ctx.fillStyle = '#6a6a8a'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; const step = Math.ceil(data.length / 6);
  for (let i = 0; i < data.length; i += step) { const x = padL + (i / (data.length - 1)) * chartW; ctx.fillText(data[i].test, x, height - padB + 12); }
}

function loadStats() {
  const overlay = document.getElementById('statsOverlay');
  const content = document.getElementById('statsContent');
  if (!userHistory.length) { content.innerHTML = '<div style="text-align:center;padding:40px">Hali natijalar yoq</div>'; overlay.classList.add('open'); return; }
  const stats = getStatsData(); const weeklyData = getWeeklyStats(); const progression = getProgressionStats(); const distribution = getDistributionStats(); const rank = getRank(stats.bestWpm);
  content.innerHTML = `<div class="stats-container" style="padding:20px"><div style="display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,var(--accent-dim),transparent);padding:20px;border-radius:16px;margin-bottom:24px"><div><div style="font-size:2rem;font-weight:900;color:var(--accent)">${rank.name}</div><div style="color:var(--accent);font-size:1rem">${'★'.repeat(rank.stars)}${'☆'.repeat(5-rank.stars)}</div><div style="font-size:0.65rem;color:var(--text-dim)">${rank.next ? `Keyingi: ${rank.next} WPM` : 'Maksimal daraja!'}</div></div><div style="display:flex;gap:32px"><div><div style="font-size:2rem;font-weight:800;color:var(--accent)">${stats.bestWpm}</div><div style="font-size:0.6rem">Rekord</div></div><div><div style="font-size:2rem;font-weight:800;color:var(--accent)">${stats.avgWpm}</div><div style="font-size:0.6rem">Ortacha</div></div><div><div style="font-size:2rem;font-weight:800;color:var(--success)">${stats.avgAcc}%</div><div style="font-size:0.6rem">Aniqlik</div></div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px"><div style="background:var(--bg3);padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--info)">${stats.total}</div><div style="font-size:0.55rem">Testlar</div></div><div style="background:var(--bg3);padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--info)">${Math.floor(stats.totalTime/60)}m ${stats.totalTime%60}s</div><div style="font-size:0.55rem">Jami vaqt</div></div><div style="background:var(--bg3);padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--info)">${stats.totalWords}</div><div style="font-size:0.55rem">Sozlar</div></div><div style="background:var(--bg3);padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${stats.bestWpm}</div><div style="font-size:0.55rem">Peak</div></div></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:24px"><div style="background:var(--bg3);border-radius:12px;padding:16px"><div style="margin-bottom:12px"><div style="font-weight:700">WPM Progression</div></div><canvas id="progCanvas" style="width:100%;height:200px"></canvas></div><div style="background:var(--bg3);border-radius:12px;padding:16px"><div style="margin-bottom:12px"><div style="font-weight:700">Weekly Average</div></div><canvas id="weekCanvas" style="width:100%;height:200px"></canvas></div><div style="background:var(--bg3);border-radius:12px;padding:16px"><div style="margin-bottom:12px"><div style="font-weight:700">WPM Distribution</div></div><canvas id="distCanvas" style="width:100%;height:200px"></canvas></div><div style="background:var(--bg3);border-radius:12px;padding:16px"><div style="margin-bottom:12px"><div style="font-weight:700">Accuracy Trend</div></div><canvas id="accCanvas" style="width:100%;height:200px"></canvas></div></div><div style="background:var(--bg3);border-radius:12px;overflow:hidden"><div style="padding:16px;border-bottom:1px solid var(--border);font-weight:700">Songi testlar</div><div style="overflow-x:auto;max-height:300px;overflow-y:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)"><th style="padding:12px;text-align:left">#</th><th style="padding:12px;text-align:left">WPM</th><th style="padding:12px;text-align:left">Aniqlik</th><th style="padding:12px;text-align:left">Vaqt</th><th style="padding:12px;text-align:left">Sana</th></tr></thead><tbody>${userHistory.slice(0,20).map((h,i)=>`<tr style="border-top:1px solid var(--border)"><td style="padding:12px">${i+1}</td><td style="padding:12px;color:var(--accent);font-weight:800">${h.wpm}</td><td style="padding:12px;color:var(--success)">${h.acc}%</td><td style="padding:12px">${h.time}s</td><td style="padding:12px;font-size:0.6rem">${new Date(h.date).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  overlay.classList.add('open');
  setTimeout(() => { drawProgressionChart('progCanvas', progression); drawWeeklyChart('weekCanvas', weeklyData); drawDistributionChart('distCanvas', distribution); drawAccuracyChart('accCanvas', progression); }, 150);
}

function loadLeaderboard() {
  const list = document.getElementById('leaderboardList');
  const sorted = [...userHistory].sort((a, b) => b.wpm - a.wpm).slice(0, 30);
  if (!sorted.length) { list.innerHTML = '<div style="text-align:center;padding:40px">Hali natijalar yoq</div>'; return; }
  list.innerHTML = sorted.map((h, i) => `<div class="leaderboard-entry"><div class="leaderboard-rank ${i===0?'rank-gold':i===1?'rank-silver':i===2?'rank-bronze':''}">${i+1}</div><div class="leaderboard-name">${userName}</div><div class="leaderboard-wpm">${h.wpm}</div><div style="font-size:0.6rem;color:var(--text-dim)">${h.acc}%</div></div>`).join('');
  document.getElementById('leaderboardOverlay').classList.add('open');
}

// ============ SHARE ============
function showSharePreview(entry) {
  const now = new Date(); const dateStr = now.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' }); const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  const best = userHistory.length ? Math.max(...userHistory.map(h => h.wpm)) : entry.wpm; const rank = getRank(best); const avgWpm = userHistory.length > 1 ? Math.round(userHistory.reduce((a,b) => a + b.wpm, 0) / userHistory.length) : entry.wpm;
  document.getElementById('sharePreviewInner').innerHTML = `<div class="share-card-header"><div class="share-card-logo">mt</div><div class="share-card-brand">mr<span style="color:var(--accent)">type</span></div></div><div class="share-card-wpm">${entry.wpm}</div><div class="share-card-wpm-label">words per minute</div><div class="share-card-rank"><span class="share-card-rank-name">${rank.name}</span><span class="share-card-rank-stars">${'★'.repeat(rank.stars)}${'☆'.repeat(5 - rank.stars)}</span></div><div class="share-card-stats"><div class="share-card-stat"><div class="share-card-stat-value success">${entry.acc}%</div><div class="share-card-stat-label">Aniqlik</div></div><div class="share-card-stat"><div class="share-card-stat-value info">${entry.raw}</div><div class="share-card-stat-label">Raw WPM</div></div><div class="share-card-stat"><div class="share-card-stat-value">${entry.words}</div><div class="share-card-stat-label">So'zlar</div></div><div class="share-card-stat"><div class="share-card-stat-value accent">${avgWpm}</div><div class="share-card-stat-label">O'rtacha WPM</div></div></div><div class="share-card-divider"></div><div class="share-card-meta"><div class="share-card-meta-item"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="share-card-user">${userName}</span></div><div class="share-card-meta-item"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span class="share-card-date">${dateStr} · ${timeStr}</span></div></div><div class="share-card-footer"><div class="share-card-footer-logo">mt</div><span class="share-card-footer-text">© mrtype.uz · Barcha huquqlar himoyalangan</span></div>`;
  document.getElementById('shareOverlay').classList.add('open');
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

function saveShareAsImage() {
  const entryData = window._lastEntry; if (!entryData) return;
  const canvas = document.getElementById('shareCanvas'); const ctx = canvas.getContext('2d'); const w = 800, h = 600;
  canvas.width = w; canvas.height = h;
  const styles = getComputedStyle(document.body);
  const bgColor = styles.getPropertyValue('--bg').trim() || '#323437'; const bg2Color = styles.getPropertyValue('--bg2').trim() || '#2c2e31'; const accentColor = styles.getPropertyValue('--accent').trim() || '#e2b714'; const textColor = styles.getPropertyValue('--text').trim() || '#d1d0c5'; const textDimColor = styles.getPropertyValue('--text-dim').trim() || '#646669'; const borderColor = styles.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.04)'; const successColor = styles.getPropertyValue('--success').trim() || '#6ddf6d'; const infoColor = styles.getPropertyValue('--info').trim() || '#7eb8f7';
  ctx.fillStyle = bgColor; roundRect(ctx, 20, 20, w - 40, h - 40, 20); ctx.fill(); ctx.strokeStyle = borderColor; ctx.lineWidth = 2; roundRect(ctx, 20, 20, w - 40, h - 40, 20); ctx.stroke();
  ctx.fillStyle = accentColor; roundRect(ctx, 50, 50, 40, 40, 8); ctx.fill(); ctx.fillStyle = bgColor; ctx.font = 'bold 18px "JetBrains Mono"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('mt', 70, 70);
  ctx.fillStyle = textDimColor; ctx.font = 'bold 20px "JetBrains Mono"'; ctx.textAlign = 'left'; ctx.fillText('mr', 100, 70); ctx.fillStyle = accentColor; ctx.fillText('type', 130, 70);
  const wpm = entryData.wpm; ctx.fillStyle = accentColor; ctx.font = 'bold 120px "JetBrains Mono"'; ctx.textAlign = 'center'; ctx.fillText(wpm, w / 2, 200); ctx.fillStyle = textDimColor; ctx.font = '14px "JetBrains Mono"'; ctx.fillText('WORDS PER MINUTE', w / 2, 250);
  const rank = getRank(wpm); ctx.fillStyle = accentColor; ctx.font = 'bold 18px monospace'; ctx.fillText(rank.name + '  ' + '★'.repeat(rank.stars) + '☆'.repeat(5 - rank.stars), w / 2, 285);
  const statY = 320, statW = (w - 140) / 2, statH = 70, gap = 20;
  const statsList = [{ value: entryData.acc + '%', label: 'Aniqlik', color: successColor }, { value: entryData.raw, label: 'Raw WPM', color: infoColor }, { value: entryData.words, label: 'So\'zlar', color: textColor }, { value: Math.round(userHistory.reduce((a,b) => a + b.wpm, 0) / (userHistory.length || 1)), label: 'O\'rtacha WPM', color: accentColor }];
  statsList.forEach((stat, i) => { const col = i % 2, row = Math.floor(i / 2); const x = 60 + col * (statW + gap), y = statY + row * (statH + gap); ctx.fillStyle = bg2Color; roundRect(ctx, x, y, statW, statH, 12); ctx.fill(); ctx.fillStyle = stat.color; ctx.font = 'bold 26px "JetBrains Mono"'; ctx.textAlign = 'center'; ctx.fillText(stat.value, x + statW / 2, y + statH / 2 - 8); ctx.fillStyle = textDimColor; ctx.font = '11px monospace'; ctx.fillText(stat.label, x + statW / 2, y + statH / 2 + 18); });
  const dividerY = statY + 2 * (statH + gap) + 20; ctx.strokeStyle = borderColor; ctx.beginPath(); ctx.moveTo(60, dividerY); ctx.lineTo(w - 60, dividerY); ctx.stroke();
  const metaY = dividerY + 30; const now = new Date(); const dateStr = now.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' }); const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = accentColor; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.fillText('Qosimov Muhammadrasul', 65, metaY); ctx.fillStyle = textDimColor; ctx.font = '12px monospace'; ctx.textAlign = 'right'; ctx.fillText(dateStr + ' · ' + timeStr, w - 65, metaY);
  ctx.fillStyle = accentColor; roundRect(ctx, 60, h - 80, 22, 22, 5); ctx.fill(); ctx.fillStyle = bgColor; ctx.font = 'bold 10px "JetBrains Mono"'; ctx.textAlign = 'center'; ctx.fillText('mt', 71, h - 69); ctx.fillStyle = textDimColor; ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.fillText('© mrtype.uz', 90, h - 69);
  const a = document.createElement('a'); a.download = `mrtype_${wpm}wpm.png`; a.href = canvas.toDataURL('image/png'); a.click(); document.getElementById('shareOverlay').classList.remove('open');
}

function shareResult() { const entry = window._lastEntry; if (!entry) return; document.getElementById('resultOverlay').classList.remove('open'); showSharePreview(entry); }
function changeSound() { const sounds = ['blue', 'brown', 'red', 'creamy', 'thock']; const idx = (sounds.indexOf(currentSound) + 1) % sounds.length; currentSound = sounds[idx]; const names = {blue:'Blue Switch',brown:'Brown Switch',red:'Red Switch',creamy:'Creamy',thock:'Thock'}; dom.soundName.textContent = names[currentSound]; }
function focusInput() { dom.hiddenInput.focus(); dom.typingArea.classList.remove('blurred'); }

function renderSubOptions() {
  dom.subOptions.innerHTML = '';
  if (settings.mode === 'time') {
    [15,30,60,120].forEach(t => { const b = document.createElement('button'); b.className = 'sub-opt' + (settings.duration === t ? ' active' : ''); b.textContent = t + 's'; b.onclick = () => { settings.duration = t; renderSubOptions(); fullResetWithNewWords(); }; dom.subOptions.appendChild(b); });
  } else if (settings.mode === 'words') {
    [25,50,100,200].forEach(w => { const b = document.createElement('button'); b.className = 'sub-opt' + (settings.wordsGoal === w ? ' active' : ''); b.textContent = w + " soz"; b.onclick = () => { settings.wordsGoal = w; renderSubOptions(); fullResetWithNewWords(); }; dom.subOptions.appendChild(b); });
  } else if (settings.mode === 'quote') {
    const b = document.createElement('button'); b.className = 'sub-opt active'; b.textContent = 'Yangi iqtibos'; b.onclick = () => fullResetWithNewWords(); dom.subOptions.appendChild(b);
  } else if (settings.mode === 'dev') {
    const b = document.createElement('button'); b.className = 'sub-opt active'; b.textContent = 'Dasturlash'; dom.subOptions.appendChild(b);
  } else if (settings.mode === 'custom') {
    const info = document.createElement('div'); info.style.cssText = 'color:var(--text-dim);font-size:0.6rem'; info.textContent = '✍️ Erkin yozish - Enter bilan yakunlang'; dom.subOptions.appendChild(info);
  }
}

function toggleZenMode() { settings.zenMode = document.getElementById('zenMode').checked; document.body.classList.toggle('zen-mode', settings.zenMode); }

// ============ INIT ============
try { const saved = localStorage.getItem('mrtype_history'); if (saved) userHistory = JSON.parse(saved); } catch(e) { userHistory = []; }
updateRankBadge();

document.querySelectorAll('.mode-tab').forEach(tab => { tab.addEventListener('click', () => { document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); settings.mode = tab.dataset.mode; renderSubOptions(); fullResetWithNewWords(); }); });

document.addEventListener('keydown', (e) => {
  const overlays = ['resultOverlay', 'settingsOverlay', 'leaderboardOverlay', 'statsOverlay', 'duelOverlay', 'shareOverlay'];
  if (overlays.some(id => document.getElementById(id)?.classList.contains('open'))) { if (e.key === 'Escape') { overlays.forEach(id => document.getElementById(id)?.classList.remove('open')); focusInput(); } return; }
  if (e.key === 'Tab') { e.preventDefault(); sameWordsRestart(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); fullResetWithNewWords(); return; }
  // CUSTOM MODE - Enter bilan yakunlash
  if (settings.mode === 'custom' && e.key === 'Enter' && gameState.isRunning) { e.preventDefault(); gameState.wordsCompleted = 1; finishGame(); return; }
  const ignore = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (ignore.includes(e.key) || e.ctrlKey || e.altKey) return;
  e.preventDefault(); highlightKey(e.key.toLowerCase(), 'press');
  if (e.key === 'Backspace') handleBackspace();
  else if (e.key === ' ') handleSpace();
  else if (e.key.length === 1) handleChar(e.key);
});

document.addEventListener('keyup', (e) => highlightKey(e.key.toLowerCase(), null));
dom.typingArea.addEventListener('click', focusInput);
dom.hiddenInput.addEventListener('blur', () => dom.typingArea.classList.add('blurred'));
dom.hiddenInput.addEventListener('focus', () => dom.typingArea.classList.remove('blurred'));

// Buttons
document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsOverlay').classList.add('open');
document.getElementById('settingsClose').onclick = () => { document.getElementById('settingsOverlay').classList.remove('open'); focusInput(); };
document.getElementById('leaderboardBtn').onclick = () => loadLeaderboard();
document.getElementById('leaderboardClose').onclick = () => { document.getElementById('leaderboardOverlay').classList.remove('open'); focusInput(); };
document.getElementById('statsBtn').onclick = () => loadStats();
document.getElementById('statsCloseBtn').onclick = () => { document.getElementById('statsOverlay').classList.remove('open'); focusInput(); };
document.getElementById('duelBtn').onclick = () => { document.getElementById('duelContent').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">⚔️ Duel mode ishlab chiqilmoqda...</div>'; document.getElementById('duelOverlay').classList.add('open'); };
document.getElementById('duelClose').onclick = () => { document.getElementById('duelOverlay').classList.remove('open'); focusInput(); };
document.getElementById('shareResultBtn').onclick = () => shareResult();
document.getElementById('sharePreviewClose').onclick = () => { document.getElementById('shareOverlay').classList.remove('open'); focusInput(); };
document.getElementById('shareCancelBtn').onclick = () => { document.getElementById('shareOverlay').classList.remove('open'); focusInput(); };
document.getElementById('shareSaveBtn').onclick = () => saveShareAsImage();
document.getElementById('newWordsBtn').onclick = () => { document.getElementById('resultOverlay').classList.remove('open'); fullResetWithNewWords(); };
document.getElementById('restartResultBtn').onclick = () => { document.getElementById('resultOverlay').classList.remove('open'); sameWordsRestart(); };
document.getElementById('soundBtn').onclick = () => changeSound();

['settingsOverlay', 'leaderboardOverlay', 'statsOverlay', 'resultOverlay', 'duelOverlay', 'shareOverlay'].forEach(id => { document.getElementById(id).addEventListener('click', function(e) { if (e.target === this) { this.classList.remove('open'); focusInput(); } }); });
document.querySelectorAll('#langOptions .settings-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('#langOptions .settings-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); settings.lang = btn.dataset.lang; fullResetWithNewWords(); }; });
document.querySelectorAll('#fontSizeOptions .settings-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('#fontSizeOptions .settings-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); settings.fontSize = btn.dataset.fs; settings.fontHeight = btn.dataset.fh; document.documentElement.style.setProperty('--fs-base', settings.fontSize); document.documentElement.style.setProperty('--lh-base', settings.fontHeight); renderWords(); }; });
document.querySelectorAll('#themeGrid .theme-swatch').forEach(sw => { sw.onclick = () => { document.querySelectorAll('#themeGrid .theme-swatch').forEach(s => s.classList.remove('active')); sw.classList.add('active'); settings.theme = sw.dataset.theme; document.body.setAttribute('data-theme', settings.theme); }; });
document.getElementById('showKeyboard').onchange = (e) => { settings.showKeyboard = e.target.checked; dom.keyboardSection.style.display = settings.showKeyboard ? 'flex' : 'none'; };
document.getElementById('soundEnabled').onchange = (e) => { settings.soundEnabled = e.target.checked; };
document.getElementById('smoothCaret').onchange = (e) => { settings.smoothCaret = e.target.checked; if(settings.smoothCaret) dom.caret.classList.add('smooth'); else dom.caret.classList.remove('smooth'); };
document.getElementById('zenMode').onchange = () => { toggleZenMode(); };

// ============ AUTO ZEN MODE ============
let zenTimeout = null; let autoZenEnabled = false;
function activateAutoZen() {
  if (!settings.zenMode && autoZenEnabled) { settings.zenMode = true; document.getElementById('zenMode').checked = true; const hideSelectors = ['.header', '.mode-tabs', '.sub-options', '.stats-bar', '.sound-selector', '.rank-badge', '.shortcuts-hint']; hideSelectors.forEach(selector => { document.querySelectorAll(selector).forEach(el => { el.style.transition = 'opacity 0.5s ease, visibility 0.5s ease'; el.style.opacity = '0'; el.style.visibility = 'hidden'; }); }); const keyboardSection = document.querySelector('.keyboard-section'); if (keyboardSection) { const isKeyboardVisible = keyboardSection.style.display === 'flex' || getComputedStyle(keyboardSection).display === 'flex'; if (isKeyboardVisible) { keyboardSection.style.transition = 'none'; keyboardSection.style.opacity = '1'; keyboardSection.style.visibility = 'visible'; } else { keyboardSection.style.transition = 'opacity 0.5s ease, visibility 0.5s ease'; keyboardSection.style.opacity = '0'; keyboardSection.style.visibility = 'hidden'; } } setTimeout(() => { document.body.classList.add('zen-mode'); }, 500); }
}
function deactivateAutoZen() {
  if (settings.zenMode) { settings.zenMode = false; document.getElementById('zenMode').checked = false; document.body.classList.remove('zen-mode'); const showSelectors = ['.header', '.mode-tabs', '.sub-options', '.stats-bar', '.sound-selector', '.rank-badge', '.shortcuts-hint', '.keyboard-section']; showSelectors.forEach(selector => { document.querySelectorAll(selector).forEach(el => { el.style.transition = 'opacity 0.5s ease, visibility 0.5s ease'; el.style.opacity = '1'; el.style.visibility = 'visible'; }); }); }
  autoZenEnabled = false; clearTimeout(zenTimeout); zenTimeout = setTimeout(() => { autoZenEnabled = true; }, 3000);
}
document.addEventListener('keydown', (e) => { const overlays = ['resultOverlay', 'settingsOverlay', 'leaderboardOverlay', 'statsOverlay', 'duelOverlay', 'shareOverlay']; const anyOverlayOpen = overlays.some(id => document.getElementById(id)?.classList.contains('open')); if (!anyOverlayOpen && autoZenEnabled && !settings.zenMode) { const ignore = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'Tab', 'Backspace']; if (!ignore.includes(e.key) && e.key.length === 1) { activateAutoZen(); } } });
document.addEventListener('mousemove', (e) => { if (e.movementX !== 0 || e.movementY !== 0) { if (settings.zenMode) deactivateAutoZen(); } });
document.addEventListener('click', (e) => { if (settings.zenMode && !e.target.closest('.typing-area') && !e.target.closest('.typing-wrapper')) deactivateAutoZen(); });
document.addEventListener('wheel', () => { if (settings.zenMode) deactivateAutoZen(); });
document.addEventListener('touchstart', (e) => { if (settings.zenMode && !e.target.closest('.typing-area') && !e.target.closest('.typing-wrapper')) deactivateAutoZen(); });
setTimeout(() => { autoZenEnabled = true; }, 1000);
const zenObserver = new MutationObserver(() => { if (!document.body.classList.contains('zen-mode') && settings.zenMode) { settings.zenMode = false; document.getElementById('zenMode').checked = false; } });
zenObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

// Start
fullResetWithNewWords(); renderSubOptions(); focusInput();
document.documentElement.style.setProperty('--fs-base', settings.fontSize); document.documentElement.style.setProperty('--lh-base', settings.fontHeight);
dom.keyboardSection.style.display = settings.showKeyboard ? 'flex' : 'none'; document.body.setAttribute('data-theme', settings.theme);
if(settings.smoothCaret) dom.caret.classList.add('smooth');
console.log('MR TYPE - Professional Typing Trainer');
