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
