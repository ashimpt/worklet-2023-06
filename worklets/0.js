// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////
const stg = { id: 0, amp: 2.351 };

const tet = params.tet;
const baseNotes = [1, 10 / 8, 4 / 3, 12 / 8, 15 / 8].map((v) => log2(v));
const notes = baseNotes.map((v) => (!tet ? v : round(crush(v, 1 / tet) * tet)));
if (tet == 5 || tet == 6) notes[1]--;
if (tet == 5) notes[4]--;
const freq = (n) => 98 * 2 ** (floor(n / 5) + notes.at(mod(n, 5)) / (tet || 1));

const transpose = [1, freq(2) / freq(1), freq(6) / freq(1), freq(7) / freq(1)];
const fm = freq(9) / freq(0) - 1;

const pLfo = rnd();
const fLfo = rnd(10, 12);
const curve = (x) => mix(x, am(x / 2), 0.3);
const decay = (p, dr) => clip(1 - (p % 1) / dr);
const tapes = [0, 1].map(() => new Loop());

process(stg, function (data, length, i0, i, t) {
  for (; i0 < length; i0++, t = ++i / sr) {
    const u = 60 * (curve(phase(t, 20)) + floor(t / 20));
    const arp = ((7 + (floor(u / 120) % 3)) * floor(u)) % 15;
    const f = freq(arp) * transpose.at((u / 30) % 4);
    const o = log2(f / 50);
    const p = TAU * f * t;
    const q = TAU * 2 * t;
    const df = 2.5 + o / 5;
    const b0 = asd(u, 0.33, 0.33) * mix(sin((f + df) * q), sin((f - df) * q));
    const b3a = o < 3 ? 0.7 * sin(800 * q) : 0;
    const b3 = 0.3 * decay(u, 0.05) * (sin(4 * p) + b3a);
    const b2 = (2.1 / o) * decay(u, 1) * sin(fm * p + b3);
    const b1 = asd(u) * sin(p + b2 - 0.5 * am(t / fLfo + pLfo) * b0);
    const b = min(1, 2 / o) * (0.2 * b1 + 0.07 * b0);
    const pp = 0.5 + (-1) ** arp * mix(0, 0.25, arp / 14);
    for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;

    const m0 = 0.015 * sr * sin(t);
    for (let ch = 2; ch--; ) {
      const fb = tapes[ch ^ 1].get(i - sr / (ch ? 4 : 3) + (ch ? m0 : -m0));
      const b0 = (0.8 / 4) * tanh(4 * fb);
      tapes[ch].set(data[ch][i0] + b0, i);
      data[ch][i0] += b0;
    }
  }
});
