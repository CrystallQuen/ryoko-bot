/**
 * Verrous en mémoire pour le quiz kanji.
 * - setupChannels : salons ayant un panneau de configuration ouvert
 * - startingChannels : salons dont le quiz est en cours de démarrage (verrou anti-doublon)
 */

const setupChannels = new Set<string>(); // channelId
const startingChannels = new Set<string>(); // channelId

export function hasOpenSetup(channelId: string): boolean {
  return setupChannels.has(channelId);
}
export function registerSetup(channelId: string): void {
  setupChannels.add(channelId);
}
export function clearSetup(channelId: string): void {
  setupChannels.delete(channelId);
}

export function isStarting(channelId: string): boolean {
  return startingChannels.has(channelId);
}
export function lockStart(channelId: string): void {
  startingChannels.add(channelId);
}
export function unlockStart(channelId: string): void {
  startingChannels.delete(channelId);
}
