// What the mascot's colors mean. Single source for the 3D scene, the halo, the legend and Settings.
// Amber is deliberately NOT a resting state: it only ever appears as the "asked you" flare, so
// amber keeps one meaning across the whole app (the For-you card, the nudge, the flare).
import type { PresenceState } from './Presence';

export interface PresenceMeaning { key: PresenceState | 'flare'; hex: string; word: string; meaning: string }

export const PRESENCE_HEX: Record<PresenceState, string> = {
  idle: '#a39a8c',         // warm stone
  listening: '#8db6ff',    // brand blue
  transcribing: '#7fd8ff', // light cyan
  thinking: '#b99dff',     // violet
  speaking: '#6fd6a4',     // green
};
export const FLARE_HEX = '#f6b93b';

export const PRESENCE_WORD: Record<PresenceState, string> = {
  idle: 'Waiting',
  listening: 'Listening',
  transcribing: 'Writing',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

export const PRESENCE_LEGEND: PresenceMeaning[] = [
  { key: 'idle', hex: PRESENCE_HEX.idle, word: 'waiting', meaning: 'Paused or nobody is talking yet.' },
  { key: 'listening', hex: PRESENCE_HEX.listening, word: 'listening', meaning: 'The mic is open and it hears the room.' },
  { key: 'transcribing', hex: PRESENCE_HEX.transcribing, word: 'writing', meaning: 'Someone is talking; their words are landing in captions.' },
  { key: 'thinking', hex: PRESENCE_HEX.thinking, word: 'thinking', meaning: 'Updating the ledger or preparing your catch-up.' },
  { key: 'speaking', hex: PRESENCE_HEX.speaking, word: 'speaking', meaning: 'Saying your line out loud in the next gap.' },
  { key: 'flare', hex: FLARE_HEX, word: 'asked you', meaning: 'A brief amber flare: someone just asked you something.' },
];

export const PRESENCE_PROMISE = 'The mascot shows what the clerk is doing so you never have to wonder if it heard.';
