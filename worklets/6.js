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
setup(Math2, (params) => {
  if (params.tet12) tet = 12;
  if (params.tet12) keys = [0, 4, 5, 7, 11];
});

class Synth {
  bass = [3, -1];
  constructor(id) {
    this.o = [2, 1, 0, 0, 1, 2].at(id);
    this.v = [4, 2, 1, 1, 2, 4].at(id);
    this.pat = rnd(2 ** 8);
    this.pp = id / 5;
  }
  process(data, i0, i, t, speed) {
    const { bass, o, v, pp } = this;
    if (i % (32 * sr) == 0) this.pat = rnd(2 ** 8);
    const n = v * (t + 0.7 * speed);
    const pattern = 0b11 & (this.pat >> (2 * floor(n % 4)));
    const n0 = 5 * o + bass.at((n / 16) % 2) + pattern;
    const e0 = min((n % 1) / 1e-3, (1 - (n % 1)) ** 2);
    const e1 = (1 - (n % 1)) ** 5;
    const e2 = (1 - (n % 1)) ** 7;
    const p = TAU * freq(n0) * t;
    const a = 0.5 * min(1, 8 / (n0 + 5));
    const b = a * e0 * sin(p + 1.1 * e1 * sin(E * p + 0.7 * e2 * sin(p / E)));
    for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
  }
}
const synths = [0, 1, 2, 3, 4, 5].map((v) => new Synth(v));

const aux0 = [0, 0];

process(6, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    const speed = am(t / 32);
    for (const s of synths) s.process(data, i0, i, t, speed);

    for (let ch = 2; ch--; ) data[ch][i0] = 0.45 * tanh(data[ch][i0]);

    aux0[0] = aux0[1] = 0;
    createBackground(data, spb, i0, i, t);

    for (let ch = 2; ch--; ) reverb.inputs[ch] = aux0[ch] + 0.1 * data[ch][i0];
    reverb.process(data, i0, i);

    for (let ch = 2; ch--; ) data[ch][i0] += 2 * aux0[ch];
  }
});

const tapes = [0, 1].map(() => new Loop(8));
const hlds0Opt = (v) => ({ l: round(sr / v), k: exp(-0.6 / sr) });
const hlds0 = [1.8, 1.7, 1.5, 1.6].map((v) => Hold.create(hlds0Opt(v)));
const bandOpt = { type: "band", f: min(0.4 * sr, 6400), q: 0.7 };
const bands = [0, 1, 2, 3].map(() => Filter.create(bandOpt));
const hlds1Opt = { k: exp(-18 / sr), l: sr / 6, f: () => 10 ** -rnd() };
const hlds1 = [0, 1].map(() => Hold.create(hlds1Opt));

function createBackground(data, spb, i0, i, t) {
  for (let ch = 2; ch--; ) {
    const x0 = i + (-1.2 + 1.0 * hlds0[ch](i)) * sr;
    const b0 = tapes[ch].get(x0);
    const b1 = tapes[ch].get(x0 - 4 * sr);
    const fb0 = bands[ch](b0 + b1);
    aux0[ch] += fb0;

    const x1 = i + (-3.2 + 1.0 * hlds0[ch + 2](i)) * sr;
    const b2 = tapes[ch].get(x1);
    const b3 = tapes[ch].get(x1 - 4 * sr);
    const fb1 = bands[ch + 2](b2 + b3);
    aux0[ch & 1] += pan(0.33) * fb1;
    aux0[ch ^ 1] += pan(0.67) * fb1;

    for (let ch = 2; ch--; ) {
      tapes[ch].set(hlds1[ch](i) * data[ch][i0] + 0.1 * aux0[ch], i);
    }
  }
}

const reverb = new (class Reverb {
  inputs = [0, 0];
  delays = [...Array(14)].map(() => new Loop(1));
  srt = sr / 1000;
  process(data, i0, i) {
    const { inputs, delays, lpo, lps, srt } = this;
    for (let ch = 2; ch--; ) delays[ch + 12].set(0.5 * inputs[ch], i);

    for (let ch = 2; ch--; ) {
      let earlyOut = 0;
      for (let n = 0, num = 8; n < num; n++) {
        const early = mix(5.777 - ch, 9 + ch, n / num);
        const a = 0.9 * mix(1, 0.5, n / num) * (n % 2 ? 1 : 2);
        earlyOut += a * delays[((ch + n) % 2) + 12].iGet(i - early * srt);
      }

      // data[ch][i0] += earlyOut;
      // const preOut = delays[ch + 12].iGet(i - 5e-3 * srt);

      let combOut = 0;
      for (let n = 0; n < 4; n++) {
        const dl = mix(33.444 + ch, 55 - ch, n / 4);
        const a0 = mix(0.9, 0.8, n / 3);
        const comb = delays[ch + 2 * n];
        const b = a0 * comb.iGet(i - dl * srt);
        comb.set(earlyOut + b, i);
        combOut += b / 4;
      }

      const apfOut0 = -delays[ch + +8].feedback(combOut, i, 5.0 * srt, 0.7);
      const apfOut1 = -delays[ch + 10].feedback(apfOut0, i, 1.7 * srt, 0.7);
      data[ch][i0] += apfOut1;
    }
  }
})();
