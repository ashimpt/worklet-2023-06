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
    let secPeak = 0;
    for (let ch = 2; ch--; ) {
      let chPeak = 0;
      for (let i = 0; i < spb; i++) {
        const v = inp[ch][i];
        chPeak = max(chPeak, abs(v));
        sumSq[ch] += v * v;
      }
      peaks[ch] = max(peaks[ch], chPeak);
      secPeak = max(secPeak, chPeak);
    }
    this.value = max(this.value, secPeak);
    this.peak = max(...peaks);
  },
  limit(inp, spb) {
    for (let ch = 2, v = this.peak; v > 1 && ch--; )
      for (let i = spb; i--; ) inp[ch][i] /= v;
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
  params;
  seekFrame = 0;
  length = 0;
  constructor(...args) {
    super(...args);
    this.port.onmessage = ({ data }) => {
      this.params = data;
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

    const t = floor(idx / sr);
    if (!currentFrame || t != floor((idx + spb) / sr)) {
      this.secProcess(spb, idx, t);
    }

    return true;
  }
  secProcess(spb, idx, ct) {
    const t = ct + (currentFrame ? 1 : 0);

    const warn = this.params.warn;
    if (warn && peakMeter.value > warn / 100) {
      console.log({ amp: peakMeter.value.toFixed(3), t });
    }

    peakMeter.post(this.port, idx + spb, t);
    peakMeter.value = 0;
  }
}

registerProcessor("master", processor);
