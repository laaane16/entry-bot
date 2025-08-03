import { getRandomDelayMS } from "./getRandomDelayMS";

export const generateRandomTimes = (count: number) => {
  const used = new Set();
  const result = [];

  while (result.length < count) {
    const hour = Math.floor(Math.random() * (24 - 7)) + 7; // 7..23
    const minute = Math.floor(Math.random() * 60);
    const activeTime = getRandomDelayMS();

    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (!used.has(timeStr)) {
      used.add(timeStr);
      result.push({ hour, minute, activeTime });
    }
  }

  return result;
}

export const generateRandomTimesForCounts = (
  groupCount: number,             
  minPer: number = 1,             
  maxPer: number = 10
) => {
  if (minPer < 1 || maxPer < minPer) {
    throw new Error("Неправильные границы minPer / maxPer");
  }

  const allBatches: Array<
    { hour: number; minute: number; activeTime: number }[]
  > = [];

  for (let i = 0; i < groupCount; i++) {
    const randomSize = Math.floor(Math.random() * (maxPer - minPer + 1)) + minPer;
    const batch = generateRandomTimes(randomSize);
    allBatches.push(batch);
  }

  return allBatches;
};