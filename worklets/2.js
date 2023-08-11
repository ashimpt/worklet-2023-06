// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { Math2, sr, params, process } from "../mod.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
////////////////////////////////////////////////////////////////////////////////
const opt = { id: 2, amp: 0.256 };

const tet = params.tet12 ? 12 : 9;
const keys = params.tet12 ? [0, 4, 5, 7, 11] : [0, 3, 4, 5, 8];
const freq = (n) => 98 * 2 ** (floor(n / 5) + keys.at(mod(n, 5)) / tet);

const rndMel = rnd();
const mel1 = (t) => round(7 * am(3 * t + 0.5 * am(5 * t)) + 3 * am(t));
const mel0 = (t) => mel1(25e-3 * t + rndMel) + 5 * (floor(t / 20) % 2);

let list = [];
let count = 0;
function createNote(t) {
  const pp = (count++ % 5) / 4;
  const n = mel0(t);
  const f = freq(n);
  const rNum = list.filter((o) => o.r).length;
  const rFrq = list.find((o) => o.r && o.f == f);
  const long = rnd(4) < 1 && rNum < 3 && !rFrq;
  const l = (long ? 6 : 2) * sr;
  const fm = long ? freq(n + 6) / f - 1 : 3;
  const o = log2(f / 50);
  return { i: 0, n, f, o, pp, long, l, fm };
}

let p0 = 0;
let b0 = 0;
let f0;
const lop0 = Lop.create({ k: exp(-33 / sr) });

function synth(data, i0, i, t) {
  const vb = 2 ** (30e-3 * sin(TAU * 5 * t));
  p0 += TAU * (f0 * vb) * (1 / sr);
  b0 = sin(p0 + lop0(min(1, 400 / f0)) * b0);
  for (let ch = 2; ch--; ) data[ch][i0] += 0.11 * b0;
}

const env = (t, dr) => max(0, 1 - t / dr);
const tape = new Loop();
const bp0 = Filter.create({ type: "band", u: 1 });
const revs = [0, 1].map(() => new Loop());
const fncFltr = (o) => o.i < o.l;
let aux0 = 0;

process(opt, function (data, spb, i0, i, t) {
  f0 = 2 * freq(mel0(t));

  for (; i0 < spb; i0++, t = ++i / sr) {
    if (i % (sr / 4) == 0) {
      list = list.filter(fncFltr);
      if (list.length < 5 && t % 10 < 7) list.push(createNote(t));
    }

    aux0 = 0;
    for (const s of list) {
      const { i, l, long, o, f, fm, pp } = s;
      const t0 = i / sr;
      const p0 = i / l;
      const p = TAU * f * t0;
      let b = mix(0.7, 1, o / 4);
      if (long) {
        const a1 = (5 / o) * asd(t + 4 * asd(t / 4.5, 0.5), 0.3, 0.3);
        const b1 = a1 * sin(fm * p);
        const e0 = 0.4 * asd(p0, 1e-3, 1e-3);
        b *= 0.7 * e0 * sin(p + b1);
      } else {
        const b0a = 2 * env(t0, 0.02) * sin(3 * p);
        const b0 = (5 / o) * env(t0, 0.1) * sin(2 * p + b0a);
        const b1 = (200 / f) * env(t0, 0.2 / o) * sin(5 * p);
        const a1 = f < 201 ? 0 : (3 / o) * (t0 / t0 ** t0);
        const b2 = f < 201 ? 0 : a1 * mix(sin(3 * p), sin(3.015 * p));
        const e0 = asd(p0, 0.01);
        b *= 1.0 * e0 * sin(p + b0 + b1 + b2);
        aux0 += b;
      }
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
      s.i++;
    }

    {
      const b0 = tape.get(i - 0.667 * sr);
      const b1 = bp0(tanh(b0), 1224 + 205 * am(t / 5), 1);
      tape.set(aux0 + 1.3 * b1, i);
      for (let ch = 2; ch--; ) data[ch][i0] += 0.25 * b0;
    }

    synth(data, i0, i, t);

    {
      const b0 = 0.53 * revs[0].iGet(i - +8.9e-3 * sr);
      const b1 = 0.41 * revs[1].iGet(i - 40.1e-3 * sr);
      const b2 = 0.53 * revs[1].iGet(i - +8.3e-3 * sr);
      const b3 = 0.41 * revs[0].iGet(i - 40.9e-3 * sr);
      revs[0].set(data[0][i0] + b0 - b1, i);
      revs[1].set(data[1][i0] + b2 - b3, i);
      data[0][i0] = mix(data[0][i0], b0 + b1, 0.4);
      data[1][i0] = mix(data[1][i0], b2 + b3, 0.4);
    }
  }
});
