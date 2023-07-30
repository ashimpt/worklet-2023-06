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
setup({ set12: () => ((tet = 12), (keys = [0, 4, 5, 7, 11])) });


const tapes = [0, 1].map(() => new Loop());
const curve = (x) => mix(x, 0.5 + 0.5 * cos(PI + PI * x), 0.3);
const hips = [0, 1].map(() => Filter.create({ type: "high", f: 20 }));

process(0, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    const u = 60 * (curve((t % 20) / 20) + floor(t / 20));
    const o = (floor(u / 30) % 2) / tet + (floor(u / 60) % 2);
    const f = freq(((7 + (floor(u / 120) % 3)) * floor(u)) % 15) * 2 ** o;

    const p = TAU * f * t;
    const e = asd(u);
    const a0 = min(1, 400 / f);
    const a1 = 1.5 / log2(f / 50);
    const b = 0.2 * a0 * e * sin(p + a1 * e * sin(E * p));
    const m = 0.02 * sr * sin(t);
    for (let ch = 2; ch--; ) {
      const fb = 0.8 * tapes[ch].get(i - sr / (ch ? 3 : 4) + (ch ? m : -m));
      const b0 = b + fb;
      tapes[ch ^ 1].set(-tanh(2 * b0) / 2, i);
      data[ch][i0] = hips[ch](b0);
    }
  }
});
