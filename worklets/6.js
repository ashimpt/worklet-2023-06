// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////
const stg = { id: 6, amp: 0.64 };

const tet = params.tet12 ? 12 : 9;
const notes = params.tet12 ? [0, 4, 5, 7, 11] : [0, 3, 4, 5, 8];
const freq = (n) => 98 * 2 ** (floor(n / 5) + notes.at(mod(n, 5)) / tet);

class Synth {
  bass = [3, -1];
  constructor(id) {
    this.o = [2, 1, 0, 0, 1, 2].at(id);
    this.v = [4, 2, 1, 1, 2, 4].at(id);
    this.pattern = rnd(2 ** 8);
    this.pp = id / 5;
  }
  beat = -1;
  process(data, i0, i, t, speed) {
    if (i % (32 * sr) == 0) this.pattern = rnd(2 ** 8);
    const beat = this.v * (t + 0.7 * speed);
    if (this.beat != floor(beat)) {
      this.beat = floor(beat);
      const n1 = 0b11 & (this.pattern >> (2 * floor(beat % 4)));
      const n0 = 5 * this.o + this.bass.at((beat / 16) % 2) + n1;
      this.f = freq(n0);
      this.a = 0.5 * min(1, 8 / (n0 + 5));
    }

    const { pp } = this;
    const p = TAU * this.f * t;
    const p0 = beat % 1;
    const e0 = min(p0 / 1e-3, (1 - p0) ** 2);
    const b1 = 0.7 * (1 - p0) ** 7 * sin(p / E);
    const b0 = 1.1 * (1 - p0) ** 5 * sin(E * p + b1);
    const b = this.a * e0 * sin(p + b0);
    for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
  }
}

const synths = [0, 1, 2, 3, 4, 5].map((v) => new Synth(v));

const aux0 = [0, 0];

process(stg, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    const speed = am(t / 32);
    for (const s of synths) s.process(data, i0, i, t, speed);

    for (let ch = 2; ch--; ) data[ch][i0] = tanh(data[ch][i0]);

    aux0[0] = aux0[1] = 0;
    createBackground(data, spb, i0, i, t);

    for (let ch = 2; ch--; ) reverb.input(aux0[ch] + 0.1 * data[ch][i0], i, ch);
    reverb.process(data, i0, i);

    for (let ch = 2; ch--; ) data[ch][i0] += 2 * aux0[ch];
  }
});

const tapes = [0, 1].map(() => new Loop(8));
const rndLfo0Opt = (v) => ({ l: round(sr / v), k: exp(-0.6 / sr) });
const rndLfo0 = [1.8, 1.7, 1.5, 1.6].map((v) => Hold.create(rndLfo0Opt(v)));
const bandOpt = { type: "band", f: min(0.4 * sr, 6400), q: 0.7 };
const bands = [0, 1, 2, 3].map(() => Filter.create(bandOpt));
const rndLfo1Opt = { k: exp(-18 / sr), l: sr / 6, f: () => 10 ** -rnd() };
const rndLfo1 = [0, 1].map(() => Hold.create(rndLfo1Opt));

function createBackground(data, spb, i0, i, t) {
  for (let ch = 2; ch--; ) {
    const tape = tapes[ch];
    const x0 = i + (-1.2 + 1.0 * rndLfo0[ch](i)) * sr;
    const b0 = tape.get(x0);
    const b1 = tape.get(x0 - 4 * sr);
    const fb0 = bands[ch](b0 + b1);
    aux0[ch] += fb0;

    const x1 = i + (-3.2 + 1.0 * rndLfo0[ch + 2](i)) * sr;
    const b2 = tape.get(x1);
    const b3 = tape.get(x1 - 4 * sr);
    const fb1 = bands[ch + 2](b2 + b3);
    aux0[ch & 1] += pan(0.33) * fb1;
    aux0[ch ^ 1] += pan(0.67) * fb1;

    for (let ch = 2; ch--; ) {
      tapes[ch].set(rndLfo1[ch](i) * data[ch][i0] + 0.1 * aux0[ch], i);
    }
  }
}

const reverb = new (class Reverb {
  delays = [...Array(14)].map(() => new Loop(1));
  input(v, i, ch) {
    this.delays[ch].set(0.5 * v, i);
  }
  process(data, i0, i) {
    const { inputs, delays } = this;
    const srt = sr / 1000;

    for (let ch = 2; ch--; ) {
      let earlyOut = 0;
      for (let n = 0, num = 8; n < num; n++) {
        const early = mix(5.777 - ch, 9 + ch, n / num);
        const a = 0.9 * mix(1, 0.5, n / num) * (n % 2 ? 1 : 2);
        earlyOut += a * delays[(ch + n) % 2].iGet(i - early * srt);
      }

      // data[ch][i0] += earlyOut;
      // const preOut = delays[ch].iGet(i - 5e-3 * srt);

      let combOut = 0;
      for (let n = 0, num = 4; n < num; n++) {
        const dl = mix(33.444 + ch, 55 - ch, n / num);
        const a0 = mix(0.9, 0.8, n / (num - 1));
        const comb = delays[2 + 2 * n + ch];
        const b = a0 * comb.iGet(i - dl * srt);
        comb.set(earlyOut + b, i);
        combOut += b / num;
      }

      const apfOut0 = -delays[10 + ch].feedback(combOut, i, 5.0 * srt, 0.7);
      const apfOut1 = -delays[12 + ch].feedback(apfOut0, i, 1.7 * srt, 0.7);
      data[ch][i0] += apfOut1;
    }
  }
})();
