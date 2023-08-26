const numTracks = 7;
let ctx, master, analyser, ampWav;

addEventListener("load", () => {
  if (!params.sr) params.sr = 24e3;
  if (!params.bit) params.bit = 16;
  if (params.fade === undefined) params.fade = 60;
  if (params.solo === undefined) params.solo = 60;
  if (params.anlz === undefined) params.anlz = 1;
  params.duration = 2 * params.fade + params.solo;
  params.interval = params.fade + params.solo;
  params.totalDuration = (numTracks - 1) * params.interval + params.duration;
  params.length = params.sr * params.totalDuration;

  if (!params.anlz) q("canvas").style.display = "none";
  const cw = q("canvas").offsetWidth;
  q("canvas").width = cw;
  q("canvas").height = parseInt(cw / 5);

  const dur = secToTimeString(params.totalDuration);
  q("#info").textContent = `sampleRate: ${params.sr}, ` + `duration: ${dur}`;

  q("#output").append(createSeekBar());
  if (params.rec) q("#output").append(createButton("rec", () => start()));
  else {
    q("#output").append(createButton("play", () => start()));
    q("#output").append(createButton("suspend", () => changeState()));
  }

  addEventListener("resize", () => {
    q("#seekbar").replaceWith(createSeekBar());
  });
});

function createSeekBar() {
  const w = document.body.offsetWidth;
  const h = parseInt(Math.max(w / 9, document.body.offsetHeight / 9));
  const wps = w / params.totalDuration;

  const { canvas, rect, line } = pSvg;
  const c = canvas(w, h);
  c.addEventListener("click", (ev) => start(ev.x / w));
  c.style.background = "#333";
  c.style.display = "block";
  c.id = "seekbar";

  const progress = rect(0, 0, 1, h);
  progress.setAttribute("fill", "#666");
  c.change = (t) => progress.setAttributeNS(null, "width", t * wps);
  c.append(progress);

  for (let i = numTracks; i--; ) {
    let x = params.interval * i;
    const li0 = line(x * wps, h, (x += params.fade) * wps, 9);
    const li1 = line(x * wps, 9, (x += params.solo) * wps, 9);
    const li2 = line(x * wps, 9, (x += params.fade) * wps, h);
    [li0, li1, li2].map((o) => o.setAttribute("stroke", "tan"));
    c.append(li0, li1, li2);
  }

  return c;
}

const changeState = async (method) => {
  if (!ctx) return;
  if (method) await ctx[method]();
  else await ctx[ctx.state == "running" ? "suspend" : "resume"]();
  q("#info").textContent = ctx.state;
  if (ctx.state == "closed") ctx = null;
};

async function start(seekPos = 0) {
  if (/⏳/.test(document.title)) return;
  document.title = "⏳" + title;

  if (analyser) analyser.close();
  if (ctx && ctx.close) ctx.close();

  if (params.rec && !seekPos) await render();
  else await play(seekPos);

  document.title = title;
}

async function play(seekPos) {
  ctx = new AudioContext({ sampleRate: params.sr });
  await changeState("suspend");

  const seekTime = parseInt(params.totalDuration * seekPos);
  await setupMaster(seekTime);
  for (let i = numTracks; i--; ) await setupTrack(i, seekTime);

  if (params.anlz) createAnalyser();
  changeState("resume");
}

async function render() {
  ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    sampleRate: params.sr,
    length: params.length,
  });

  await setupMaster(0);
  for (let i = numTracks; i--; ) await setupTrack(i, 0);

  const audioBuffer = await ctx.startRendering();
  const data = [0, 1].map((ch) => audioBuffer.getChannelData(ch));

  while (!ampWav) await new Promise((rsl) => setTimeout(rsl, 100));
  createWav(data, ampWav);
  ampWav = 0;
}

async function setupMaster(seekTime) {
  await ctx.audioWorklet.addModule("master.js");
  master = await new AudioWorkletNode(ctx, "master", {});
  await new Promise((rsl) => {
    master.port.postMessage(Object.assign({ seekTime }, params));
    master.port.onmessage = rsl;
  });

  master.port.onmessage = handleMasterMessage;
  master.connect(ctx.destination);
}

async function setupTrack(id, seekTime) {
  await ctx.audioWorklet.addModule(`worklets/${id}.js`);

  const worklet = await new AudioWorkletNode(ctx, id, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  await new Promise((rsl) => {
    const mess = { seekTime, startTime: id * params.interval };
    worklet.port.postMessage(Object.assign(mess, params));
    worklet.port.onmessage = rsl;
  });
  worklet.connect(master);
}

function handleMasterMessage({ data }) {
  if (data.info) {
    q("#seekbar").change(data.info.t);
    data.info.time = secToTimeString(data.info.t);
    data.info.t = undefined;
    q("#info").textContent = JSON.stringify(data.info).replace(/[\"{}]/g, "");
  }

  if (data.amplifier) ampWav = data.amplifier;
  if (data.end) changeState("close");
}

async function createWav(data, amplifier) {
  const opt = { amplifier, sampleRate: params.sr, bitsPerSample: params.bit };
  // const url = new PcmToWave(opt).createBlobUrl(data);
  const url = await PcmToWave.createUrl(opt, data);
  const txt = new Date().toLocaleTimeString() + ".wav";
  q("#output").append(create("br"), createLink(url, txt));
}

function createAnalyser() {
  analyser = new Analyser(q("canvas"), ctx);
  ctx.addEventListener("statechange", (ev) => {
    if (ctx && ctx.state == "running") analyser.startLoop();
    else analyser.stopLoop();
  });
  master.connect(analyser.node);
}
