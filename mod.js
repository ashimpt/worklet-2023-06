const options = {};
export const sr = sampleRate;
export const setup = (opt) => Object.assign(options, opt);
export function process(name, play) {
  let duration, fadeRatio, seekFrameFromStart, trackLength;

  class processor extends AudioWorkletProcessor {
    constructor(...args) {
      super(...args);
      this.port.onmessage = ({ data }) => {
        const { startTime, fade, seekTime } = data;
        if (data.tet12 && options.set12) options.set12();
        duration = data.duration;
        fadeRatio = fade / duration;
        seekFrameFromStart = parseInt(sr * (seekTime - startTime));
        trackLength = parseInt(sr * duration);

        this.port.postMessage({});
      };
    }
    process(inputs, { 0: data }, param) {
      let i = seekFrameFromStart + currentFrame;
      if (i >= trackLength) return false;
      const samplesPerBlock = data[0].length;
      if (i <= -samplesPerBlock) return true;
      const i0 = i < 0 ? -i : 0;
      i = i < 0 ? 0 : i;
      play(data, samplesPerBlock, i0, i, i / sr);
      fade(data, i, samplesPerBlock, fadeRatio, duration);
      return true;
    }
  }

  registerProcessor(name, processor);
}

const { min, max } = Math;

function fade(data, i, spb, ratio, duration) {
  for (let i0 = 0; i0 < spb; i0++, i++) {
    const p = min(1, max(0, i / sr / duration));
    const e = min(p / ratio, 1, (1 - p) / ratio) ** 0.7;
    for (let ch = 2; ch--; ) data[ch][i0] *= e;
  }
}
