import { describe, it, expect } from 'vitest';

// Need to load as CJS module
const ExamEngine = require('../js/exam-engine.js');

const { STATUS, computeStatus, getTodayDayIndex, didStatusChange, formatCountdown, formatTime } = ExamEngine;

function makeSlot(label, startH, startM, duration, earlySubmitMin = 0) {
  const startSec = startH * 3600 + startM * 60;
  return {
    label,
    startSec,
    duration,
    endSec: startSec + duration * 60,
    earlySubmitMin,
  };
}

const schoolEndSec = 16 * 3600;

describe('formatTime', () => {
  it('formats seconds as HH:MM', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(8 * 3600 + 10 * 60)).toBe('08:10');
    expect(formatTime(16 * 3600)).toBe('16:00');
  });
});

describe('formatCountdown', () => {
  it('formats remaining seconds with prefix', () => {
    expect(formatCountdown('剩餘', 125)).toBe('剩餘 02:05');
    expect(formatCountdown('倒數', 0)).toBe('倒數 00:00');
    expect(formatCountdown('考試中', 3599)).toBe('考試中 59:59');
  });
});

describe('computeStatus', () => {
  const slots = [
    makeSlot('第1節', 8, 10, 50, 15),
    makeSlot('第2節', 9, 10, 80, 15),
    makeSlot('第5節', 13, 5, 50, 15),
  ];

  it('returns IDLE when no slots', () => {
    const result = computeStatus([], 8 * 3600, schoolEndSec);
    expect(result.status).toBe(STATUS.IDLE);
  });

  it('returns BEFORE_EXAM when before first exam', () => {
    const nowSec = 7 * 3600;
    const result = computeStatus(slots, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.BEFORE_EXAM);
    expect(result.nextSlot.label).toBe('第1節');
    expect(result.message).toContain('08:10');
    expect(result.message).toContain('下一節課');
  });

  it('returns EXAM_ACTIVE during exam', () => {
    const nowSec = 8 * 3600 + 15 * 60;
    const result = computeStatus(slots, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.EXAM_ACTIVE);
    expect(result.slot.label).toBe('第1節');
    expect(result.remainSec).toBe((9 * 3600) - nowSec);
    expect(result.progress).toBeCloseTo(5 / 50, 2);
  });

  it('returns EARLY_SUBMIT when within early submit window', () => {
    const nowSec = 8 * 3600 + 46 * 60;
    const result = computeStatus(slots, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.EARLY_SUBMIT);
    expect(result.message).toContain('可提早交卷');
  });

  it('returns LAST_5_MIN in final 5 minutes', () => {
    const nowSec = 8 * 3600 + 57 * 60;
    const result = computeStatus(slots, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.LAST_5_MIN);
    expect(result.remainSec).toBe(3 * 60);
    expect(result.message).toContain('交卷倒數');
  });

  it('LAST_5_MIN takes priority over EARLY_SUBMIT', () => {
    const nowSec = 8 * 3600 + 56 * 60;
    const result = computeStatus(slots, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.LAST_5_MIN);
  });

  it('returns BREAK between exams', () => {
    const nowSec = 9 * 3600 + 5 * 60;
    const result = computeStatus(slots, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.BREAK);
    expect(result.nextSlot.label).toBe('第2節');
    expect(result.message).toContain('09:10');
    expect(result.message).toContain('下一節課');
  });

  it('returns SCHOOL_OVER after all exams', () => {
    const nowSec = 14 * 3600;
    const result = computeStatus(slots, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.SCHOOL_OVER);
    expect(result.message).toBe('放學');
  });

  it('handles exam with earlySubmit = 0 (no early submit)', () => {
    const slotsNoEarly = [makeSlot('國文', 8, 20, 100, 0)];
    const nowSec = 8 * 3600 + 20 * 60 + 90 * 60;
    const result = computeStatus(slotsNoEarly, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.EXAM_ACTIVE);
  });

  it('handles unordered slots correctly', () => {
    const unordered = [
      makeSlot('第5節', 13, 5, 50, 15),
      makeSlot('第1節', 8, 10, 50, 15),
    ];
    const nowSec = 8 * 3600 + 15 * 60;
    const result = computeStatus(unordered, nowSec, schoolEndSec);
    expect(result.status).toBe(STATUS.EXAM_ACTIVE);
    expect(result.slot.label).toBe('第1節');
  });

  it('progress increases from 0 to near 1', () => {
    const slot = makeSlot('第1節', 8, 10, 50, 0);
    const start = computeStatus([slot], 8 * 3600 + 10 * 60, schoolEndSec);
    const mid = computeStatus([slot], 8 * 3600 + 35 * 60, schoolEndSec);
    const end = computeStatus([slot], 8 * 3600 + 59 * 60, schoolEndSec);
    expect(start.progress).toBeCloseTo(0, 2);
    expect(mid.progress).toBeCloseTo(0.5, 2);
    expect(end.progress).toBeCloseTo(49 / 50, 2);
  });
});

describe('study slots', () => {
  it('returns STUDY status during self-study period', () => {
    const slot = makeSlot('第3節', 10, 10, 50, 15);
    slot.isStudy = true;
    const nowSec = 10 * 3600 + 20 * 60; // 10:20
    const result = computeStatus([slot], nowSec, 16 * 3600);
    expect(result.status).toBe(STATUS.STUDY);
    expect(result.remainSec).toBe(40 * 60);
    expect(result.message).toContain('自習中');
  });

  it('STUDY ignores early submit and last 5 min', () => {
    const slot = makeSlot('第3節', 10, 10, 50, 15);
    slot.isStudy = true;
    // 3 min before end — normally would be LAST_5_MIN
    const nowSec = 10 * 3600 + 10 * 60 + 47 * 60; // 10:57
    const result = computeStatus([slot], nowSec, 16 * 3600);
    expect(result.status).toBe(STATUS.STUDY);
    expect(result.message).toContain('自習中');
  });

  it('mixed exam and study slots work correctly', () => {
    const examSlot = makeSlot('第1節', 8, 10, 50, 15);
    const studySlot = makeSlot('第2節', 9, 10, 50, 15);
    studySlot.isStudy = true;
    const examSlot2 = makeSlot('第3節', 10, 10, 80, 15);

    // During exam
    let r = computeStatus([examSlot, studySlot, examSlot2], 8 * 3600 + 20 * 60, 16 * 3600);
    expect(r.status).toBe(STATUS.EXAM_ACTIVE);

    // During study
    r = computeStatus([examSlot, studySlot, examSlot2], 9 * 3600 + 20 * 60, 16 * 3600);
    expect(r.status).toBe(STATUS.STUDY);

    // During next exam
    r = computeStatus([examSlot, studySlot, examSlot2], 10 * 3600 + 20 * 60, 16 * 3600);
    expect(r.status).toBe(STATUS.EXAM_ACTIVE);
  });
});

describe('getTodayDayIndex', () => {
  it('returns day index when date matches', () => {
    const schedule = { dates: ['2026-03-27', '2026-03-28'] };
    expect(getTodayDayIndex(schedule, '2026-03-27')).toBe(0);
    expect(getTodayDayIndex(schedule, '2026-03-28')).toBe(1);
  });

  it('returns -1 when no match', () => {
    const schedule = { dates: ['2026-03-27'] };
    expect(getTodayDayIndex(schedule, '2026-04-01')).toBe(-1);
  });

  it('handles null schedule', () => {
    expect(getTodayDayIndex(null, '2026-03-27')).toBe(-1);
  });
});

describe('didStatusChange', () => {
  it('returns true on first call (null prev)', () => {
    expect(didStatusChange(null, { status: STATUS.IDLE })).toBe(true);
  });

  it('returns true when status changes', () => {
    expect(didStatusChange(
      { status: STATUS.EXAM_ACTIVE },
      { status: STATUS.EARLY_SUBMIT }
    )).toBe(true);
  });

  it('returns false when status stays the same', () => {
    const s = { status: STATUS.EXAM_ACTIVE, slot: { startSec: 1000 } };
    expect(didStatusChange(s, s)).toBe(false);
  });
});
