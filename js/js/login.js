// ================= ELEMENTLAR =================
const authBox = document.getElementById("authBox");
const accountBox = document.getElementById("accountBox");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginPhone = document.getElementById("loginPhone");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const regName = document.getElementById("regName");
const regPhone = document.getElementById("regPhone");
const regPassword = document.getElementById("regPassword");
const registerError = document.getElementById("registerError");
const userName = document.getElementById("userName");
const userPhone = document.getElementById("userPhone");
const profileImg = document.getElementById("profileImg");
const avatar = document.getElementById("avatar");
const savedList = document.getElementById("saved-list");
const sectionModal = document.getElementById("sectionModal");
const sectionTitle = document.getElementById("sectionTitle");
const sectionContent = document.getElementById("sectionContent");

// ================= GLOBAL =================
let users = JSON.parse(localStorage.getItem("users")) || [];
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;

// ================= TABS =================
loginTab.onclick = () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  loginTab.classList.add("bg-purple-600","text-white");
  registerTab.classList.remove("bg-purple-600","text-white");
};
registerTab.onclick = () => {
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  registerTab.classList.add("bg-purple-600","text-white");
  loginTab.classList.remove("bg-purple-600","text-white");
};

// ================= OPEN ACCOUNT =================
function openAccount() {
  authBox.classList.add("hidden");
  accountBox.classList.remove("hidden");

  if (!currentUser) return;

  userName.textContent = currentUser.name;
  userPhone.textContent = currentUser.phone;

  if (currentUser.avatar) {
    profileImg.src = currentUser.avatar;
    profileImg.classList.remove("hidden");
    avatar.classList.add("hidden");
  } else {
    avatar.textContent = currentUser.name[0].toUpperCase();
    profileImg.classList.add("hidden");
    avatar.classList.remove("hidden");
  }

  renderSavedProducts();
}

// ================= LOGIN =================
document.getElementById("loginBtn").onclick = () => {
  loginError.classList.add("hidden");
  if (!loginPhone.value || !loginPassword.value) {
    loginError.textContent = "Iltimos, barcha maydonlarni to‘ldiring";
    loginError.classList.remove("hidden");
    return;
  }

  const user = users.find(u => u.phone===loginPhone.value && u.password===loginPassword.value);
  if(!user){
    loginError.textContent="Login yoki parol noto‘g‘ri";
    loginError.classList.remove("hidden");
    return;
  }

  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  openAccount();
};

// ================= REGISTER =================
document.getElementById("registerBtn").onclick = () => {
  registerError.classList.add("hidden");
  if(!regName.value || !regPhone.value || !regPassword.value){
    registerError.textContent="Iltimos, barcha maydonlarni to‘ldiring";
    registerError.classList.remove("hidden");
    return;
  }
  if(regPhone.value.length < 9){
    registerError.textContent="Telefon raqam kamida 9 ta bo‘lishi kerak";
    registerError.classList.remove("hidden");
    return;
  }
  if(users.some(u=>u.phone===regPhone.value)){
    registerError.textContent="Bu raqam allaqachon ro‘yxatdan o‘tgan";
    registerError.classList.remove("hidden");
    return;
  }

  const newUser = {
    name: regName.value,
    phone: regPhone.value,
    password: regPassword.value,
    avatar: "",
    orders: [],
    promos: [],
    saved: []
  };
  users.push(newUser);
  localStorage.setItem("users", JSON.stringify(users));

  currentUser = newUser;
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  openAccount();
};

// ================= LOGOUT =================
function logout(){
  currentUser=null;
  localStorage.removeItem("currentUser");
  accountBox.classList.add("hidden");
  authBox.classList.remove("hidden");
}

// ================= RENDER SAVED =================
function renderSavedProducts(){
  if(!currentUser || !currentUser.saved) return;
  savedList.innerHTML="";

  if(currentUser.saved.length===0){
    savedList.innerHTML=`<p class="text-center text-gray-400 col-span-full">Sizning savatingiz bo'sh</p>`;
    return;
  }

  currentUser.saved.forEach(item=>{
    const card = document.createElement("div");
    card.className="bg-white dark:bg-[#111827] p-4 rounded-xl shadow flex flex-col justify-between";

    card.innerHTML=`
      <img src="${item.img}" alt="${item.title}" class="w-full h-32 object-contain rounded mb-2">
      <h3 class="font-bold text-black dark:text-white mb-1">${item.title}</h3>
      <p class="text-gray-500 text-sm mb-1">Soni: ${item.qty}</p>
      <p class="font-semibold text-purple-600 mb-2">$${item.price}</p>
      <button onclick="goToCheckout('${item.id}')"
        class="bg-green-600 text-white py-2 rounded-lg mb-1 hover:bg-green-700">
        To'lov qilish
      </button>
      <button onclick="removeFromSaved('${item.id}')"
        class="bg-red-500 text-white py-2 rounded-lg hover:bg-red-600">
        O'chirish
      </button>
    `;
    savedList.appendChild(card);
  });
}

function removeFromSaved(id) {
    if (!currentUser || !currentUser.saved) return;

    // idlarni stringga aylantiramiz
    currentUser.saved = currentUser.saved.filter(p => String(p.id) !== String(id));

    const idx = users.findIndex(u => u.phone === currentUser.phone);
    if (idx > -1) users[idx] = currentUser;

    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    renderSavedProducts();
    renderSavedProductsModal();
}


// ================= CHECKOUT =================
function goToCheckout(id){
  const product=currentUser.saved.find(p=>p.id===id);
  if(!product) return;

  localStorage.setItem("checkoutProduct", JSON.stringify(product));
  window.location.href="checkout.html";
}

// ================= MODAL =================
function openSection(section){
  sectionModal.classList.remove("hidden");
  if(section==="saved"){
    sectionTitle.textContent="Savat";
    renderSavedProductsModal();
  } else {
    sectionTitle.textContent=section;
    sectionContent.textContent=currentUser[section]?.length ? currentUser[section].join("\n"):"Ma'lumot mavjud emas";
  }
}

function closeSection(){
  sectionModal.classList.add("hidden");
}

sectionModal.addEventListener("click",e=>{
  if(e.target===sectionModal) closeSection();
});

// ================= SAVAT =================
function renderSavedProducts(){
  if(!currentUser || !currentUser.saved) return;
  savedList.innerHTML="";

  if(currentUser.saved.length===0){
    savedList.innerHTML=`<p class="text-center text-gray-400 col-span-full">Sizning savatingiz bo'sh</p>`;
    return;
  }

  currentUser.saved.forEach(item=>{
    const card = document.createElement("div");
    card.className="bg-white dark:bg-[#111827] p-4 rounded-xl shadow flex flex-col justify-between";

    card.innerHTML=`
      <img src="${item.img}" class="w-full h-32 object-contain rounded mb-2">
      <h3 class="font-bold text-black dark:text-white mb-1">${item.title}</h3>
      <p class="text-gray-500 text-sm mb-1">Soni: ${item.qty}</p>
      <p class="font-semibold text-purple-600 mb-2">$${item.price}</p>
      <button onclick="goToCheckout('${item.id}')"
        class="bg-green-600 text-white py-2 rounded-lg mb-1 hover:bg-green-700">To'lov qilish</button>
      <button onclick="removeFromSaved('${item.id}')"
        class="bg-red-500 text-white py-2 rounded-lg hover:bg-red-600">O'chirish</button>
    `;
    savedList.appendChild(card);
  });
}

// ================= REMOVE =================
function removeFromSaved(id){
  if(!currentUser || !currentUser.saved) return;
  currentUser.saved = currentUser.saved.filter(p => String(p.id)!==String(id));

  const idx = users.findIndex(u=>u.phone===currentUser.phone);
  if(idx>-1) users[idx] = currentUser;

  localStorage.setItem("users", JSON.stringify(users));
  localStorage.setItem("currentUser", JSON.stringify(currentUser));

  renderSavedProducts();
}

// ================= CHECKOUT =================
function goToCheckout(id){
  const product = currentUser.saved.find(p=>String(p.id)===String(id));
  if(!product) return;

  localStorage.setItem("checkoutProduct", JSON.stringify(product));
  window.location.href="checkout.html";
}

// ================= ADD TO SAVED (DETAIL.JS uchun) =================
function addToSaved(product){
  if(!currentUser) return;

  const exists = currentUser.saved.find(p=>String(p.id)===String(product.id));
  if(exists) exists.qty += product.qty || 1;
  else {
    currentUser.saved.push({...product, qty: product.qty || 1});
  }

  const idx = users.findIndex(u=>u.phone===currentUser.phone);
  if(idx>-1) users[idx] = currentUser;

  localStorage.setItem("users", JSON.stringify(users));
  localStorage.setItem("currentUser", JSON.stringify(currentUser));

  renderSavedProducts();
}

// ================= INIT =================
window.addEventListener("DOMContentLoaded",()=>{
  if(currentUser) openAccount();
});

function addToSaved(product) {
    if (!currentUser) return;

    // Agar mahsulot allaqachon bo‘lsa, sonini oshirish
    const exists = currentUser.saved.find(p => p.id === product.id);
    if (exists) {
        exists.qty += 1;
    } else {
        product.qty = 1;
        currentUser.saved.push(product);
    }

    // USERS array-ni yangilash
    const idx = users.findIndex(u => u.phone === currentUser.phone);
    if (idx > -1) users[idx] = currentUser;

    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    renderSavedProducts();
    renderSavedProductsModal();
}
