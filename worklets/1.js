// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////

const tapes = [0, 1].map(() => new Loop());
const volume = 0.15;

function syn(data, n, i, t, n0, a1, pp) {
  const f = 100 * 2 ** ((n + n0) / 9);
  const p = TAU * f * t;
  const b = a1 * sin(p);
  for (let ch = 2; ch--; ) data[ch][i] += pan(ch ? pp : 1 - pp) * b;
}

class Synth {
  eAmp = 1e-5;
  lop = Lop.create({ k: exp(-35 / sr) });
  constructor(maxDiv = 4, bottomN = 0, times) {
    this.bag = Bag.create({ bag: [...Array(maxDiv)].map((v, i) => i) });
    this.bottomN = bottomN;
    this.times = times;
  }
  process(data, i0, i, t, spb) {
    let { eDir, n0, start, next, pp, vel, voices, a0 } = this;

    for (; i0 < spb; i0++, t = ++i / sr) {
      if (!next || i >= next) {
        let isUpdated = 0;
        // update
        if (!vel || rnd(6) < 1) {
          isUpdated = vel && 1;
          this.divisor = 2 ** (1 + this.bag());
          vel = [2, 4, 8, 12].at(rnd(4));

          if (volume * this.eAmp <= 1e-2) {
            const p = voices;
            while (p == voices) voices = [2, 4, 8].at(rnd(3));
            a0 = (1 / voices) ** 0.667;
          }
        }

        // trigger
        const blank = isUpdated && rnd(3) < 2 ? 1 / ceil(rnd(5)) : 0;
        const dr = blank || ceil(rnd(this.times)) / this.divisor;
        start = i;
        next = i + round(dr * sr);
        eDir = blank ? 0 : 1;
        n0 = this.bottomN + floor(rnd(27));
        pp = rnd();
        Object.assign(this, { start, next, eDir, n0, pp, vel, voices, a0 });
      }

      // each sample
      if (this.eAmp == 1) this.eDir = 0;
      const tmp = this.eAmp * exp((this.eDir ? vel : -vel) / sr);
      this.eAmp = clip(tmp, 1e-5, 1);

      const e0 = asd((i - start) / (next - start), 0.01, 0.01);
      const a1 = volume * a0 * this.eAmp * e0;
      if (a1 <= 1e-5) continue;
      for (let n = voices; n--; ) syn(data, n, i0, t, n0, a1, this.lop(pp));
    }
  }
}

const clusters = [
  new Synth(4, 18, 2),
  new Synth(2, +9, 4),
  new Synth(1, +0, 8),
];

const delays = [...Array(12)].map(() => new Loop());
const srt = sr / 1000;
function delay(data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    for (let ch = 2; ch--; ) {
      const in0 = data[ch][i0];
      let del = 39.99;
      const b0 = delays[ch + 0].feedback(in0, i, del-- * srt, 0.85);
      const b1 = delays[ch + 2].feedback(in0, i, del-- * srt, 0.86);
      const b2 = delays[ch + 4].feedback(in0, i, del-- * srt, 0.87);
      const b3 = delays[ch + 6].feedback(in0, i, del-- * srt, 0.88);
      const b4 = delays[ch + 8].feedback(b0 - b1 + b2 - b3, i, 5e-3 * sr, 0.7);
      const b5 = delays[ch + 10].feedback(b4 / 4, i, 1.7e-3 * sr, 0.7);
      data[ch][i0] += 0.1 * b5;
    }
  }
}

process(1, function (data, spb, i0, i, t) {
  for (const cluster of clusters) cluster.process(data, i0, i, t, spb);
  delay(data, spb, i0, i, t);
});
