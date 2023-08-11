// prettier-ignore
const {abs,ceil,cos,exp,floor,log,log2,log10,max,min,pow,round,sign,sin,sqrt,tanh,trunc,E,PI}=Math;
import { Math2, sr, params, process } from "../mod.js";
const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { Loop, Bag, Lop, Filter, SH, Hold } = Math2;
////////////////////////////////////////////////////////////////////////////////
const opt = { id: 7, amp: 0.89 };

process(opt, function (data, spb, i0, i, t) {
  for (; i0 < spb; i0++, t = ++i / sr) {
    const p = TAU * 200 * t;
    const b = sin(p + sin(p));
    for (let ch = 2; ch--; ) data[ch][i0] += b;
  }
});
