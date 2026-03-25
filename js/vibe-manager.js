/* ══════════════════════════════════
   Vibe Manager – Nav, Themes, Wind, Density
   ══════════════════════════════════ */

const VIBES = [
  { name: '夜櫻', file: 'vibe/yozakura.html',       theme: 'dark',  accent: '#ffb7c5', accent2: '#ff7eb9', dim: '#a18a93', border: '#3a1c28', bg: '#0a0507', font: "'Zen Antique Soft', serif" },
  { name: '夏夜', file: 'vibe/summer-night.html',    theme: 'dark',  accent: '#4ade80', accent2: '#22c55e', dim: '#8aa193', border: '#1c3a28', bg: '#050a07', font: "'Caveat', cursive" },
  { name: '秋楓', file: 'vibe/autumn-leaves.html',   theme: 'light', accent: '#fb923c', accent2: '#f97316', dim: '#6b7280', border: 'rgba(0,0,0,0.12)', bg: '#f5e6d0', font: "'Fredoka', sans-serif" },
  { name: '冬雪', file: 'vibe/winter-snow.html',     theme: 'light', accent: '#5ba3d9', accent2: '#3b82f6', dim: '#6b7280', border: 'rgba(0,0,0,0.12)', bg: '#e0ecf5', font: "'Pixelify Sans', monospace" },
  { name: '夜雨', file: 'vibe/night-rain.html',      theme: 'dark',  accent: '#60a5fa', accent2: '#3b82f6', dim: '#8094a8', border: '#1c2a3a', bg: '#0a0e15', font: "'Orbitron', monospace" },
  { name: '星空', file: 'vibe/starry-sky.html',      theme: 'dark',  accent: '#a78bfa', accent2: '#7c3aed', dim: '#9a8aaa', border: '#2a1c3a', bg: '#050510', font: "'Silkscreen', monospace" },
  { name: '像素冒險', file: 'vibe/pixel-game.html', theme: 'light', accent: '#f0a020', accent2: '#e08010', dim: '#5a7090', border: 'rgba(0,0,0,0.15)', bg: '#4a90d9', font: "'Press Start 2P', monospace" },
  { name: '霓虹都市', file: 'vibe/neon-city.html',  theme: 'dark',  accent: '#e040fb', accent2: '#00ffff', dim: '#8a6aaa', border: '#2a1040', bg: '#08060f', font: "'Audiowide', sans-serif" },
  { name: '夏日海灘', file: 'vibe/summer-beach.html',theme: 'light', accent: '#0099cc', accent2: '#00bcd4', dim: '#5a7585', border: 'rgba(0,0,0,0.1)', bg: '#e8f4f8', font: "'Pacifico', cursive" },
  { name: '平溪天燈', file: 'vibe/sky-lantern.html', theme: 'dark',  accent: '#ff9944', accent2: '#ff6600', dim: '#a08060', border: '#3a2810', bg: '#0a0806', font: "'ZCOOL XiaoWei', serif" },
  { name: '雪梨煙火', file: 'vibe/sydney-fireworks.html', theme: 'dark', accent: '#ff4488', accent2: '#44ddff', dim: '#9090aa', border: '#1a1a30', bg: '#050515', font: "'Righteous', sans-serif" },
  { name: '珊瑚海洋', file: 'vibe/coral-reef.html', theme: 'dark', accent: '#ff7744', accent2: '#22ccaa', dim: '#6a90a0', border: '#0a2a3a', bg: '#031520', font: "'Fredoka', sans-serif" },
  { name: '極光', file: 'vibe/aurora.html', theme: 'dark', accent: '#00ff88', accent2: '#44ffaa', dim: '#80a090', border: '#1a3028', bg: '#050810', font: "'Fredoka', sans-serif" },
  { name: '101跨年', file: 'vibe/taipei101.html', theme: 'dark', accent: '#ff4488', accent2: '#44ddff', dim: '#8090aa', border: '#1a1a30', bg: '#020818', font: "'Righteous', sans-serif" },
];

let currentVibeIndex = parseInt(localStorage.getItem('vibeIndex') || '0');
if (currentVibeIndex >= VIBES.length) currentVibeIndex = 0;

const vibeHint     = document.getElementById('vibeHint');
const vibeFrame    = document.getElementById('vibe-frame');
const densityHint  = document.getElementById('densityHint');
let densityTimer   = null;

// ══════════════════════════════════
//  Theme
// ══════════════════════════════════
function applyVibeTheme(vibe) {
  const root = document.documentElement.style;
  const isLight = vibe.theme === 'light';

  document.body.classList.toggle('light-theme', isLight);
  document.body.style.background = vibe.bg;

  root.setProperty('--accent',  vibe.accent);
  root.setProperty('--accent2', vibe.accent2);
  root.setProperty('--dim',     vibe.dim);
  root.setProperty('--border',  vibe.border);
  root.setProperty('--glow',  `0 0 10px ${vibe.accent}99, 0 0 20px ${vibe.accent2}66, 0 0 40px ${vibe.accent2}33`);
  root.setProperty('--glow2', `0 0 20px ${vibe.accent2}80`);
  root.setProperty('--font-clock', vibe.font);

  if (isLight) {
    root.setProperty('--bg', 'transparent');
    root.setProperty('--text', '#1a1a2e');
    root.setProperty('--panel', 'rgba(255,255,255,0.82)');
  } else {
    root.setProperty('--bg', vibe.bg);
    root.setProperty('--text', '#e2e8f0');
    root.setProperty('--panel', '#111827');
  }
}

let isTransitioning = false;

function loadVibe(index) {
  if (isTransitioning) return;
  currentVibeIndex = index;
  localStorage.setItem('vibeIndex', index);
  const vibe = VIBES[index];

  // Fade out
  isTransitioning = true;
  vibeFrame.style.opacity = '0';
  // Set body bg to new vibe's color immediately (visible behind fading iframe)
  document.body.style.background = vibe.bg;

  setTimeout(() => {
    applyVibeTheme(vibe);
    vibeFrame.src = vibe.file;
    // Fade in after iframe loads
    vibeFrame.onload = () => {
      vibeFrame.style.opacity = '1';
      isTransitioning = false;
      window.focus();
    };
    // Fallback if onload doesn't fire
    setTimeout(() => {
      vibeFrame.style.opacity = '1';
      isTransitioning = false;
    }, 1200);
  }, 400); // wait for fade-out to complete

  // Show hint
  vibeHint.textContent = vibe.name;
  vibeHint.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => vibeHint.classList.remove('show'), 2000);
  resetAutoSubScene();
}

// Reclaim focus whenever iframe tries to steal it
vibeFrame.addEventListener('load', () => window.focus());
window.addEventListener('blur', () => {
  if (document.activeElement === vibeFrame) window.focus();
});
let hintTimer = null;

// Keyboard arrow keys
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    currentVibeIndex = (currentVibeIndex - 1 + VIBES.length) % VIBES.length;
    loadVibe(currentVibeIndex);
  } else if (e.key === 'ArrowRight') {
    currentVibeIndex = (currentVibeIndex + 1) % VIBES.length;
    loadVibe(currentVibeIndex);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    sendToVibe({ type: 'density', dir: 1 });
    resetAutoSubScene();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    sendToVibe({ type: 'density', dir: -1 });
    resetAutoSubScene();
  }
});

// ══════════════════════════════════
//  Auto sub-scene cycling
// ══════════════════════════════════
const AUTO_SUB_INTERVAL = 30000; // 30 seconds
let autoSubTimer = null;

function startAutoSubScene() {
  clearInterval(autoSubTimer);
  autoSubTimer = setInterval(() => {
    sendToVibe({ type: 'density', dir: 1 });
  }, AUTO_SUB_INTERVAL);
}

function resetAutoSubScene() {
  // Manual switch resets the timer
  startAutoSubScene();
}

startAutoSubScene();

// ══════════════════════════════════
//  postMessage bridge
// ══════════════════════════════════
function sendToVibe(data) {
  try {
    if (vibeFrame.contentWindow) vibeFrame.contentWindow.postMessage(data, '*');
  } catch(e) {}
}

// ══════════════════════════════════
//  Mouse move → wind (speed-based)
// ══════════════════════════════════
let mouseX = 0, mouseY = 0;
let prevMoveTime = performance.now();

document.addEventListener('mousemove', (e) => {
  const now = performance.now();
  const dt = (now - prevMoveTime) / 1000 || 0.016;
  prevMoveTime = now;

  const dx = e.clientX - mouseX;
  const dy = e.clientY - mouseY;
  mouseX = e.clientX;
  mouseY = e.clientY;

  const moveSpeed = Math.sqrt(dx*dx + dy*dy) / dt;   // px/sec
  const norm = Math.sqrt(dx*dx + dy*dy) || 1;
  const windVX = dx / norm;
  const windVY = dy / norm;
  const windStrength = Math.min(moveSpeed / 800, 1);

  sendToVibe({
    type: 'mousemove',
    x: e.clientX, y: e.clientY,
    windVX, windVY, windStrength,
    dx, dy, dt,
  });
});

// Touch swipe → switch vibe
let swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0;
document.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  swipeStartX = t.clientX;
  swipeStartY = t.clientY;
  swipeStartTime = performance.now();
  touchPrevX = t.clientX; touchPrevY = t.clientY; touchPrevTime = performance.now();
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - swipeStartX;
  const dy = t.clientY - swipeStartY;
  const dt = performance.now() - swipeStartTime;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  // Horizontal swipe: >60px, mostly horizontal, within 400ms
  if (absDx > 60 && absDx > absDy * 1.5 && dt < 400) {
    if (dx < 0) {
      // Swipe left → next scene
      currentVibeIndex = (currentVibeIndex + 1) % VIBES.length;
      loadVibe(currentVibeIndex);
    } else {
      // Swipe right → previous scene
      currentVibeIndex = (currentVibeIndex - 1 + VIBES.length) % VIBES.length;
      loadVibe(currentVibeIndex);
    }
  }
}, { passive: true });

// Touch wind
let touchPrevX = 0, touchPrevY = 0, touchPrevTime = 0;
document.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  const now = performance.now();
  const dt = (now - touchPrevTime) / 1000 || 0.016;
  const dx = t.clientX - touchPrevX;
  const dy = t.clientY - touchPrevY;
  touchPrevX = t.clientX; touchPrevY = t.clientY; touchPrevTime = now;
  const moveSpeed = Math.sqrt(dx*dx + dy*dy) / dt;
  const norm = Math.sqrt(dx*dx + dy*dy) || 1;
  sendToVibe({
    type: 'mousemove',
    x: t.clientX, y: t.clientY,
    windVX: dx/norm, windVY: dy/norm,
    windStrength: Math.min(moveSpeed / 800, 1),
    dx, dy, dt,
  });
}, { passive: true });

// ══════════════════════════════════
//  Mouse wheel / click → cycle density
// ══════════════════════════════════
document.addEventListener('wheel', (e) => {
  // Skip if over interactive elements
  if (e.target.closest('button, label, input, .exam-panel, .mode-switcher, .toggle-wrap')) return;
  e.preventDefault();
  const dir = e.deltaY > 0 ? 1 : -1;
  sendToVibe({ type: 'density', dir });
}, { passive: false });

// Click on non-interactive area → send to vibe (vibe decides what to do)
document.addEventListener('click', (e) => {
  if (e.target.closest('button, label, input, .exam-panel, .mode-switcher, .toggle-wrap, select, a, .vibe-nav')) return;
  sendToVibe({ type: 'click', x: e.clientX, y: e.clientY });
});

// Listen for density label from vibe
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'densityLabel') {
    densityHint.textContent = e.data.label;
    densityHint.classList.add('show');
    clearTimeout(densityTimer);
    densityTimer = setTimeout(() => densityHint.classList.remove('show'), 1500);
  }
});

// ══════════════════════════════════
//  Send current time to vibe (for sun/moon position)
// ══════════════════════════════════
function sendTime() {
  const now = new Date();
  sendToVibe({
    type: 'time',
    hours: now.getHours(),
    minutes: now.getMinutes(),
  });
}
setInterval(sendTime, 30000); // every 30s
// Also send on vibe load
vibeFrame.addEventListener('load', () => {
  setTimeout(sendTime, 300);
});

// ══════════════════════════════════
//  Init
// ══════════════════════════════════
loadVibe(currentVibeIndex);
