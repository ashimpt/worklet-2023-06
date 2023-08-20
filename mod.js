const { min, max, abs } = Math;
import { createMath2 as getMath2 } from "./math2.js";
export const sr = sampleRate;
export const params = {};

export function createMath2() {
  return getMath2(params.seed);
}

export function process({ id, amp }, play) {
  let duration, fadeRatio, seekFrameFromStart, trackLength;

  class processor extends AudioWorkletProcessor {
    constructor(...args) {
      super(...args);
      this.port.onmessage = ({ data }) => {
        const { startTime, fade, seekTime } = data;

        duration = data.duration;
        fadeRatio = fade / duration;
        seekFrameFromStart = parseInt(sr * (seekTime - startTime));
        trackLength = parseInt(sr * duration);

        this.port.postMessage({});
      };
    }
    process(inputs, { 0: outputData }, param) {
      let idxTrack = seekFrameFromStart + currentFrame;
      if (idxTrack >= trackLength) return false;
      const lenBlock = outputData[0].length;
      if (idxTrack <= -lenBlock) return true;
      const idxBlock = idxTrack < 0 ? -idxTrack : 0;
      idxTrack = idxTrack < 0 ? 0 : idxTrack;

      play(outputData, lenBlock, idxBlock, idxTrack, idxTrack / sr);

      // fade
      for (let i = idxTrack, i0 = idxBlock; i0 < lenBlock; i0++, i++) {
        const p = i / sr / duration;
        const a = amp * min(p / fadeRatio, 1, (1 - p) / fadeRatio) ** 0.7;
        for (let ch = 2; ch--; ) outputData[ch][i0] *= a;
      }
      return true;
    }
  }

  registerProcessor(id, processor);
}
