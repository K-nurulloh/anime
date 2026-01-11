let ALL_PRODUCTSS = [];
const cardsContainerr = document.getElementById("cards");

// FETCH HAMMA PRODUCTS
fetch("products.json")
  .then(res => res.json())
  .then(products => {
    ALL_PRODUCTSS = products;

    // Dastlab 8 ta card random tarzda chiqarish
    renderCardsRandom(ALL_PRODUCTSS, 8);
  });

// ================================
// FUNCTION: CARDLARNI RENDER QILISH RANDOM + FADE-IN
// ================================
function renderCardsRandom(products, count = 4) {
  if (!products.length) return;

  // Random tanlash
  const itemsToShow = [];
  for (let i = 0; i < count; i++) {
    const randIndex = Math.floor(Math.random() * products.length);
    itemsToShow.push(products[randIndex]);
  }

  itemsToShow.forEach((item, index) => {
    const card = document.createElement("div");

    card.className = `
      opacity-0 transform translate-y-10
      bg-white dark:bg-gray-800 rounded-xl shadow-md p-2 cursor-pointer hover:shadow-lg transition duration-500
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
    cardsContainerr.appendChild(card);

    // Random fade-in delay
    const delay = index * 150 + Math.random() * 300;
    setTimeout(() => {
      card.classList.remove("opacity-0", "translate-y-10");
      card.classList.add("opacity-100", "translate-y-0");
    }, delay);
  });
}

// ================================
// INFINITE SCROLL RANDOM
// ================================
window.addEventListener("scroll", () => {
  const scrollBottom = window.innerHeight + window.scrollY;
  const containerBottom = cardsContainer.offsetTop + cardsContainer.offsetHeight;

  if (scrollBottom + 200 >= containerBottom) {
    // Scroll pastga yetganda har safar random 4 ta card chiqarish
    renderCardsRandom(ALL_PRODUCTS, 4);
  }
});



  // ================== QIDIRUV (ALOXIDA) ==================
const searchBtn = document.getElementById("search-btn");
const searchBox = document.getElementById("search-box");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

let ALL_PRODUCTS = [];

// products.json dan kelgan ma’lumotni ushlab qolamiz
fetch("products.json")
  .then(res => res.json())
  .then(data => {
    ALL_PRODUCTS = data;
  });

// Qidiruvni ochish
searchBtn.addEventListener("click", () => {
  searchBox.classList.remove("hidden");
  searchInput.focus();
});

// Fon bosilsa yopiladi
searchBox.addEventListener("click", (e) => {
  if (e.target === searchBox) {
    searchBox.classList.add("hidden");
    searchInput.value = "";
    searchResults.innerHTML = "";
  }
});

// Qidirish
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
        window.location.href = `detail.html?id=${p.id}`;
      };

      searchResults.appendChild(li);
    });
});
// ======================================================

let PRODUCTS = [];

// Fetch products.json
fetch("products.json")
  .then(res => res.json())
  .then(data => PRODUCTS = data);

const searchInputt = document.getElementById("searchInput");
const results = document.getElementById("results");
const cardsContainer = document.getElementById("cards");

// Play Market style: inputga yozganing paytida faqat searchKey
searchInputt.addEventListener("input", () => {
  const value = searchInputt.value.toLowerCase().trim();
  results.innerHTML = "";

  if (!value) {
    results.classList.add("hidden");
    return;
  }

  const filteredKeys = [...new Set(
    PRODUCTS
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
  if (!e.target.closest(".relative")) {
    results.classList.add("hidden");
  }
});

// Fade-in cards with random delay
function showCards(key) {
  results.classList.add("hidden");
  cardsContainer.innerHTML = "";

  const products = PRODUCTS.filter(p => p.searchKey === key);

  products.forEach((item, index) => {
    const card = document.createElement("div");

    card.className = `
      opacity-0 transform translate-y-10
      bg-white dark:bg-gray-800 rounded-xl shadow-md p-2 cursor-pointer hover:shadow-lg transition duration-500
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
    cardsContainer.appendChild(card);

    // Random fade-in
    const delay = index * 150 + Math.random() * 200;
    setTimeout(() => {
      card.classList.remove("opacity-0", "translate-y-10");
      card.classList.add("opacity-100", "translate-y-0");
    }, delay);
  });

  // Scrollga qarab yangi cardlar asta-sekin qo‘shish
  let lastIndex = products.length;
  window.onscroll = () => {
    const bottom = cardsContainer.getBoundingClientRect().bottom;
    if (bottom < window.innerHeight + 200) { // pastga yetganda
      const more = ALL_PRODUCTS.filter(p => p.searchKey === key).slice(lastIndex, lastIndex + 4);
      more.forEach((item, i) => {
        const card = document.createElement("div");
        card.className = `
          opacity-0 transform translate-y-10
          bg-white dark:bg-gray-800 rounded-xl shadow-md p-2 cursor-pointer hover:shadow-lg transition duration-500
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
        cardsContainer.appendChild(card);

        const delay = i * 150 + Math.random() * 200;
        setTimeout(() => {
          card.classList.remove("opacity-0", "translate-y-10");
          card.classList.add("opacity-100", "translate-y-0");
        }, delay);
      });
      lastIndex += more.length;
    }
  };
}
