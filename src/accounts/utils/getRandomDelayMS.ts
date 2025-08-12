export const getRandomDelayMS = (minSec = 30, maxSec = 600) => {
  const ms = 1000;

  return (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * ms;
}