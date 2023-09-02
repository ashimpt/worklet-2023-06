const numTracks = 7;
const df = { tet: 0, fade: 60, solo: 60, sr: 24e3, anlz: 0, seed: 0, bit: 0 };
let params, ctx, master, analyser, ampWav;
const muteList = [];

addEventListener("load", () => {
  q("canvas").width = q("canvas").offsetWidth;
  q("canvas").height = parseInt(q("canvas").width / 5);

  q("#clear").addEventListener("click", (e) => updateUrl(e, 1));
  q("#new-window").addEventListener("click", (e) => {
    e.preventDefault();
    // prevent addModule freeze
    window.open(location.href, "_blank");
    window.close();
  });
  const aList = [...document.querySelectorAll("#params>a")];
  for (const a of aList) a.addEventListener("click", (e) => updateUrl(e));

  init();
});

addEventListener("resize", () => q("#seekbar").replaceWith(createSeekBar()));

function updateUrl(e, clear = false) {
  e.preventDefault();
  if (/⏳/.test(document.title)) return;

  if (clear) {
    const url = decodeURIComponent(`${window.location.pathname}?`);
    window.history.replaceState({}, "", url);
    for (const [k, v] of Object.entries(urlParams)) urlParams[k] = undefined;
  } else {
    const a = new URLSearchParams(e.target.href.split("?")[1]);
    for (const [k, v] of a.entries()) setQueryStringParameter(k, v);
    const url = new URLSearchParams(location.search);
    for (const [k, v] of url.entries()) urlParams[k] = parseInt(v);
  }

  init();
}

async function init() {
  await changeState("close");

  // params
  params = Object.assign({}, urlParams);
  for (const [k, v] of Object.entries(df)) {
    if (params[k] === undefined) params[k] = v;
  }
  params.duration = 2 * params.fade + params.solo;
  params.interval = params.fade + params.solo;
  params.totalDuration = (numTracks - 1) * params.interval + params.duration;
  params.length = params.sr * params.totalDuration;

  // elements
  q("canvas").style.display = params.anlz ? "block" : "none";

  const dur = secToTimeString(params.totalDuration);
  q("#info").textContent = `sampleRate: ${params.sr}, duration: ${dur}`;
  const size = 2 * (params.bit / 8 || 4) * params.sr * params.totalDuration;
  if (params.bit) q("#info").textContent += ", size: " + dataSizeToString(size);

  output.replaceChildren();
  q("#output").append(createSeekBar());
  q("#output").append(createButton(params.bit ? "rec" : "play", () => start()));
  q("#output").append(createButton("suspend", () => changeState()));

  // links
  for (const a of [...document.querySelectorAll("#params>a")]) {
    let selected = 1;
    const url = new URLSearchParams(a.href.split("?")[1]);
    for (const [key, value] of url.entries()) {
      if (params[key] != parseInt(value)) selected = 0;
    }

    a.classList.toggle("selected", selected);
  }
}

function createSeekBar() {
  const w = document.body.offsetWidth;
  const h = parseInt(Math.max(w / 9, document.body.offsetHeight / 9));
  const wps = w / params.totalDuration;

  const { canvas, rect, line } = pSvg;
  const c = canvas(w, h);
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

  c.addEventListener("click", (ev) => start(ev.x / w));
  return c;
}

async function changeState(method) {
  if (!ctx || ctx.state == "closed") return;
  if (analyser && method == "close") analyser.close();
  if (method) await ctx[method]();
  else {
    if (ctx instanceof OfflineAudioContext) console.warn(ctx.state, ctx);
    else await ctx[ctx.state == "running" ? "suspend" : "resume"]();
  }

  q("#info").textContent = ctx.state;
  if (ctx.state == "closed") ctx = null;
}

async function start(seekPos = 0) {
  if (/⏳/.test(document.title)) return;
  document.title = "⏳" + title;

  await changeState("close");

  if (params.bit && !seekPos) await render();
  else await play(seekPos);

  document.title = title;
}

async function play(seekPos) {
  const hints = "playback,playback,balanced,interactive".split(",");
  const latencyHint = hints[params.anlz];

  ctx = new AudioContext({ sampleRate: params.sr, latencyHint });
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
    length: params.length,
    sampleRate: params.sr,
  });

  await setupMaster(0);
  for (let i = numTracks; i--; ) await setupTrack(i, 0);

  let audioBuffer;
  try {
    audioBuffer = await ctx.startRendering();
  } catch (e) {
    alert(e); // try length
    ctx = null;
    return;
  }
  const data = [0, 1].map(() => new Float32Array(params.length));
  for (let ch = 2; ch--; ) audioBuffer.copyFromChannel(data[ch], ch);

  while (!ampWav) await new Promise((rsl) => setTimeout(rsl, 100));
  createWav(data, ampWav);
  ampWav = null;
}

async function setupMaster(seekTime) {
  // TODO: OfflineAudioContext addModule freeze ?
  // rec -> redirect to this page with different query -> rec

  await ctx.audioWorklet.addModule("./master.js");
  master = await new AudioWorkletNode(ctx, "master", {});

  await new Promise((rsl) => {
    master.port.postMessage(Object.assign({ seekTime }, params));
    master.port.onmessage = rsl;
  });

  master.port.onmessage = handleMasterMessage;
  master.connect(ctx.destination);
}

async function setupTrack(id, seekTime) {
  if (muteList.indexOf(id) != -1) return;
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
  const url = await PcmToWave.process(data, opt);
  const txt = new Date().toLocaleTimeString() + ".wav";
  q("#output").append(createLink(url, txt));
}

function createAnalyser() {
  analyser = new Analyser(q("canvas"), ctx);
  ctx.addEventListener("statechange", (ev) => {
    if (ctx && ctx.state == "running") analyser.startLoop();
    else analyser.stopLoop();
  });
  master.connect(analyser.node);
}
