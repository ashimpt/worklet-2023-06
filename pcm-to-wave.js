class PcmToWave {
  sampleRate = 48000;
  bitsPerSample = 16;
  numChannels = 2;
  amplifier = 1;
  constructor(options) {
    Object.assign(this, options);
  }

  static process(data, opt = {}, ret = "url") {
    const worker = new Worker("pcm-to-wave-worker.js");
    worker.postMessage(Object.assign({ isOptions: 1 }, opt));

    const chData = new PcmToWave(opt).setupChannel(data);
    for (let ch = 0; ch < chData.length; ch++) {
      worker.postMessage(chData[ch], [chData[ch].buffer]);
    }

    return new Promise((resolve) => {
      worker.onmessage = ({ data }) => {
        if (ret == "raw") {
          resolve(data);
          return;
        }

        const blob = new Blob([data], { type: "audio/wav" });
        if (ret == "blob") resolve(blob);
        else resolve(URL.createObjectURL(blob));
      };
    });
  }

  createBlobUrl(buffers) {
    const blob = this.createBlob(buffers);
    return URL.createObjectURL(blob);
  }

  createBlob(buffers) {
    const uint8array = this.convert(buffers);
    return new Blob([uint8array], { type: "audio/wav" });
  }

  convert(buffers) {
    const buff = this.setupChannel(buffers);
    return this.#createWaveFormatData(buff);
  }

  setupChannel(inputs, numChs = this.numChannels) {
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
    // http://soundfile.sapp.org/doc/WaveFormat/
    const chData = [];
    for (let i = 0; i < this.numChannels; i++) {
      chData[i] = this.#convertIntoUint8(buffers[i], this.amplifier);
    }

    const dataLength = chData[0].length * this.numChannels;
    const output = new Uint8Array(44 + dataLength);
    this.#setHeader(output, dataLength, this);
    this.#setDataChunk(output, chData);
    return output;
  }

  #convertIntoUint8(x, amp) {
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

  #setHeader(output, subChunk2Size, { numChannels, sampleRate }) {
    const bitsPerSample = this.bitsPerSample,
      audioFormat = bitsPerSample == 32 ? 3 : 1,
      byteRate = (sampleRate * numChannels * bitsPerSample) / 8,
      blockAlign = (numChannels * bitsPerSample) / 8,
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
    output.set(new Uint8Array(buffer));
  }

  #setDataChunk(output, chData) {
    const outputLength = output.length;
    const numChannels = this.numChannels;
    const bytesPerSample = this.bitsPerSample / 8;
    let outputIndex = 44;
    let chDataIndex = 0;
    while (outputIndex < outputLength) {
      for (let ch = 0; ch < numChannels; ch++) {
        for (let b = 0; b < bytesPerSample; b++) {
          output[outputIndex++] = chData[ch][chDataIndex + b];
        }
      }
      chDataIndex += bytesPerSample;
    }
  }
}
