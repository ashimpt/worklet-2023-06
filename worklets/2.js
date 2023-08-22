// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////
const stg = { id: 2, amp: 0.395 };

const tet = params.tet;
const baseNotes = [1, 10 / 8, 4 / 3, 12 / 8, 15 / 8].map((v) => log2(v));
const notes = baseNotes.map((v) => (!tet ? v : round(crush(v, 1 / tet) * tet)));
if (tet == 5 || tet == 6) notes[1]--;
if (tet == 5) notes[4]--;
const freq = (n) => 98 * 2 ** (floor(n / 5) + notes.at(mod(n, 5)) / (tet || 1));

const rndMel = rnd();
let octave = 0;
const mel1 = (t) => round(7 * am(3 * t + 0.5 * am(5 * t)) + 3 * am(t));
const mel0 = (t) => mel1(25e-3 * t + rndMel) + 5 * octave;

let list = [];
let count = 0;

function createNote(t, beat) {
  const mainBeat = [0, 3].includes(beat % 4);
  if (list.length > 5 && !mainBeat) return;

  const n = mel0(t);
  const f = freq(n);
  const repFrq = list.filter((o) => o.f == f);
  if (repFrq.length >= 2) {
    if (!mainBeat) return;
    if (repFrq.filter((o) => !o.long && o.i < sr).length >= 2) return;
  }

  const pp = (count++ % 5) / 4;
  const o = log2(f / 50);

  const longNum = list.filter((o) => o.long).length < 3;
  const longFrq = list.find((o) => o.long && o.f == f) === undefined;
  const long = longNum && longFrq && !mainBeat && rnd(4) < 1;

  const l = (long ? 6 : 2) * sr;
  const fm = long ? freq(n + 6) / f - 1 : 3;
  list.push({ i: 0, n, f, o, pp, long, l, fm });
}

const decay = (t, dr) => max(0, 1 - t / dr);
let aux0 = 0;

function synth(data, i0, t, s) {
  const { i, l, long, o, f, fm, pp } = s;
  if (i > l) return;
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
    const b0a = 2 * decay(t0, 0.02) * sin(3 * p);
    const b0 = (5 / o) * decay(t0, 0.1) * sin(2 * p + b0a);
    const b1 = (200 / f) * decay(t0, 0.2 / o) * sin(5 * p);
    const a2 = f < 201 ? 0 : (3 / o) * (t0 / t0 ** t0);
    const b2 = f < 201 ? 0 : a2 * mix(sin(3 * p), sin(3.015 * p));
    const e0 = asd(p0, 0.01);
    b *= 0.9 * e0 * sin(p + b0 + b1 + b2);
    aux0 += b;
  }
  for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
  s.i++;
}

let p0 = 0;
let b0 = 0;
let f0;
const lop0 = Lop.create({ k: exp(-33 / sr) });

function monoSynth(data, i0, i, t) {
  const vb = 2 ** (30e-3 * sin(TAU * 5 * t));
  p0 += TAU * (f0 * vb) * (1 / sr);
  b0 = sin(p0 + lop0(min(1, 600 / f0)) * b0);
  for (let ch = 2; ch--; ) data[ch][i0] += 0.12 * b0;
}

const bpm = 110;
let beat = -1;

process(stg, function (data, length, i0, i, t) {
  f0 = 2 * freq(mel0(t));

  for (; i0 < length; i0++, t = ++i / sr) {
    const currentBeat = ((bpm * 2) / 60) * t;
    if (beat != floor(currentBeat)) {
      beat = floor(currentBeat);

      if (beat % 20 == 0 && rnd(2) < 1) octave ^= 1;
      list = list.filter((o) => o.i < o.l);
      if (beat % 8 < 4 && beat % 40 < 24) createNote(t, beat);
    }

    aux0 = 0;
    for (const s of list) synth(data, i0, t, s);

    delay: {
      const b0 = tape.get(i - 0.7 * sr);
      const fLfo = lfoBottom * 2 ** (lfoOct * am(t / 4));
      const b1 = bp0(tanh(b0), fLfo, 1);
      tape.set(aux0 + 1.33 * b1, i);
      for (let ch = 2; ch--; ) data[ch][i0] += 0.25 * b0;
    }

    monoSynth(data, i0, i, t);

    reverb: {
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

const tape = new Loop();
const bp0 = Filter.create({ type: "band", u: 1 });
const lfoBottom = freq(18) + 50;
const lfoTop = freq(19) - 50;
const lfoOct = log2(lfoTop / lfoBottom);

const revs = [0, 1].map(() => new Loop());
