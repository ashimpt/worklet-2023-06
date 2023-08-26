importScripts("./pcm-to-wave.js");

let pcmToWave = {};
let pcm = [];

onmessage = ({ data }) => {
  if (data.isOptions) pcmToWave = new PcmToWave(data);
  else pcm.push(data);

  if (!pcmToWave || pcm.length != pcmToWave.numChannels) return;
  const buff = pcmToWave.convert(pcm);
  postMessage(buff, [buff.buffer]);
};
