// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { createMath2, sr, params, process } from "../mod.js";
const math2 = createMath2();
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = math2;
////////////////////////////////////////////////////////////////////////////////
const stg = { id: 4, amp: 0.208 };

const tet = params.tet;
const baseNotes = [1, 10 / 8, 4 / 3, 12 / 8, 15 / 8].map((v) => log2(v));
const notes = baseNotes.map((v) => (!tet ? v : round(crush(v, 1 / tet) * tet)));
if (tet == 5 || tet == 6) notes[1]--;
if (tet == 5) notes[4]--;
const freq = (n) => 98 * 2 ** (floor(n / 5) + notes.at(mod(n, 5)) / (tet || 1));

const transpose = freq(2) / freq(0);

const rndMelody = rnd();
const melMod = (x) => 0.5 * am(7 * x);
const melody = (x) => 0.5 * am(5 * x + melMod(x)) + 0.5 * am(3 * x);
const lp = Filter.create({ u: 1 });
const useFilter = sr / 2 > 7999;
const sh = SH.create({ l: round(sr / freq(18)) });

let f, a0, lenNote;
let accent = 0;
let click8 = 1;
let p = 0;
let b2 = 0;

const bpm = 143;
const div = 10;
const l16 = round(((60 / bpm) * sr) / 4);
const l8 = 2 * l16;
const lenBar = div * l8;
const posPhrase = -rnd(0.09, 0.15); // am(3 * x) 0 to 1 -> 0.166...
const velMelody0 = rnd(0.12, 0.14);
const velMelody1 = (2 / 3) * velMelody0;
const accentBeats = [0, 2, 5, 7];
const accentNotes = [0, 1, 3];

function updateNote(i, nBeat) {
  const count4Bar = floor(i / lenBar / 4);
  const phase1Bar = phase(i, lenBar);
  const t0 = posPhrase * count4Bar; // 4 bar
  const vel = i % (2 * lenBar) < lenBar ? velMelody0 : velMelody1; // 1 bar
  const t1 = vel * phase1Bar; // 1 note

  let n = floor(5 + 18 * melody(rndMelody + t0 + t1));
  if (accentBeats.includes(nBeat % 10)) {
    while (!accentNotes.includes(n % 5)) n--;
  }
  f = freq(n);

  if (phase(i, 4 * lenBar) > 0.499) f *= transpose;
  a0 = min(1, 2 / log2(f / 100));
}
updateNote(0, 0, 0);

const decay = (x, s = 0.5, e = 0.6) => clip((e - (x % 1)) / (e - s));
const env = (p, a, s, e, q = p % 1) => min(q / a, decay(q, s, e));

process(stg, function (data, length, i0, i, t) {
  for (; i0 < length; i0++, t = ++i / sr) {
    const beat = div * phase(i, lenBar);
    if (i % l16 == 0) {
      accent = 1 & (0b00101 >> beat % 5);
      click8 = 1 & (0b01111 >> beat % 5);

      if (i % l8 == 0) {
        lenNote = l8;
        if ((0b1001010000 >> beat) & 1) lenNote = l16;
        else if (rnd(6) < 1) lenNote = l16;
      }

      if (i % lenNote == 0) updateNote(i, floor(beat));
    }

    const p0 = phase(i, l16);
    const p1 = phase(i, l8);
    const auto0 = am(t / 180);

    let envSideClick = 1;
    click: {
      const e = click8 ? env(p1, 0.02, 0.05, 0.2) : env(p0, 0.04, 0.1, 0.4);
      const a = auto0 * (accent * 0.7 + 0.3) * e;
      envSideClick = 1 - a;
      if (!e) break click;
      const p = TAU * 4 * 98 * t + 20 * e;
      const b = a * sin(p + e * sin(E * p));
      for (let ch = 2; ch--; ) data[ch][i0] += b;
    }

    let synOut = 0;
    syn: {
      const e0 = env(lenNote == l16 ? p0 : p1, 0.1, 0.8, 0.9);
      if (!e0) break syn;
      p += TAU * f * (1 / sr);
      const b0 = 0.5 * a0 * (1 - p1) * sin((2 / 3) * p);
      const e1 = accent * asd(p1, 0.1);
      const b3 = 1.5 * e1 * b2;
      b2 = sin(p + b0 + b3);
      const b1 = mix(b2, sh(b2, i), 0.5 * am(3 * am(t / 23)));
      const fAuto = max(2400, f) * 2 ** (0.5 * auto0 + 0.5 * e1);
      if (useFilter) synOut = a0 * e0 * lp(b1, fAuto, 0.7);
      else synOut = a0 * e0 * b1;
      for (let ch = 2; ch--; ) data[ch][i0] += synOut;
    }

    for (let ch = 2; ch--; ) {
      const sec = (ch ? 0.26 : 0.23) + 5e-3 * rndLfos[ch](i);
      const fb = tapes[ch].get(i - sr * sec);
      tapes[ch].set(synOut - 0.7 * fb, i);
      data[ch][i0] += envSideClick * 0.9 * fb;
    }
  }
});

const tapes = [0, 1].map(() => new Loop());
const rndLfos = [0, 1].map(() => Hold.create({ k: exp(-35 / sr), l: sr / 5 }));
