/* ══════════════════════════════════
   Clock Display & Date Logic
   ══════════════════════════════════ */

const WEEKDAYS = ['日','一','二','三','四','五','六'];
const DAYS_EN  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function pad(n) { return String(n).padStart(2, '0'); }

const ClockModule = {
  onTick: [],
  is24h: false,
  showSec: false,
  colonBlink: false,

  start() {
    // Load preferences
    const saved24 = localStorage.getItem('clock_24h');
    const savedSec = localStorage.getItem('clock_sec');
    const savedBlink = localStorage.getItem('clock_blink');
    if (saved24 !== null) this.is24h = saved24 === 'true';
    if (savedSec !== null) this.showSec = savedSec === 'true';
    if (savedBlink !== null) this.colonBlink = savedBlink === 'true';

    const colon = document.getElementById('mainColon');
    const secWrap = document.getElementById('secWrap');
    colon.classList.toggle('blink', this.colonBlink);
    secWrap.style.display = this.showSec ? '' : 'none';

    // Click handlers
    document.querySelectorAll('.hour-digit').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.is24h = !this.is24h;
        localStorage.setItem('clock_24h', this.is24h);
      });
    });
    document.querySelectorAll('.min-digit').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSec = !this.showSec;
        localStorage.setItem('clock_sec', this.showSec);
        secWrap.style.display = this.showSec ? '' : 'none';
      });
    });
    colon.style.cursor = 'pointer';
    colon.addEventListener('click', (e) => {
      e.stopPropagation();
      this.colonBlink = !this.colonBlink;
      localStorage.setItem('clock_blink', this.colonBlink);
      colon.classList.toggle('blink', this.colonBlink);
    });

    const tick = () => {
      const now = new Date();
      let h = now.getHours();
      if (!this.is24h) {
        h = h % 12 || 12;
      }
      const hStr = pad(h);

      // Hour: hide leading zero for single-digit hours
      const h0El = document.getElementById('h0');
      const h1El = document.getElementById('h1');
      if (hStr[0] === '0') {
        h0El.textContent = '';
        h0El.style.display = 'none';
      } else {
        h0El.textContent = hStr[0];
        h0El.style.display = '';
      }
      h1El.textContent = hStr[1];

      document.getElementById('m0').textContent = pad(now.getMinutes())[0];
      document.getElementById('m1').textContent = pad(now.getMinutes())[1];

      if (this.showSec) {
        document.getElementById('s0').textContent = pad(now.getSeconds())[0];
        document.getElementById('s1').textContent = pad(now.getSeconds())[1];
      }

      document.getElementById('dateLine').textContent =
        `${now.getFullYear()} · ${pad(now.getMonth()+1)} · ${pad(now.getDate())}`;
      document.getElementById('weekday').textContent =
        `星期${WEEKDAYS[now.getDay()]}  ·  ${DAYS_EN[now.getDay()]}`;

      this.onTick.forEach(fn => fn(now));
    };
    tick();
    setInterval(tick, 1000);
  }
};
