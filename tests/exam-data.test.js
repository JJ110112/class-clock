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

const ExamData = (await import('../js/exam-data.js')).default || require('../js/exam-data.js');

beforeEach(() => {
  localStorageMock.clear();
});

describe('ExamData helpers', () => {
  it('timeToSec converts hours and minutes to seconds', () => {
    expect(ExamData.timeToSec(0, 0)).toBe(0);
    expect(ExamData.timeToSec(1, 0)).toBe(3600);
    expect(ExamData.timeToSec(8, 10)).toBe(29400);
    expect(ExamData.timeToSec(16, 0)).toBe(57600);
  });

  it('secToTime converts seconds to [h, m]', () => {
    expect(ExamData.secToTime(0)).toEqual([0, 0]);
    expect(ExamData.secToTime(3600)).toEqual([1, 0]);
    expect(ExamData.secToTime(29400)).toEqual([8, 10]);
  });

  it('toDateStr formats date as YYYY-MM-DD', () => {
    expect(ExamData.toDateStr(new Date(2026, 2, 27))).toBe('2026-03-27');
    expect(ExamData.toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('addDays adds days to a date string', () => {
    expect(ExamData.addDays('2026-03-27', 1)).toBe('2026-03-28');
    expect(ExamData.addDays('2026-03-27', 2)).toBe('2026-03-29');
    expect(ExamData.addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('Period Settings', () => {
  it('loads defaults when nothing saved', () => {
    const settings = ExamData.loadPeriodSettings();
    expect(settings.periods).toHaveLength(7);
    expect(settings.periods[0]).toEqual({ label: '1', start: [8, 10] });
    expect(settings.schoolEnd).toEqual([16, 0]);
  });

  it('saves and loads custom settings', () => {
    const custom = {
      periods: ExamData.DEFAULT_PERIODS.map(p => ({ ...p, start: [...p.start] })),
      schoolEnd: [15, 30],
    };
    custom.periods[0].start = [8, 20];
    ExamData.savePeriodSettings(custom);
    const loaded = ExamData.loadPeriodSettings();
    expect(loaded.periods[0].start).toEqual([8, 20]);
    expect(loaded.schoolEnd).toEqual([15, 30]);
  });
});

describe('Schedule CRUD', () => {
  it('creates a schedule with generated id', () => {
    const s = ExamData.createSchedule({
      name: '第一次期中考',
      type: 'monthly',
      dates: ['2026-03-27', '2026-03-28'],
      days: [
        { slots: [{ period: 1, duration: 50 }, { period: 2, duration: 80 }] },
        { slots: [{ period: 1, duration: 50 }] },
      ],
    });
    expect(s.id).toBeTruthy();
    expect(s.name).toBe('第一次期中考');
    expect(s.type).toBe('monthly');
    expect(s.days).toHaveLength(2);
    expect(s.earlySubmit).toEqual(ExamData.DEFAULT_EARLY_SUBMIT_MONTHLY);
  });

  it('loads all schedules', () => {
    ExamData.createSchedule({ name: 'A', type: 'monthly' });
    ExamData.createSchedule({ name: 'B', type: 'mock' });
    const all = ExamData.loadAllSchedules();
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('A');
    expect(all[1].name).toBe('B');
  });

  it('updates a schedule', () => {
    const s = ExamData.createSchedule({ name: 'Old', type: 'monthly' });
    const updated = ExamData.updateSchedule(s.id, { name: 'New' });
    expect(updated.name).toBe('New');
    expect(ExamData.getScheduleById(s.id).name).toBe('New');
  });

  it('returns null when updating non-existent id', () => {
    expect(ExamData.updateSchedule('nonexistent', { name: 'X' })).toBeNull();
  });

  it('deletes a schedule', () => {
    const s = ExamData.createSchedule({ name: 'Del', type: 'monthly' });
    expect(ExamData.deleteSchedule(s.id)).toBe(true);
    expect(ExamData.loadAllSchedules()).toHaveLength(0);
  });

  it('returns false when deleting non-existent id', () => {
    expect(ExamData.deleteSchedule('nonexistent')).toBe(false);
  });

  it('clears active schedule when deleting it', () => {
    const s = ExamData.createSchedule({ name: 'Act', type: 'monthly' });
    ExamData.setActiveScheduleId(s.id);
    ExamData.deleteSchedule(s.id);
    expect(ExamData.getActiveScheduleId()).toBeNull();
  });
});

describe('Active Schedule', () => {
  it('returns null when no active schedule', () => {
    expect(ExamData.getActiveScheduleId()).toBeNull();
    expect(ExamData.getActiveSchedule()).toBeNull();
  });

  it('sets and gets active schedule', () => {
    const s = ExamData.createSchedule({ name: 'Active', type: 'monthly' });
    ExamData.setActiveScheduleId(s.id);
    expect(ExamData.getActiveScheduleId()).toBe(s.id);
    expect(ExamData.getActiveSchedule().name).toBe('Active');
  });

  it('clears active schedule', () => {
    ExamData.setActiveScheduleId('some-id');
    ExamData.setActiveScheduleId(null);
    expect(ExamData.getActiveScheduleId()).toBeNull();
  });
});

describe('findScheduleForDate', () => {
  it('finds matching schedule and day index', () => {
    ExamData.createSchedule({
      name: '月考',
      type: 'monthly',
      dates: ['2026-03-27', '2026-03-28'],
    });
    const result = ExamData.findScheduleForDate('2026-03-28');
    expect(result).not.toBeNull();
    expect(result.schedule.name).toBe('月考');
    expect(result.dayIndex).toBe(1);
  });

  it('returns null when no match', () => {
    ExamData.createSchedule({
      name: '月考',
      type: 'monthly',
      dates: ['2026-03-27'],
    });
    expect(ExamData.findScheduleForDate('2026-04-01')).toBeNull();
  });
});

describe('getDaySlots', () => {
  it('computes monthly slots with period start times', () => {
    const schedule = {
      type: 'monthly',
      days: [{ slots: [{ period: 1, duration: 50 }, { period: 3, duration: 80 }] }],
      earlySubmit: { 1: 15, 3: 15 },
    };
    const periods = ExamData.DEFAULT_PERIODS;
    const slots = ExamData.getDaySlots(schedule, 0, periods);

    expect(slots).toHaveLength(2);
    expect(slots[0].label).toBe('第1節');
    expect(slots[0].startSec).toBe(ExamData.timeToSec(8, 10));
    expect(slots[0].endSec).toBe(ExamData.timeToSec(8, 10) + 50 * 60);
    expect(slots[0].earlySubmitMin).toBe(15);

    expect(slots[1].label).toBe('第3節');
    expect(slots[1].startSec).toBe(ExamData.timeToSec(10, 10));
    expect(slots[1].duration).toBe(80);
  });

  it('computes mock slots with custom start times', () => {
    const schedule = {
      type: 'mock',
      days: [{
        slots: [
          { subject: '國文', start: [8, 20], duration: 100, earlySubmit: 0 },
          { subject: '英文', start: [10, 20], duration: 100, earlySubmit: 0 },
        ]
      }],
    };
    const slots = ExamData.getDaySlots(schedule, 0);

    expect(slots).toHaveLength(2);
    expect(slots[0].subject).toBe('國文');
    expect(slots[0].startSec).toBe(ExamData.timeToSec(8, 20));
    expect(slots[0].endSec).toBe(ExamData.timeToSec(8, 20) + 100 * 60);
    expect(slots[0].earlySubmitMin).toBe(0);
  });

  it('returns empty array for non-existent day index', () => {
    const schedule = { type: 'monthly', days: [] };
    expect(ExamData.getDaySlots(schedule, 5)).toEqual([]);
  });
});

describe('Mute setting', () => {
  it('defaults to muted', () => {
    expect(ExamData.isMuted()).toBe(true);
  });

  it('saves and loads mute state', () => {
    ExamData.setMuted(false);
    expect(ExamData.isMuted()).toBe(false);
    ExamData.setMuted(true);
    expect(ExamData.isMuted()).toBe(true);
  });
});
