"use strict";

// Границы совпадают с соответствующими правилами в styles.css.
const DESKTOP_MENU_QUERY = "(min-width: 1001px)";
const COMPACT_CATALOGUE_QUERY = "(max-width: 960px)";
const COMPACT_STORE_QUERY = "(max-width: 800px)";

/** Мобильное меню: кнопка, переход по ссылке и закрытие клавишей Escape. */
function initMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.querySelector("#mobile-menu");
  if (!toggle || !menu) return;

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    menu.hidden = !open;
  }

  toggle.addEventListener("click", () => setOpen(menu.hidden));
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia(DESKTOP_MENU_QUERY).addEventListener("change", () => setOpen(false));
}

/** Без JavaScript и на широком экране группы товаров всегда доступны. */
function initCatalogue() {
  const compact = window.matchMedia(COMPACT_CATALOGUE_QUERY);
  const syncCards = [];

  document.querySelectorAll(".category-grid .category").forEach((card, index) => {
    const heading = card.querySelector(".category-heading");
    const title = card.querySelector(".category-title");
    const content = card.querySelector(".category-content");
    if (!heading || !title || !content) return;

    const toggle = document.createElement("button");
    content.id = `category-products-${index + 1}`;
    toggle.type = "button";
    toggle.className = "category-toggle";
    toggle.setAttribute("aria-label", title.textContent.trim());
    toggle.setAttribute("aria-controls", content.id);
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    heading.append(toggle);

    let expanded = false;
    function sync() {
      toggle.hidden = !compact.matches;
      content.hidden = compact.matches && !expanded;
      toggle.setAttribute("aria-expanded", String(!content.hidden));
      card.classList.toggle("category-collapsible", compact.matches);
    }

    toggle.addEventListener("click", () => {
      expanded = !expanded;
      sync();
    });
    syncCards.push(sync);
    sync();
  });

  compact.addEventListener("change", () => syncCards.forEach((sync) => sync()));
}

/** На телефоне преимущества свёрнуты; на компьютере видны все шесть. */
function initAdvantages() {
  const toggle = document.querySelector(".advantages-toggle");
  const content = document.querySelector("#store-advantages");
  if (!toggle || !content) return;

  const compact = window.matchMedia(COMPACT_STORE_QUERY);
  let expanded = false;

  function sync() {
    toggle.hidden = !compact.matches;
    content.hidden = compact.matches && !expanded;
    toggle.setAttribute("aria-expanded", String(!content.hidden));
  }

  toggle.addEventListener("click", () => {
    expanded = !expanded;
    sync();
  });
  compact.addEventListener("change", sync);
  sync();
}

initMobileMenu();
initCatalogue();
initAdvantages();

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});
