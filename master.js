const { max, min, abs, round, floor, log10, sqrt } = Math;
import { Math2 } from "./math2.js";
import { params } from "./mod.js";

const sr = sampleRate;
const filter = new Math2().Filter;
const hps = [0, 1].map(() => filter.create({ type: "high", f: 20 }));

const peakMeter = {
  value: 0,
  peak: 0,
  peaks: [0, 0],
  sumSq: [0.01, 0.01],
  process(inp, lenBlock) {
    const { peaks, sumSq } = this;
    let blockPeak = 0;
    for (let ch = 2; ch--; ) {
      let chPeak = 0;
      for (let i = 0; i < lenBlock; i++) {
        const v = inp[ch][i];
        chPeak = max(chPeak, abs(v));
        sumSq[ch] += v * v;
      }
      peaks[ch] = max(peaks[ch], chPeak);
      blockPeak = max(blockPeak, chPeak);
    }
    this.value = max(this.value, blockPeak);
    this.peak = max(...peaks);
  },
  limit(inp, lenBlock) {
    for (let ch = 2, v = this.peak; v > 1 && ch--; )
      for (let i = lenBlock; i--; ) inp[ch][i] /= v;
  },
  db: (v) => (20 * log10(v)).toFixed(1),
  post(port, length, t) {
    const peak = this.peaks.map((v) => v.toFixed(3));
    const rms = this.sumSq.map((v) => this.db(sqrt(v / length)));
    const a = this.value.toFixed(3);
    const info = { peak, rms, a, t };
    port.postMessage({ info });
  },
};

class processor extends AudioWorkletProcessor {
  seekFrame = 0;
  length = 0;
  amp = 1; //TODO: prevent clipping
  constructor(...args) {
    super(...args);
    this.port.onmessage = ({ data }) => {
      Object.assign(params, data);

      this.seekFrame = round(sr * data.seekTime);
      this.length = data.length;

      if (data.rec) this.amp = 0.1;

      this.port.postMessage({ loaded: 1 });
    };
  }
  process({ 0: inp }, { 0: oup }) {
    const idx = this.seekFrame + currentFrame;
    const lenBlock = oup[0].length;
    for (let ch = 2, a = this.amp; ch--; ) {
      for (let i = 0; i < lenBlock; i++) {
        oup[ch][i] = a * hps[ch](inp[ch][i] || 0);
      }
    }

    peakMeter.process(oup, lenBlock);
    peakMeter.limit(oup, lenBlock);

    const ct = floor(idx / sr);
    const end = idx + lenBlock >= this.length;

    if (!currentFrame || ct != floor((idx + lenBlock) / sr)) {
      this.processSec(lenBlock, idx, ct, end);
    }

    if (!end) return true;
    else {
      const amplifier = 0.89 / peakMeter.peak || void 0;
      this.port.postMessage({ amplifier });
      if (ampData[0] !== undefined) console.log({ ampData });
      if (!params.rec) this.port.postMessage({ end: 1 });
      return false;
    }
  }

  processSec(lenBlock, idx, ct, end) {
    const t = ct + (currentFrame ? 1 : 0);

    if (params.rec && peakMeter.peak > 1) console.error("clipping");
    if (params.warn) {
      const min = floor(t / 60);
      if (peakMeter.value / this.amp > params.warn / 100) {
        console.warn({ a: peakMeter.value / this.amp, t });
      }

      ampData[min] = max(ampData[min] || 0, peakMeter.value / this.amp);
      if (t % 60 == 0) logStyle(ampData.at(-2) || NaN);
    }

    if (!params.rec || end || t % 10 == 0) {
      peakMeter.post(this.port, idx + lenBlock, t);
    }
    peakMeter.value = 0;
  }
}

const ampData = [];
const logStyle = (s) => console.log("%c" + s, "font-size:smaller");

registerProcessor("master", processor);
