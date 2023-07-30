// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////

process(Infinity, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    const p = TAU * 200 * t;
    const b = 0.3 * sin(p + sin(p));
    for (let ch = 2; ch--; ) data[ch][i0] += b;
  }
});
