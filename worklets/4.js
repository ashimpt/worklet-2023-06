// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////
const stg = { id: 4, amp: 0.216 };

const tet = params.tet12 ? 12 : 9;
const notes = params.tet12 ? [0, 4, 5, 7, 11] : [0, 3, 4, 5, 8];
const freq = (n) => 98 * 2 ** (floor(n / 5) + notes.at(mod(n, 5)) / tet);
const shift = 2 ** (tet == 9 ? 4 / 9 : 5 / 12);

const rndMelody = rnd();
const melMod = (x) => 0.5 * am(7 * x);
const melody = (x) => 0.5 * am(5 * x + melMod(x)) + 0.5 * am(3 * x);
const lp = Filter.create({ u: 1 });
const useFilter = sr / 2 > 8000;
const sh = SH.create({ l: round(sr / freq(18)) });

let f, a0, length;
let accent = 0;
let n8 = 1;
let p = 0;
let b2 = 0;
const bpm = 143;
const div = 10;
const dix = 2;
const l0 = round(((60 / bpm) * sr) / 2 / dix);
const l1 = dix * l0;
const lenPhrase = div * l1;
const durPhrase = lenPhrase / sr;
const posMel = 22e-3 / durPhrase;
const velMel0 = 150e-3 / durPhrase;
const velMel1 = (2 / 3) * velMel0;

function updateNote(i, first) {
  const t0 = posMel * (crush(i, 4 * lenPhrase, floor) / sr);
  const t1 = (first ? velMel0 : velMel1) * ((i % lenPhrase) / sr);
  f = freq(5 + 18 * melody(rndMelody + t0 + t1));
  if (phase(i, 4 * lenPhrase) >= 0.5) f *= shift;
  a0 = min(1, 2 / log2(f / 100));
}
updateNote(0, 0, 0);

const ade = (p, a, d, e = 1, q = p % 1) => clip(min(q / a, (e - q) / d));

process(stg, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    const beat = div * phase(i, lenPhrase);
    if (i % l0 == 0) {
      const first = i % (2 * lenPhrase) < lenPhrase;
      accent = 1 & (0b00101 >> beat % 5);
      n8 = 1 & (0b01111 >> beat % 5);

      if (i % l1 == 0) {
        length = l1;
        if ((0b1001010000 >> beat) & 1) length = l0;
        else if (rnd(6) < 1) length = l0;
      }

      if (i % length == 0) updateNote(i, first);
    }

    const p0 = phase(i, l0);
    const p1 = phase(i, l1);
    const auto0 = am(t / 180);

    let envSideDesk = 1;
    desk: {
      const e = n8 ? ade(p1, 0.02, 0.2, 0.205) : ade(p0, 0.04, 0.4, 0.41);
      const v0 = accent * 0.7 + 0.3;
      const a = auto0 * v0 * e;
      envSideDesk = 1 - a;
      if (!e) break desk;
      const p = TAU * 4 * 98 * t + 20 * e;
      const b = a * sin(p + e * sin(E * p));
      for (let ch = 2; ch--; ) data[ch][i0] += b;
    }

    let synOut = 0;
    syn: {
      const e0 = length == l0 ? ade(p0, 0.1, 0.1, 0.9) : asd(p1, 0.05, 0.05);
      if (!e0) break syn;
      p += TAU * f * (1 / sr);
      const b0 = 0.5 * a0 * (1 - p1) * sin((2 / 3) * p);
      const e1 = accent * asd(p1, 0.1);
      const b3 = 1.5 * e1 * b2;
      b2 = sin(p + b0 + b3);
      const b1 = mix(b2, sh(b2, i), 0.5 * am(3 * am(t / 23)));
      const fAuto = max(2400, f) * 2 ** (0.5 * auto0 + 0.5 * e1);
      if (useFilter) synOut = a0 * e0 * lp(b1, fAuto, 0.7);
      else synOut = a0 * e0 * b1;
      for (let ch = 2; ch--; ) data[ch][i0] += synOut;
    }

    for (let ch = 2; ch--; ) {
      const sec = (ch ? 0.26 : 0.23) + 5e-3 * rndLfos[ch](i);
      const fb = tapes[ch].get(i - sr * sec);
      tapes[ch].set(synOut - 0.7 * fb, i);
      data[ch][i0] += envSideDesk * 0.9 * fb;
    }
  }
});

const tapes = [0, 1].map(() => new Loop());
const rndLfos = [0, 1].map(() => Hold.create({ k: exp(-35 / sr), l: sr / 5 }));
