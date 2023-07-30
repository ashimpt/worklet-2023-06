const { max, min, abs, round, floor, log10, sqrt } = Math;
const sr = sampleRate;
let writer;

class PcmWriter {
  constructor(dur = 1) {
    this.length = round(dur * sr);
    this.data = [0, 0].map(() => new Float32Array(this.length));
  }
  process(x, spb, idx, length, { data }) {
    const l = min(spb, length - idx);
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
  sumSq: [1e-3, 1e-3],
  process(inp, spb) {
    const { peaks, sumSq } = this;
    let blockPeak = 0;
    for (let ch = 2; ch--; ) {
      let chPeak = 0;
      for (let i = 0; i < spb; i++) {
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
  limit(inp, spb) {
    for (let ch = 2, v = this.peak; v > 1 && ch--; )
      for (let i = spb; i--; ) inp[ch][i] /= v;
  },
  pFnc: (v) => v.toFixed(3),
  rFnc: (v) => (20 * log10(sqrt(v))).toFixed(1),
  post(port, length, t) {
    const a = this.value.toFixed(3);
    const peak = this.peaks.map(this.pFnc);
    const rms = this.sumSq.map((v) => this.rFnc(v / length));
    const info = { peak, rms, a, t };
    port.postMessage({ info });
  },
};

class processor extends AudioWorkletProcessor {
  length = 0;
  seekFrame = 0;
  constructor(...args) {
    super(...args);
    this.port.onmessage = ({ data }) => {
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
      return;
    }

    const spb = oup[0].length;
    for (let ch = 2; ch--; ) {
      for (let i = 0; i < spb; i++) {
        oup[ch][i] = inp[ch][i] || 0;
      }
    }

    if (writer) writer.process(oup, spb, idx, this.length, writer);

    peakMeter.process(oup, spb);
    peakMeter.limit(oup, spb);

    if (!currentFrame || floor(idx / sr) != floor((idx + spb) / sr)) {
      // if (peakMeter.value > 0.45) {
      //   console.log({
      //     amp: peakMeter.value.toFixed(3),
      //     t: floor(idx / sr),
      //   });
      // }

      const t = floor(idx / sr) + (currentFrame ? 1 : 0);
      peakMeter.post(this.port, idx + spb, t);
      peakMeter.value = 0;
    }

    return true;
  }
}

registerProcessor("master", processor);
