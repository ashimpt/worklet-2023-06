// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, setup, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////

let tet = 9;
let keys = [0, 3, 4, 5, 8];
const freq = (n) => 100 * 2 ** (floor(n / 5) + keys.at(mod(n, 5)) / tet);
setup(Math2, (params) => {
  if (params.tet12) tet = 12;
  if (params.tet12) keys = [0, 4, 5, 7, 11];
});

const curve = (x) => mix(x, 0.5 + 0.5 * cos(PI + PI * x), 0.3);
const tapes = [0, 1].map(() => new Loop());
const hps = [0, 1].map(() => Filter.create({ type: "high", f: 20 }));

process(0, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    const u = 60 * (curve(phase(t, 20)) + floor(t / 20));
    const arp = ((7 + (floor(u / 120) % 3)) * floor(u)) % 15;
    const chord = (floor(u / 30) % 2) / tet;
    const octave = floor(u / 60) % 2;
    const f = freq(arp) * 2 ** (chord + octave);
    const o = log2(f / 50);
    const p = TAU * f * t;
    const q = TAU * 2 * t;
    const b0 = asd(u, 0.33, 0.33) * mix(sin((f + 3) * q), sin((f - 3) * q));
    const b1 = asd(u) * sin(p + (2 / o) * asd(u, 1e-9) * sin(E * p));
    const b = min(1, 2 / o) * (0.2 * b1 + 0.05 * b0);
    const pp = 0.5 + (-1) ** arp * mix(0, 0.25, arp / 14);
    for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;

    const m = 0.015 * sr * sin(t);
    for (let ch = 2; ch--; ) {
      const fb = tapes[ch ^ 1].get(i - sr / (ch ? 4 : 3) + (ch ? m : -m));
      const b0 = (0.8 / 4) * tanh(4 * fb);
      tapes[ch].set(data[ch][i0] + b0, i);
      data[ch][i0] += b0;
    }
  }

  for (let ch = 2; ch--; )
    for (let i = 0; i < spb; i++) {
      data[ch][i] = 1.6 * hps[ch](data[ch][i]);
    }
});
