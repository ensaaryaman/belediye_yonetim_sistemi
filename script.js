// ==================== SES SİSTEMİ ====================
// Ses sistemi degiskenleri
let soundEnabled = true;
let audioContext = null;
let soundInitialized = false;

// AudioContext'i baslat
function initSound() {
    if (soundInitialized) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        soundInitialized = true;
    } catch (e) {
        console.log('Audio not supported');
    }
}

// Temel ses uretme fonksiyonu
function playTone(frequency, duration, type, volume) {
    if (type === undefined) type = 'sine';
    if (volume === undefined) volume = 0.3;
    
    if (!soundEnabled || !audioContext) return;
    
    var oscillator = audioContext.createOscillator();
    var gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Hedefe vurma sesi
function playHitSound(combo) {
    if (combo === undefined) combo = 1;
    var baseFreq = 600 + (combo * 50);
    playTone(baseFreq, 0.1, 'sine', 0.25);
    setTimeout(function() {
        playTone(baseFreq * 1.5, 0.1, 'sine', 0.15);
    }, 50);
}

// Kacirma sesi
function playMissSound() {
    playTone(200, 0.2, 'sawtooth', 0.15);
}

// Kombo kirilma sesi
function playComboBreakSound() {
    playTone(150, 0.3, 'square', 0.1);
}

// Geri sayim sesi
function playCountdownSound() {
    playTone(440, 0.15, 'sine', 0.2);
}

// "GO!" sesi
function playCountdownGoSound() {
    playTone(880, 0.3, 'sine', 0.25);
}

// Oyun sonu sesi
function playGameOverSound() {
    playTone(400, 0.2, 'sine', 0.2);
    setTimeout(function() {
        playTone(350, 0.2, 'sine', 0.2);
    }, 150);
    setTimeout(function() {
        playTone(300, 0.4, 'sine', 0.2);
    }, 300);
}

// Yeni rekor sesi
function playNewRecordSound() {
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i++) {
        (function(index) {
            setTimeout(function() {
                playTone(notes[index], 0.2, 'sine', 0.25);
            }, index * 100);
        })(i);
    }
}

// Ses ac/kapa
function toggleSoundEnabled() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
}

// ==================== OYUN DEĞİŞKENLERİ ====================
let score = 0;
let timeLeft = 30;
let hits = 0;
let misses = 0;
let totalClicks = 0;
let gameActive = false;
let gameTimer = null;
let targetTimer = null;
let reactionTimes = [];
let targetSpawnTime = 0;
let currentTarget = null;

// Kombo sistemi
let combo = 0;
let maxCombo = 0;
let comboTimer = null;
let comboTimeLeft = 100;
const COMBO_TIMEOUT = 2000;

// Hareket sistemi
let moveInterval = null;

// Zorluk ayarları
const difficultySettings = {
    easy: { size: 70, timeout: 2500, spawnDelay: 1200, moveSpeed: 1 },
    medium: { size: 55, timeout: 1800, spawnDelay: 900, moveSpeed: 2 },
    hard: { size: 40, timeout: 1200, spawnDelay: 600, moveSpeed: 3 },
    extreme: { size: 30, timeout: 800, spawnDelay: 400, moveSpeed: 4 }
};

// DOM elementleri
const gameArea = document.getElementById('gameArea');
const overlay = document.getElementById('overlay');
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time');
const accuracyDisplay = document.getElementById('accuracy');
const avgTimeDisplay = document.getElementById('avgTime');
const maxComboDisplay = document.getElementById('maxCombo');
const comboDisplay = document.getElementById('comboDisplay');
const multiplierDisplay = document.getElementById('multiplier');
const comboBarContainer = document.getElementById('comboBarContainer');
const comboBar = document.getElementById('comboBar');
const highScoreBadge = document.getElementById('highScoreBadge');
const startBtn = document.getElementById('startBtn');
const soundBtn = document.getElementById('soundBtn');
const difficultySelect = document.getElementById('difficulty');
const gameModeSelect = document.getElementById('gameMode');

// ==================== SKOR SİSTEMİ ====================
function getHighScores() {
    const scores = localStorage.getItem('aimTrainerScores');
    return scores ? JSON.parse(scores) : [];
}

function saveHighScore(scoreData) {
    let scores = getHighScores();
    scores.push(scoreData);
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    localStorage.setItem('aimTrainerScores', JSON.stringify(scores));
    return scores;
}

function updateHighScoreBadge() {
    const scores = getHighScores();
    const highScore = scores.length > 0 ? scores[0].score : 0;
    highScoreBadge.textContent = '\uD83D\uDC51 En \u0130yi: ' + highScore;
}

function showLeaderboard() {
    const modal = document.getElementById('leaderboardModal');
    const list = document.getElementById('leaderboardList');
    const scores = getHighScores();

    if (scores.length === 0) {
        list.innerHTML = '<li class="no-scores">Hen\u00fcz skor kaydedilmedi!</li>';
    } else {
        list.innerHTML = scores.map((s, i) => `
            <li>
                <span class="rank">#${i + 1}</span>
                <div class="score-info">
                    <div class="score-value">${s.score} puan</div>
                    <div class="score-details">
                        ${s.difficulty} | ${s.mode} | %${s.accuracy} isabet | ${s.maxCombo}x kombo
                    </div>
                </div>
            </li>
        `).join('');
    }

    modal.classList.add('active');
}

function closeLeaderboard() {
    document.getElementById('leaderboardModal').classList.remove('active');
}

// ==================== KOMBO SİSTEMİ ====================
function updateCombo(hit) {
    if (hit) {
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        maxComboDisplay.textContent = maxCombo;
        
        comboDisplay.textContent = `${combo}x KOMBO`;
        comboDisplay.classList.add('active');
        
        const multiplier = getMultiplier();
        multiplierDisplay.textContent = `×${multiplier.toFixed(1)}`;
        multiplierDisplay.classList.add('active');
        
        comboBarContainer.classList.add('active');
        comboTimeLeft = 100;
        comboBar.style.width = '100%';
        
        clearInterval(comboTimer);
        comboTimer = setInterval(() => {
            comboTimeLeft -= (100 / (COMBO_TIMEOUT / 50));
            comboBar.style.width = comboTimeLeft + '%';
            
            if (comboTimeLeft <= 0) {
                breakCombo(false);
            }
        }, 50);
        
    } else {
        breakCombo(true);
    }
}

function breakCombo(playSound = true) {
    if (combo > 3 && playSound) {
        playComboBreakSound();
    }
    combo = 0;
    clearInterval(comboTimer);
    comboDisplay.classList.remove('active');
    multiplierDisplay.classList.remove('active');
    comboBarContainer.classList.remove('active');
}

function getMultiplier() {
    if (combo < 3) return 1.0;
    if (combo < 5) return 1.2;
    if (combo < 8) return 1.5;
    if (combo < 12) return 2.0;
    if (combo < 20) return 2.5;
    return 3.0;
}

// ==================== SES KONTROLÜ ====================
function toggleSound() {
    initSound();
    var enabled = toggleSoundEnabled();
    soundBtn.textContent = enabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
}

// ==================== PARÇACIK EFEKTİ ====================
function createParticles(x, y) {
    const colors = ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
    const rect = gameArea.getBoundingClientRect();
    
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = Math.random() * 8 + 4;
        const angle = (Math.PI * 2 * i) / 8;
        const velocity = Math.random() * 50 + 30;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = color;
        particle.style.left = (x - rect.left) + 'px';
        particle.style.top = (y - rect.top) + 'px';
        
        gameArea.appendChild(particle);
        
        const destX = Math.cos(angle) * velocity;
        const destY = Math.sin(angle) * velocity;
        
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${destX}px, ${destY}px) scale(0)`, opacity: 0 }
        ], {
            duration: 600,
            easing: 'ease-out'
        });
        
        setTimeout(() => particle.remove(), 600);
    }
}

// ==================== OYUN BAŞLATMA ====================
function startGame() {
    initSound();
    startBtn.disabled = true;
    difficultySelect.disabled = true;
    gameModeSelect.disabled = true;
    
    var countdown = 3;
    overlay.innerHTML = '<div class="countdown">' + countdown + '</div>';
    playCountdownSound();
    
    var countdownInterval = setInterval(function() {
        countdown--;
        if (countdown > 0) {
            overlay.innerHTML = '<div class="countdown">' + countdown + '</div>';
            playCountdownSound();
        } else {
            clearInterval(countdownInterval);
            overlay.innerHTML = '<div class="countdown">GO!</div>';
            playCountdownGoSound();
            setTimeout(function() {
                overlay.style.display = 'none';
                beginGame();
            }, 500);
        }
    }, 1000);
}

function beginGame() {
    score = 0;
    timeLeft = 30;
    hits = 0;
    misses = 0;
    totalClicks = 0;
    reactionTimes = [];
    combo = 0;
    maxCombo = 0;
    gameActive = true;
    
    updateStats();
    updateHighScoreBadge();
    
    gameTimer = setInterval(() => {
        timeLeft--;
        timeDisplay.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    
    spawnTarget();
    gameArea.onclick = handleMiss;
}

// ==================== HEDEF SİSTEMİ ====================
function spawnTarget() {
    if (!gameActive) return;
    
    const settings = difficultySettings[difficultySelect.value];
    const mode = gameModeSelect.value;
    const size = settings.size;
    
    if (currentTarget) {
        currentTarget.remove();
        misses++;
        updateCombo(false);
        updateStats();
    }
    
    if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
    }
    
    const target = document.createElement('div');
    target.className = 'target';
    target.style.width = size + 'px';
    target.style.height = size + 'px';
    
    const padding = size;
    const maxX = gameArea.offsetWidth - padding;
    const maxY = gameArea.offsetHeight - padding - 30;
    let x = padding + Math.random() * (maxX - padding);
    let y = padding + Math.random() * (maxY - padding);
    
    target.style.left = x + 'px';
    target.style.top = y + 'px';
    
    target.onclick = (e) => {
        e.stopPropagation();
        handleHit(target, e);
    };
    
    gameArea.appendChild(target);
    currentTarget = target;
    targetSpawnTime = Date.now();
    
    // Hareket modu
    if (mode === 'moving' || mode === 'chaos') {
        let vx = (Math.random() - 0.5) * settings.moveSpeed * 2;
        let vy = (Math.random() - 0.5) * settings.moveSpeed * 2;
        
        if (mode === 'chaos') {
            vx *= 1.5;
            vy *= 1.5;
        }
        
        moveInterval = setInterval(() => {
            if (!currentTarget || currentTarget !== target) {
                clearInterval(moveInterval);
                return;
            }
            
            x += vx;
            y += vy;
            
            if (x <= padding || x >= maxX) {
                vx = -vx;
                if (mode === 'chaos') {
                    vx += (Math.random() - 0.5) * 2;
                }
            }
            if (y <= padding || y >= maxY) {
                vy = -vy;
                if (mode === 'chaos') {
                    vy += (Math.random() - 0.5) * 2;
                }
            }
            
            x = Math.max(padding, Math.min(maxX, x));
            y = Math.max(padding, Math.min(maxY, y));
            
            target.style.left = x + 'px';
            target.style.top = y + 'px';
        }, 16);
    }
    
    targetTimer = setTimeout(() => {
        if (currentTarget === target && gameActive) {
            spawnTarget();
        }
    }, settings.timeout);
}

// ==================== İSABET VE KAÇIRMA ====================
function handleHit(target, e) {
    if (!gameActive) return;
    
    clearTimeout(targetTimer);
    if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
    }
    
    const reactionTime = Date.now() - targetSpawnTime;
    reactionTimes.push(reactionTime);
    
    updateCombo(true);
    playHitSound(combo);
    createParticles(e.clientX, e.clientY);
    
    const settings = difficultySettings[difficultySelect.value];
    const timeBonus = Math.max(0, settings.timeout - reactionTime);
    const basePoints = Math.floor(10 + (timeBonus / 50));
    const multiplier = getMultiplier();
    const points = Math.floor(basePoints * multiplier);
    
    score += points;
    hits++;
    totalClicks++;
    
    target.classList.add('hit');
    const isCombo = combo >= 3;
    showScorePopup(e.clientX, e.clientY, '+' + points, isCombo);
    
    setTimeout(() => {
        target.remove();
        currentTarget = null;
        if (gameActive) {
            setTimeout(spawnTarget, settings.spawnDelay / 4);
        }
    }, 100);
    
    updateStats();
}

function handleMiss(e) {
    if (!gameActive) return;
    if (e.target.classList.contains('target')) return;
    
    playMissSound();
    
    misses++;
    totalClicks++;
    score = Math.max(0, score - 5);
    
    updateCombo(false);
    
    const rect = gameArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const missIndicator = document.createElement('div');
    missIndicator.className = 'miss-indicator';
    missIndicator.style.left = x + 'px';
    missIndicator.style.top = y + 'px';
    gameArea.appendChild(missIndicator);
    
    setTimeout(() => missIndicator.remove(), 500);
    
    updateStats();
}

function showScorePopup(x, y, text, isCombo = false) {
    const popup = document.createElement('div');
    popup.className = 'score-popup' + (isCombo ? ' combo' : '');
    popup.textContent = text;
    
    const rect = gameArea.getBoundingClientRect();
    popup.style.left = (x - rect.left) + 'px';
    popup.style.top = (y - rect.top) + 'px';
    
    gameArea.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
}

// ==================== İSTATİSTİKLER ====================
function updateStats() {
    scoreDisplay.textContent = score;
    
    const accuracy = totalClicks > 0 ? Math.round((hits / totalClicks) * 100) : 0;
    accuracyDisplay.textContent = accuracy + '%';
    
    const avgTime = reactionTimes.length > 0 
        ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
        : 0;
    avgTimeDisplay.textContent = avgTime + 'ms';
    
    maxComboDisplay.textContent = maxCombo;
}

// ==================== OYUN SONU ====================
function endGame() {
    gameActive = false;
    clearInterval(gameTimer);
    clearTimeout(targetTimer);
    clearInterval(comboTimer);
    if (moveInterval) clearInterval(moveInterval);
    
    if (currentTarget) {
        currentTarget.remove();
        currentTarget = null;
    }
    
    gameArea.onclick = null;
    breakCombo(false);
    
    const accuracy = totalClicks > 0 ? Math.round((hits / totalClicks) * 100) : 0;
    const avgTime = reactionTimes.length > 0 
        ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
        : 0;
    const bestTime = reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0;
    
    const scoreData = {
        score: score,
        accuracy: accuracy,
        avgTime: avgTime,
        maxCombo: maxCombo,
        difficulty: difficultySelect.options[difficultySelect.selectedIndex].text,
        mode: gameModeSelect.options[gameModeSelect.selectedIndex].text,
        date: new Date().toLocaleDateString('tr-TR')
    };
    
    const scores = saveHighScore(scoreData);
    const isNewRecord = scores[0].score === score && scores.filter(s => s.score === score).length === 1;
    
    if (isNewRecord) {
        playNewRecordSound();
    } else {
        playGameOverSound();
    }
    
    overlay.innerHTML = `
        <h2>${isNewRecord ? '\uD83C\uDF89 YEN\u0130 REKOR!' : '\uD83C\uDFC6 Oyun Bitti!'}</h2>
        <div class="final-stats">
            <div class="big-stat ${isNewRecord ? 'new-record' : ''}">${score}</div>
            <p>Toplam Skor</p>
        </div>
        <div style="margin-top: 20px;">
            <p>\u2705 \u0130sabet: ${hits}/${totalClicks} (${accuracy}%)</p>
            <p>\u26A1 Ortalama S\u00fcre: ${avgTime}ms</p>
            <p>\uD83D\uDE80 En H\u0131zl\u0131: ${bestTime}ms</p>
            <p>\uD83D\uDD25 Max Kombo: ${maxCombo}x</p>
        </div>
    `;
    overlay.style.display = 'flex';
    
    updateHighScoreBadge();
    
    startBtn.disabled = false;
    startBtn.textContent = 'Tekrar Oyna';
    difficultySelect.disabled = false;
    gameModeSelect.disabled = false;
}

// ==================== SIFIRLAMA ====================
function resetGame() {
    gameActive = false;
    clearInterval(gameTimer);
    clearTimeout(targetTimer);
    clearInterval(comboTimer);
    if (moveInterval) clearInterval(moveInterval);
    
    if (currentTarget) {
        currentTarget.remove();
        currentTarget = null;
    }
    
    score = 0;
    timeLeft = 30;
    hits = 0;
    misses = 0;
    totalClicks = 0;
    reactionTimes = [];
    combo = 0;
    maxCombo = 0;
    
    scoreDisplay.textContent = '0';
    timeDisplay.textContent = '30';
    accuracyDisplay.textContent = '0%';
    avgTimeDisplay.textContent = '0ms';
    maxComboDisplay.textContent = '0';
    
    breakCombo(false);
    
    overlay.innerHTML = `
        <h2>\uD83C\uDFAF Aim Trainer</h2>
        <p>Hedeflere m\u00fcmk\u00fcn oldu\u011funca h\u0131zl\u0131 t\u0131kla!</p>
        <p>\uD83D\uDD25 \u00dcst \u00fcste vuru\u015flar = Kombo bonusu!</p>
        <p>Oyunu ba\u015flatmak i\u00e7in a\u015fa\u011f\u0131daki butona t\u0131kla.</p>
    `;
    overlay.style.display = 'flex';
    
    startBtn.disabled = false;
    startBtn.textContent = 'Ba\u015flat';
    difficultySelect.disabled = false;
    gameModeSelect.disabled = false;
    gameArea.onclick = null;
}

// Sayfa yüklendiğinde
updateHighScoreBadge();
