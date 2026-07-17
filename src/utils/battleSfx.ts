export type BattleSfxName =
  | "countdown"
  | "go"
  | "tap"
  | "wheelStart"
  | "wheelStop"
  | "chargeTap"
  | "rainbowReady"
  | "rainbowHit"
  | "rainbowMiss"
  | "attack"
  | "impact"
  | "hpDrain"
  | "handoff";

let audioContext: AudioContext | null = null;
let muted = false;
let lastTapAt = 0;
let audioPrimed = false;
let resumePending = false;
let musicTimer: number | null = null;
let musicStep = 0;
export type BattleMusicTrack = 0 | 1 | 2;
let currentMusicTrack: BattleMusicTrack = 0;

export const BATTLE_MUSIC_TRACKS = [
  { name: "Neon Arena", interval: 360, roots: [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 130.81], lead: [2, 2.25, 2, 1.5], wave: "square" as OscillatorType },
  { name: "Meteor Rush", interval: 285, roots: [98, 146.83, 123.47, 164.81, 98, 174.61, 146.83, 123.47], lead: [2, 3, 2.5, 3], wave: "sawtooth" as OscillatorType },
  { name: "Final Clash", interval: 410, roots: [130.81, 116.54, 98, 116.54, 130.81, 155.56, 146.83, 116.54], lead: [1.5, 2, 2.5, 2], wave: "triangle" as OscillatorType },
] as const;

const SFX_VOLUME_BOOST = 1.8;
const MUSIC_VOLUME_BOOST = 2.6;

function context() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

export function setBattleSfxMuted(value: boolean) {
  muted = value;
  if (value) stopBattleMusic();
}

export async function unlockBattleAudio() {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  if (ctx.state === "running" && !audioPrimed) {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
    audioPrimed = true;
  }
}

function tone(frequency: number, duration: number, gainValue = 0.035, endFrequency?: number, delay = 0) {
  if (muted) return;
  const ctx = context();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.min(0.18, gainValue * SFX_VOLUME_BOOST), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(duration = 0.12, gainValue = 0.035, delay = 0) {
  if (muted) return;
  const ctx = context();
  if (!ctx || ctx.state !== "running") return;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = Math.min(0.16, gainValue * SFX_VOLUME_BOOST);
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

function musicTone(frequency: number, duration: number, gainValue: number, delay = 0, wave: OscillatorType = "square") {
  if (muted) return;
  const ctx = context();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.min(0.12, gainValue * MUSIC_VOLUME_BOOST), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function scheduleBattleMusicStep() {
  const track = BATTLE_MUSIC_TRACKS[currentMusicTrack];
  const root = track.roots[musicStep % track.roots.length];
  const leadRatio = track.lead[musicStep % track.lead.length];
  musicTone(root, track.interval / 1000 * 0.82, 0.021, 0, track.wave);
  musicTone(root * leadRatio, 0.11, 0.010, 0.045, track.wave);
  if (musicStep % 2 === 0) musicTone(root * 1.5, 0.17, 0.008, track.interval / 2000, "triangle");
  if (currentMusicTrack === 1 && musicStep % 2 === 1) musicTone(root * 4, 0.055, 0.006, 0.12, "square");
  if (currentMusicTrack === 2 && musicStep % 4 === 3) musicTone(root * 0.5, 0.28, 0.012, 0.05, "sawtooth");
  musicStep += 1;
}

export async function startBattleMusic(track: BattleMusicTrack = currentMusicTrack) {
  if (muted) return;
  if (track !== currentMusicTrack) {
    stopBattleMusic();
    currentMusicTrack = track;
  }
  if (musicTimer !== null) return;
  await unlockBattleAudio();
  const ctx = context();
  if (!ctx || ctx.state !== "running" || muted || musicTimer !== null) return;
  scheduleBattleMusicStep();
  musicTimer = window.setInterval(scheduleBattleMusicStep, BATTLE_MUSIC_TRACKS[currentMusicTrack].interval);
}

export function stopBattleMusic() {
  if (musicTimer !== null && typeof window !== "undefined") window.clearInterval(musicTimer);
  musicTimer = null;
  musicStep = 0;
}

export function playVictoryMusic() {
  if (muted) return;
  stopBattleMusic();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((frequency, index) => {
    musicTone(frequency, 0.32, 0.035, index * 0.16, "triangle");
    musicTone(frequency / 2, 0.38, 0.018, index * 0.16, "square");
  });
  musicTone(523.25, 0.85, 0.032, 0.72, "triangle");
  musicTone(659.25, 0.85, 0.026, 0.72, "triangle");
  musicTone(783.99, 0.85, 0.026, 0.72, "triangle");
  musicTone(1046.5, 1.0, 0.028, 0.72, "sine");
}

export function playBattleSfx(name: BattleSfxName, intensity = 0) {
  if (muted) return;
  const ctx = context();
  if (ctx && ctx.state === "suspended") {
    if (!resumePending) {
      resumePending = true;
      void ctx.resume()
        .then(() => {
          resumePending = false;
          if (ctx.state === "running") playBattleSfx(name, intensity);
        })
        .catch(() => { resumePending = false; });
    }
    return;
  }
  if (name === "tap" || name === "chargeTap") {
    const now = performance.now();
    if (now - lastTapAt < 42) return;
    lastTapAt = now;
  }

  switch (name) {
    case "countdown": tone(440, 0.09, 0.025); break;
    case "go":
      tone(520, 0.34, 0.072, 1040);
      tone(1040, 0.26, 0.06, 680, 0.08);
      tone(130, 0.28, 0.065, 70);
      noise(0.16, 0.055);
      break;
    case "tap": tone(210 + Math.min(100, intensity * 5), 0.045, 0.018, 280 + intensity * 4); break;
    case "wheelStart": tone(130, 0.55, 0.028, 360); break;
    case "wheelStop": tone(760, 0.15, 0.045, 420); noise(0.10, 0.03); break;
    case "chargeTap": tone(280 + Math.min(420, intensity * 32), 0.055, 0.022, 360 + intensity * 36); break;
    case "rainbowReady":
      tone(440, 0.18, 0.026);
      tone(660, 0.18, 0.026, undefined, 0.16);
      tone(880, 0.24, 0.03, undefined, 0.32);
      break;
    case "rainbowHit":
      tone(523, 0.35, 0.03);
      tone(659, 0.35, 0.03, undefined, 0.05);
      tone(784, 0.42, 0.032, undefined, 0.10);
      break;
    case "rainbowMiss": tone(360, 0.28, 0.025, 190); break;
    case "attack": tone(180, 0.38, 0.04, 720); noise(0.22, 0.018); break;
    case "impact": tone(110, 0.28, 0.055, 55); noise(0.20, 0.05); break;
    case "hpDrain": tone(420, 0.44, 0.025, 160); break;
    case "handoff": tone(392, 0.16, 0.025); tone(587, 0.22, 0.027, undefined, 0.13); break;
  }
}
