// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////
const stg = { id: 5, amp: 0.3 };
const g2 = 98;
let time = 0;

const lop0 = Lop.create({ k: exp(-7 / sr) });
const rndSq = () => rnd() ** 0.5;
const rndLfo0 = Hold.create({ k: exp(-9 / sr), l: sr / 8, f: rndSq });
const rndLfo1 = Hold.create({ k: exp(-9 / sr), l: sr / 3, f: rndSq });
const rndTg = () => (rnd(9 - 6 * am(time / 180)) < 1 ? 1 : 0);
const rndToggle = Hold.create({ k: exp(-99 / sr), l: sr / 1, f: rndTg });
const lop1 = Lop.create({ k: exp(-333 / sr) });

let oct = 0;
let p1 = 0;
let fMod;

process(stg, function (data, length, i0, i, t) {
  time = t;
  for (; i0 < length; i0++, t = ++i / sr) {
    if (!i || (i % (sr / 4) == 0 && rnd(4) < 1)) oct = floor(rnd(0, 4, 2));

    let synOut = 0;
    syn: {
      const p0 = TAU * g2 * t;
      const o = lop0(oct);
      p1 += TAU * g2 * 2 ** o * (1 / sr);
      const b1a = mix(4, 1, o / 3) * sin(2 * p1);
      const b1 = 1.7 * rndLfo0(i) * am(3 * t) ** 7 * sin(p0 / 2 + b1a); // beat
      const w0 = TAU * phase(2.5 * t, 1) ** 2;
      const b2 = 0.4 * rndLfo1(i) * sin(w0 + sin(32 * p0)); // high
      const b0 = sin(p0 + b1 + b2);
      if (i % sr == 0) fMod = round(rnd(4, 10));
      const a3 = lop1(mix(1, (fMod * t) % 1 < 0.5, rndToggle(i)));
      const b3 = sin(p1 + sin(p1 / 2));
      synOut = mix(b0, a3 * b0 * b3, 0.7);
      for (let ch = 2; ch--; ) data[ch][i0] += synOut;
    }

    for (let ch = 2; ch--; ) {
      const tape = tapes[ch];
      if (!tape.x || tape.x > sr || tape.x < -sr) {
        tape.x = 0;
        tape.v = 2 ** (bag() / 9) - 1;
      }
      const e0 = asd(phase(tape.x, sr), 1e-3, 1e-3);
      const fb0 = e0 * tapes[ch ^ 1].get(i - sr + tape.x);
      const fb1 = e0 * tapes[ch & 1].get(i - sr + tape.x);
      const fb = mix(-fb0, fb1, 0.3);
      tape.set(synOut + 0.93 * fb, i);
      data[ch][i0] += 1.25 * fb;

      tape.x += tape.v;
    }
  }

  for (let ch = 2; ch--; )
    for (let i = 0; i < length; i++) {
      data[ch][i] = lps[ch](data[ch][i]);
    }
});

const tapes = [0, 1].map(() => new Loop(4));
const bag = Bag.create({ bag: [-2, -1, 1, 2] });
const lps = [0, 1].map(() => Filter.create({ f: sr / 2 }));
