class PcmToWave {
  sampleRate = 48000;
  bitsPerSample = 16;
  numChannels = 2;
  amplifier = 1;
  constructor(options) {
    Object.assign(this, options);
  }

  createBlobURL(buffers) {
    const blob = this.createBlob(buffers);
    return URL.createObjectURL(blob);
  }

  createBlob(buffers) {
    const uint8array = this.convert(buffers);
    return new Blob([uint8array], { type: "audio/wav" });
  }

  convert(inBuffers) {
    const buffers = this.#setupChannel(inBuffers, this.numChannels);
    return this.#createWaveFormatData(buffers);
  }

  #setupChannel(inputs, numChs) {
    const outputs = [];
    if (inputs[0].length) {
      if (inputs.length != numChs) console.warn("numChannels");
      for (let i = 0; i < numChs; i++)
        outputs[i] = inputs[i] || new Float64Array(outputs[0].length);
    } else {
      // 1d array input
      if (numChs != 1) console.warn("numChannels");
      for (let i = 0; i < numChs; i++) outputs[i] = Array.from(inputs);
    }
    return outputs;
  }

  #createWaveFormatData(buffers) {
    const dataChunks = [];
    for (let i = 0; i < this.numChannels; i++)
      dataChunks[i] = this.#convertIntoDataChunk(buffers[i], this.amplifier);
    const mergedChunk = this.#mergeChannels(dataChunks);
    return this.#addHeader(mergedChunk);
  }

  #convertIntoDataChunk(x, amp = 1) {
    switch (this.bitsPerSample) {
      case 8: {
        const y = new Uint8Array(x.length);
        for (let i = 0, l = x.length; i < l; i++) {
          y[i] = Math.round(((amp * x[i]) / 2 + 0.5) * 0xff); // 0 -> 128
        }
        return y;
      }
      case 16: {
        amp *= 0x7fff;
        const y = new Int16Array(x.length);
        for (let i = 0, l = x.length; i < l; i++) {
          y[i] = amp * x[i];
        }
        return new Uint8Array(y.buffer);
      }
      case 32: {
        const y = new Float32Array(x.length);
        for (let i = 0, l = x.length; i < l; i++) {
          y[i] = amp * x[i];
        }
        return new Uint8Array(y.buffer);
      }
      case 24: {
        amp *= 0x7fffff;
        const y = new Uint8Array(x.length * 3);
        for (let i = 0, l = x.length; i < l; i++) {
          const n = Math.trunc(amp * x[i]);
          y[i * 3] = n & 0xff;
          y[i * 3 + 1] = (n >>> 8) & 0xff;
          y[i * 3 + 2] = (n >>> 16) & 0xff;
        }
        return y;
      }
      default:
        throw new Error("bitsPerSample");
    }
  }

  #mergeChannels(inputs) {
    const numChannels = this.numChannels;
    const length = inputs[0].length * numChannels;
    const output = new Uint8Array(length);
    const bytesPerSample = this.bitsPerSample / 8;
    let sampleIndex = 0;
    let outputIndex = 0;
    while (outputIndex < length) {
      for (let ch = 0; ch < numChannels; ch++) {
        for (let b = 0; b < bytesPerSample; b++) {
          output[outputIndex++] = inputs[ch][sampleIndex + b];
        }
      }
      sampleIndex += bytesPerSample;
    }
    return output;
  }

  #addHeader(data) {
    const header = this.#createHeader(data, this);
    const headerLen = header.length;
    const output = new Uint8Array(headerLen + data.length);
    for (let i = headerLen; i--; ) output[i] = header[i];
    for (let i = data.length; i--; ) output[headerLen + i] = data[i];

    return output;
  }

  #createHeader(data, { numChannels, sampleRate }) {
    const bitsPerSample = this.bitsPerSample,
      audioFormat = bitsPerSample == 32 ? 3 : 1,
      byteRate = (sampleRate * numChannels * bitsPerSample) / 8,
      blockAlign = (numChannels * bitsPerSample) / 8,
      subChunk2Size = data.length,
      chunkSize = 36 + subChunk2Size;

    const buffer = new ArrayBuffer(44);
    // prettier-ignore
    {
      const view = new DataView(buffer);
      view.setUint32( 0, 0x52494646);
      view.setUint32( 4, chunkSize    , 1);
      view.setUint32( 8, 0x57415645);
      view.setUint32(12, 0x666d7420);
      view.setUint32(16, 16           , 1);
      view.setUint16(20, audioFormat  , 1);
      view.setUint16(22, numChannels  , 1);
      view.setUint32(24, sampleRate   , 1);
      view.setUint32(28, byteRate     , 1);
      view.setUint16(32, blockAlign   , 1);
      view.setUint16(34, bitsPerSample, 1);
      view.setUint32(36, 0x64617461);
      view.setUint32(40, subChunk2Size, 1);
    }
    return new Uint8Array(buffer);
  }
}
