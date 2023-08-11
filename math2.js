// prettier-ignore
const { abs, acos, acosh, asin, asinh, atan, atanh, atan2, ceil, cbrt, expm1, clz32, cos, cosh, exp, floor, fround, hypot, imul, log, log1p, log2, log10, max, min, pow, /*random,*/ round, sign, sin, sinh, sqrt, tan, tanh, trunc, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1_2, SQRT2 } = Math;
const sr = sampleRate;

class XorShift {
  constructor(seed) {
    this.state = new Uint32Array([seed || 1]);
  }
  process = () => {
    this.state[0] ^= this.state[0] << 13;
    this.state[0] ^= this.state[0] >>> 17;
    this.state[0] ^= this.state[0] << 5;
    return this.state[0] / 0x100000000; // 2 ** 32
  };
  static create(seed) {
    return new this(seed).process;
  }
}

export const Math2 = new (class {
  random = Math.random;
  XorShift = XorShift;
  setSeed = (seed) => {
    Math2.random = XorShift.create(seed);
  };
  TAU = 2 * Math.PI;
  mod = (v, m = 1) => ((v % m) + m) % m;
  mix = (a, b = 1, ratio = 0.5) => a + (b - a) * ratio;
  clip = (x, lo = 0, hi = 1) => max(lo, min(hi, x));
  phase = (x, l = 1) => mod(x, l) / l;
  crush = (a, b = 0.5, fnc = round) => fnc(a / b) * b;
  pot = (x, k = 1) => x / (1 + (1 - x) * k);
  pan = (x) => x / (0.4 + 0.6 * x);
  am = (phase) => 0.5 - 0.5 * cos(2 * PI * phase);
  asd = (x, a = 0.01, d = 1 - a) => min((x % 1) / a, 1, (1 - (x % 1)) / d);
  rnd = (lo = 1, hi = 0, e = 1) => lo + (hi - lo) * Math2.random() ** e;
  rndTriangular = (med = 0.5, r = Math2.random()) =>
    r < med ? sqrt(r / med) * med : 1 - sqrt((1 - r) / (1 - med)) * (1 - med);
  lerpArray(arr, x) {
    const fx = floor(x);
    const d0 = arr[fx];
    return d0 + (arr[fx + 1] - d0) * (x - fx) || 0;
  }
  shuffle(array) {
    for (let i = 0; i < array.length; i++) {
      const r = floor(array.length * Math2.random());
      [array[i], array[r]] = [array[r], array[i]];
    }
    return array;
  }
  isPrime(v) {
    // if (!Number.isInteger(v)) throw new Error("isPrime");
    if (v < 3) return v == 2;
    if (Number.isInteger(v / 2)) return false;
    for (let i = 3, l = sqrt(v); i <= l; i += 2) {
      if (Number.isInteger(v / i)) return false;
    }
    return true;
  }
})();

const { TAU, mod, mix, clip, phase, crush, pot, pan, am, asd, rnd } = Math2;
const { lerpArray, shuffle } = Math2;

Math2.Loop = class extends Float64Array {
  constructor(sec = 4) {
    super(sec * sr);
  }
  get(idx) {
    if (!Number.isInteger(idx)) {
      const im = mod(idx, this.length);
      if (im > this.length - 1) {
        return mix(this.at(-1), this[0], im - floor(im));
      } else return lerpArray(this, im);
    }
    return this[mod(idx, this.length)];
  }
  set(x, idx) {
    return (this[idx % this.length] = x);
  }
  add(x, idx) {
    this[idx % this.length] += x;
  }
  iGet(idx) {
    return this[mod(parseInt(idx), this.length)];
  }
  feedback(x, idx, deltaIdx = sr, amp = 0.7) {
    const fb = this[mod(parseInt(idx - deltaIdx), this.length)];
    return (this[idx % this.length] = x + amp * fb);
  }
};

class Abstract {
  constructor(options = {}) {
    Object.assign(this, options);
  }
  static create(options = {}) {
    const ins = new this();
    Object.assign(ins, options);
    return ins.process;
  }
}

Math2.Bag = class extends Abstract {
  bag = [0, 1];
  currentBag = [];
  process = () => {
    if (!this.currentBag.length)
      this.currentBag.push(...shuffle([...this.bag]));
    return this.currentBag.shift();
  };
};

Math2.Lop = class extends Abstract {
  k = exp(-1 / sr);
  y1 = 0;
  process = (inp) => (this.y1 = inp + (this.y1 - inp) * this.k);
};

Math2.SH = class extends Abstract {
  l = 2;
  x = 0;
  process = (v, i, l = this.l) => {
    if (i % l == 0) this.x = v;
    return this.x;
  };
};

Math2.Hold = class extends Abstract {
  k = exp(-7 / sr);
  l = sr / 10;
  f = Math2.random;
  x = 0;
  y1 = 0;
  process = (i, fnc) => {
    if (i % this.l == 0) this.x = fnc ? fnc() : this.f();
    const { x, y1, k } = this;
    return (this.y1 = x + (y1 - x) * k);
  };
};

const BiquadFilter = class extends Abstract {
  x1 = 0;
  x2 = 0;
  y1 = 0;
  y2 = 0;
  process = (x0) => {
    const { b0, b1, b2, a0, a1, a2 } = this;
    const { x1, x2, y1, y2 } = this;
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [this.x1, this.x2, this.y1, this.y2] = [x0, x1, y0, y1];
    return y0;
  };
  low = (f, q) => {
    const w0 = 2 * PI * (f / sr);
    const cosW0 = cos(w0);
    const a = sin(w0) / (2 * q);
    const b1 = (this.b1 = 1 - cosW0);
    this.b2 = this.b0 = b1 / 2;
    this.a0 = 1 + a;
    this.a1 = -2 * cosW0;
    this.a2 = 1 - a;
  };
  high = (f, q) => {
    const w0 = 2 * PI * (f / sr);
    const cosW0 = cos(w0);
    const a = sin(w0) / (2 * q);
    const b1 = (this.b1 = -1 - cosW0);
    this.b2 = this.b0 = -b1 / 2;
    this.a0 = 1 + a;
    this.a1 = -2 * cosW0;
    this.a2 = 1 - a;
  };
  band = (f, q) => {
    const w0 = 2 * PI * (f / sr);
    const sinW0 = sin(w0);
    const a = sinW0 / (2 * q);
    this.b2 = -(this.b0 = sinW0 / 2);
    this.b1 = 0;
    this.a0 = 1 + a;
    this.a1 = -2 * cos(w0);
    this.a2 = 1 - a;
  };
};

Math2.BiquadFilter = BiquadFilter;
Math2.Filter = {
  create: ({ type = "low", f = 800, q = 1, u = false } = {}) => {
    if (f > sr / 2) {
      console.warn(f, sr / 2);
      f = sr / 2;
    }
    const instance = new BiquadFilter();
    const update = instance[type];
    const process = instance.process;
    update(f, q);

    if (!u) return process;
    else return (x, f0 = f, q0 = q) => (update(f0, q0), process(x));
  },
};
