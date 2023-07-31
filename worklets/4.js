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
const holds = [0, 1].map(() => Hold.create({ k: exp(-35 / sr), l: sr / 5 }));

const durPhrase = 2;
const rndMelody = rnd();
const melody = (x) => 0.5 * am(5 * x + 0.5 * am(7 * x)) + 0.5 * am(3 * x);
const crushF = (a, b) => floor(a / b) * b;
const lp = Filter.create({ f: 3000, q: 0.7 });
const hp = Filter.create({ type: "high", f: 100, q: 0.7 });
const sh = SH.create({ l: round(sr / freq(18)) });
const lop = Lop.create({ k: exp(-1000 / sr) });

let f, t0, a0, length, accent;
let p = 0;
let b2 = 0;
const l0 = sr / 15;
const l1 = sr / +5;

function updateNote(i, t, s) {
  if (i % (durPhrase * sr) == 0) t0 = crushF(t, 4 * durPhrase);
  f = freq(5 + 18 * melody(rndMelody + 0.07 * t0 + (t % durPhrase) / 14));
  a0 = min(1, 2 / log2(f / 100));
  if (phase(t, 4 * durPhrase) >= 0.5) f *= 2 ** (tet == 9 ? 4 / 9 : 5 / 12);
}
updateNote(0, 0, 0);

process(4, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    if (i % l0 == 0) {
      const s = (5 * t) % 10;
      if (rnd(8) < 1) length = l0;
      else if ((0b1011110000 >> s) & 1 && (5 * t) % 20 >= 10) length = l0;
      else length = l1;

      accent = (0b0010100101 >> s) & 1 ? 1 : 0;
      if (i % length == 0) updateNote(i, t, s);
    }

    p += TAU * f * (1 / sr);
    const a1 = lop(a0);
    const b0 = 0.25 * a1 * sin((2 / 3) * p);
    const b3 = 1.5 * accent * asd(5 * t, 0.1) * b2;
    b2 = sin(p + b0 + b3);
    const b1 = mix(b2, sh(b2, i), 0.5 * am(3 * am(t / 23)));
    const b = 0.12 * a1 * hp(lp(b1));

    for (let ch = 2; ch--; ) {
      const sec = (ch ? 0.26 : 0.23) + 5e-3 * holds[ch](i);
      const fb = -tapes[ch].get(i - sr * sec);
      tapes[ch].set(b + 0.7 * fb, i);
      data[ch][i0] += b + 0.9 * fb;
    }
  }
});
