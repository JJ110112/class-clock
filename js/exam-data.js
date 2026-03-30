/* ══════════════════════════════════
   Exam Data – CRUD & Persistence
   ══════════════════════════════════ */

const ExamData = (() => {
  const STORAGE_KEY_PERIODS   = 'classClock_periods';
  const STORAGE_KEY_SCHEDULES = 'classClock_schedules';
  const STORAGE_KEY_ACTIVE    = 'classClock_activeSchedule';
  const STORAGE_KEY_MUTE      = 'classClock_mute';

  // ── Default period start times (1~7 節) ──
  const DEFAULT_PERIODS = [
    { label: '1', start: [8, 10] },
    { label: '2', start: [9, 10] },
    { label: '3', start: [10, 10] },
    { label: '4', start: [11, 10] },
    { label: '5', start: [13, 5] },
    { label: '6', start: [14, 5] },
    { label: '7', start: [15, 10] },
  ];

  const DEFAULT_SCHOOL_END = [16, 0];

  const DEFAULT_EARLY_SUBMIT_MONTHLY = {
    1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 15, 7: 30
  };

  // ── Helpers ──
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function timeToSec(h, m) {
    return h * 3600 + m * 60;
  }

  function secToTime(sec) {
    return [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60)];
  }

  function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }

  // ── Period Settings ──
  function loadPeriodSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PERIODS);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          periods: parsed.periods || DEFAULT_PERIODS.map(p => ({ ...p })),
          schoolEnd: parsed.schoolEnd || [...DEFAULT_SCHOOL_END],
        };
      }
    } catch (e) { /* ignore */ }
    return {
      periods: DEFAULT_PERIODS.map(p => ({ ...p, start: [...p.start] })),
      schoolEnd: [...DEFAULT_SCHOOL_END],
    };
  }

  function savePeriodSettings(settings) {
    localStorage.setItem(STORAGE_KEY_PERIODS, JSON.stringify(settings));
  }

  // ── Schedule CRUD ──
  function loadAllSchedules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SCHEDULES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveAllSchedules(schedules) {
    try {
      const data = JSON.stringify(schedules);
      // Check if data size exceeds typical localStorage limit (5MB)
      if (data.length > 4.5 * 1024 * 1024) {
        throw new Error('Data too large for localStorage');
      }
      localStorage.setItem(STORAGE_KEY_SCHEDULES, data);
    } catch (error) {
      if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
        alert('儲存空間已滿，請刪除一些舊的考程排程');
        throw new Error('LocalStorage quota exceeded');
      } else {
        console.error('Failed to save schedules:', error);
        throw error;
      }
    }
  }

  function createSchedule(data) {
    const schedule = {
      id: generateId(),
      name: data.name || '未命名考程',
      type: data.type || 'monthly',  // 'monthly' | 'mock'
      dates: data.dates || [],
      days: data.days || [],
      earlySubmit: data.earlySubmit || { ...DEFAULT_EARLY_SUBMIT_MONTHLY },
    };
    const all = loadAllSchedules();
    all.push(schedule);
    saveAllSchedules(all);
    return schedule;
  }

  function updateSchedule(id, updates) {
    const all = loadAllSchedules();
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) return null;
    
    Object.assign(all[idx], updates);
    saveAllSchedules(all);
    return all[idx];
  }

  function deleteSchedule(id) {
    const all = loadAllSchedules();
    const filtered = all.filter(s => s.id !== id);
    if (filtered.length === all.length) return false;
    saveAllSchedules(filtered);
    // Clear active if deleted
    if (getActiveScheduleId() === id) setActiveScheduleId(null);
    return true;
  }

  function getScheduleById(id) {
    return loadAllSchedules().find(s => s.id === id) || null;
  }

  // ── Active Schedule ──
  function getActiveScheduleId() {
    return localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
  }

  function setActiveScheduleId(id) {
    if (id) localStorage.setItem(STORAGE_KEY_ACTIVE, id);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE);
  }

  function getActiveSchedule() {
    const id = getActiveScheduleId();
    return id ? getScheduleById(id) : null;
  }

  // ── Auto-detect which schedule matches today ──
  function findScheduleForDate(dateStr) {
    const all = loadAllSchedules();
    for (const s of all) {
      const dayIdx = s.dates.indexOf(dateStr);
      if (dayIdx !== -1) return { schedule: s, dayIndex: dayIdx };
    }
    return null;
  }

  // ── Compute exam slots for a given day of a schedule ──
  function getDaySlots(schedule, dayIndex, periodSettings) {
    if (!schedule.days[dayIndex]) return [];
    const slots = schedule.days[dayIndex].slots || [];

    if (schedule.type === 'monthly') {
      const periods = periodSettings || loadPeriodSettings().periods;
      return slots.map(slot => {
        const periodIdx = slot.period - 1;
        const period = periods[periodIdx];
        if (!period) return null;
        const earlyMin = (schedule.earlySubmit && schedule.earlySubmit[slot.period]) || 0;
        return {
          period: slot.period,
          label: `第${period.label}節`,
          startSec: timeToSec(period.start[0], period.start[1]),
          duration: slot.duration,
          endSec: timeToSec(period.start[0], period.start[1]) + slot.duration * 60,
          earlySubmitMin: earlyMin,
          isStudy: !!slot.isStudy,
        };
      }).filter(Boolean);
    }

    // mock: slots have their own start times
    return slots.map(slot => {
      const startSec = timeToSec(slot.start[0], slot.start[1]);
      return {
        subject: slot.subject,
        label: slot.subject,
        startSec,
        duration: slot.duration,
        endSec: startSec + slot.duration * 60,
        earlySubmitMin: slot.earlySubmit || 0,
        isStudy: !!slot.isStudy,
      };
    });
  }

  // ── Overlap check ──
  function checkSlotOverlap(periods, slots, toPeriod, duration, excludePeriod) {
    const toStart = timeToSec(periods[toPeriod - 1].start[0], periods[toPeriod - 1].start[1]);
    const toEnd = toStart + duration * 60;
    for (const slot of slots) {
      if (slot.period === excludePeriod) continue;
      const sStart = timeToSec(periods[slot.period - 1].start[0], periods[slot.period - 1].start[1]);
      const sEnd = sStart + slot.duration * 60;
      if (toStart < sEnd && toEnd > sStart) return slot;
    }
    return null;
  }

  // ── Mute setting ──
  function isMuted() {
    const val = localStorage.getItem(STORAGE_KEY_MUTE);
    return val === null ? true : val === 'true';  // default muted
  }

  function setMuted(muted) {
    localStorage.setItem(STORAGE_KEY_MUTE, String(muted));
  }

  // ── Public API ──
  return {
    DEFAULT_PERIODS,
    DEFAULT_SCHOOL_END,
    DEFAULT_EARLY_SUBMIT_MONTHLY,
    generateId,
    timeToSec,
    secToTime,
    toDateStr,
    addDays,
    loadPeriodSettings,
    savePeriodSettings,
    loadAllSchedules,
    saveAllSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    getScheduleById,
    getActiveScheduleId,
    setActiveScheduleId,
    getActiveSchedule,
    findScheduleForDate,
    getDaySlots,
    checkSlotOverlap,
    isMuted,
    setMuted,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExamData;
}
