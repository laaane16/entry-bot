import { getRandomDelayMS } from "./getRandomDelayMS";

interface Time { hour: number; minute: number; activeTime: number }

export const generateRandomTimes = (count: number) => {
  const used = new Set();
  const result: Time[] = [];

  const addRandomTime = (start: number = 7, end: number = 24) => {
    const hour = Math.floor(Math.random() * (end - start + 1)) + start;
    const minute = Math.floor(Math.random() * 60);
    const activeTime = getRandomDelayMS();

    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (!used.has(timeStr)) {
      used.add(timeStr);
      result.push({ hour, minute, activeTime });
    }
  }

  addRandomTime(7, 11);
  addRandomTime(17, 21);

  while (result.length < count) {
    addRandomTime();
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
    Time[]
  > = [];

  for (let i = 0; i < groupCount; i++) {
    const randomSize = Math.floor(Math.random() * (maxPer - minPer + 1)) + minPer;
    const batch = generateRandomTimes(randomSize);
    allBatches.push(batch);
  }

  return allBatches;
};