// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, setup, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////
setup(Math2);
const g2 = 98;

const numBirds = 10;
const birdBagEls = [...Array(40)].map((v, i) => 10 ** -(i % 10));
const birdBag = Bag.create({ bag: birdBagEls });

class Bird {
  start = 0;
  p = 0;
  constructor(id) {
    this.id = id;
    this.pp = mix(0.1, 0.9, id / (numBirds - 1));
    this.update();
  }
  update() {
    this.f0 = mix(g2, g2 * 2 ** 4, Math2.rndTriangular(0.4));
    this.f1 = mix(g2, g2 * 2 ** 4, Math2.rndTriangular(0.2));
    this.e0 = rnd(0.1, 0.9);
    this.d0 = rnd(0.03, 0.2, 1); // rest
    this.d1 = rnd(0.03, 0.3, 2);
    this.count = 0;
    this.maxCount = floor(6 / (this.d0 + this.d1));
    this.a0 = 0.8 * sqrt(1 / numBirds) * birdBag() * 10 ** -rnd(0.5, 0);
    if (this.a0 < 1e-5) this.a0 = 0;
  }
  process(data, i0, i, t) {
    const { f0, f1, start, d1, e0, a0, a1, pp } = this;
    if (t < start) return;
    if (t < start + d1) {
      if (!a0) return;
      const p0 = (t - start) / d1;
      this.p += TAU * mix(f0, f1, p0) * (1 / sr);
      const p = this.p;
      const b = a0 * asd(p0, e0) * sin(p + sin(p));
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    } else {
      this.start = t + this.d0;
      if (rnd(8) < 1 || this.count++ > this.maxCount) this.update();
    }
  }
}

const birds = [...Array(numBirds)].map((v, i) => new Bird(i));
const tapes = [0, 1].map(() => new Loop(9));

process(3, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    for (let b of birds) b.process(data, i0, i, t);

    for (let ch = 2; ch--; ) {
      const fb = tapes[ch].get(i - 8 * sr);
      tapes[ch].set(data[ch][i0] + 0.6 * fb, i);
      data[ch][i0] += 0.6 * fb;
    }

    for (let ch = 2; ch--; ) reverb.inputs[ch] = data[ch][i0];
    reverb.process(data, i0, i);
  }
});

const reverb = new (class Reverb {
  inputs = [0, 0];
  delays = [...Array(14)].map(() => new Loop(1));
  process(data, i0, i) {
    const { inputs, delays, lpo, lps } = this;
    const srt = sr / 1000;

    for (let ch = 2; ch--; ) delays[ch + 12].set(0.07 * inputs[ch], i);

    for (let ch = 2; ch--; ) {
      let earlyOut = 0;
      const earlyNum = 8;
      for (let n = 0, c = ch; n < earlyNum; n++) {
        const early = mix(5.777 - ch, 35 + ch, n / earlyNum);
        const a = mix(1, 0.5, n / earlyNum) * (ch == c ? 2 : 1);
        earlyOut += a * delays[(c++ % 2) + 12].iGet(i - early * srt);
      }
      data[ch][i0] += 0.4 * earlyOut;

      const preOut = delays[ch + 12].iGet(i - 5e-3 * srt);

      let combOut = 0;
      const combNum = 4;
      for (let n = 0; n < combNum; n++) {
        const dl = mix(31.1 + ch / 3, 39 - ch / 5, n / combNum);
        const a0 = mix(0.8, 0.7, n / combNum);
        const comb = delays[ch + 2 * n];
        const b = a0 * comb.iGet(i - dl * srt);
        comb.set(preOut + b, i);
        combOut += b / 4;
      }

      // const apfOut0 = -delays[ch + +8].feedback(combOut, i, 5.0 * srt, 0.7);
      // const apfOut1 = -delays[ch + 10].feedback(apfOut0, i, 1.7 * srt, 0.7);
      // data[ch][i0] += apfOut1;

      let apfOut = 0;
      const apfNum = 4;
      const apf = delays[ch + 8];
      for (let n = 0; n < apfNum; n++) {
        // const dt = mix(1.555, 10, sqrt(n / apfNum));
        // apfOut += apf.iGet(i - dt * srt);
        apfOut += apf.iGet(i - apfLengths[n]);
      }
      apf.set(combOut + (0.7 / apfNum) * apfOut, i);
      data[ch][i0] += apfOut;
    }
  }
})();

const apfLengths = ((o = [], num = 4) => {
  for (let n = 0; n < num; n++) {
    const dt = mix(1.555, 10, sqrt(n / num));
    o[n] = ceilPrime(dt * (sr / 1000));
  }
  return o;
})();

function ceilPrime(v) {
  v = ceil(v);
  while (!isPrime(v)) v++;
  return v;
}

function isPrime(v) {
  if (v < 3) return v == 2;
  for (let i = 3, l = sqrt(v); i <= l; i += 2) {
    if (v / i == floor(v / i)) return false;
  }
  return true;
}

// http://www.ari-co.co.jp/service/soft/reverb-2.htm
