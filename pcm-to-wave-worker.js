importScripts("./pcm-to-wave.js");

let pcmToWave = {};
let pcm = [];

onmessage = ({ data }) => {
  if (data.isOptions) pcmToWave = new PcmToWave(data);
  else pcm.push(data);

  if (pcm.length != pcmToWave.numChannels) return;
  const arr = pcmToWave.convert(pcm);
  postMessage(arr, [arr.buffer]);
};
