/* ══════════════════════════════════
   Clock Display & Date Logic
   ══════════════════════════════════ */

const WEEKDAYS = ['日','一','二','三','四','五','六'];
const DAYS_EN  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function pad(n) { return String(n).padStart(2, '0'); }

const ClockModule = {
  onTick: [],

  start() {
    const tick = () => {
      const now = new Date();
      document.getElementById('h0').textContent = pad(now.getHours())[0];
      document.getElementById('h1').textContent = pad(now.getHours())[1];
      document.getElementById('m0').textContent = pad(now.getMinutes())[0];
      document.getElementById('m1').textContent = pad(now.getMinutes())[1];
      document.getElementById('s0').textContent = pad(now.getSeconds())[0];
      document.getElementById('s1').textContent = pad(now.getSeconds())[1];
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
