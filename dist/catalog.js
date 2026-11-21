const form = document.querySelector('.catalog-filters');
const search = document.querySelector('#catalog-search');
const category = document.querySelector('#catalog-category');
const status = document.querySelector('#catalog-status');
const sections = [...document.querySelectorAll('.catalog-section')];

function normalize(text) {
  return text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

function filterCatalog() {
  const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
  let matches = 0;

  for (const section of sections) {
    const showCategory = !category.value || section.id === category.value;
    let visibleCards = 0;
    for (const card of section.querySelectorAll('.catalog-card')) {
      const name = normalize(card.querySelector('h3').textContent);
      const description = normalize(card.querySelector('p').textContent);
      card.hidden = !showCategory || !words.every(word => `${name} ${description}`.includes(word));
      visibleCards += Number(!card.hidden);
    }
    section.hidden = visibleCards === 0;
    matches += visibleCards;
  }

  status.textContent = matches ? `Найдено позиций: ${matches}` : 'Ничего не найдено. Попробуйте другое название.';
}

form.hidden = false;
form.addEventListener('submit', event => event.preventDefault());
search.addEventListener('input', filterCatalog);
category.addEventListener('change', filterCatalog);
filterCatalog();
