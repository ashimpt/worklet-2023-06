const title = document.title;
const q = (s) => document.querySelector(s);

const params = Object.fromEntries(new URLSearchParams(location.search));
for (const [k, v] of Object.entries(params)) params[k] = parseInt(v);

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