const { max, min, abs, round, floor, log10, sqrt } = Math;
import { Math2 } from "./math2.js";
import { params } from "./mod.js";

const filter = new Math2().Filter;
const hps = [0, 1].map(() => filter.create({ type: "high", f: 20 }));
const sr = sampleRate;
let writer;

class PcmWriter {
  constructor(dur = 1) {
    this.length = round(dur * sr);
    this.data = [0, 0].map(() => new Float32Array(this.length));
  }
  process(x, lenBlock, idx, length, { data }) {
    const l = min(lenBlock, length - idx);
    for (let i = 0; i < l; i++, idx++) {
      data[0][idx] += x[0][i];
      data[1][idx] += x[1][i];
    }
  }
  post(port, maxAmp) {
    const amplifier = 0.89 / maxAmp || void 0;
    port.postMessage({ amplifier });
    port.postMessage(this.data[0], [this.data[0].buffer]);
    port.postMessage(this.data[1], [this.data[1].buffer]);
  }
}

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
  constructor(...args) {
    super(...args);
    this.port.onmessage = ({ data }) => {
      Object.assign(params, data);

      this.seekFrame = round(sr * data.seekTime);
      this.length = data.totalDuration * sr;

      if (data.rec && !data.seekTime) {
        console.warn("rec");
        writer = new PcmWriter(data.totalDuration);
      } else if (data.rec) console.warn("not rec");

      this.port.postMessage({ loaded: 1 });
    };
  }
  process({ 0: inp }, { 0: oup }) {
    const idx = this.seekFrame + currentFrame;
    if (idx >= this.length) {
      if (writer) writer.post(this.port, peakMeter.peak);
      this.port.postMessage({ end: 1 });
      if (ampData[0]) console.log({ ampData });
      return;
    }

    const lenBlock = oup[0].length;
    for (let ch = 2; ch--; ) {
      for (let i = 0; i < lenBlock; i++) {
        oup[ch][i] = hps[ch](inp[ch][i] || 0);
      }
    }

    if (writer) writer.process(oup, lenBlock, idx, this.length, writer);

    peakMeter.process(oup, lenBlock);
    peakMeter.limit(oup, lenBlock);

    const t = floor(idx / sr);
    if (!currentFrame || t != floor((idx + lenBlock) / sr)) {
      this.secProcess(lenBlock, idx, t);
    }

    return true;
  }
  secProcess(lenBlock, idx, ct) {
    const t = ct + (currentFrame ? 1 : 0);

    if (params.warn) {
      const min = floor(t / 60);
      ampData[min] = max(ampData[min] || 0, peakMeter.value);
      if (floor(t) % 60 == 0) console.log(ampData.at(-2) || 0);
      if (peakMeter.value > params.warn / 100) {
        console.warn({ a: peakMeter.value, t });
      }
    }

    peakMeter.post(this.port, idx + lenBlock, t);
    peakMeter.value = 0;
  }
}

const ampData = [];
registerProcessor("master", processor);
