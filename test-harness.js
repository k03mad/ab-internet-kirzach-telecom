// Тестовый стенд: эмулирует AnyBalance API и гоняет main.js провайдера
const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');

const BASE = 'https://lk.kirzhachtelecom.ru';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let cookies = {}; // name -> value
let lastStatus = 0;
const cookieFile = __dirname + '/ck_harness.txt';
const PROVIDER_DIR = __dirname + '/provider';

function httpReq(method, path, headers, body) {
  // синхронный HTTP через curl
  const args = ['-s', '-L', '-c', cookieFile, '-b', cookieFile, '--max-time', '30', '-A', UA];
  args.push('-w', '\n%{http_code}');
  for (const [k, v] of Object.entries(headers || {})) {
    args.push('-H', k + ': ' + v);
  }
  if (method === 'POST') {
    if (body) {
      args.push('--data-binary', body);
    }
  }
  args.push(BASE + path);
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const m = /\n(\d{3})$/.exec(out);
  lastStatus = m ? +m[1] : 0;
  return out.replace(/\n\d{3}$/, '');
}

function encodeForm(params) {
  return Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}

function encodeForm(params) {
  return Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}

// --- AnyBalance mock ---
let resultState = null;
const anybalance = {
  getPreferences: () => ({ login: process.env.KT_LOGIN, password: process.env.KT_PASS }),
  trace: (...a) => console.log('  [trace]', a.join(' ')),
  setDefaultCharset: (c) => {},
  getLastStatusCode: () => lastStatus,
  isAvailable: () => true,
  setResult: (r) => { resultState = r; console.log('SETRESULT called'); },
  Error: function (msg, allowRetry, fatal) {
    this.message = msg; this.allowRetry = allowRetry; this.fatal = fatal;
  },
  getLastUrl: () => '',
  getLastResponseHeader: () => null,
  getLastResponseHeaders: () => [],
  getCookies: () => Object.entries(cookies).map(([n, v]) => ({ name: n, value: v, domain: 'lk.kirzhachtelecom.ru', path: '/' })),
  getCookie: (n) => cookies[n],
  setCookie: (d, n, v) => { if (v === null) delete cookies[n]; else cookies[n] = v; },
};

// переопределяем requestGet/requestPost на реальный HTTP (синхронно)
anybalance.requestGet = (url, headers) => {
  const path = url.replace(BASE, '') || '/';
  console.log('  [GET]', path);
  return httpReq('GET', path, headers);
};
anybalance.requestPost = (url, data, headers) => {
  const path = url.replace(BASE, '') || '/';
  console.log('  [POST]', path, JSON.stringify(data));
  const body = typeof data === 'string' ? data : encodeForm(data);
  const h = Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, headers || {});
  return httpReq('POST', path, h, body);
};

// ВАЖНО: НЕ передаём String/Array/Object/JSON и пр. в песочницу — vm должен
// использовать собственные интринсики, иначе библиотека не сможет расширить
// String.prototype для строк, создаваемых внутри vm.
const sandbox = { AnyBalance: anybalance, console, setTimeout, clearTimeout, setInterval, clearInterval, process: undefined };
sandbox.global = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;

const ctx = vm.createContext(sandbox);

async function run() {
  // загружаем библиотеку
  const lib = fs.readFileSync(PROVIDER_DIR + '/library.js', 'utf8');
  vm.runInContext(lib, ctx, { filename: 'library.js' });
  console.log('library loaded');

  // загружаем main.js
  const main = fs.readFileSync(PROVIDER_DIR + '/main.js', 'utf8');
  vm.runInContext(main, ctx, { filename: 'main.js' });
  console.log('main.js loaded');

  try {
    vm.runInContext('main()', ctx, { filename: 'run' });
  } catch (e) {
    console.log('ERROR:', e.message);
    if (e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
  }
  console.log('\nRESULT:', JSON.stringify(resultState, null, 2));
  // кука-файл содержит логин (сервер кладёт его в cookie) — удаляем, чтобы не светить личные данные
  try { fs.rmSync(cookieFile, { force: true }); } catch (e) {}
}

run();
