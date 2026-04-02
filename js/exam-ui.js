/* ══════════════════════════════════
   Exam UI – Status Bar
   ══════════════════════════════════ */

const ExamUI = (() => {
  let prevStatus = null;

  // ── Auto-activate schedule matching today ──
  function autoActivate() {
    const today = ExamData.toDateStr(new Date());
    const result = ExamData.findScheduleForDate(today);
    if (result) {
      ExamData.setActiveScheduleId(result.schedule.id);
    }
  }

  // ── Update status bar (called every second via ClockModule.onTick) ──
  function updateStatus(now) {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    const statusCountdown = document.getElementById('statusCountdown');
    const statusProgress = document.getElementById('statusProgressBar');
    const statusInfo = document.getElementById('statusInfo');

    const muteEl = document.getElementById('muteIndicator');
    const schedule = ExamData.getActiveSchedule();
    if (!schedule) {
      statusBar.classList.remove('visible', 'urgent', 'exam-active');
      document.querySelector('.container').classList.remove('exam-active');
      prevStatus = null;
      return;
    }
    // Update mute indicator
    const muted = ExamData.isMuted();
    muteEl.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    muteEl.classList.toggle('unmuted', !muted);

    const todayStr = ExamData.toDateStr(now);
    const dayIndex = ExamEngine.getTodayDayIndex(schedule, todayStr);

    if (dayIndex === -1) {
      statusBar.classList.remove('visible', 'urgent', 'exam-active');
      document.querySelector('.container').classList.remove('exam-active');
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
      AudioModule.play(status.status);
    }
    prevStatus = status;

    // Render based on status
    const isUrgent = status.status === ExamEngine.STATUS.LAST_5_MIN;
    statusBar.classList.toggle('urgent', isUrgent);

    const isActive = [
      ExamEngine.STATUS.EXAM_ACTIVE,
      ExamEngine.STATUS.EARLY_SUBMIT,
      ExamEngine.STATUS.LAST_5_MIN,
      ExamEngine.STATUS.STUDY,
    ].includes(status.status);
    statusBar.classList.toggle('exam-active', isActive);
    document.querySelector('.container').classList.toggle('exam-active', isActive);

    if (status.status === ExamEngine.STATUS.IDLE) {
      statusBar.classList.remove('visible');
      document.querySelector('.container').classList.remove('exam-active');
      prevStatus = null;
      return;
    }

    const disclaimer = document.getElementById('statusDisclaimer');

    if (status.status === ExamEngine.STATUS.SCHOOL_OVER) {
      statusText.textContent = '';
      statusCountdown.style.display = 'none';
      statusInfo.textContent = status.message;
      statusInfo.style.fontSize = 'clamp(1.5rem, 6vw, 3rem)';
      statusInfo.style.color = 'var(--accent)';
      statusProgress.style.width = '0%';
      disclaimer.style.display = 'none';
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
      disclaimer.style.display = 'none';
      return;
    }

    // Active exam/study states — show countdown + disclaimer
    statusCountdown.style.display = 'inline-flex';
    disclaimer.style.display = '';

    const mm = String(Math.floor(status.remainSec / 60)).padStart(2, '0');
    const ss = String(status.remainSec % 60).padStart(2, '0');
    document.getElementById('scd0').textContent = mm[0];
    document.getElementById('scd1').textContent = mm[1];
    document.getElementById('scd2').textContent = ss[0];
    document.getElementById('scd3').textContent = ss[1];

    // Auto-scale countdown to fit within status bar
    const parentW = statusCountdown.parentElement.clientWidth - 40;
    const countdownW = statusCountdown.scrollWidth;
    if (countdownW > parentW && parentW > 0) {
      statusCountdown.style.transform = `scale(${parentW / countdownW})`;
    } else {
      statusCountdown.style.transform = '';
    }

    // Status label
    switch (status.status) {
      case ExamEngine.STATUS.EXAM_ACTIVE:
        statusText.textContent = `考試中 — ${status.slot.label} 剩餘`;
        break;
      case ExamEngine.STATUS.EARLY_SUBMIT:
        statusText.textContent = `可提早交卷 — ${status.slot.label} 剩餘`;
        break;
      case ExamEngine.STATUS.LAST_5_MIN:
        statusText.textContent = '交卷倒數 剩餘';
        break;
      case ExamEngine.STATUS.STUDY:
        statusText.textContent = `自習中 — ${status.slot.label} 剩餘`;
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
    autoActivate();
    ClockModule.onTick.push(updateStatus);
    document.getElementById('muteIndicator').addEventListener('click', () => {
      ExamData.setMuted(!ExamData.isMuted());
      updateStatus(new Date());
    });
  }

  return { init, updateStatus };
})();
