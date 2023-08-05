// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
import { Math2 } from "../math2.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
import { sr, setup, process } from "../mod.js";
////////////////////////////////////////////////////////////////////////////////
setup(Math2);

const numBirds = 10;
const birdBagEls = [...Array(40)].map((v, i) => 10 ** -(i % 10));
const birdBag = Bag.create({ bag: birdBagEls });
const aux0 = [0, 0];

class Bird {
  start = 0;
  p = 0;
  constructor(id) {
    this.id = id;
    this.pp = mix(0.1, 0.9, id / (numBirds - 1));
    this.update();
  }
  update() {
    this.f0 = mix(100, 1600, Math2.rndTriangular(0.5));
    this.f1 = mix(100, 1600, Math2.rndTriangular(0.3));
    this.e0 = rnd(0.1, 0.9);
    this.d0 = rnd(0.03, 0.2, 1); // rest
    this.d1 = rnd(0.03, 0.3, 2);
    this.count = 0;
    this.maxCount = floor(6 / (this.d0 + this.d1));
    this.a0 = 0.8 * sqrt(1 / numBirds) * birdBag() * 10 ** -rnd(0.5, 0);
    this.a1 = 10 ** rnd(-10 / 20);
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
      const wet = a1 * b;
      for (let ch = 2; ch--; ) aux0[ch] += pan(ch ? pp : 1 - pp) * wet;
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    } else {
      this.start = t + this.d0;
      if (rnd(8) < 1 || this.count++ > this.maxCount) this.update();
    }
  }
}

const birds = [...Array(numBirds)].map((v, i) => new Bird(i));
const tapes = [0, 1].map(() => new Loop(9));

const delays = [...Array(14)].map(() => new Loop(1));
const srt = sr / 1000;
const lops = [0, 1].map(() => Filter.create({ f: 1600, q: 0.5 }));
process(3, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    aux0[0] = aux0[1] = 0;
    for (let b of birds) b.process(data, i0, i, t);

    for (let ch = 2; ch--; ) {
      const fb = tapes[ch].get(i - 8 * sr);
      delays[ch + 12].set(lops[ch](aux0[ch] + 0.7 * fb), i);
    }

    for (let ch = 2; ch--; ) {
      let in0 = 0;
      let early = 57.777 - ch / 7;
      for (let n = 0; n < 5; n++) {
        early += 4.444 + ch / 15;
        const c = 12 + ((ch + n) % 2);
        in0 += (n % 2 ? 0.3 : 0.5) * delays[c].iGet(i - early * srt);
      }

      let del = 41.11;
      const b0 = delays[ch + 0].feedback(in0, i, del-- * srt, 0.85);
      const b1 = delays[ch + 2].feedback(in0, i, del-- * srt, 0.86);
      const b2 = delays[ch + 4].feedback(in0, i, del-- * srt, 0.87);
      const b3 = delays[ch + 6].feedback(in0, i, del-- * srt, 0.88);
      const b4 = delays[ch + 8].feedback(b0 - b1 + b2 - b3, i, 5e-3 * sr, 0.7);
      const b5 = delays[ch + 10].feedback(b4 / 4, i, 1.7e-3 * sr, 0.7);
      data[ch][i0] += 0.05 * b5;
    }

    for (let ch = 2; ch--; ) {
      const fb = tapes[ch].get(i - 8 * sr);
      tapes[ch].set(data[ch][i0] + 0.666 * fb, i);
      data[ch][i0] += 0.666 * fb;
    }
  }
});
