class Analyser {
  audioCtx;
  canvasCtx;
  node;
  dataArray;
  freqInterval;
  fftSize = 2 ** 11;
  mode = 0;
  zoom = 1;
  constructor(canvasEl, audioCtx_ = new AudioContext()) {
    const ctx = (this.audioCtx = audioCtx_);
    const analyser = (this.node = ctx.createAnalyser());
    analyser.fftSize = this.fftSize;
    this.dataArray = new Uint8Array(this.fftSize / 2);
    this.freqInterval = ctx.sampleRate / this.fftSize;
    this.setupCanvas(canvasEl);
  }
  setupCanvas(canvasEl) {
    const ctx = (this.canvasCtx = canvasEl.getContext("2d"));
    this.canvasEvent = this.toggleMode.bind(this);
    ctx.canvas.addEventListener("click", this.canvasEvent);
    ctx.fillStyle = "#fff";
  }
  toggleMode() {
    this.mode = ++this.mode % 3;
    this.stopLoop();
    if (this.mode < 2) this.startLoop();
  }
  animId = null;
  frameCount = 0;
  stopRect = () => this.canvasCtx.fillRect(10, 10, 5, 5);
  startLoop = () => (this.stopLoop(), this.loop());
  stopLoop = () => (cancelAnimationFrame(this.animId), this.stopRect());
  loop = () => ((this.animId = requestAnimationFrame(this.loop)), this.draw());
  close = () => {
    this.stopLoop();
    const canvas = this.canvasCtx.canvas;
    this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.removeEventListener("click", this.canvasEvent);
  };
  draw = () => {
    const ctx = this.canvasCtx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const l = Math.floor(this.dataArray.length / this.zoom);
    if (this.mode == 0) this.drawTime(ctx, w, h, l, this.dataArray);
    else if (this.mode == 1) this.drawFreq(ctx, w, h, l, this.dataArray);
    else this.stopLoop();
    // ctx.fillText(Math.floor(this.frameCount++ / 60), 10, 10);
  };
  drawTime(ctx, w, h, l, array) {
    this.node.getByteTimeDomainData(array);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, h / 2, w, 1);
    for (let i = 0, s = w / l + 1; i < l; i++) {
      const d = array[i];
      ctx.fillRect((i / l) * w, (1 - d / 256) * h, s, s);
    }
  }
  #freqBG = null;
  drawFreq(ctx, w, h, l, array) {
    if (this.#freqBG) ctx.drawImage(this.#freqBG, 0, 0);
    else this.#drawFreqBackGround(ctx, w, h, l);
    this.node.getByteFrequencyData(array);
    ctx.fillStyle = "#fff";
    for (let i = 1; i < l; i++) {
      const x = Math.log2(i) / Math.log2(l);
      const y = (1 - array[i] / 256) * h;
      ctx.fillRect(Math.round(x * w), y, 1, h - y);
    }
  }
  #drawFreqBackGround(ctx, w, h, l) {
    const { log2, round, random } = Math;
    const idx = (hz) => hz / this.freqInterval;
    const hzToX = (hz) => round(w * (log2(idx(hz)) / log2(l)));

    ctx.fillStyle = ["#330", "#033", "#303"].at(3 * random()); // bg
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#666"; // octave line
    for (let oct = -2; oct < 9; oct++) {
      ctx.fillRect(hzToX(100 * 2 ** oct), 0, 1, h);
    }
    ctx.fillStyle = "tan";
    for (const hz of [10, 100, 1e3, 10e3]) {
      ctx.fillRect(hzToX(hz), 0, 1, h);

      for (let i = 1, l = hz == 1e3 ? 19 : 9; i <= l; i++) {
        ctx.fillRect(hzToX(hz * i), h / 2 - 2, 1, 4);
      }
    }
    ctx.fillRect(hzToX(20e3), 0, 1, h);

    this.#freqBG = new Image();
    this.#freqBG.src = ctx.canvas.toDataURL();
  }
}
