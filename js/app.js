// ================================
// GLOBAL VARIABLES
// ================================
let ALL_PRODUCTS = [];
let lastIndex = 0;
let perPage = 8;
let currentKey = null;

const cardsContainer = document.getElementById("cards");
const searchInputt = document.getElementById("searchInput");
const results = document.getElementById("results");
const searchBtn = document.getElementById("search-btn");
const searchBox = document.getElementById("search-box");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

// ================================
// FETCH PRODUCTS
// ================================
fetch("products.json")
  .then(res => res.json())
  .then(data => {
    ALL_PRODUCTS = data;
    renderRandomCards(perPage); // dastlabki cardlar
  });

// ================================
// CREATE CARD
// ================================
function createCard(item) {
  const card = document.createElement("div");
  card.className = `
    opacity-0 transform scale-95 translate-y-8
    bg-white dark:bg-gray-800 rounded-xl shadow-md p-2 cursor-pointer
    hover:shadow-xl hover:-translate-y-1 hover:scale-105
    transition duration-500 ease-out
  `;

  card.innerHTML = `
    <div class="w-full h-36 bg-gray-100 dark:bg-gray-700 rounded-xl mb-2 flex items-center justify-center overflow-hidden">
      <img src="${item.img}" class="object-contain w-full h-full">
    </div>
    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 line-clamp-2">${item.title}</h3>
    <div class="flex items-center gap-2 mb-2">
      <span class="text-purple-600 font-bold text-sm">${item.price}</span>
      ${item.oldPrice ? `<span class="line-through text-gray-400 dark:text-gray-400 text-xs">${item.oldPrice}</span>` : ''}
    </div>
    <button class="w-full bg-purple-600 text-white rounded-md py-1 text-xs hover:bg-purple-700 mt-1 cursor-pointer">
      Sotib olish
    </button>
  `;

  card.onclick = () => window.location.href = `detail.html?id=${item.id}`;
  return card;
}



// ================================
// RENDER RANDOM CARDS WITH STAGGERED EFFECT
// ================================
function renderRandomCards(count = 4) {
  const source = currentKey
    ? ALL_PRODUCTS.filter(p => p.searchKey === currentKey)
    : ALL_PRODUCTS;

  if (!source.length) return;

  const itemsToShow = [];
  for (let i = 0; i < count; i++) {
    const randIndex = Math.floor(Math.random() * source.length);
    itemsToShow.push(source[randIndex]);
  }

  itemsToShow.forEach((item, index) => {
    const card = createCard(item);
    cardsContainer.appendChild(card);

    // Staggered effect: har bir kartaga alohida delay
    const delay = index * 150 + Math.random() * 150;
    setTimeout(() => {
      card.classList.remove("opacity-0", "translate-y-8", "scale-95");
      card.classList.add("opacity-100", "translate-y-0", "scale-100");
    }, delay);
  });
}

// ================================
// INFINITE SCROLL RANDOM
// ================================
window.addEventListener("scroll", () => {
  const bottom = cardsContainer.getBoundingClientRect().bottom;
  if (bottom < window.innerHeight + 200) {
    renderRandomCards(perPage); // scroll bo‘lganda yangi kartalar
  }
});

// ================================
// SEARCH BUTTON + BOX
// ================================
searchBtn.addEventListener("click", () => {
  searchBox.classList.remove("hidden");
  searchInput.focus();
});

searchBox.addEventListener("click", (e) => {
  if (e.target === searchBox) {
    searchBox.classList.add("hidden");
    searchInput.value = "";
    searchResults.innerHTML = "";
  }
});

// ================================
// SEARCH PRODUCTS BY TITLE
// ================================
searchInput.addEventListener("input", () => {
  const value = searchInput.value.toLowerCase().trim();
  searchResults.innerHTML = "";

  if (!value) return;

  ALL_PRODUCTS
    .filter(p => p.title.toLowerCase().includes(value))
    .forEach(p => {
      const li = document.createElement("li");
      li.className =
        "flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800";

      li.innerHTML = `
        <img src="${p.img}" class="w-12 h-12 object-contain rounded">
        <div>
          <p class="text-sm font-medium">${p.title}</p>
          <p class="text-xs text-purple-600">${p.price} so'm</p>
        </div>
      `;

      li.onclick = () => {
        currentKey = null;
        cardsContainer.innerHTML = "";
        renderRandomCards(perPage);
        searchBox.classList.add("hidden");
        window.location.href = `detail.html?id=${p.id}`;
      };

      searchResults.appendChild(li);
    });
});

// ================================
// PLAY MARKET STYLE SEARCH (searchKey)
// ================================
searchInputt.addEventListener("input", () => {
  const value = searchInputt.value.toLowerCase().trim();
  results.innerHTML = "";

  if (!value) {
    results.classList.add("hidden");
    currentKey = null;
    cardsContainer.innerHTML = "";
    renderRandomCards(perPage);
    return;
  }

  const filteredKeys = [...new Set(
    ALL_PRODUCTS
      .filter(p => p.searchKey.toLowerCase().includes(value))
      .map(p => p.searchKey)
  )];

  if (!filteredKeys.length) {
    results.innerHTML = `<div class="px-5 py-4 text-gray-500 dark:text-gray-400">Topilmadi</div>`;
    results.classList.remove("hidden");
    return;
  }

  filteredKeys.forEach(key => {
    results.innerHTML += `
      <div
        class="block px-5 py-4 text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#0b1220] cursor-pointer transition"
        onclick="showCards('${key}')"
      >
        ${key}
      </div>
    `;
  });

  results.classList.remove("hidden");
});

document.addEventListener("click", e => {
  if (!e.target.closest(".relative")) results.classList.add("hidden");
});

// ================================
// SHOW CARDS BY SEARCH KEY
// ================================
function showCards(key) {
  currentKey = key;
  cardsContainer.innerHTML = "";
  renderRandomCards(perPage); // random cardlarni filter bo‘yicha chiqarish
}
