// Dark mode aniqlash va html/body fonini o'rnatish
if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
  document.documentElement.classList.add('dark');
  document.body.classList.add('bg-gray-900', 'text-white');
} else {
  document.documentElement.classList.remove('dark');
  document.body.classList.add('bg-white', 'text-black');
}

// URL parametri olish
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

fetch("products.json")
  .then(res => res.json())
  .then(products => {
    const product = products.find(p => p.id == id);
    const detailDiv = document.getElementById("detail");

    detailDiv.innerHTML = `
      <div class="flex flex-col lg:flex-row gap-6 w-full p-4 rounded-xl bg-white dark:bg-gray-800">
        <!-- Chap: rasm -->
        <div class="flex flex-col">
          <img id="main-img" src="${product.img}" class="w-full lg:w-96 rounded-xl mb-4 object-contain">
          <div id="thumbs" class="flex gap-4 overflow-x-auto">
            ${product.thumbs.map(src => `<img src="${src}" class="w-20 h-20 rounded cursor-pointer border-2 border-transparent hover:border-orange-500 flex-shrink-0">`).join('')}
          </div>
        </div>

        <!-- O‘ng: info -->
        <div class="flex flex-col justify-between w-full lg:w-1/2">
          <div>
            <span class="text-sm text-orange-500 font-bold">${product.company}</span>
            <h1 class="text-2xl sm:text-3xl font-bold my-2 text-black dark:text-white">${product.title}</h1>
            <p class="text-gray-600 dark:text-gray-300">${product.desc}</p>
            <div class="price my-4">
              <span class="text-xl font-bold text-black dark:text-white">${product.price}</span>
              ${product.discount ? `<span class="text-sm bg-orange-200 text-orange-600 px-2 rounded ml-2">${product.discount}</span>` : ''}
              ${product.oldPrice ? `<span class="line-through text-gray-400 ml-2 dark:text-gray-500">${product.oldPrice}</span>` : ''}
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div class="quantity flex items-center gap-2">
              <button id="minus" class="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600">-</button>
              <span id="qty" class="text-black dark:text-white">0</span>
              <button id="plus" class="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600">+</button>
            </div>
            <button id="add-cart" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Sotib olish</button>
          </div>
        </div>
      </div>
    `;

    // Thumbnail click
    const mainImg = document.getElementById("main-img");
    const thumbs = document.querySelectorAll("#thumbs img");
    thumbs.forEach(thumb => thumb.onclick = () => mainImg.src = thumb.src);

    // Quantity
    let qty = 0;
    const qtySpan = document.getElementById("qty");
    document.getElementById("plus").onclick = () => { qty++; qtySpan.textContent = qty; };
    document.getElementById("minus").onclick = () => { if(qty>0){ qty--; qtySpan.textContent = qty; } };

    // Modal yaratish
    const modal = document.createElement("div");
    modal.id = "buy-modal";
    modal.className = "fixed inset-0 flex items-center justify-center bg-black/50 hidden z-50";
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 text-black dark:text-white p-6 rounded-lg shadow-lg w-80 text-center">
        <p id="buy-text" class="mb-4"></p>
        <button id="close-modal" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Yopish</button>
      </div>
    `;
    document.body.appendChild(modal);

    const buyText = document.getElementById("buy-text");
    const closeModal = document.getElementById("close-modal");

    // Sotib olish tugmasi
    document.getElementById("add-cart").onclick = () => {
      if(qty > 0) {
        buyText.textContent = `${product.title} x${qty} savatga qo‘shildi!`;
      } else {
        buyText.textContent = "Soni 0!";
      }
      modal.classList.remove("hidden");
    };

    closeModal.onclick = () => modal.classList.add("hidden");

     // O‘xshash mahsulotlar
    const otherDiv = document.getElementById("other");
    otherDiv.className = "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6"; // 2 column mobil, 4 column desktop
    otherDiv.innerHTML = ""; // eski kartalarni tozalash

   products.filter(p => p.id != id).forEach(item => {
  const card = document.createElement("div");
  card.innerHTML = `
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-md p-2 cursor-pointer hover:shadow-lg transition duration-200 flex flex-col" style="min-height: 400px;">
      <!-- Rasm -->
      <div class="flex-shrink-0">
        <img src="${item.img}" class="w-full h-36 sm:h-40 md:h-44 object-contain rounded-xl mb-2">
      </div>

      <!-- Info -->
      <div class="flex-1 flex flex-col justify-between">
        <div>
          ${item.company ? `<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">${item.company}</p>` : ''}
          <h2 class="text-base font-bold mb-1 line-clamp-2">${item.title}</h2>
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <span class="text-purple-600 font-bold">${item.price}</span>
            ${item.discount ? `<span class="text-sm bg-orange-200 text-orange-600 px-2 rounded ml-2">${item.discount}</span>` : ''}
            ${item.oldPrice ? `<span class="line-through text-gray-400 ml-2">${item.oldPrice}</span>` : ''}
          </div>
        </div>
        <button class="px-4 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 mt-2 sm:mt-4">Sotib olish</button>
      </div>
    </div>
  `;
  card.onclick = () => { window.location.href = `detail.html?id=${item.id}`; };
  otherDiv.appendChild(card);
  
  });

  });

const feedbackList = document.getElementById("feedback-list");
const showAllBtn = document.getElementById("feedback-show-all");
const feedbackInput = document.getElementById("feedback-input");
const feedbackSubmit = document.getElementById("feedback-submit");
const starContainer = document.getElementById("feedback-stars");
const starCount = document.getElementById("feedback-stars-count");

// Dastlabki feedbacklar
let defaultFeedbacks = [
  {name: "Ali", text: "Juda yaxshi mahsulot!", stars: 5},
  {name: "Vali", text: "Qulay va chiroyli.", stars: 4},
  {name: "Gulbahor", text: "Tez yetkazildi.", stars: 5},
  {name: "Shoxrux", text: "Rangi ekran bilan mos keladi.", stars: 4},
  {name: "Nilufar", text: "O‘rtacha sifat.", stars: 3},
  {name: "Bahrom", text: "Juda foydali.", stars: 5},
];

// LocalStorage dan o'qish
let allFeedbacks = JSON.parse(localStorage.getItem("allFeedbacks")) || defaultFeedbacks;

// Single feedback card yaratish
function createFeedbackCard(f) {
  const card = document.createElement("div");
  card.className = "opacity-0 transform translate-y-5 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col justify-between w-full sm:w-[48%] transition duration-500";

  const starIcons = '★'.repeat(f.stars) + '☆'.repeat(5-f.stars);

  card.innerHTML = `
    <div class="flex flex-col gap-1">
      <span class="font-semibold text-black dark:text-white">${f.name}</span>
      <span class="text-sm text-gray-700 dark:text-gray-300">${f.text}</span>
    </div>
    <div class="text-yellow-400 font-bold mt-2">${starIcons}</div>
  `;

  setTimeout(() => {
    card.classList.remove("opacity-0", "translate-y-5");
    card.classList.add("opacity-100", "translate-y-0");
  }, Math.random() * 300);

  return card;
}

// Render preview (2 ta)
function renderFeedbackPreview() {
  feedbackList.innerHTML = "";
  feedbackList.className = "flex flex-wrap gap-3";
  const preview = allFeedbacks.slice(0, 2);
  preview.forEach(f => feedbackList.appendChild(createFeedbackCard(f)));

  showAllBtn.classList.toggle("hidden", allFeedbacks.length <= 2);

  // LocalStorage ga saqlash
  localStorage.setItem("allFeedbacks", JSON.stringify(allFeedbacks));
}

// Yulduzlar tanlash
let selectedStars = 5;
function renderStars() {
  starContainer.innerHTML = "";
  for(let i=1; i<=5; i++) {
    const star = document.createElement("span");
    star.className = "cursor-pointer transition-transform hover:scale-125";
    star.innerHTML = i <= selectedStars ? "★" : "☆";
    star.onclick = () => {
      selectedStars = i;
      renderStars();
      starCount.textContent = selectedStars;
    };
    starContainer.appendChild(star);
  }
  starCount.textContent = selectedStars;
}
renderStars();

// Feedback submit
feedbackSubmit.onclick = () => {
  const text = feedbackInput.value.trim();
  if(!text) return;

  const newFeedback = {name: "Siz", text, stars: selectedStars};
  allFeedbacks.unshift(newFeedback);

  feedbackInput.value = "";
  selectedStars = 5;
  renderStars();

  renderFeedbackPreview();
};

// Enter bosilganda yuborish
feedbackInput.addEventListener("keydown", e => {
  if(e.key === "Enter") feedbackSubmit.onclick();
});

// Barchasini ko'rish
showAllBtn.onclick = () => {
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 flex items-start justify-center bg-black/40 z-50 pt-28 overflow-auto";

  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-900 p-6 rounded-t-3xl w-11/12 max-w-lg max-h-[80vh] shadow-xl relative flex flex-col">
      <button id="close-feedback-modal" class="absolute top-3 right-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-2xl font-bold">×</button>
      <h3 class="text-lg font-bold mb-4 text-black dark:text-white text-center">Barcha fikrlar</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1" id="modal-feedback-list" style="max-height:70vh;"></div>
    </div>
  `;

  document.body.appendChild(modal);
  const modalList = document.getElementById("modal-feedback-list");
  allFeedbacks.forEach((f, index) => {
    const card = createFeedbackCard(f);
    card.style.transitionDelay = `${index*50}ms`;
    modalList.appendChild(card);
  });

  document.getElementById("close-feedback-modal").onclick = () => modal.remove();
};

// Dastlabki preview render
renderFeedbackPreview();

