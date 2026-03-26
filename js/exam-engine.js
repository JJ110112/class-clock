/* ══════════════════════════════════
   Exam Engine – Status Computation
   ══════════════════════════════════ */

const ExamEngine = (() => {
  // Status constants
  const STATUS = {
    IDLE:           'idle',           // No active schedule
    BREAK:          'break',          // Between exams
    EXAM_ACTIVE:    'exam_active',    // Exam in progress, not yet submittable
    EARLY_SUBMIT:   'early_submit',   // Can submit early
    LAST_5_MIN:     'last_5_min',     // Last 5 minutes
    EXAM_ENDED:     'exam_ended',     // Exam just ended, break before next
    SCHOOL_OVER:    'school_over',    // All exams done for the day
    BEFORE_EXAM:    'before_exam',    // Before first exam of the day
    STUDY:          'study',          // Self-study period
  };

  /**
   * Compute current exam status given sorted slots and current time in seconds.
   *
   * @param {Array} slots - Sorted array of exam slots from ExamData.getDaySlots()
   *   Each slot: { label, startSec, endSec, duration, earlySubmitMin, period?, subject? }
   * @param {number} nowSec - Current time in seconds since midnight
   * @param {number} schoolEndSec - School end time in seconds (for monthly exams)
   * @returns {Object} Status object with:
   *   - status: one of STATUS constants
   *   - slot: current or next slot (if applicable)
   *   - remainSec: seconds remaining (for countdowns)
   *   - progress: 0-1 progress through exam
   *   - nextSlot: next upcoming slot (for break messages)
   *   - message: formatted status message
   */
  function computeStatus(slots, nowSec, schoolEndSec) {
    if (!slots || slots.length === 0) {
      return { status: STATUS.IDLE, message: '' };
    }

    // Sort by startSec
    const sorted = [...slots].sort((a, b) => a.startSec - b.startSec);

    // Find current exam/study
    for (let i = 0; i < sorted.length; i++) {
      const slot = sorted[i];
      if (nowSec >= slot.startSec && nowSec < slot.endSec) {
        const remainSec = slot.endSec - nowSec;
        const elapsed = nowSec - slot.startSec;
        const totalSec = slot.duration * 60;
        const progress = elapsed / totalSec;

        // Self-study period — simple countdown, no early submit / last 5 min
        if (slot.isStudy) {
          return {
            status: STATUS.STUDY,
            slot,
            remainSec,
            progress,
            message: formatCountdown(`自習中 — ${slot.label} 剩餘`, remainSec),
          };
        }

        // Last 5 minutes
        if (remainSec <= 300) {
          return {
            status: STATUS.LAST_5_MIN,
            slot,
            remainSec,
            progress,
            message: formatCountdown('交卷倒數', remainSec),
          };
        }

        // Early submit check
        if (slot.earlySubmitMin > 0) {
          const earlySubmitSec = slot.earlySubmitMin * 60;
          if (remainSec <= earlySubmitSec) {
            return {
              status: STATUS.EARLY_SUBMIT,
              slot,
              remainSec,
              progress,
              message: formatCountdown(`可提早交卷 — ${slot.label} 剩餘`, remainSec),
            };
          }
        }

        // Active exam
        return {
          status: STATUS.EXAM_ACTIVE,
          slot,
          remainSec,
          progress,
          message: formatCountdown(`考試中 — ${slot.label} 剩餘`, remainSec),
        };
      }
    }

    // Not currently in any exam. Check if before first exam.
    if (nowSec < sorted[0].startSec) {
      return {
        status: STATUS.BEFORE_EXAM,
        nextSlot: sorted[0],
        remainSec: sorted[0].startSec - nowSec,
        message: `下課中 — 下一節 ${sorted[0].label} ${formatTime(sorted[0].startSec)} 開始`,
      };
    }

    // After the last exam
    const lastSlot = sorted[sorted.length - 1];
    if (nowSec >= lastSlot.endSec) {
      if (schoolEndSec && nowSec < schoolEndSec) {
        return {
          status: STATUS.SCHOOL_OVER,
          message: '放學',
        };
      }
      return {
        status: STATUS.SCHOOL_OVER,
        message: '放學',
      };
    }

    // Between exams — find the next one
    for (let i = 0; i < sorted.length; i++) {
      if (nowSec < sorted[i].startSec) {
        return {
          status: STATUS.BREAK,
          nextSlot: sorted[i],
          remainSec: sorted[i].startSec - nowSec,
          message: `考試結束 — 下課中　下一節 ${sorted[i].label} ${formatTime(sorted[i].startSec)} 開始`,
        };
      }
    }

    return { status: STATUS.IDLE, message: '' };
  }

  /**
   * Determine which day index matches today for a schedule.
   * Returns -1 if today doesn't match any date.
   */
  function getTodayDayIndex(schedule, todayStr) {
    if (!schedule || !schedule.dates) return -1;
    return schedule.dates.indexOf(todayStr);
  }

  /**
   * Check if a status transition occurred (for triggering sounds).
   */
  function didStatusChange(prevStatus, currentStatus) {
    if (!prevStatus || prevStatus.status !== currentStatus.status) return true;
    // Also detect transition into last 5 min within the same exam
    if (prevStatus.slot && currentStatus.slot &&
        prevStatus.slot.startSec === currentStatus.slot.startSec) {
      return prevStatus.status !== currentStatus.status;
    }
    return false;
  }

  // ── Formatters ──
  function formatCountdown(prefix, remainSec) {
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');
    return `${prefix} ${mm}:${ss}`;
  }

  function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    return `${h}:${m}`;
  }

  return {
    STATUS,
    computeStatus,
    getTodayDayIndex,
    didStatusChange,
    formatCountdown,
    formatTime,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExamEngine;
}
