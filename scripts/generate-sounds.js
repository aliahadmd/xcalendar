// Generates tiny UI sounds as WAV files (44.1kHz 16-bit mono).
// Run: node scripts/generate-sounds.js
const fs = require("fs");
const path = require("path");

const SR = 44100;

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function env(i, n, attack = 0.004, release = 0.5) {
  const t = i / SR;
  const dur = n / SR;
  const a = Math.min(1, t / attack);
  const r = Math.pow(1 - t / dur, 1 / release * 0.5 + 1);
  return a * r;
}

function tone(freq, dur, gain, curve = 1) {
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * Math.pow(curve, t);
    out[i] = Math.sin(2 * Math.PI * f * t) * env(i, n) * gain;
  }
  return out;
}

function mix(...parts) {
  const len = Math.max(...parts.map((p) => p.length + (p._delay ?? 0)));
  const out = new Float64Array(len);
  for (const p of parts) {
    const delay = p._delay || 0;
    for (let i = 0; i < p.length; i++) out[i + delay] += p[i];
  }
  return out;
}

function delayed(samples, delaySec) {
  const s = new Float64Array(samples);
  s._delay = Math.floor(SR * delaySec);
  return s;
}

// tick — soft short click, like a gentle selector
const tick = mix(tone(1800, 0.035, 0.28), tone(900, 0.05, 0.12));

// complete — two-note rising chime (E6 -> B6), warm with soft harmonic
const complete = mix(
  tone(1318.5, 0.16, 0.3),
  delayed(tone(1975.5, 0.28, 0.24), 0.09),
  delayed(tone(659.3, 0.3, 0.08), 0.09),
);

// save — quick airy up-sweep
const save = mix(tone(520, 0.18, 0.24, 2.4), tone(1040, 0.14, 0.1, 2.2));

// delete — short low double-tap
const del = mix(tone(300, 0.07, 0.3), delayed(tone(220, 0.09, 0.26), 0.08));

const outDir = path.join(__dirname, "..", "assets", "sounds");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "tick.wav"), toWav(tick));
fs.writeFileSync(path.join(outDir, "complete.wav"), toWav(complete));
fs.writeFileSync(path.join(outDir, "save.wav"), toWav(save));
fs.writeFileSync(path.join(outDir, "delete.wav"), toWav(del));
console.log("Wrote 4 sounds to assets/sounds/");
