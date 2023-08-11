// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { Math2, sr, params, process } from "../mod.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
////////////////////////////////////////////////////////////////////////////////
const opt = { id: 4, amp: 0.133 };

const tet = params.tet12 ? 12 : 9;
const keys = params.tet12 ? [0, 4, 5, 7, 11] : [0, 3, 4, 5, 8];
const freq = (n) => 98 * 2 ** (floor(n / 5) + keys.at(mod(n, 5)) / tet);

const tapes = [0, 1].map(() => new Loop());
const holds = [0, 1].map(() => Hold.create({ k: exp(-35 / sr), l: sr / 5 }));

const durPhrase = 2;
const lPhrase = durPhrase * sr;

const rndMelody = rnd();
const melMod = (x) => 0.5 * am(7 * x);
const melody = (x) => 0.5 * am(5 * x + melMod(x)) + 0.5 * am(3 * x);
const lp = Filter.create({ u: 1 });
const sh = SH.create({ l: round(sr / freq(18)) });

let f, o, t0, a0, length, accent;
let p = 0;
let b2 = 0;
const div = 10;
const l0 = lPhrase / div / 3;
const l1 = lPhrase / div;

function updateNote(i, t, s) {
  if (i % lPhrase == 0) t0 = 0.07 * crush(t, 4 * durPhrase, floor);
  f = freq(5 + 18 * melody(rndMelody + t0 + 0.0715 * (t % durPhrase)));
  o = log2(f / 100);
  a0 = min(1, 2 / o);
  if (phase(t, 4 * durPhrase) >= 0.5) f *= 2 ** (tet == 9 ? 4 / 9 : 5 / 12);
}
updateNote(0, 0, 0);

process(opt, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    if (i % l0 == 0) {
      const s = div * phase(i, lPhrase);
      accent = (0b0010100101 >> s) & 1 ? 1 : 0;

      if (i % l1 == 0) {
        if (!accent && rnd(4) < 1) length = l0;
        else if ((0b1011101000 >> s) & 1) {
          if (phase(i, 2 * lPhrase) > 0.5) length = l0;
        } else length = l1;
      }

      if (i % length == 0) updateNote(i, t, s);
    }

    p += TAU * f * (1 / sr);
    const p0 = phase(i, l0);
    const p1 = phase(i, l1);
    const e0 = asd(length == l0 ? p0 : p1, 0.05, 0.05);
    const b0 = 0.5 * a0 * (1 - p1) * sin((2 / 3) * p);
    const b3 = 1.5 * accent * asd(p1, 0.1) * b2;
    b2 = sin(p + b0 + b3);
    const b1 = mix(b2, sh(b2, i), 0.5 * am(3 * am(t / 23)));
    const ff = 2e3 * 2 ** am(t / 180);
    const b = a0 * e0 * lp(b1, ff, 0.7);
    for (let ch = 2; ch--; ) data[ch][i0] += b;

    for (let ch = 2; ch--; ) {
      const sec = (ch ? 0.26 : 0.23) + 5e-3 * holds[ch](i);
      const fb = tapes[ch].get(i - sr * sec);
      tapes[ch].set(b - 0.7 * fb, i);
      data[ch][i0] += 0.9 * fb;
    }
  }
});
