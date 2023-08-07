// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, setup, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////
setup(Math2);

const amp = 0.15;

function syn(data, n, i, t, n0, a1, pp) {
  const f = 100 * 2 ** ((n + n0) / 9);
  const p = TAU * f * t;
  const b = amp * a1 * sin(p);
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
    this.vel = [4, 8, 12].at(rnd(3));
    if (!this.rest && !init) return;
    const pre = this.voices;
    while (pre == this.voices) this.voices = [2, 4, 6].at(rnd(3));
    this.a0 = (1 / this.voices) ** 0.667;
  }
  trigger(i) {
    const pre = this.n0;
    while (pre == this.n0) this.n0 = this.bottom + floor(rnd(27));
    this.dir = 1;
    this.pp = rnd();

    if (rnd(6) < 1 || this.rest) this.update();

    this.start = i;
    const dr = ceil(rnd(this.dividend)) / this.divisor;
    this.end = i + round(dr * sr);

    if (rnd(20) < 1 && !this.rest) {
      this.end += sr;
      this.rest = true;
    } else this.rest = false;
  }
  process(data, i0, i, t, spb) {
    for (; i0 < spb; i0++, t = ++i / sr) {
      if (i >= this.end) this.trigger(i);
      const { dir, n0, start, end, pp, vel, voices, a0 } = this;

      if (this.env == 1) this.dir = 0;
      const tmp = this.env * exp((this.dir ? vel : -vel) / sr);
      this.env = clip(tmp, 1e-5, 1);

      const e0 = asd((i - start) / (end - start), 0.01, 0.01);
      const a1 = a0 * this.env * e0;
      if (a1 <= 1e-5) continue;
      for (let n = voices; n--; ) syn(data, n, i0, t, n0, a1, this.lop0(pp));
    }
  }
}

const synths = [new Synth(0), new Synth(1), new Synth(2)];

process(1, function (data, spb, i0, i, t) {
  for (const cluster of synths) cluster.process(data, i0, i, t, spb);
  reverb(data, spb, i0, i, t);
});

const delays = [...Array(14)].map(() => new Loop(1));
const srt = sr / 1000;

function reverb(data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    for (let ch = 2; ch--; ) delays[ch + 12].set(0.2 * data[ch][i0], i);
    for (let ch = 2; ch--; ) {
      const preOut = delays[ch + 12].iGet(i - 10e-3 * srt);

      let combOut = 0;
      for (let n = 0; n < 4; n++) {
        const dl = mix(55 - ch / 5, 99 + ch / 7, n / 4);
        const a0 = mix(0.8, 0.7, n / 3);
        const comb = delays[ch + 2 * n];
        const b = a0 * comb.iGet(i - dl * srt);
        comb.set(preOut + b, i);
        combOut += b / 4;
      }

      const apfOut0 = -delays[ch + +8].feedback(combOut, i, 5.0 * srt, 0.7);
      const apfOut1 = -delays[ch + 10].feedback(apfOut0, i, 1.7 * srt, 0.7);
      data[ch][i0] += apfOut1;
    }
  }
}
