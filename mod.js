const { min, max, abs } = Math;
export const sr = sampleRate;
export const params = {};

import { Math2 } from "./math2.js";
export const createMath2 = (seed) => Math2.create(seed || params.seed);

export function process({ id, amp }, playTrack) {
  let duration, fadeRatio, seekFrameFromStart, trackLength;

  class processor extends AudioWorkletProcessor {
    constructor(...args) {
      super(...args);
      this.port.onmessage = ({ data }) => {
        const { startTime, fade, seekTime } = data;

        duration = data.duration;
        fadeRatio = (fade || 1e-3) / duration;
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
      if (idxTrack < 0) idxTrack = 0;

      const length = min(lenBlock, trackLength - idxTrack);
      playTrack(outputData, length, idxBlock, idxTrack, idxTrack / sr);

      // fade
      for (let i = 0, i0 = idxBlock, i1 = idxTrack; i < length; i++, i0++) {
        const p = i1++ / sr / duration;
        const a = amp * min(p / fadeRatio, 1, (1 - p) / fadeRatio) ** 0.7;
        for (let ch = 2; ch--; ) outputData[ch][i0] *= a || 0;
      }
      return true;
    }
  }

  amp *= params.amp;
  registerProcessor(id, processor);
}
