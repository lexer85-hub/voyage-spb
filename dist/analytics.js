"use strict";

// Укажите отдельный номер счётчика Вояж-СПб. При 0 Метрика не загружается.
const VOYAGE_METRIKA_ID = 0;

/** Согласие относится к конкретному счётчику и действует 180 дней. */
function initAnalyticsConsent(counterId = VOYAGE_METRIKA_ID) {
  const banner = document.querySelector("#analytics-banner");
  const accept = document.querySelector("#analytics-accept");
  const reject = document.querySelector("#analytics-reject");
  const settings = document.querySelectorAll(".analytics-settings");
  if (!banner || !accept || !reject) return;

  const storageKey = "voyage-spb-analytics-consent-v1";
  const consentLifetime = 180 * 24 * 60 * 60 * 1000;
  const configured = Number.isSafeInteger(counterId) && counterId > 0;
  const availability = document.querySelector("#analytics-availability");
  if (availability) availability.hidden = configured;
  let allowed = false;
  let initialized = false;
  let tagReady = false;
  let tagScript = null;
  let returnFocus = null;

  function readChoice(raw) {
    try {
      const value = JSON.parse(raw);
      return value &&
        value.counterId === counterId &&
        value.expiresAt > Date.now() &&
        ["accepted", "rejected"].includes(value.choice)
        ? value.choice
        : null;
    } catch {
      return null;
    }
  }

  function showBanner() {
    banner.hidden = false;
    document.body.classList.add("analytics-prompt-open");
  }

  function hideBanner() {
    banner.hidden = true;
    document.body.classList.remove("analytics-prompt-open");
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }

  function initializeCounter() {
    if (!allowed || !configured || initialized || typeof window.ym !== "function") return;
    window.ym(counterId, "init", {
      trackLinks: true,
      accurateTrackBounce: true,
      clickmap: false,
      webvisor: false,
    });
    initialized = true;
  }

  function startAnalytics() {
    if (!allowed || !configured || initialized) return;
    if (tagReady) {
      initializeCounter();
      return;
    }
    if (tagScript) return;

    window.ym =
      window.ym ||
      function () {
        (window.ym.a = window.ym.a || []).push(arguments);
      };
    window.ym.l = Date.now();
    tagScript = document.createElement("script");
    tagScript.async = true;
    tagScript.src = "https://mc.yandex.ru/metrika/tag.js";
    tagScript.onload = () => {
      tagReady = true;
      // Отказ во время загрузки не должен приводить к запуску счётчика.
      initializeCounter();
    };
    tagScript.onerror = () => {
      tagScript.remove();
      tagScript = null;
    };
    document.head.append(tagScript);
  }

  function applyChoice(choice) {
    allowed = choice === "accepted";
    if (allowed) startAnalytics();
    else if (initialized) {
      window.ym(counterId, "destruct");
      initialized = false;
    }
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          choice,
          counterId,
          expiresAt: Date.now() + consentLifetime,
        }),
      );
    } catch {
      // Если хранилище недоступно, выбор действует только на текущей странице.
    }
    applyChoice(choice);
    hideBanner();
  }

  accept.addEventListener("click", () => saveChoice("accepted"));
  reject.addEventListener("click", () => saveChoice("rejected"));
  settings.forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", () => {
      returnFocus = button;
      showBanner();
      reject.focus();
    });
  });

  // Смена выбора в другой вкладке останавливает счётчик и здесь.
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    const choice = readChoice(event.newValue);
    applyChoice(choice);
    if (choice) hideBanner();
    else showBanner();
  });

  let choice = null;
  try {
    choice = readChoice(localStorage.getItem(storageKey));
  } catch {}
  applyChoice(choice);
  if (!choice) showBanner();
}

initAnalyticsConsent();
