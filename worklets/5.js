// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, setup, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////
setup(Math2);

const lopO = Lop.create({ k: exp(-7 / sr) });
const func0 = () => rnd() ** 0.5;
const hold0 = Hold.create({ k: exp(-9 / sr), l: sr / 8, f: func0 });
const hold1 = Hold.create({ k: exp(-9 / sr), l: sr / 3, f: func0 });

const tapes = [0, 1].map(() => new Loop(4));
const bag = Bag.create({ bag: [-2, -1, 1, 2] });
const hps = [0, 1].map(() => Filter.create({ type: "high", f: 20, q: 0.7 }));
const lps = [0, 1].map(() => Filter.create({ f: 10e3 }));

let oct = 0;
let p1 = 0;
process(5, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    if (!i || (i % (sr / 4) == 0 && rnd(4) < 1)) {
      oct = floor(rnd(0, 4, 2));
    }

    const p0 = TAU * 100 * t;
    const o = lopO(oct);
    p1 += TAU * 100 * 2 ** o * (1 / sr);
    const b1a = mix(4, 1, o / 3) * sin(2 * p1);
    const b1 = 1.5 * hold0(i) * am(3 * t) ** 7 * sin(p0 / 2 + b1a);
    const b2 = 0.3 * hold1(i) * sin(TAU * 2.5 * t + sin(32 * p0));
    const b0 = sin(p0 + b1 + b2);
    const b3 = b0 * sin(p1 + sin(0.5 * p1));
    const b = 0.2 * mix(b0, b3, 0.5);
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
