// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////

const stg = { id: 1, amp: 0.194 };
const g2 = 98;

class Synth {
  env = 1e-5;
  pp = 0.5;
  end = 0;
  rest = 1;
  lop0 = Lop.create({ k: exp(-35 / sr) });
  constructor(id) {
    const opt = [
      { bottom: 18, maxNumerator: 8, denominators: [32, 16, 12, 8] },
      { bottom: +9, maxNumerator: 4, denominators: [16, +6, +4, 2] },
      { bottom: +0, maxNumerator: 2, denominators: [+8, +3, +2, 1] },
    ].at(id);
    Object.assign(this, opt);

    this.denominatorBag = Bag.create({ bag: opt.denominators });
  }
  update() {
    this.denominator = this.denominatorBag();
    this.count = 0;
    this.updateCount = clip(ceil(rnd(3) * this.denominator), 4, 32);
    const vel = [4, 8, 12].at(rnd(3)); // 1e-5 * exp(11.5) = 0.98...
    this.aVel = exp(+vel / sr);
    this.dVel = exp(-vel / sr);
    const pre = this.numOsc;
    while (pre == this.numOsc) this.numOsc = [2, 4, 6].at(rnd(3));
    this.a0 = (1 / this.numOsc) ** 0.667;
    this.rest = false;
  }
  trigger(i) {
    if (this.rest) this.update();

    const pre = this.note;
    while (pre == this.note) this.note = this.bottom + floor(rnd(27));
    this.pp = rnd();
    this.dir = 1;
    this.start = i;
    const dr = ceil(rnd(this.maxNumerator)) / this.denominator;
    this.end = i + round(dr * sr);

    if (this.count == this.updateCount) {
      this.end = crush(this.end + rnd(1, 4) * sr, sr / 2);
      this.rest = true;
    }

    this.count++;
  }
  process(data, i0, i, t, spb) {
    for (; i0 < spb; i0++, t = ++i / sr) {
      if (i >= this.end) this.trigger(i);
      let { note, start, end, env } = this;

      env *= this.dir ? this.aVel : this.dVel;
      this.env = env = clip(env, 1e-5, 1);
      if (env == 1) this.dir = 0;

      const e0 = asd((i - start) / (end - start), 0.01, 0.01);

      if (env * e0 <= 1e-5) continue;

      const a1 = this.a0 * env * e0;
      const pp0 = this.lop0(this.pp);
      const aL = a1 * pan(1 - pp0);
      const aR = a1 * pan(pp0);
      for (let n = this.numOsc; n--; ) {
        const f = g2 * 2 ** ((note + n) / 9);
        const b = sin(TAU * f * t);
        data[0][i0] += aL * b;
        data[1][i0] += aR * b;
      }
    }
  }
}

const synths = [new Synth(0), new Synth(1), new Synth(2)];

process(stg, function (data, spb, i0, i, t) {
  for (const synth of synths) synth.process(data, i0, i, t, spb);
  reverb(data, spb, i0, i, t);
});

const delays = [...Array(14)].map(() => new Loop(1));
const srt = sr / 1000;

function reverb(data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    for (let ch = 2; ch--; ) delays[ch].set(0.2 * data[ch][i0], i);
    for (let ch = 2; ch--; ) {
      const preOut = delays[ch].iGet(i - 10e-3 * srt);

      let combOut = 0;
      for (let n = 0; n < 4; n++) {
        const dl = mix(55 - ch / 5, 99 + ch / 7, n / 4);
        const a0 = mix(0.8, 0.7, n / 3);
        const comb = delays[2 + 2 * n + ch];
        const b = a0 * comb.iGet(i - dl * srt);
        comb.set(preOut + b, i);
        combOut += b / 4;
      }

      const apfOut0 = -delays[10 + ch].feedback(combOut, i, 5.0 * srt, 0.7);
      const apfOut1 = -delays[12 + ch].feedback(apfOut0, i, 1.7 * srt, 0.7);
      data[ch][i0] += apfOut1;
    }
  }
}
