// script.js - MR TYPE Full Professional Version

let audioCtx = null;
let currentSound = 'blue';
let currentDuelId = null;
let duelInterval = null;
let zenModeTimeout = null;

let gameState = {
  words: [],
  wordStatus: [],
  wordTyped: [],
  curWord: 0,
  typedBuf: '',
  extraChars: [],
  isRunning: false,
  isFinished: false,
  startTime: 0,
  totalKeys: 0,
  correctKeys: 0,
  wrongKeys: 0,
  wordsCompleted: 0,
  wordsCorrect: 0,
  timerInt: null,
  lastCharTime: 0,
  keyIntervals: [],
  statsHistory: [],
  lastSecond: -1,
  errorMap: {}
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
let userName = 'Guest';

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

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function playSound(type) {
  if (!settings.soundEnabled) return;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
  }
  const sound = SOUNDS[currentSound];
  if (!sound) return;
  const freq = type === 'correct' ? sound.freq : sound.errFreq;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = sound.type;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + sound.dur);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + sound.dur);
  } catch (e) {
    console.warn('Audio error:', e);
  }
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
  const stars = '★'.repeat(rank.stars) + '☆'.repeat(5 - rank.stars);
  dom.rankStars.textContent = stars;
  dom.rankNext.textContent = rank.next ? `Keyingi: ${rank.next} WPM` : 'Maksimal daraja';
}

function addToHistory(entry) {
  userHistory.unshift(entry);
  if (userHistory.length > 300) userHistory.length = 300;
  localStorage.setItem('mrtype_history', JSON.stringify(userHistory));
  updateRankBadge();
  if (window.mrStatistics) {
    window.mrStatistics.history = userHistory;
  }
}

function loadHistory() {
  try {
    userHistory = JSON.parse(localStorage.getItem('mrtype_history') || '[]');
  } catch {
    userHistory = [];
  }
  updateRankBadge();
  if (window.mrStatistics) {
    window.mrStatistics.history = userHistory;
  }
}

function generateWords() {
  if (settings.mode === 'quote') return [];
  if (settings.mode === 'dev') return [...DEV_WORDS];
  const pool = WORD_POOLS[settings.lang] || WORD_POOLS.en;
  const needed = settings.mode === 'words' ? settings.wordsGoal + 50 : 200;
  return Array.from({ length: needed }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function generateQuote() {
  const pool = QUOTES[settings.lang] || QUOTES.en;
  const quote = pool[Math.floor(Math.random() * pool.length)];
  return quote.split(' ');
}

function initGame() {
  if (settings.mode === 'quote') {
    gameState.words = generateQuote();
  } else {
    gameState.words = generateWords();
  }
  
  gameState.wordStatus = gameState.words.map(() => 'pending');
  gameState.wordTyped = gameState.words.map(() => '');
  gameState.curWord = 0;
  gameState.typedBuf = '';
  gameState.extraChars = [];
  gameState.isRunning = false;
  gameState.isFinished = false;
  gameState.totalKeys = 0;
  gameState.correctKeys = 0;
  gameState.wrongKeys = 0;
  gameState.wordsCompleted = 0;
  gameState.wordsCorrect = 0;
  gameState.keyIntervals = [];
  gameState.statsHistory = [];
  gameState.lastSecond = -1;
  gameState.errorMap = {};
  
  renderWords();
  updateStatsDisplay();
}

function renderWords() {
  dom.wordsContainer.innerHTML = '';
  
  for (let wi = 0; wi < gameState.words.length; wi++) {
    const word = gameState.words[wi];
    if (!word) continue;
    
    const wordEl = document.createElement('span');
    wordEl.className = 'word';
    if (wi === gameState.curWord) {
      wordEl.classList.add('current-word');
    }
    wordEl.id = `w${wi}`;

    if (wi < gameState.curWord) {
      const typed = gameState.wordTyped[wi] || '';
      const maxLen = Math.max(word.length, typed.length);
      for (let ci = 0; ci < maxLen; ci++) {
        const ch = document.createElement('span');
        ch.className = 'char';
        if (ci < word.length && ci < typed.length) {
          ch.textContent = word[ci];
          ch.classList.add(typed[ci] === word[ci] ? 'correct' : 'incorrect');
        } else if (ci < word.length) {
          ch.textContent = word[ci];
          ch.classList.add('incorrect');
        } else {
          ch.textContent = typed[ci];
          ch.classList.add('extra');
        }
        ch.style.fontSize = settings.fontSize;
        ch.style.height = settings.fontHeight;
        wordEl.appendChild(ch);
      }
    } else if (wi === gameState.curWord) {
      for (let ci = 0; ci < word.length; ci++) {
        const ch = document.createElement('span');
        ch.className = 'char';
        ch.id = `c${wi}-${ci}`;
        ch.textContent = word[ci];
        ch.style.fontSize = settings.fontSize;
        ch.style.height = settings.fontHeight;
        if (ci < gameState.typedBuf.length) {
          ch.classList.add(gameState.typedBuf[ci] === word[ci] ? 'correct' : 'incorrect');
        } else {
          ch.classList.add('pending');
        }
        wordEl.appendChild(ch);
      }
      for (let ei = 0; ei < gameState.extraChars.length; ei++) {
        const ch = document.createElement('span');
        ch.className = 'char extra';
        ch.textContent = gameState.extraChars[ei];
        ch.style.fontSize = settings.fontSize;
        ch.style.height = settings.fontHeight;
        wordEl.appendChild(ch);
      }
    } else {
      for (let ci = 0; ci < word.length; ci++) {
        const ch = document.createElement('span');
        ch.className = 'char pending';
        ch.textContent = word[ci];
        ch.style.fontSize = settings.fontSize;
        ch.style.height = settings.fontHeight;
        wordEl.appendChild(ch);
      }
    }
    dom.wordsContainer.appendChild(wordEl);
  }
  
  updateCaret();
  autoScroll();
}

function updateCaret() {
  const word = gameState.words[gameState.curWord];
  if (!word) {
    dom.caret.style.opacity = '0';
    return;
  }
  
  const afterWord = gameState.typedBuf.length >= word.length;
  let target = null;
  
  if (!afterWord) {
    target = document.getElementById(`c${gameState.curWord}-${gameState.typedBuf.length}`);
  } else {
    const wordEl = document.getElementById(`w${gameState.curWord}`);
    if (wordEl) {
      const chars = wordEl.querySelectorAll('.char');
      target = chars[chars.length - 1];
    }
  }
  
  if (!target) {
    dom.caret.style.opacity = '0';
    return;
  }
  
  const rect = target.getBoundingClientRect();
  const areaRect = dom.typingArea.getBoundingClientRect();
  const left = rect.left - areaRect.left + dom.typingArea.scrollLeft;
  const top = rect.top - areaRect.top + dom.typingArea.scrollTop;
  const caretX = afterWord ? left + rect.width : left;
  
  dom.caret.style.opacity = '1';
  dom.caret.style.left = caretX + 'px';
  dom.caret.style.top = top + 'px';
  dom.caret.style.height = settings.fontHeight;
}

function autoScroll() {
  const currentWord = document.getElementById(`w${gameState.curWord}`);
  if (!currentWord) return;
  
  const container = dom.typingArea;
  const wordRect = currentWord.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const containerCenter = containerRect.left + containerRect.width / 2;
  const wordCenter = wordRect.left + wordRect.width / 2;
  const scrollOffset = wordCenter - containerCenter;
  
  if (Math.abs(scrollOffset) > 10) {
    container.scrollBy({
      left: scrollOffset,
      behavior: 'smooth'
    });
  }
}

function updateStatsDisplay() {
  let wpm = 0;
  if (gameState.isRunning) {
    const elapsed = (Date.now() - gameState.startTime) / 60000;
    wpm = elapsed > 0 ? Math.round((gameState.correctKeys / 5) / elapsed) : 0;
  }
  
  const acc = gameState.totalKeys === 0 ? 100 : Math.round((gameState.correctKeys / gameState.totalKeys) * 100);
  
  dom.liveWpm.textContent = wpm;
  dom.liveAcc.textContent = acc + '%';

  if (settings.mode === 'time') {
    if (gameState.isRunning) {
      const elapsed = (Date.now() - gameState.startTime) / 1000;
      const left = Math.max(0, settings.duration - Math.floor(elapsed));
      dom.liveTimer.textContent = left;
      dom.timerLabel.textContent = 'Soniya';
      const pct = ((settings.duration - left) / settings.duration) * 100;
      dom.progressFill.style.width = pct + '%';
      dom.progressPercent.textContent = Math.round(pct) + '%';
      if (left <= 0 && gameState.isRunning) finishGame();
    } else {
      dom.liveTimer.textContent = settings.duration;
    }
  } else if (settings.mode === 'words') {
    dom.liveTimer.textContent = `${gameState.curWord}/${settings.wordsGoal}`;
    dom.timerLabel.textContent = 'Soz';
    const pct = (gameState.curWord / settings.wordsGoal) * 100;
    dom.progressFill.style.width = pct + '%';
    dom.progressPercent.textContent = Math.round(pct) + '%';
    if (gameState.curWord >= settings.wordsGoal && gameState.isRunning) finishGame();
  } else if (settings.mode === 'quote') {
    dom.liveTimer.textContent = `${gameState.curWord}/${gameState.words.length}`;
    dom.timerLabel.textContent = 'Soz';
    const pct = (gameState.curWord / gameState.words.length) * 100;
    dom.progressFill.style.width = pct + '%';
    dom.progressPercent.textContent = Math.round(pct) + '%';
    if (gameState.curWord >= gameState.words.length && gameState.isRunning) finishGame();
  } else {
    if (gameState.isRunning) {
      const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
      dom.liveTimer.textContent = elapsed + 's';
      dom.timerLabel.textContent = "Otgan";
    } else {
      dom.liveTimer.textContent = '0s';
    }
  }

  const total = settings.mode === 'words' ? settings.wordsGoal :
                settings.mode === 'quote' ? gameState.words.length : '∞';
  dom.liveWords.textContent = `${gameState.wordsCompleted}/${total}`;
  
  if (gameState.isRunning && gameState.lastSecond < Math.floor((Date.now() - gameState.startTime) / 1000)) {
    gameState.lastSecond = Math.floor((Date.now() - gameState.startTime) / 1000);
    gameState.statsHistory.push({
      second: gameState.lastSecond,
      wpm: wpm,
      acc: acc,
      errors: gameState.wrongKeys
    });
  }
}

function startGame() {
  if (gameState.isRunning || gameState.isFinished) return;
  
  gameState.isRunning = true;
  gameState.startTime = Date.now();
  gameState.lastCharTime = Date.now();
  gameState.lastSecond = -1;
  
  gameState.timerInt = setInterval(() => {
    updateStatsDisplay();
    if (settings.mode === 'time' && gameState.isRunning) {
      if (Date.now() - gameState.startTime >= settings.duration * 1000) finishGame();
    }
  }, 50);
  
  dom.caret.classList.remove('blink');
  dom.caret.classList.add('typing');
  if (settings.smoothCaret) dom.caret.classList.add('smooth');
}

function finishGame() {
  if (gameState.isFinished) return;
  
  gameState.isFinished = true;
  gameState.isRunning = false;
  clearInterval(gameState.timerInt);
  
  const elapsed = Date.now() - gameState.startTime;
  const netWpm = elapsed > 0 ? Math.round((gameState.correctKeys / 5) / (elapsed / 60000)) : 0;
  const rawWpm = elapsed > 0 ? Math.round((gameState.totalKeys / 5) / (elapsed / 60000)) : 0;
  const acc = gameState.totalKeys === 0 ? 100 : Math.round((gameState.correctKeys / gameState.totalKeys) * 100);
  const consistency = gameState.keyIntervals.length > 5 ? 85 : 95;
  const peak = gameState.statsHistory.length ? Math.max(...gameState.statsHistory.map(s => s.wpm)) : netWpm;
  
  const entry = {
    wpm: netWpm,
    raw: rawWpm,
    acc: acc,
    consistency: consistency,
    peak: peak,
    words: gameState.wordsCompleted,
    time: Math.round(elapsed / 1000),
    mode: settings.mode,
    lang: settings.lang,
    date: new Date().toISOString(),
    errors: gameState.errorMap
  };
  
  addToHistory(entry);
  showResultModal(entry);
  playSound('correct');
}

function restartGame(newWords = false) {
  clearInterval(gameState.timerInt);
  
  if (newWords) {
    initGame();
  } else {
    gameState.curWord = 0;
    gameState.typedBuf = '';
    gameState.extraChars = [];
    gameState.isRunning = false;
    gameState.isFinished = false;
    gameState.totalKeys = 0;
    gameState.correctKeys = 0;
    gameState.wrongKeys = 0;
    gameState.wordsCompleted = 0;
    gameState.wordsCorrect = 0;
    gameState.keyIntervals = [];
    gameState.statsHistory = [];
    gameState.lastSecond = -1;
    gameState.wordStatus = gameState.words.map(() => 'pending');
    gameState.wordTyped = gameState.words.map(() => '');
    renderWords();
  }
  
  updateStatsDisplay();
  dom.hiddenInput.value = '';
  dom.typingArea.classList.remove('blurred');
  dom.hiddenInput.focus();
  dom.caret.classList.remove('typing');
  dom.caret.classList.add('blink');
  if (settings.smoothCaret) dom.caret.classList.add('smooth');
  document.getElementById('resultOverlay').classList.remove('open');
}

function handleChar(char) {
  if (gameState.isFinished) return;
  if (!gameState.isRunning) startGame();

  const word = gameState.words[gameState.curWord];
  if (!word) return;

  const now = Date.now();
  if (gameState.lastCharTime > 0) {
    const interval = now - gameState.lastCharTime;
    if (interval < 1000) gameState.keyIntervals.push(interval);
  }
  gameState.lastCharTime = now;
  gameState.totalKeys++;

  if (gameState.typedBuf.length < word.length) {
    const expected = word[gameState.typedBuf.length];
    if (char === expected) {
      gameState.correctKeys++;
      gameState.typedBuf += char;
      playSound('correct');
      highlightKey(char, 'correct');
    } else {
      gameState.wrongKeys++;
      gameState.errorMap[char] = (gameState.errorMap[char] || 0) + 1;
      playSound('error');
      gameState.typedBuf += char;
      highlightKey(char, 'error');
      dom.typingArea.style.background = 'var(--error-dim)';
      setTimeout(() => { dom.typingArea.style.background = ''; }, 150);
    }
  } else {
    if (gameState.extraChars.length < 10) {
      gameState.extraChars.push(char);
      gameState.wrongKeys++;
      playSound('error');
      highlightKey(char, 'error');
    }
  }
  
  renderWords();
  updateStatsDisplay();
}

function handleBackspace() {
  if (gameState.isFinished) return;
  
  if (gameState.extraChars.length > 0) {
    gameState.extraChars.pop();
    renderWords();
    return;
  }
  
  if (gameState.typedBuf.length > 0) {
    gameState.typedBuf = gameState.typedBuf.slice(0, -1);
    renderWords();
    return;
  }
  
  if (gameState.curWord > 0 && gameState.wordStatus[gameState.curWord - 1] === 'incorrect') {
    gameState.curWord--;
    gameState.typedBuf = gameState.wordTyped[gameState.curWord];
    gameState.wordStatus[gameState.curWord] = 'pending';
    gameState.wordTyped[gameState.curWord] = '';
    gameState.wordsCompleted = Math.max(0, gameState.wordsCompleted - 1);
    renderWords();
  }
}

function handleSpace() {
  if (gameState.isFinished) return;
  if (!gameState.isRunning) { startGame(); return; }

  const word = gameState.words[gameState.curWord];
  if (!word || gameState.typedBuf.length === 0) return;

  const typed = gameState.typedBuf + gameState.extraChars.join('');
  const isCorrect = typed === word && gameState.extraChars.length === 0;

  if (isCorrect) {
    gameState.correctKeys++;
    gameState.wordStatus[gameState.curWord] = 'correct';
    gameState.wordsCorrect++;
  } else {
    gameState.wordStatus[gameState.curWord] = 'incorrect';
  }

  gameState.wordTyped[gameState.curWord] = typed;
  gameState.wordsCompleted++;
  gameState.curWord++;
  gameState.typedBuf = '';
  gameState.extraChars = [];

  renderWords();
  updateStatsDisplay();

  if (settings.mode === 'words' && gameState.curWord >= settings.wordsGoal) finishGame();
  if (settings.mode === 'quote' && gameState.curWord >= gameState.words.length) finishGame();
}

function highlightKey(key, status) {
  const keyEl = document.querySelector(`.key[data-key="${key}"]`);
  if (!keyEl) return;
  
  keyEl.classList.remove('pressed', 'pressed-correct', 'pressed-error');
  
  if (status === 'press') {
    keyEl.classList.add('pressed');
  } else if (status === 'correct') {
    keyEl.classList.add('pressed-correct');
  } else if (status === 'error') {
    keyEl.classList.add('pressed-error');
  }
  
  setTimeout(() => {
    keyEl.classList.remove('pressed', 'pressed-correct', 'pressed-error');
  }, 100);
}

function renderSubOptions() {
  dom.subOptions.innerHTML = '';
  
  if (settings.mode === 'time') {
    [15, 30, 60, 120].forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'sub-opt' + (settings.duration === t ? ' active' : '');
      btn.textContent = t + 's';
      btn.onclick = () => {
        settings.duration = t;
        renderSubOptions();
        restartGame(true);
      };
      dom.subOptions.appendChild(btn);
    });
  } else if (settings.mode === 'words') {
    [25, 50, 100, 200].forEach(w => {
      const btn = document.createElement('button');
      btn.className = 'sub-opt' + (settings.wordsGoal === w ? ' active' : '');
      btn.textContent = w + " soz";
      btn.onclick = () => {
        settings.wordsGoal = w;
        renderSubOptions();
        restartGame(true);
      };
      dom.subOptions.appendChild(btn);
    });
  } else if (settings.mode === 'quote') {
    const btn = document.createElement('button');
    btn.className = 'sub-opt active';
    btn.textContent = 'Yangi iqtibos';
    btn.onclick = () => restartGame(true);
    dom.subOptions.appendChild(btn);
  } else if (settings.mode === 'dev') {
    const btn = document.createElement('button');
    btn.className = 'sub-opt active';
    btn.textContent = 'Dasturlash terminallari';
    dom.subOptions.appendChild(btn);
  } else if (settings.mode === 'custom') {
    const btn = document.createElement('button');
    btn.className = 'sub-opt active';
    btn.textContent = 'Oz matningizni yozing';
    btn.onclick = () => {
      const text = prompt('Matnni kiriting (Enter tugmasini bosib tugatasiz):');
      if (text) {
        gameState.words = text.split(' ');
        gameState.wordStatus = gameState.words.map(() => 'pending');
        gameState.wordTyped = gameState.words.map(() => '');
        gameState.curWord = 0;
        gameState.typedBuf = '';
        gameState.extraChars = [];
        renderWords();
        dom.hiddenInput.focus();
      }
    };
    dom.subOptions.appendChild(btn);
  }
}

function showResultModal(entry) {
  document.getElementById('resultWpm').textContent = entry.wpm;
  
  const statsHtml = `
    <div class="result-stat-card">
      <div class="result-stat-value" style="color:var(--success)">${entry.acc}%</div>
      <div class="result-stat-label">Aniqlik</div>
    </div>
    <div class="result-stat-card">
      <div class="result-stat-value" style="color:var(--accent)">${entry.peak}</div>
      <div class="result-stat-label">Eng yuqori</div>
    </div>
    <div class="result-stat-card">
      <div class="result-stat-value" style="color:var(--info)">${entry.consistency}%</div>
      <div class="result-stat-label">Barqarorlik</div>
    </div>
    <div class="result-stat-card">
      <div class="result-stat-value">${entry.raw}</div>
      <div class="result-stat-label">Raw WPM</div>
    </div>
    <div class="result-stat-card">
      <div class="result-stat-value">${entry.words}</div>
      <div class="result-stat-label">Sozlar</div>
    </div>
    <div class="result-stat-card">
      <div class="result-stat-value">${entry.time}s</div>
      <div class="result-stat-label">Vaqt</div>
    </div>
  `;
  
  document.getElementById('resultStats').innerHTML = statsHtml;
  document.getElementById('resultOverlay').classList.add('open');
}

function loadLeaderboard() {
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '<div style="text-align:center;padding:20px">Yuklanmoqda...</div>';
  
  const history = userHistory.slice(0, 50).sort((a, b) => b.wpm - a.wpm);
  
  if (!history.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px">Hali natijalar yoq</div>';
    return;
  }
  
  list.innerHTML = '';
  history.forEach((h, i) => {
    const entry = document.createElement('div');
    entry.className = 'leaderboard-entry';
    
    let rankClass = '';
    if (i === 0) rankClass = 'rank-gold';
    else if (i === 1) rankClass = 'rank-silver';
    else if (i === 2) rankClass = 'rank-bronze';
    
    entry.innerHTML = `
      <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
      <div class="leaderboard-name">${userName}</div>
      <div class="leaderboard-wpm">${h.wpm}</div>
      <div style="font-size:0.6rem;color:var(--text-muted)">${h.acc}%</div>
    `;
    list.appendChild(entry);
  });
}

function loadStats() {
  const content = document.getElementById('statsContent');
  
  if (!userHistory.length) {
    content.innerHTML = '<div style="text-align:center;padding:40px">Hali natijalar yoq</div>';
    return;
  }
  
  const total = userHistory.length;
  const best = Math.max(...userHistory.map(h => h.wpm));
  const avg = Math.round(userHistory.reduce((a, b) => a + b.wpm, 0) / total);
  const avgAcc = Math.round(userHistory.reduce((a, b) => a + b.acc, 0) / total);
  const totalTime = userHistory.reduce((a, b) => a + b.time, 0);
  
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
      <div style="background:var(--bg-tertiary);padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--accent)">${total}</div>
        <div style="font-size:0.55rem;color:var(--text-muted)">Testlar</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--accent)">${best}</div>
        <div style="font-size:0.55rem;color:var(--text-muted)">Rekord WPM</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--accent)">${avg}</div>
        <div style="font-size:0.55rem;color:var(--text-muted)">Ortacha WPM</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--success)">${avgAcc}%</div>
        <div style="font-size:0.55rem;color:var(--text-muted)">Ortacha aniqlik</div>
      </div>
      <div style="background:var(--bg-tertiary);padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--info)">${Math.floor(totalTime / 60)}m</div>
        <div style="font-size:0.55rem;color:var(--text-muted)">Jami vaqt</div>
      </div>
    </div>
    <div style="background:var(--bg-tertiary);border-radius:8px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:10px;text-align:left;font-size:0.6rem;color:var(--text-muted)">#</th>
            <th style="padding:10px;text-align:left;font-size:0.6rem;color:var(--text-muted)">WPM</th>
            <th style="padding:10px;text-align:left;font-size:0.6rem;color:var(--text-muted)">Aniqlik</th>
            <th style="padding:10px;text-align:left;font-size:0.6rem;color:var(--text-muted)">Vaqt</th>
            <th style="padding:10px;text-align:left;font-size:0.6rem;color:var(--text-muted)">Sana</th>
          </tr>
        </thead>
        <tbody>
          ${userHistory.slice(0, 30).map((h, i) => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px;font-size:0.7rem">${i + 1}</td>
              <td style="padding:8px;font-size:0.8rem;font-weight:800;color:var(--accent)">${h.wpm}</td>
              <td style="padding:8px;font-size:0.7rem;color:var(--success)">${h.acc}%</td>
              <td style="padding:8px;font-size:0.7rem">${h.time}s</td>
              <td style="padding:8px;font-size:0.6rem;color:var(--text-muted)">${new Date(h.date).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function shareResult() {
  const wpm = document.getElementById('resultWpm').textContent;
  const canvas = document.getElementById('shareCanvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = 800;
  canvas.height = 600;
  
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, 800, 600);
  
  ctx.fillStyle = '#e2b714';
  ctx.fillRect(0, 0, 800, 4);
  
  ctx.font = 'bold 48px "JetBrains Mono", monospace';
  ctx.fillStyle = '#d0d0ea';
  ctx.fillText('MR TYPE', 60, 100);
  
  ctx.font = '900 120px "JetBrains Mono", monospace';
  ctx.fillStyle = '#e2b714';
  ctx.fillText(wpm, 60, 280);
  
  ctx.font = '20px "Inter", sans-serif';
  ctx.fillStyle = '#70708a';
  ctx.fillText('WORDS PER MINUTE', 60, 330);
  
  const best = userHistory.length ? Math.max(...userHistory.map(h => h.wpm)) : parseInt(wpm);
  const rank = getRank(best);
  
  ctx.font = '24px "Inter", sans-serif';
  ctx.fillStyle = '#a0a0c0';
  ctx.fillText(rank.name, 60, 420);
  
  ctx.font = '14px "Inter", sans-serif';
  ctx.fillStyle = '#4a4a60';
  ctx.fillText('mrtype.uz', 60, 560);
  
  const link = document.createElement('a');
  link.download = `mrtype_${wpm}wpm.png`;
  link.href = canvas.toDataURL();
  link.click();
  
  showToast('Rasm yuklandi');
}

function changeSound() {
  const sounds = ['blue', 'brown', 'red', 'creamy', 'thock'];
  const currentIndex = sounds.indexOf(currentSound);
  const nextIndex = (currentIndex + 1) % sounds.length;
  currentSound = sounds[nextIndex];
  
  const names = {
    blue: 'Blue Switch',
    brown: 'Brown Switch',
    red: 'Red Switch',
    creamy: 'Creamy',
    thock: 'Thock'
  };
  
  dom.soundName.textContent = names[currentSound];
  showToast(`Ovoz: ${names[currentSound]}`);
}

function toggleZenMode() {
  settings.zenMode = document.getElementById('zenMode').checked;
  if (settings.zenMode) {
    document.body.classList.add('zen-mode');
  } else {
    document.body.classList.remove('zen-mode');
  }
}

function focusInput() {
  dom.hiddenInput.focus();
  dom.typingArea.classList.remove('blurred');
  dom.typingArea.classList.add('focused');
}

// Event Listeners
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    settings.mode = tab.dataset.mode;
    renderSubOptions();
    initGame();
    restartGame(true);
  });
});

document.addEventListener('keydown', (e) => {
  const overlays = ['resultOverlay', 'settingsOverlay', 'leaderboardOverlay', 'statsOverlay', 'duelOverlay'];
  const anyOpen = overlays.some(id => document.getElementById(id).classList.contains('open'));
  
  if (anyOpen) {
    if (e.key === 'Escape') {
      overlays.forEach(id => document.getElementById(id).classList.remove('open'));
      focusInput();
    }
    return;
  }
  
  if (e.key === 'Tab') {
    e.preventDefault();
    restartGame(false);
    return;
  }
  
  if (e.ctrlKey && e.key === 'r') {
    e.preventDefault();
    restartGame(true);
    return;
  }
  
  if (e.key === 'Enter' && settings.mode === 'custom' && gameState.isRunning) {
    finishGame();
    return;
  }
  
  const ignoreKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (ignoreKeys.includes(e.key)) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  
  e.preventDefault();
  highlightKey(e.key.toLowerCase(), 'press');
  
  if (e.key === 'Backspace') {
    handleBackspace();
  } else if (e.key === ' ') {
    handleSpace();
  } else if (e.key.length === 1) {
    handleChar(e.key);
  }
});

document.addEventListener('keyup', (e) => {
  highlightKey(e.key.toLowerCase(), null);
});

dom.typingArea.addEventListener('click', focusInput);
dom.hiddenInput.addEventListener('blur', () => dom.typingArea.classList.add('blurred'));
dom.hiddenInput.addEventListener('focus', () => dom.typingArea.classList.remove('blurred'));

document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsOverlay').classList.add('open');
document.getElementById('settingsClose').onclick = () => document.getElementById('settingsOverlay').classList.remove('open');

document.getElementById('leaderboardBtn').onclick = () => {
  loadLeaderboard();
  document.getElementById('leaderboardOverlay').classList.add('open');
};
document.getElementById('leaderboardClose').onclick = () => document.getElementById('leaderboardOverlay').classList.remove('open');

document.getElementById('statsBtn').onclick = () => {
  loadStats();
  document.getElementById('statsOverlay').classList.add('open');
};
document.getElementById('statsClose').onclick = () => document.getElementById('statsOverlay').classList.remove('open');

document.getElementById('duelBtn').onclick = () => {
  document.getElementById('duelContent').innerHTML = '<div style="text-align:center;padding:40px">Duel mode ishlab chiqilmoqda</div>';
  document.getElementById('duelOverlay').classList.add('open');
};
document.getElementById('duelClose').onclick = () => document.getElementById('duelOverlay').classList.remove('open');

document.getElementById('shareResultBtn').onclick = () => shareResult();
document.getElementById('newWordsBtn').onclick = () => {
  document.getElementById('resultOverlay').classList.remove('open');
  restartGame(true);
};
document.getElementById('restartResultBtn').onclick = () => {
  document.getElementById('resultOverlay').classList.remove('open');
  restartGame(false);
};

document.getElementById('soundBtn').onclick = () => changeSound();

document.querySelectorAll('#langOptions .settings-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#langOptions .settings-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.lang = btn.dataset.lang;
    restartGame(true);
    showToast(`Til: ${btn.textContent}`);
  };
});

document.querySelectorAll('#fontSizeOptions .settings-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#fontSizeOptions .settings-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.fontSize = btn.dataset.fs;
    settings.fontHeight = btn.dataset.fh;
    document.documentElement.style.setProperty('--char-fs', settings.fontSize);
    document.documentElement.style.setProperty('--char-h', settings.fontHeight);
    renderWords();
  };
});

document.querySelectorAll('#themeGrid .theme-swatch').forEach(sw => {
  sw.onclick = () => {
    document.querySelectorAll('#themeGrid .theme-swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    settings.theme = sw.dataset.theme;
    document.body.setAttribute('data-theme', settings.theme);
    showToast(`Mavzu: ${settings.theme}`);
  };
});

document.getElementById('showKeyboard').onchange = (e) => {
  settings.showKeyboard = e.target.checked;
  dom.keyboardSection.style.display = settings.showKeyboard ? 'flex' : 'none';
};

document.getElementById('soundEnabled').onchange = (e) => {
  settings.soundEnabled = e.target.checked;
};

document.getElementById('smoothCaret').onchange = (e) => {
  settings.smoothCaret = e.target.checked;
};

document.getElementById('zenMode').onchange = () => toggleZenMode();

// Initialization
loadHistory();
initGame();
renderSubOptions();
focusInput();

document.documentElement.style.setProperty('--char-fs', settings.fontSize);
document.documentElement.style.setProperty('--char-h', settings.fontHeight);
dom.keyboardSection.style.display = settings.showKeyboard ? 'flex' : 'none';
document.body.setAttribute('data-theme', settings.theme);

console.log('MR TYPE - Professional Typing Trainer loaded!');
