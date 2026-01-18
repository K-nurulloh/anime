import {
  ensureSeedData,
  getUsers,
  saveUsers,
  setCurrentUserId,
  getCurrentUser,
  getWishlist,
  saveWishlist,
  getSettings,
  saveSettings,
} from './storage.js';
import { renderProductCard, showToast, initThemeToggle, updateCartBadge } from './ui.js';
import { fetchProducts } from './api.js';

ensureSeedData();
initThemeToggle();
updateCartBadge();

const authSection = document.querySelector('#auth-section');
const profileSection = document.querySelector('#profile-section');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const logoutBtn = document.querySelector('#logout-btn');
const wishlistList = document.querySelector('#wishlist-list');
const wishlistEmpty = document.querySelector('#wishlist-empty');
const settingsForm = document.querySelector('#settings-form');

const renderProfile = () => {
  const user = getCurrentUser();
  if (!user) {
    authSection.classList.remove('hidden');
    profileSection.classList.add('hidden');
    return;
  }
  authSection.classList.add('hidden');
  profileSection.classList.remove('hidden');
  profileSection.querySelector('[data-profile-name]').textContent = user.name;
  profileSection.querySelector('[data-profile-phone]').textContent = user.phone;
};

const renderWishlist = async () => {
  const { products } = await fetchProducts();
  const wishlist = getWishlist();
  const items = products.filter((product) => wishlist.some((entry) => entry.id === product.id));
  if (!items.length) {
    wishlistEmpty.classList.remove('hidden');
    wishlistList.innerHTML = '';
    return;
  }
  wishlistEmpty.classList.add('hidden');
  wishlistList.innerHTML = items.map(renderProductCard).join('');
};

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const phone = formData.get('phone');
  const password = formData.get('password');
  const users = getUsers();
  const user = users.find((item) => item.phone === phone && item.password === password);
  if (!user) {
    showToast('Login xato', 'error');
    return;
  }
  setCurrentUserId(user.id);
  showToast('Xush kelibsiz!');
  renderProfile();
  renderWishlist();
});

registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const name = formData.get('name');
  const phone = formData.get('phone');
  const password = formData.get('password');
  const users = getUsers();
  if (users.some((user) => user.phone === phone)) {
    showToast('Bu telefon allaqachon ro\'yxatda', 'error');
    return;
  }
  const newUser = {
    id: `u-${Date.now()}`,
    name,
    phone,
    password,
    cart: [],
    wishlist: [],
    orders: [],
    role: 'user',
  };
  users.push(newUser);
  saveUsers(users);
  setCurrentUserId(newUser.id);
  showToast('Profil yaratildi');
  renderProfile();
  renderWishlist();
});

logoutBtn.addEventListener('click', () => {
  setCurrentUserId(null);
  showToast('Logout qilindi');
  renderProfile();
});

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(settingsForm);
  const settings = getSettings();
  const updated = {
    ...settings,
    darkMode: formData.get('darkMode') === 'on',
    language: formData.get('language'),
  };
  saveSettings(updated);
  showToast('Sozlamalar saqlandi');
  document.documentElement.classList.toggle('dark', updated.darkMode);
});

wishlistList.addEventListener('click', (event) => {
  const button = event.target.closest('.wishlist-btn');
  if (!button) return;
  const id = Number(button.dataset.id);
  const wishlist = getWishlist().filter((item) => item.id !== id);
  saveWishlist(wishlist);
  showToast('Wishlistdan olib tashlandi');
  renderWishlist();
});

const initSettingsForm = () => {
  const settings = getSettings();
  settingsForm.querySelector('[name="darkMode"]').checked = settings.darkMode;
  settingsForm.querySelector('[name="language"]').value = settings.language;
};

renderProfile();
renderWishlist();
initSettingsForm();