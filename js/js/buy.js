const searchBtn = document.getElementById("search-btn");
const searchBox = document.getElementById("search-box");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

let ALL_PRODUCTS = [];

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

