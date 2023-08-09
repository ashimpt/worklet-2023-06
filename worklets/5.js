// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, setup, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////
setup(Math2);
const g2 = 98;

const lopO = Lop.create({ k: exp(-7 / sr) });
const rndSq = () => rnd() ** 0.5;
const rndLfo0 = Hold.create({ k: exp(-9 / sr), l: sr / 8, f: rndSq });
const rndLfo1 = Hold.create({ k: exp(-9 / sr), l: sr / 3, f: rndSq });
const rndTg = () => (rnd(3) < 1 ? 1 : 0);
const rndToggle = Hold.create({ k: exp(-99 / sr), l: sr / 1, f: rndTg });

const tapes = [0, 1].map(() => new Loop(4));
const bag = Bag.create({ bag: [-2, -1, 1, 2] });
const hps = [0, 1].map(() => Filter.create({ type: "high", f: 20, q: 0.7 }));
const lps = [0, 1].map(() => Filter.create({ f: 10e3 }));
const lop0 = Lop.create({ k: exp(-333 / sr) });

let oct = 0;
let p1 = 0;
let fMod = 8;
process(5, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    if (!i || (i % (sr / 4) == 0 && rnd(4) < 1)) {
      oct = floor(rnd(0, 4, 2));
    }

    const p0 = TAU * g2 * t;
    const o = lopO(oct);
    p1 += TAU * g2 * 2 ** o * (1 / sr);
    const b1a = mix(4, 1, o / 3) * sin(2 * p1);
    const b1 = 1.5 * rndLfo0(i) * am(3 * t) ** 7 * sin(p0 / 2 + b1a); // beat
    const w0 = TAU * phase(2.5 * t, 1) ** 2;
    const b2 = 0.3 * rndLfo1(i) * sin(w0 + sin(32 * p0)); // high
    const b0 = sin(p0 + b1 + b2);
    if (i % sr == 0) fMod = round(rnd(4, 10));
    const a3 = lop0(mix(1, (fMod * t) % 1 < 0.5, rndToggle(i)));
    const b3 = sin(p1 + sin(p1 / 2));
    const b = 0.2 * mix(b0, a3 * b0 * b3, 0.7);
    for (let ch = 2; ch--; ) data[ch][i0] += b;

    for (let ch = 2; ch--; ) {
      const tape = tapes[ch];
      if (!tape.x || tape.x > sr || tape.x < -sr) {
        tape.x = 0;
        tape.v = 2 ** (bag() / 9);
      }
      const e0 = asd(phase(tape.x, sr), 1e-3, 1e-3);
      const fb0 = e0 * tapes[ch ^ 1].get(i - sr + tape.x);
      const fb1 = e0 * tapes[ch & 1].get(i - sr + tape.x);
      const fb = mix(-fb0, fb1, 0.3);
      tape.set(b + 0.93 * fb, i);
      data[ch][i0] += 1.2 * fb;

      tape.x += tape.v - 1;
    }
  }

  for (let ch = 2; ch--; )
    for (let i = 0; i < spb; i++) {
      data[ch][i] = lps[ch](hps[ch](data[ch][i]));
    }
});
