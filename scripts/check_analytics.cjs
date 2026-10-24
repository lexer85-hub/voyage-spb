/* Проверки согласия без сети: имитируем загрузку счётчика и действия посетителя. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../dist/analytics.js"), "utf8");
const key = "voyage-spb-analytics-consent-v1";
const saved = (choice, id = 12345, expiry = Date.now() + 60000) =>
  JSON.stringify({ choice, counterId: id, expiresAt: expiry });

function page({ value = null, id = 12345, storageBlocked = false } = {}) {
  const elements = new Map();
  const scripts = [];
  const calls = [];
  const events = {};
  let stored = value;
  let focused;
  function element(name) {
    const listeners = {};
    const item = {
      hidden: true,
      isConnected: true,
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
      click: () => listeners.click(),
      focus: () => {
        focused = name;
      },
      remove: () => {
        item.removed = true;
      },
    };
    elements.set(name, item);
    return item;
  }
  const banner = element("#analytics-banner");
  const accept = element("#analytics-accept");
  const reject = element("#analytics-reject");
  const settings = element(".analytics-settings");
  const document = {
    querySelector: (name) => elements.get(name) || null,
    querySelectorAll: () => [settings],
    createElement: () => element(`script-${scripts.length}`),
    body: { classList: { add() {}, remove() {} } },
    head: { append: (script) => scripts.push(script) },
  };
  const window = {
    addEventListener: (name, fn) => {
      events[name] = fn;
    },
  };
  const localStorage = {
    getItem() {
      if (storageBlocked) throw Error("Storage blocked");
      return stored;
    },
    setItem(_, value) {
      if (storageBlocked) throw Error("Storage blocked");
      stored = value;
    },
  };
  // Первый запуск без разметки; затем вызываем ту же функцию с тестовым номером.
  const context = vm.createContext({
    window,
    localStorage,
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  });
  vm.runInContext(source, context);
  context.document = document;
  context.testCounterId = id;
  vm.runInContext("initAnalyticsConsent(testCounterId)", context);
  return {
    banner,
    accept,
    reject,
    settings,
    scripts,
    calls,
    stored: () => stored,
    focused: () => focused,
    load() {
      window.ym = (...args) => calls.push(args);
      scripts.at(-1).onload();
    },
    storage(value, storageKey = key) {
      events.storage({ key: storageKey, newValue: value });
    },
  };
}

let p = page();
assert.equal(p.banner.hidden, false);
assert.equal(p.scripts.length, 0, "До согласия нет запроса к Метрике");
p.reject.click();
assert.equal(p.scripts.length, 0, "Отказ не загружает Метрику");
assert.equal(page({ value: p.stored() }).banner.hidden, true, "Отказ сохраняется");
p.settings.click();
assert.equal(p.banner.hidden, false);
assert.equal(p.focused(), "#analytics-reject");
p.accept.click();
assert.equal(p.focused(), ".analytics-settings");
assert.equal(p.scripts.length, 1);
assert.equal(p.calls.length, 0, "Нет инициализации до загрузки скрипта");
p.load();
assert.equal(p.calls[0][1], "init");
assert.equal(p.calls[0][2].webvisor, false);
p.accept.click();
assert.equal(p.calls.length, 1, "Повторное согласие не создаёт второй счётчик");
p.reject.click();
assert.equal(p.calls.at(-1)[1], "destruct");
p.accept.click();
assert.equal(p.calls.at(-1)[1], "init");
assert.equal(p.scripts.length, 1, "Повторное включение использует загруженный скрипт");

p = page();
p.accept.click();
p.reject.click();
p.load();
assert.equal(p.calls.length, 0, "Отказ во время загрузки исключает последующий запуск");

p = page({ value: saved("accepted") });
assert.equal(p.scripts.length, 1);
p.load();
p.storage(saved("rejected"));
assert.equal(p.calls.at(-1)[1], "destruct", "Отказ из другой вкладки останавливает счётчик");
p.storage(null, null);
assert.equal(p.banner.hidden, false, "После очистки хранилища согласие запрашивается заново");

for (const value of ["invalid", saved("accepted", 12345, 0), saved("accepted", 98765)]) {
  p = page({ value });
  assert.equal(p.banner.hidden, false);
  assert.equal(p.scripts.length, 0, "Неверное, истёкшее или чужое согласие не действует");
}

p = page({ id: 0 });
p.accept.click();
assert.equal(p.scripts.length, 0, "Без номера счётчика запросы не отправляются");
p = page({ storageBlocked: true });
p.reject.click();
assert.equal(p.banner.hidden, true);
assert.equal(p.scripts.length, 0);

p = page();
p.accept.click();
p.scripts[0].onerror();
p.settings.click();
p.accept.click();
assert.equal(p.scripts.length, 2, "После ошибки загрузки доступна повторная попытка");
console.log(
  "OK: согласие, отказ, сохранение, отзыв, гонка загрузки, смена вкладки, срок и ошибки хранилища/сети.",
);
