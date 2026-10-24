import type { ScheduleStore, TrainSchedule } from "@/lib/irctc-engine";

// Timetables rarely change, so a week-old copy is fine.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const keyOf = (trainNo: string) => `sched:${trainNo}`;

export const chromeScheduleStore: ScheduleStore = {
  async get(trainNo) {
    try {
      const key = keyOf(trainNo);
      const stored = (await chrome.storage.local.get(key))[key] as { at: number; data: TrainSchedule } | undefined;
      return stored && Date.now() - stored.at < TTL_MS ? stored.data : undefined;
    } catch {
      return undefined;
    }
  },
  async set(trainNo, schedule) {
    try {
      await chrome.storage.local.set({ [keyOf(trainNo)]: { at: Date.now(), data: schedule } });
    } catch {
      // Storage is a best-effort cache.
    }
  },
};
