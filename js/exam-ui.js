/* ══════════════════════════════════
   Exam UI – Selector & Status Bar
   ══════════════════════════════════ */

const ExamUI = (() => {
  let prevStatus = null;

  // ── Render exam selector buttons ──
  function renderSelector() {
    const container = document.getElementById('examSelector');
    container.innerHTML = '';

    const schedules = ExamData.loadAllSchedules();
    const activeId = ExamData.getActiveScheduleId();

    schedules.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'exam-sel-btn' +
        (s.id === activeId ? ' active' : '') +
        (s.type === 'mock' ? ' mock' : '');
      btn.textContent = s.name;
      btn.addEventListener('click', () => {
        if (ExamData.getActiveScheduleId() === s.id) {
          ExamData.setActiveScheduleId(null);
        } else {
          ExamData.setActiveScheduleId(s.id);
        }
        renderSelector();
        updateStatus(new Date());
      });
      container.appendChild(btn);
    });
  }

  // ── Auto-activate schedule matching today ──
  function autoActivate() {
    const today = ExamData.toDateStr(new Date());
    const result = ExamData.findScheduleForDate(today);
    if (result) {
      ExamData.setActiveScheduleId(result.schedule.id);
      renderSelector();
    }
  }

  // ── Update status bar (called every second via ClockModule.onTick) ──
  function updateStatus(now) {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    const statusCountdown = document.getElementById('statusCountdown');
    const statusProgress = document.getElementById('statusProgressBar');
    const statusInfo = document.getElementById('statusInfo');

    const schedule = ExamData.getActiveSchedule();
    if (!schedule) {
      statusBar.classList.remove('visible', 'urgent');
      prevStatus = null;
      return;
    }

    const todayStr = ExamData.toDateStr(now);
    const dayIndex = ExamEngine.getTodayDayIndex(schedule, todayStr);

    if (dayIndex === -1) {
      statusBar.classList.remove('visible', 'urgent');
      prevStatus = null;
      return;
    }

    const periodSettings = ExamData.loadPeriodSettings();
    const slots = ExamData.getDaySlots(schedule, dayIndex, periodSettings.periods);
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const schoolEndSec = ExamData.timeToSec(periodSettings.schoolEnd[0], periodSettings.schoolEnd[1]);

    const status = ExamEngine.computeStatus(slots, nowSec, schedule.type === 'monthly' ? schoolEndSec : null);

    statusBar.classList.add('visible');

    // Check for status change (for audio)
    if (ExamEngine.didStatusChange(prevStatus, status) && !ExamData.isMuted()) {
      playStatusSound(status.status);
    }
    prevStatus = status;

    // Render based on status
    const isUrgent = status.status === ExamEngine.STATUS.LAST_5_MIN;
    statusBar.classList.toggle('urgent', isUrgent);

    if (status.status === ExamEngine.STATUS.IDLE) {
      statusBar.classList.remove('visible');
      return;
    }

    if (status.status === ExamEngine.STATUS.SCHOOL_OVER) {
      statusText.textContent = '';
      statusCountdown.style.display = 'none';
      statusInfo.textContent = status.message;
      statusInfo.style.fontSize = 'clamp(1.5rem, 6vw, 3rem)';
      statusInfo.style.color = 'var(--accent)';
      statusProgress.style.width = '0%';
      return;
    }
    statusInfo.style.fontSize = '';
    statusInfo.style.color = '';

    if (status.status === ExamEngine.STATUS.BEFORE_EXAM ||
        status.status === ExamEngine.STATUS.BREAK) {
      statusText.textContent = status.message;
      statusCountdown.style.display = 'none';
      statusProgress.style.width = '0%';
      statusInfo.textContent = '';
      return;
    }

    // Active exam states — show countdown
    statusCountdown.style.display = 'flex';
    const mm = String(Math.floor(status.remainSec / 60)).padStart(2, '0');
    const ss = String(status.remainSec % 60).padStart(2, '0');
    document.getElementById('scd0').textContent = mm[0];
    document.getElementById('scd1').textContent = mm[1];
    document.getElementById('scd2').textContent = ss[0];
    document.getElementById('scd3').textContent = ss[1];

    // Status label
    switch (status.status) {
      case ExamEngine.STATUS.EXAM_ACTIVE:
        statusText.textContent = `考試中 — ${status.slot.label}`;
        break;
      case ExamEngine.STATUS.EARLY_SUBMIT:
        statusText.textContent = `可提早交卷 — ${status.slot.label}`;
        break;
      case ExamEngine.STATUS.LAST_5_MIN:
        statusText.textContent = '交卷倒數';
        break;
      case ExamEngine.STATUS.STUDY:
        statusText.textContent = `自習中 — ${status.slot.label}`;
        break;
    }

    // Progress bar (remaining %)
    const pct = status.remainSec / (status.slot.duration * 60) * 100;
    statusProgress.style.width = Math.min(100, pct) + '%';

    // Info line
    const sH = String(Math.floor(status.slot.startSec / 3600)).padStart(2, '0');
    const sM = String(Math.floor((status.slot.startSec % 3600) / 60)).padStart(2, '0');
    const eH = String(Math.floor(status.slot.endSec / 3600)).padStart(2, '0');
    const eM = String(Math.floor((status.slot.endSec % 3600) / 60)).padStart(2, '0');
    statusInfo.textContent = `${sH}:${sM} ～ ${eH}:${eM}`;
  }

  // ── Audio ──
  function playStatusSound(statusType) {
    if (typeof AudioModule !== 'undefined') {
      AudioModule.play(statusType);
    }
  }

  // ── Init ──
  function init() {
    renderSelector();
    autoActivate();
    ClockModule.onTick.push(updateStatus);
  }

  return { init, renderSelector, updateStatus };
})();
