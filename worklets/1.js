// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////

const tapes = [0, 1].map(() => new Loop());
const amp = 0.15;

function syn(data, n, i, t, n0, a1, pp) {
  const f = 100 * 2 ** ((n + n0) / 9);
  const p = TAU * f * t;
  const b = a1 * sin(p);
  for (let ch = 2; ch--; ) data[ch][i] += pan(ch ? pp : 1 - pp) * b;
}

class Synth {
  env = 1e-5;
  pp = 0.5;
  end = 0;
  lop0 = Lop.create({ k: exp(-35 / sr) });
  constructor(id) {
    const bag = [...Array([4, 2, 1].at(id))].map((v, i) => i);
    this.bag = Bag.create({ bag });
    this.dividend = [2, 4, 8].at(id);
    this.bottom = [18, 9, 0].at(id);

    this.n0 = this.bottom;
    this.update(1);
  }
  update(init) {
    this.divisor = 2 ** (1 + this.bag());
    if (!this.rest && !init) return;
    this.vel = [4, 8, 12].at(rnd(3));
    const pre = this.voices;
    while (pre == this.voices) this.voices = [2, 4, 6].at(rnd(3));
    this.a0 = (1 / this.voices) ** 0.667;
  }
  trigger(i) {
    this.start = i;
    this.pp = rnd();
    const pre = this.n0;
    while (pre == this.n0) this.n0 = this.bottom + floor(rnd(27));
    if (rnd(20) < 1 && !this.rest) {
      this.rest = true;
      this.end = i + sr;
      this.dir = 0;
    } else {
      if (rnd(6) < 1 || this.rest) this.update();
      this.rest = false;
      const dr = ceil(rnd(this.dividend)) / this.divisor;
      this.end = i + round(dr * sr);
      this.dir = 1;
    }
  }
  process(data, i0, i, t, spb) {
    for (; i0 < spb; i0++, t = ++i / sr) {
      if (i >= this.end) this.trigger(i);
      const { dir, n0, start, end, pp, vel, voices, a0 } = this;

      if (this.env == 1) this.dir = 0;
      const tmp = this.env * exp((this.dir ? vel : -vel) / sr);
      this.env = clip(tmp, 1e-5, 1);

      const e0 = asd((i - start) / (end - start), 0.01, 0.01);
      const a1 = amp * a0 * this.env * e0;
      if (a1 <= 1e-5) continue;
      for (let n = voices; n--; ) syn(data, n, i0, t, n0, a1, this.lop0(pp));
    }
  }
}

const synths = [new Synth(0), new Synth(1), new Synth(2)];

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
  for (const cluster of synths) cluster.process(data, i0, i, t, spb);
  delay(data, spb, i0, i, t);
});
