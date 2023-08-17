// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////
const stg = { id: 4, amp: 0.205 };

const tet = params.tet12 ? 12 : 9;
const notes = params.tet12 ? [0, 4, 5, 7, 11] : [0, 3, 4, 5, 8];
const freq = (n) => 98 * 2 ** (floor(n / 5) + notes.at(mod(n, 5)) / tet);
const shift = 2 ** (tet == 9 ? 4 / 9 : 5 / 12);

const tapes = [0, 1].map(() => new Loop());
const rndLfo = [0, 1].map(() => Hold.create({ k: exp(-35 / sr), l: sr / 5 }));

const rndMelody = rnd();
const melMod = (x) => 0.5 * am(7 * x);
const melody = (x) => 0.5 * am(5 * x + melMod(x)) + 0.5 * am(3 * x);
const lp = Filter.create({ u: 1 });
const sh = SH.create({ l: round(sr / freq(18)) });

let f, t0, a0, length;
let accent = 0;
let p = 0;
let b2 = 0;
const div = 10;
const dix = 2;
const l0 = round((2 * sr) / div / dix);
const l1 = dix * l0;
const lenPhrase = div * l1;
const durPhrase = lenPhrase / sr;

function updateNote(i, t, s, first) {
  if (i % lenPhrase == 0) t0 = 11e-3 * crush(t, 4 * durPhrase, floor);
  const phrase = (first ? 75e-3 : 50e-3) * (t % durPhrase);
  f = freq(5 + 18 * melody(rndMelody + t0 + phrase));
  if (phase(t, 4 * durPhrase) >= 0.5) f *= shift;
  a0 = min(1, 2 / log2(f / 100));
}
updateNote(0, 0, 0);

const asde = (p, a, d, e = 1, q = p % 1) => clip(min(q / a, (e - q) / d));

process(stg, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    if (i % l0 == 0) {
      const first = i % (2 * lenPhrase) < lenPhrase;
      const s = div * phase(i, lenPhrase);
      accent = 1 & (0b0010100101 >> s);

      if (i % l1 == 0) {
        length = l1;
        if ((0b1001010000 >> s) & 1) length = l0;
        else if (rnd(6) < 1) length = l0;
      }

      if (i % length == 0) updateNote(i, t, s, first);
    }

    let synOut = 0;
    syn: {
      p += TAU * f * (1 / sr);
      const p0 = phase(i, l0);
      const p1 = phase(i, l1);
      const e0 = length == l0 ? asde(p0, 0.1, 0.1, 0.9) : asd(p1, 0.05, 0.05);
      if (!e0) break syn;
      const b0 = 0.5 * a0 * (1 - p1) * sin((2 / 3) * p);
      const e1 = accent * asd(p1, 0.1);
      const b3 = 1.5 * e1 * b2;
      b2 = sin(p + b0 + b3);
      const b1 = mix(b2, sh(b2, i), 0.5 * am(3 * am(t / 23)));
      const fAuto = max(2400, f) * 2 ** (0.5 * e1 + 0.5 * am(t / 180));
      synOut = a0 * e0 * lp(b1, min(sr / 2, fAuto), 0.7);
      for (let ch = 2; ch--; ) data[ch][i0] += synOut;
    }

    for (let ch = 2; ch--; ) {
      const sec = (ch ? 0.26 : 0.23) + 5e-3 * rndLfo[ch](i);
      const fb = tapes[ch].get(i - sr * sec);
      tapes[ch].set(synOut - 0.7 * fb, i);
      data[ch][i0] += 0.9 * fb;
    }
  }
});
