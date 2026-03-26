import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
global.localStorage = localStorageMock;

const ExamData = require('../js/exam-data.js');
const ExamEngine = require('../js/exam-engine.js');

beforeEach(() => {
  localStorageMock.clear();
});

describe('Full monthly exam workflow', () => {
  it('creates schedule, computes correct status at each phase', () => {
    // Set up period settings
    const settings = ExamData.loadPeriodSettings();

    // Create a monthly exam schedule
    const schedule = ExamData.createSchedule({
      name: '第一次期中考',
      type: 'monthly',
      dates: ['2026-03-27', '2026-03-28'],
      days: [
        { slots: [
          { period: 1, duration: 50 },
          { period: 2, duration: 80 },
          { period: 5, duration: 50 },
        ]},
        { slots: [
          { period: 1, duration: 50 },
          { period: 2, duration: 50 },
        ]},
      ],
      earlySubmit: { 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 15, 7: 30 },
    });

    // Activate it
    ExamData.setActiveScheduleId(schedule.id);

    // Get day 1 slots
    const slots = ExamData.getDaySlots(schedule, 0, settings.periods);
    expect(slots).toHaveLength(3);

    const schoolEndSec = ExamData.timeToSec(settings.schoolEnd[0], settings.schoolEnd[1]);

    // 07:00 - Before first exam
    let status = ExamEngine.computeStatus(slots, 7 * 3600, schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.BEFORE_EXAM);

    // 08:10 - Exam starts (period 1)
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(8, 10), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);
    expect(status.slot.label).toBe('第1節');

    // 08:30 - Still in exam
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(8, 30), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);
    expect(status.remainSec).toBe(30 * 60);

    // 08:46 - Can submit early (15 min before end at 09:00, so 14 min left)
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(8, 46), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.EARLY_SUBMIT);

    // 08:56 - Last 5 minutes (4 min left)
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(8, 56), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.LAST_5_MIN);

    // 09:00 - Period 1 ended, break before period 2
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(9, 0), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.BREAK);
    expect(status.nextSlot.label).toBe('第2節');

    // 09:10 - Period 2 starts (80 min)
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(9, 10), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);
    expect(status.slot.label).toBe('第2節');
    expect(status.slot.duration).toBe(80);

    // 10:30 - Period 2 ended
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(10, 30), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.BREAK);
    expect(status.nextSlot.label).toBe('第5節');

    // 13:55 - Period 5, last 5 minutes (end at 13:55)
    // Period 5 starts at 13:05, 50 min → ends at 13:55
    // At 13:51 → 4 min left
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(13, 51), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.LAST_5_MIN);

    // 14:00 - All exams done
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(14, 0), schoolEndSec);
    expect(status.status).toBe(ExamEngine.STATUS.SCHOOL_OVER);
  });

  it('day 2 has different slots', () => {
    const settings = ExamData.loadPeriodSettings();
    const schedule = ExamData.createSchedule({
      name: '月考',
      type: 'monthly',
      dates: ['2026-03-27', '2026-03-28'],
      days: [
        { slots: [{ period: 1, duration: 50 }] },
        { slots: [{ period: 3, duration: 100 }] },
      ],
    });

    const day2Slots = ExamData.getDaySlots(schedule, 1, settings.periods);
    expect(day2Slots).toHaveLength(1);
    expect(day2Slots[0].label).toBe('第3節');
    expect(day2Slots[0].duration).toBe(100);
    // Period 3 starts at 10:10, 100 min → ends at 11:50
    expect(day2Slots[0].endSec).toBe(ExamData.timeToSec(10, 10) + 100 * 60);
  });
});

describe('Full mock exam workflow', () => {
  it('creates mock schedule and computes status', () => {
    const schedule = ExamData.createSchedule({
      name: '職科第1次模擬考',
      type: 'mock',
      dates: ['2026-04-10', '2026-04-11'],
      days: [
        { slots: [
          { subject: '國文', start: [8, 20], duration: 100, earlySubmit: 0 },
          { subject: '英文', start: [10, 20], duration: 100, earlySubmit: 0 },
          { subject: '專一', start: [13, 10], duration: 100, earlySubmit: 0 },
        ]},
        { slots: [
          { subject: '數學', start: [8, 20], duration: 80, earlySubmit: 0 },
          { subject: '專二', start: [10, 20], duration: 100, earlySubmit: 0 },
        ]},
      ],
    });

    const day1Slots = ExamData.getDaySlots(schedule, 0);
    expect(day1Slots).toHaveLength(3);

    // 08:20 - 國文 starts
    let status = ExamEngine.computeStatus(day1Slots, ExamData.timeToSec(8, 20));
    expect(status.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);
    expect(status.slot.label).toBe('國文');

    // 09:55 - Last 5 min of 國文 (ends at 10:00)
    status = ExamEngine.computeStatus(day1Slots, ExamData.timeToSec(9, 56));
    expect(status.status).toBe(ExamEngine.STATUS.LAST_5_MIN);

    // 10:05 - Between 國文 and 英文
    status = ExamEngine.computeStatus(day1Slots, ExamData.timeToSec(10, 5));
    expect(status.status).toBe(ExamEngine.STATUS.BREAK);

    // No early submit for mock (earlySubmit = 0)
    // 11:30 - 英文, 30 min left (earlySubmit=0 → still active)
    status = ExamEngine.computeStatus(day1Slots, ExamData.timeToSec(11, 30));
    expect(status.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);

    // After all exams done
    status = ExamEngine.computeStatus(day1Slots, ExamData.timeToSec(15, 0));
    expect(status.status).toBe(ExamEngine.STATUS.SCHOOL_OVER);
  });

  it('mock with early submit enabled', () => {
    const schedule = ExamData.createSchedule({
      name: '模擬考(可交卷)',
      type: 'mock',
      dates: ['2026-05-01'],
      days: [{
        slots: [
          { subject: '國文', start: [8, 20], duration: 100, earlySubmit: 20 },
        ]
      }],
    });

    const slots = ExamData.getDaySlots(schedule, 0);
    // 國文: 8:20 ~ 10:00, early submit at 9:40 (20 min before end)
    // At 9:42 → 18 min left, within 20 min window
    let status = ExamEngine.computeStatus(slots, ExamData.timeToSec(9, 42));
    expect(status.status).toBe(ExamEngine.STATUS.EARLY_SUBMIT);

    // At 9:30 → 30 min left, outside 20 min window
    status = ExamEngine.computeStatus(slots, ExamData.timeToSec(9, 30));
    expect(status.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);
  });
});

describe('Custom period settings', () => {
  it('monthly slots use custom period times', () => {
    // Save custom period settings
    const settings = ExamData.loadPeriodSettings();
    settings.periods[0].start = [8, 30]; // Change period 1 from 8:10 to 8:30
    ExamData.savePeriodSettings(settings);

    const schedule = ExamData.createSchedule({
      name: '自訂月考',
      type: 'monthly',
      dates: ['2026-06-01'],
      days: [{ slots: [{ period: 1, duration: 50 }] }],
    });

    const loaded = ExamData.loadPeriodSettings();
    const slots = ExamData.getDaySlots(schedule, 0, loaded.periods);

    // Should use custom time 8:30
    expect(slots[0].startSec).toBe(ExamData.timeToSec(8, 30));
    expect(slots[0].endSec).toBe(ExamData.timeToSec(8, 30) + 50 * 60);
  });

  it('custom school end time affects display', () => {
    const settings = ExamData.loadPeriodSettings();
    settings.schoolEnd = [15, 30]; // Change to 15:30
    ExamData.savePeriodSettings(settings);

    const loaded = ExamData.loadPeriodSettings();
    expect(loaded.schoolEnd).toEqual([15, 30]);
  });
});

describe('Date matching and auto-activation', () => {
  it('findScheduleForDate correctly identifies day index', () => {
    ExamData.createSchedule({
      name: 'A',
      type: 'monthly',
      dates: ['2026-03-27', '2026-03-28'],
    });
    ExamData.createSchedule({
      name: 'B',
      type: 'mock',
      dates: ['2026-04-10', '2026-04-11'],
    });

    // Day 1 of A
    let r = ExamData.findScheduleForDate('2026-03-27');
    expect(r.schedule.name).toBe('A');
    expect(r.dayIndex).toBe(0);

    // Day 2 of B
    r = ExamData.findScheduleForDate('2026-04-11');
    expect(r.schedule.name).toBe('B');
    expect(r.dayIndex).toBe(1);

    // No match
    expect(ExamData.findScheduleForDate('2026-05-01')).toBeNull();
  });

  it('addDays handles month boundaries', () => {
    expect(ExamData.addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(ExamData.addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('Multiple schedule management', () => {
  it('can store and retrieve multiple schedules', () => {
    ExamData.createSchedule({ name: '月考1', type: 'monthly', dates: ['2026-03-01'] });
    ExamData.createSchedule({ name: '月考2', type: 'monthly', dates: ['2026-05-01'] });
    ExamData.createSchedule({ name: '模擬1', type: 'mock', dates: ['2026-04-01'] });

    const all = ExamData.loadAllSchedules();
    expect(all).toHaveLength(3);
    expect(all.map(s => s.name)).toEqual(['月考1', '月考2', '模擬1']);
  });

  it('deleting one schedule does not affect others', () => {
    const s1 = ExamData.createSchedule({ name: 'Keep', type: 'monthly' });
    const s2 = ExamData.createSchedule({ name: 'Delete', type: 'monthly' });

    ExamData.deleteSchedule(s2.id);
    const all = ExamData.loadAllSchedules();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Keep');
  });

  it('switching active schedule', () => {
    const s1 = ExamData.createSchedule({ name: 'A', type: 'monthly' });
    const s2 = ExamData.createSchedule({ name: 'B', type: 'mock' });

    ExamData.setActiveScheduleId(s1.id);
    expect(ExamData.getActiveSchedule().name).toBe('A');

    ExamData.setActiveScheduleId(s2.id);
    expect(ExamData.getActiveSchedule().name).toBe('B');

    ExamData.setActiveScheduleId(null);
    expect(ExamData.getActiveSchedule()).toBeNull();
  });
});

describe('Self-study periods', () => {
  it('monthly exam with study period in between', () => {
    const settings = ExamData.loadPeriodSettings();
    const schedule = ExamData.createSchedule({
      name: '月考含自習',
      type: 'monthly',
      dates: ['2026-03-27'],
      days: [{
        slots: [
          { period: 1, duration: 50 },
          { period: 2, duration: 50, isStudy: true },
          { period: 3, duration: 80 },
        ]
      }],
      earlySubmit: { 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 15, 7: 30 },
    });

    const slots = ExamData.getDaySlots(schedule, 0, settings.periods);
    expect(slots).toHaveLength(3);
    expect(slots[0].isStudy).toBe(false);
    expect(slots[1].isStudy).toBe(true);
    expect(slots[2].isStudy).toBe(false);

    const schoolEndSec = ExamData.timeToSec(16, 0);

    // Period 1: exam
    let s = ExamEngine.computeStatus(slots, ExamData.timeToSec(8, 20), schoolEndSec);
    expect(s.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);

    // Period 2: study (even with earlySubmit set, should be STUDY)
    s = ExamEngine.computeStatus(slots, ExamData.timeToSec(9, 20), schoolEndSec);
    expect(s.status).toBe(ExamEngine.STATUS.STUDY);
    expect(s.message).toContain('自習中');

    // Period 2: last 3 min — still STUDY, not LAST_5_MIN
    s = ExamEngine.computeStatus(slots, ExamData.timeToSec(9, 57), schoolEndSec);
    expect(s.status).toBe(ExamEngine.STATUS.STUDY);

    // Period 3: exam again
    s = ExamEngine.computeStatus(slots, ExamData.timeToSec(10, 20), schoolEndSec);
    expect(s.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);
  });

  it('mock exam with study slot', () => {
    const schedule = ExamData.createSchedule({
      name: '模擬含自習',
      type: 'mock',
      dates: ['2026-04-10'],
      days: [{
        slots: [
          { subject: '國文', start: [8, 20], duration: 100, earlySubmit: 0 },
          { subject: '自習', start: [10, 20], duration: 50, earlySubmit: 0, isStudy: true },
          { subject: '英文', start: [13, 10], duration: 100, earlySubmit: 0 },
        ]
      }],
    });

    const slots = ExamData.getDaySlots(schedule, 0);
    expect(slots[1].isStudy).toBe(true);

    let s = ExamEngine.computeStatus(slots, ExamData.timeToSec(10, 30));
    expect(s.status).toBe(ExamEngine.STATUS.STUDY);
  });
});

describe('Edge cases', () => {
  it('exam exactly at boundary (second precision)', () => {
    const slot = {
      label: '第1節',
      startSec: ExamData.timeToSec(8, 10),
      endSec: ExamData.timeToSec(9, 0),
      duration: 50,
      earlySubmitMin: 0,
    };

    // Exactly at start
    let s = ExamEngine.computeStatus([slot], ExamData.timeToSec(8, 10));
    expect(s.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);

    // One second before end → last 5 min
    s = ExamEngine.computeStatus([slot], ExamData.timeToSec(9, 0) - 1);
    expect(s.status).toBe(ExamEngine.STATUS.LAST_5_MIN);

    // 6 minutes before end → still active (no earlySubmit set)
    s = ExamEngine.computeStatus([slot], ExamData.timeToSec(9, 0) - 360);
    expect(s.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);

    // Exactly at end
    s = ExamEngine.computeStatus([slot], ExamData.timeToSec(9, 0));
    expect(s.status).toBe(ExamEngine.STATUS.SCHOOL_OVER);
  });

  it('early submit boundary exactly at threshold', () => {
    const slot = {
      label: '第1節',
      startSec: ExamData.timeToSec(8, 10),
      endSec: ExamData.timeToSec(9, 0),
      duration: 50,
      earlySubmitMin: 15,
    };

    // Exactly 15 min before end (at 8:45:00)
    let s = ExamEngine.computeStatus([slot], ExamData.timeToSec(8, 45));
    expect(s.status).toBe(ExamEngine.STATUS.EARLY_SUBMIT);

    // 15 min + 1 sec before end (at 8:44:59)
    s = ExamEngine.computeStatus([slot], ExamData.timeToSec(8, 45) - 1);
    expect(s.status).toBe(ExamEngine.STATUS.EXAM_ACTIVE);
  });

  it('empty days array handled gracefully', () => {
    const schedule = { type: 'monthly', days: [] };
    expect(ExamData.getDaySlots(schedule, 0)).toEqual([]);
    expect(ExamData.getDaySlots(schedule, 99)).toEqual([]);
  });

  it('status with null slots returns IDLE', () => {
    expect(ExamEngine.computeStatus(null, 0).status).toBe(ExamEngine.STATUS.IDLE);
  });
});
