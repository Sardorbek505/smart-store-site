import test from 'node:test';
import assert from 'node:assert/strict';
import { init } from '../scripts/analytics.js';
import { referrerOrigin } from '../scripts/core.js';

function browser(t) {
  const originals = new Map();
  const replace = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const sent = [];
  const observed = [];
  const stopped = [];
  const listeners = {};
  const section = { getAttribute: () => 'features-title' };
  const heading = {
    innerText: 'Продажи. Склад. Контроль.',
    textContent: 'Продажи. Склад. Контроль.',
    closest: () => section,
  };
  const doc = {
    referrer: 'https://example.org/private?email=secret',
    hidden: false,
    visibilityState: 'visible',
    getElementById: (id) => id === 'features-title' ? heading : null,
    querySelectorAll: () => [section],
    addEventListener: (type, listener) => { listeners[type] = listener; },
  };
  let callback;
  let options;
  class Observer {
    constructor(fn, config) { callback = fn; options = config; }
    observe(element) { observed.push(element); }
    unobserve(element) { stopped.push(element); }
  }
  replace('document', doc);
  replace('location', { pathname: '/pomoshch/', search: '?phone=secret', hash: '#private' });
  replace('window', { IntersectionObserver: Observer });
  replace('IntersectionObserver', Observer);
  class Element {}
  replace('Element', Element);
  replace('fetch', (endpoint, request) => {
    sent.push({ endpoint, ...request, payload: JSON.parse(request.body) });
    return Promise.resolve({});
  });
  const button = (text, download = false) => Object.assign(new Element(), {
    innerText: text,
    getAttribute: () => null,
    matches: () => download,
    closest(selector) { return selector === 'a, button' ? this : section; },
  });
  return { sent, observed, stopped, listeners, heading, section, doc, button, entry: (ratio) => callback([{ target: heading, isIntersecting: true, intersectionRatio: ratio }]), options: () => options };
}

test('заголовок высокого раздела учитывается, когда хотя бы наполовину виден', (t) => {
  const b = browser(t);
  init({ analyticsAllowed: () => true, referrerOrigin });
  assert.deepEqual(b.observed, [b.heading]);
  assert.equal(b.options().threshold, 0.5);
  b.entry(0.1);
  assert.equal(b.sent.length, 1);
  b.entry(0.8);
  b.entry(1);
  assert.equal(b.sent.length, 2, 'раздел отправляется только один раз');
  assert.deepEqual(b.sent[1].payload, { site: 'smart-store', name: 'seen', label: 'Продажи. Склад. Контроль.' });
})

test('скрытая вкладка не засчитывает показ заголовка', (t) => {
  const b = browser(t);
  init({ analyticsAllowed: () => true, referrerOrigin });
  b.doc.visibilityState = 'hidden';
  b.doc.hidden = true;
  b.entry(1);
  assert.equal(b.sent.length, 1);
  assert.equal(b.stopped.length, 0);
  b.doc.visibilityState = 'visible';
  b.doc.hidden = false;
  b.listeners.visibilitychange?.();
  assert.equal(b.sent.length, 2);
})

test('запрет аналитики исключает запросы, а отзыв выбора прекращает события', (t) => {
  const b = browser(t);
  let allowed = false;
  init({ analyticsAllowed: () => allowed, referrerOrigin });
  assert.equal(b.sent.length, 0);
  assert.equal(b.observed.length, 0);
  allowed = true;
  init({ analyticsAllowed: () => allowed, referrerOrigin });
  allowed = false;
  b.entry(1);
  assert.equal(b.sent.length, 1);
  assert.equal(b.stopped.length, 0);
})

test('визит не передаёт query, fragment и путь источника или браузерные credentials', (t) => {
  const b = browser(t);
  init({ analyticsAllowed: () => true, referrerOrigin });
  assert.deepEqual(b.sent[0].payload, { site: 'smart-store', path: '/pomoshch/', ref: 'https://example.org' });
  assert.equal(b.sent[0].credentials, 'omit');
  assert.equal(b.sent[0].referrerPolicy, 'no-referrer');
  assert.doesNotMatch(b.sent[0].body, /secret|private/);
})

test('нажатия и скачивания продолжают учитываться без IntersectionObserver', (t) => {
  const b = browser(t);
  delete window.IntersectionObserver;
  init({ analyticsAllowed: () => true, referrerOrigin });
  b.listeners.click({ target: b.button('Открыть демо') });
  b.listeners.click({ target: b.button('Попробовать бесплатно', true) });
  b.listeners.click({ target: {} });
  assert.equal(b.sent.length, 3);
  assert.deepEqual(b.sent[1].payload, { site: 'smart-store', name: 'click', label: 'Открыть демо · Продажи. Склад. Контроль.' });
  assert.deepEqual(b.sent[2].payload, { site: 'smart-store', name: 'click', label: 'Скачать — Попробовать бесплатно' });
  assert.equal(b.observed.length, 0);
})

test('заголовок, ушедший с экрана в скрытой вкладке, не создаёт ложный показ', (t) => {
  const b = browser(t);
  init({ analyticsAllowed: () => true, referrerOrigin });
  b.doc.visibilityState = 'hidden';
  b.entry(1);
  b.entry(0);
  b.doc.visibilityState = 'visible';
  b.listeners.visibilitychange();
  assert.equal(b.sent.length, 1);
})
