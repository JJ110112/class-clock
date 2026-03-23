/* ══════════════════════════════════
   Exam Logic – Monthly & Mock
   ══════════════════════════════════ */

// ── 月考資料 ──
const PERIODS = [
  { label:'1', start:[8,10]  },
  { label:'2', start:[9,10]  },
  { label:'3', start:[10,10] },
  { label:'4', start:[11,10] },
  { label:'5', start:[13,5]  },
  { label:'6', start:[14,5]  },
  { label:'7', start:[15,10] },
];
const PERIOD_DURATIONS = [
  [50,80,100],[50,80,100],[50,80,100],[50],
  [50,80,100],[50,80,100],[50],
];

// ── 模擬考資料 ──
const MOCK_SCHEDULE = {
  day1: [
    { subject:'國　文',      start:[8,20],  duration:100 },
    { subject:'英　文',      start:[10,20], duration:100 },
    { subject:'專業科目（一）', start:[13,10], duration:100 },
  ],
  day2: [
    { subject:'數　學',      start:[8,20],  duration:80  },
    { subject:'專業科目（二）', start:[10,20], duration:100 },
  ],
};

// ── 狀態 ──
let currentMode    = 'monthly';
let examOn         = false, selectedPeriod = null, selectedDuration = 50;
let mockOn         = false, mockDay = 'day1';

// ── DOM refs (resolved on init) ──
let examToggle, examControls, statusOff, countdownBox, countdownLabel,
    countdownTime, countdownBar, periodInfo, durationBtnsEl;
let mockToggle, mockStatusOff, mockCDBox, mockLabel, mockTime,
    mockBar, mockBreakMsg, mockInfo, subjectBadge, subjectName;

function initExam() {
  examToggle     = document.getElementById('examToggle');
  examControls   = document.getElementById('examControls');
  statusOff      = document.getElementById('statusOff');
  countdownBox   = document.getElementById('countdownBox');
  countdownLabel = document.getElementById('countdownLabel');
  countdownTime  = document.getElementById('countdownTime');
  countdownBar   = document.getElementById('countdownBar');
  periodInfo     = document.getElementById('periodInfo');
  durationBtnsEl = document.getElementById('durationBtns');

  mockToggle     = document.getElementById('mockToggle');
  mockStatusOff  = document.getElementById('mockStatusOff');
  mockCDBox      = document.getElementById('mockCountdownBox');
  mockLabel      = document.getElementById('mockLabel');
  mockTime       = document.getElementById('mockTime');
  mockBar        = document.getElementById('mockBar');
  mockBreakMsg   = document.getElementById('mockBreakMsg');
  mockInfo       = document.getElementById('mockInfo');
  subjectBadge   = document.getElementById('subjectBadge');
  subjectName    = document.getElementById('subjectName');

  // ── Mode switching ──
  document.getElementById('btnMonthly').addEventListener('click', () => setMode('monthly'));
  document.getElementById('btnMock').addEventListener('click',    () => setMode('mock'));

  // ── Monthly toggle ──
  examToggle.addEventListener('change', () => {
    examOn = examToggle.checked;
    examControls.style.display = examOn ? 'flex' : 'none';
    statusOff.style.display    = examOn ? 'none' : 'block';
    if (examOn) { autoSelectPeriod(); }
    else { selectedPeriod = null; countdownBox.classList.remove('visible'); }
  });

  rebuildDurationBtns(0);

  // ── Mock toggle ──
  mockToggle.addEventListener('change', () => {
    mockOn = mockToggle.checked;
    mockStatusOff.style.display = mockOn ? 'none' : 'block';
    if (mockOn) {
      mockCDBox.classList.add('visible');
      subjectBadge.classList.add('visible');
    } else {
      mockCDBox.classList.remove('visible');
      subjectBadge.classList.remove('visible');
    }
  });

  document.getElementById('btnDay1').addEventListener('click', () => setMockDay('day1'));
  document.getElementById('btnDay2').addEventListener('click', () => setMockDay('day2'));

  // Register with clock
  ClockModule.onTick.push(onTick);
}

// ── Mode ──
function setMode(mode) {
  currentMode = mode;
  document.getElementById('btnMonthly').classList.toggle('active', mode==='monthly');
  document.getElementById('btnMock').classList.toggle('active',    mode==='mock');
  document.getElementById('panelMonthly').style.display = mode==='monthly' ? '' : 'none';
  document.getElementById('panelMock').style.display    = mode==='mock'    ? '' : 'none';
}

// ── Duration buttons ──
function rebuildDurationBtns(periodIdx) {
  durationBtnsEl.innerHTML = '';
  const durations = PERIOD_DURATIONS[periodIdx] || [50];
  if (!durations.includes(selectedDuration)) selectedDuration = 50;
  durations.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'db' + (d===selectedDuration ? ' active' : '');
    btn.textContent = `${d} 分`;
    btn.addEventListener('click', () => {
      selectedDuration = d;
      document.querySelectorAll('.db').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      autoSelectPeriod();
    });
    durationBtnsEl.appendChild(btn);
  });
}

function selectPeriod(i) {
  selectedPeriod = i;
  rebuildDurationBtns(i);
  countdownBox.classList.add('visible');
}

function detectPeriod(nowSec) {
  for (let i=0; i<PERIODS.length; i++) {
    const s = PERIODS[i].start[0]*3600 + PERIODS[i].start[1]*60;
    if (nowSec >= s && nowSec < s + selectedDuration*60) return i;
  }
  for (let i=0; i<PERIODS.length; i++) {
    const s = PERIODS[i].start[0]*3600 + PERIODS[i].start[1]*60;
    if (nowSec < s) return i;
  }
  return PERIODS.length - 1;
}

function autoSelectPeriod() {
  const now = new Date();
  selectPeriod(detectPeriod(now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds()));
}

function examEndSec(idx) {
  return PERIODS[idx].start[0]*3600 + PERIODS[idx].start[1]*60 + selectedDuration*60;
}

function isBreakTime(nowSec) {
  const p = PERIODS[selectedPeriod];
  const pStart = p.start[0]*3600 + p.start[1]*60;
  if (nowSec < pStart) return true;
  const eEnd = examEndSec(selectedPeriod);
  if (nowSec < eEnd) return false;
  for (let i=0; i<PERIODS.length; i++) {
    const s = PERIODS[i].start[0]*3600 + PERIODS[i].start[1]*60;
    if (s > eEnd && nowSec < s) return true;
  }
  return false;
}

function nextPeriodAfterExam() {
  const pStart = PERIODS[selectedPeriod].start[0]*3600 + PERIODS[selectedPeriod].start[1]*60;
  const nowSec = (() => { const n=new Date(); return n.getHours()*3600+n.getMinutes()*60+n.getSeconds(); })();
  if (nowSec < pStart) return PERIODS[selectedPeriod];
  const eEnd = examEndSec(selectedPeriod);
  for (let i=0; i<PERIODS.length; i++) {
    const s = PERIODS[i].start[0]*3600 + PERIODS[i].start[1]*60;
    if (s > eEnd) return PERIODS[i];
  }
  return null;
}

function setCDText(a,b,c,d) {
  ['cd0','cd1','cd2','cd3'].forEach((id,i) =>
    document.getElementById(id).textContent = [a,b,c,d][i]);
}

function showMonthlyMsg(label, msg, info='') {
  countdownLabel.textContent = label;
  countdownTime.style.display = 'none';
  countdownTime.classList.remove('urgent');
  const bm = document.getElementById('breakMsg');
  bm.textContent = msg; bm.style.display = 'block';
  countdownBar.style.width = '0%';
  periodInfo.textContent = info;
}

function updateMonthly(now) {
  if (!examOn || selectedPeriod === null) return;
  const p = PERIODS[selectedPeriod];
  const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  const eEnd   = examEndSec(selectedPeriod);
  const endH = Math.floor(eEnd/3600), endM = Math.floor((eEnd%3600)/60);

  if (selectedPeriod === PERIODS.length-1 && nowSec >= eEnd) {
    showMonthlyMsg('今日考試已結束','放學囉'); return;
  }
  if (isBreakTime(nowSec)) {
    const next = nextPeriodAfterExam();
    showMonthlyMsg('下課時間','下課中',
      next ? `下一節 第${next.label}節 ${pad(next.start[0])}:${pad(next.start[1])} 開始` : '');
    return;
  }

  countdownTime.style.display = 'flex';
  document.getElementById('breakMsg').style.display = 'none';
  countdownLabel.textContent = `第 ${p.label} 節剩餘`;
  const rem = eEnd - nowSec;
  if (rem <= 0) {
    setCDText('已','結','束','');
    countdownTime.classList.remove('urgent');
    countdownBar.style.width = '0%';
    periodInfo.textContent = '';
  } else {
    const mm=pad(Math.floor(rem/60)), ss=pad(rem%60);
    setCDText(mm[0],mm[1],ss[0],ss[1]);
    countdownTime.classList.toggle('urgent', rem<=300);
    countdownBar.style.width = Math.min(100, rem/(selectedDuration*60)*100)+'%';
    periodInfo.textContent = `${pad(p.start[0])}:${pad(p.start[1])} ～ ${pad(endH)}:${pad(endM)}`;
  }
}

// ── Mock exam ──
function setMockDay(day) {
  mockDay = day;
  document.getElementById('btnDay1').className = 'pb' + (day==='day1' ? ' active-purple' : '');
  document.getElementById('btnDay2').className = 'pb' + (day==='day2' ? ' active-purple' : '');
}

function getMockState(nowSec) {
  const schedule = MOCK_SCHEDULE[mockDay];
  for (let i=0; i<schedule.length; i++) {
    const s = schedule[i].start[0]*3600 + schedule[i].start[1]*60;
    const e = s + schedule[i].duration*60;
    if (nowSec >= s && nowSec < e)
      return { status:'active', item:schedule[i], startSec:s, endSec:e };
  }
  for (let i=0; i<schedule.length; i++) {
    const s = schedule[i].start[0]*3600 + schedule[i].start[1]*60;
    if (nowSec < s)
      return { status: i===0 ? 'before' : 'between', item:schedule[i], nextSec:s };
  }
  return { status:'done' };
}

function setMockCDText(a,b,c,d) {
  ['mcd0','mcd1','mcd2','mcd3'].forEach((id,i) =>
    document.getElementById(id).textContent = [a,b,c,d][i]);
}

function showMockMsg(label, msg, info='', subject='') {
  mockLabel.textContent = label;
  mockTime.style.display = 'none';
  mockTime.classList.remove('urgent');
  mockBreakMsg.textContent = msg; mockBreakMsg.style.display = 'block';
  mockBar.style.width = '0%';
  mockInfo.textContent = info;
  if (subject) subjectName.textContent = subject;
}

function updateMock(now) {
  if (!mockOn) return;
  const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  const state  = getMockState(nowSec);

  if (state.status === 'done') {
    showMockMsg('今日模擬考已結束','放學囉','','—'); return;
  }
  if (state.status === 'before' || state.status === 'between') {
    const nh = Math.floor(state.nextSec/3600), nm = Math.floor((state.nextSec%3600)/60);
    showMockMsg(
      state.status==='before' ? '考試尚未開始' : '下課中',
      '下課中',
      `下一科　${state.item.subject}　${pad(nh)}:${pad(nm)} 開始`,
      state.item.subject
    );
    return;
  }

  mockTime.style.display = 'flex';
  mockBreakMsg.style.display = 'none';
  mockLabel.textContent = state.item.subject + '　剩餘';
  subjectName.textContent = state.item.subject;

  const rem = state.endSec - nowSec;
  if (rem <= 0) {
    setMockCDText('已','結','束','');
    mockTime.classList.remove('urgent');
    mockBar.style.width = '0%';
    mockInfo.textContent = '';
  } else {
    const mm=pad(Math.floor(rem/60)), ss=pad(rem%60);
    setMockCDText(mm[0],mm[1],ss[0],ss[1]);
    mockTime.classList.toggle('urgent', rem<=600);
    mockBar.style.width = Math.min(100, rem/(state.item.duration*60)*100)+'%';
    const sH=Math.floor(state.startSec/3600), sM=Math.floor((state.startSec%3600)/60);
    const eH=Math.floor(state.endSec/3600),   eM=Math.floor((state.endSec%3600)/60);
    mockInfo.textContent = `${pad(sH)}:${pad(sM)} ～ ${pad(eH)}:${pad(eM)}`;
  }
}

// ── Main tick callback ──
function onTick(now) {
  if (examOn) {
    const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
    const correct = detectPeriod(nowSec);
    if (correct !== selectedPeriod) selectPeriod(correct);
  }
  updateMonthly(now);
  updateMock(now);
}
