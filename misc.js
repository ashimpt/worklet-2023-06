const title = document.title;
const q = (s) => document.querySelector(s);

const urlParams = Object.fromEntries(new URLSearchParams(location.search));
for (const [k, v] of Object.entries(urlParams)) urlParams[k] = parseInt(v);

function setQueryStringParameter(name, value) {
  const params = new URLSearchParams(window.location.search);
  params.set(name, value);
  const url = decodeURIComponent(`${window.location.pathname}?${params}`);
  window.history.replaceState({}, "", url);
}

function create(tagName, text, className) {
  const el = document.createElement(tagName);
  if (text || text === 0) el.textContent = text;
  if (className) el.classList.add(className);
  return el;
}

function createButton(txt, callback, className) {
  const elem = create("button", txt, className);
  elem.addEventListener("click", callback);
  return elem;
}

function createLink(url, txt, className) {
  const a = create("a", txt, className);
  a.href = url;
  a.target = a.download = txt;
  a.addEventListener("click", (e) => (e.preventDefault(), window.open(url)));
  return a;
}

const pSvg = {};
pSvg.canvas = (width = 100, height = 50) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  elem.setAttributeNS(null, "viewBox", "0 0 " + width + " " + height);
  elem.setAttributeNS(null, "width", width);
  elem.setAttributeNS(null, "height", height);
  return elem;
};

pSvg.text = (str = "name", x = 5, y = 5) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "text");
  elem.append(document.createTextNode(str));
  elem.setAttributeNS(null, "x", x);
  elem.setAttributeNS(null, "y", y);
  return elem;
};

pSvg.line = (x1, y1, x2, y2) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "line");
  elem.setAttributeNS(null, "x1", x1);
  elem.setAttributeNS(null, "y1", y1);
  elem.setAttributeNS(null, "x2", x2);
  elem.setAttributeNS(null, "y2", y2);
  return elem;
};

pSvg.rect = (x, y, width, height) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  elem.setAttributeNS(null, "x", x);
  elem.setAttributeNS(null, "y", y);
  elem.setAttributeNS(null, "width", width);
  elem.setAttributeNS(null, "height", height);
  return elem;
};

function secToTimeString(t) {
  const date = new Date(t * 1e3);
  let s = date.toISOString().substring(11, 19);
  if (t >= 60 * 60 * 24) s = parseInt(t / 60 / 60 / 24) + "d " + s;
  return s.replace(/^00:/, "");
}

function dataSizeToString(size) {
  const o = Math.log2(size);
  const u = ",K,M,G,T,P,E,Z,Y".split(",").at(o / 10) + "B";
  const n = size / 1024 ** parseInt(o / 10);
  return o / 10 < 1 ? n + "bytes" : n.toFixed(1) + u;
}
