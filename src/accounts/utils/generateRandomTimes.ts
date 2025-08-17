import { getRandomDelayMS } from "./getRandomDelayMS";

interface Time { hour: number; minute: number; activeTime: number }

const addRandomTime = (start: number = 7, end: number = 24) => {
  const hour = Math.floor(Math.random() * (end - start + 1)) + start;
  const minute = Math.floor(Math.random() * 60);
  const activeTime = getRandomDelayMS();

  return {hour, minute, activeTime};
}

const getRandomNumbers = (n: number) => {
  const count = Math.floor(n * 0.8); 

  const arr = Array.from({ length: n }, (_, i) => i + 1);

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.slice(0, count);
}

export const generateRandomTimes = (count: number, start: number = 7, end: number = 24, used: Set<string> = new Set()): [Time[], Set<string>] => {
  const result: Time[] = [];

  while (result.length < count) {
    const {hour, minute, activeTime} = addRandomTime(start, end);
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    if (!used.has(timeStr)) {
      used.add(timeStr);

      result.push({ hour, minute, activeTime });
    }
  }

  return [result, used];
}

export const generateRandomTimesForCounts = (
  groupCount: number,             
  minPer: number = 1,             
  maxPer: number = 10
) => {
  if (minPer < 1 || maxPer < minPer) {
    throw new Error("Неправильные границы minPer / maxPer");
  }

  const allBatches: Record<string, 
    [Time[], Set<string> | null]
  > = {};

  const accountsWithEveningEntries = getRandomNumbers(groupCount);
  for (const accIdx of accountsWithEveningEntries){
    const randomSize = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
    const [batch, used] = generateRandomTimes(randomSize, 19, 23);
    allBatches[accIdx - 1] = [batch, used];
  }

  for (let i = 0; i < groupCount; i++) {
    const [accBatches, used] = allBatches[i] || [[], new Set()];

    accBatches.push(addRandomTime(7, 11));
    accBatches.push(addRandomTime(17, 21));

    let randomSize = Math.floor(Math.random() * (maxPer - minPer + 1)) + minPer - accBatches.length;
    if (randomSize > 0){
      const batch = generateRandomTimes(randomSize, 7, 24, used || new Set())[0];
      allBatches[i] = [batch.concat(accBatches), null];
    }
  }

  return Object.values(allBatches).map(v => v[0].sort((a, b) => {
    if (a.hour !== b.hour) {
      return a.hour - b.hour;
    }
    return a.minute - b.minute;
  })
);
};