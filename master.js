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
  sumSq: [1e-5, 1e-5],
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
  getInfo(length, t) {
    const peak = this.peaks.map((v) => v.toFixed(3));
    const rms = this.sumSq.map((v) => this.db(sqrt(v / length)));
    const a = this.value.toFixed(3);
    return { peak, rms, a, t };
  },
};

class processor extends AudioWorkletProcessor {
  seekFrame = 0;
  constructor(...args) {
    super(...args);
    this.port.onmessage = ({ data }) => {
      Object.assign(params, data);

      this.seekFrame = round(sr * params.seekTime);
      if (this.seekFrame) params.bit = 0;
      params.amp = params.bit ? 0.1 : 1; //-20dB prevent clipping

      this.port.postMessage({});
    };
  }
  process({ 0: inp }, { 0: oup }) {
    const idx = this.seekFrame + currentFrame;
    const lenBlock = oup[0].length;
    const inputsAvailable = inp.length;

    if (inputsAvailable) {
      for (let ch = 2; ch--; ) {
        for (let i = 0; i < lenBlock; i++) {
          oup[ch][i] = hps[ch](inp[ch][i] || 0);
        }
      }

      peakMeter.process(oup, lenBlock);
      peakMeter.limit(oup, lenBlock);
    }

    const ct = floor(idx / sr);
    const end = idx + lenBlock >= params.length;

    if (!currentFrame || ct != floor((idx + lenBlock) / sr)) {
      this.processSec(lenBlock, ct, end);
    }

    if (!end) return true;
    else {
      const amplifier = 0.89 / peakMeter.peak || void 0;
      this.port.postMessage({ amplifier });
      if (ampList[0] !== undefined) console.log({ ampList });
      if (!params.bit) this.port.postMessage({ end: 1 });
      return false;
    }
  }

  processSec(lenBlock, ct, end) {
    const { bit, warn, amp } = params;
    const t = ct + (currentFrame ? 1 : 0);

    if (bit && peakMeter.peak > 1) console.error("clipping");
    if (warn) {
      const min = floor(t / 60);
      if (peakMeter.value / amp > warn / 100) {
        console.warn({ a: peakMeter.value / amp, t });
      }

      ampList[min] = max(ampList[min] || 0, peakMeter.value / amp);
      if (t % 60 == 0 && ampList.at(-2)) logS(min - 1 + ":" + ampList.at(-2));
    }

    if (!bit || end || t % 10 == 0) {
      const info = peakMeter.getInfo(currentFrame + lenBlock, t);
      if (end) console.log(info);
      this.port.postMessage({ info });
    }
    peakMeter.value = 0;
  }
}

const ampList = [];
const logS = (s) => console.log("%c" + s, "font-size:smaller");

registerProcessor("master", processor);
