const num = 7;

addEventListener("load", () => {
  if (!params.sr) params.sr = 24e3;
  if (!params.bit) params.bit = 16;
  if (params.fade === undefined) params.fade = 60;
  if (params.solo === undefined) params.solo = 60;
  if (params.anlz === undefined) params.anlz = 1;
  if (params.tet12 === undefined) params.tet12 = 1;
  params.duration = 2 * params.fade + params.solo;
  params.interval = params.fade + params.solo;
  params.totalDuration = (num - 1) * params.interval + params.duration;

  q("#info").textContent = `sampleRate: ${params.sr}`;

  const cw = q("canvas").offsetWidth;
  q("canvas").width = cw;
  q("canvas").height = parseInt(cw / 4);

  q("#output").append(createSeekBar());
  q("#output").append(createButton("play", () => start()));
  q("#output").append(createButton("suspend", () => changeState()));

  addEventListener("resize", () => {
    q("#seekbar").replaceWith(createSeekBar());
  });
});

function createSeekBar() {
  const width = q("#output").offsetWidth;
  const [w, h] = [width, parseInt(width / 10)];
  const wps = width / params.totalDuration;

  const { canvas, rect, line } = pSvg;
  const c = canvas(w, h);
  c.addEventListener("click", (ev) => start(ev.x / w));
  c.style.background = "#333";
  c.style.display = "block";
  c.id = "seekbar";

  const current = rect(0, 0, 1, h);
  current.setAttribute("fill", "#666");
  c.change = (t) => current.setAttributeNS(null, "width", t * wps);
  c.append(current);

  for (let i = num; i--; ) {
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

let ctx, master, analyser;

async function start(seekPos = 0) {
  if (/⏳/.test(document.title) && !confirm("start?")) return;
  document.title = "⏳" + title;

  if (analyser) analyser.close();
  if (ctx) ctx.close();

  // context
  ctx = new AudioContext({ sampleRate: params.sr });
  await changeState("suspend");
  const seekTime = parseInt(params.totalDuration * seekPos);

  //  master
  await ctx.audioWorklet.addModule("master.js");
  master = await new AudioWorkletNode(ctx, "master", {});
  await setupMasterMessage(master, seekTime);
  master.connect(ctx.destination);

  // tracks
  for (let i = num; i--; ) await loadTrack(i, seekTime);

  if (params.anlz) createAnalyser();

  document.title = title;
  changeState("resume");
}

async function setupMasterMessage(master, seekTime) {
  const mess = Object.assign(params, { seekTime });
  await new Promise((rsl) => {
    master.port.postMessage(mess);
    master.port.onmessage = rsl;
  });

  const pcm = { amplifier: 1, data: [] };
  master.port.onmessage = ({ data }) => {
    if (data.info) {
      const s = JSON.stringify(data.info || {}).replace(/[\"{}]/g, "");
      q("#info").textContent = s; // volume info
      q("#seekbar").change(data.info.t);
    }
    if (data.amplifier) pcm.amplifier = data.amplifier;
    if (data.buffer) {
      pcm.data.push(data); // typed array
      if (pcm.data.length == 2) createWav(pcm);
    }
    if (data.end) changeState("close");
  };

  function createWav({ data, amplifier }) {
    changeState("suspend");
    const opt = { amplifier, sampleRate: params.sr, bitsPerSample: params.bit };
    const url = new PcmToWave(opt).createBlobURL(data);
    const txt = new Date().toLocaleTimeString() + ".wav";
    q("#output").append(create("br"), createLink(url, txt));
  }
}

async function loadTrack(id, seekTime) {
  await ctx.audioWorklet.addModule(`worklets/${id}.js`);

  const worklet = await new AudioWorkletNode(ctx, id, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  await new Promise((rsl) => {
    const mess = { seekTime, startTime: id * params.interval };
    worklet.port.postMessage(Object.assign(params, mess));
    worklet.port.onmessage = rsl;
  });
  worklet.connect(master);
}

function createAnalyser() {
  analyser = new Analyser(q("canvas"), ctx);
  ctx.addEventListener("statechange", (ev) => {
    if (ctx && ctx.state == "running") analyser.startLoop();
    else analyser.stopLoop();
  });
  master.connect(analyser.analyser);
}
