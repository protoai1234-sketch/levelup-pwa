import { LEVEL_NAMES } from '../constants';

export function getLevel(xp) {
  return Math.floor(xp / 1500) + 1;
}

export function getLevelName(level) {
  if (level >= 9) return 'Legend';
  return LEVEL_NAMES[level] || 'Legend';
}

export function getProgressToNextLevel(xp) {
  const level = getLevel(xp);
  const currentStart = (level - 1) * 1500;
  const nextStart = level * 1500;
  return (xp - currentStart) / (nextStart - currentStart);
}

export function getXPToNextLevel(xp) {
  const level = getLevel(xp);
  return level * 1500 - xp;
}
