import {
  ensureSeedData,
  getUsers,
  saveUsers,
  setCurrentUserId,
  getCurrentUser,
  getWishlist,
  saveWishlist,
} from './storage.js';
import { renderProductCard, showToast, updateCartBadge } from './ui.js';
import { fetchProducts } from './api.js';
import { applyTranslations, initLangSwitcher, getLang, setLang, t } from './i18n.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const authSection = document.querySelector('#auth-section');
const profileSection = document.querySelector('#profile-section');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const loginBox = document.querySelector('#login-box');
const registerBox = document.querySelector('#register-box');
const showRegisterBtn = document.querySelector('#show-register');
const showLoginBtn = document.querySelector('#show-login');
const logoutBtn = document.querySelector('#logout-btn');
const wishlistList = document.querySelector('#wishlist-list');
const wishlistEmpty = document.querySelector('#wishlist-empty');
const settingsForm = document.querySelector('#settings-form');
const adminShortcuts = document.querySelector('#admin-shortcuts');
const userWishlist = document.querySelector('#user-wishlist');
const userSettings = document.querySelector('#user-settings');

// ====== ADMIN CHECK ======
const ADMIN_PHONE = '908557475';
const ADMIN_PASSWORD = 'nur123mm';

// ====== HELPERS ======
const normalizePhone = (value) => (value || '').toString().replace(/\D/g, '');
const persistCurrentUser = (user) => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};
const showLogin = () => {
  loginBox?.classList.remove('hidden');
  registerBox?.classList.add('hidden');
};

const showRegister = () => {
  registerBox?.classList.remove('hidden');
  loginBox?.classList.add('hidden');
};

// ====== PROFILE ======
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
  if (user.role === 'admin') {
    adminShortcuts?.classList.remove('hidden');
    userWishlist?.classList.add('hidden');
    userSettings?.classList.add('hidden');
  } else {
    adminShortcuts?.classList.add('hidden');
    userWishlist?.classList.remove('hidden');
    userSettings?.classList.remove('hidden');
  }
};

// ====== WISHLIST ======
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

// ====== AUTH ======
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const phone = normalizePhone(formData.get('phone'));
  const password = formData.get('password')?.toString().trim() || '';
  const users = getUsers();
  if (phone === ADMIN_PHONE && password === ADMIN_PASSWORD) {
    const existingAdmin = users.find((item) => item.id === 'admin');
    const adminUser = existingAdmin || {
      id: 'admin',
      name: 'Site Owner',
      phone: ADMIN_PHONE,
      password: ADMIN_PASSWORD,
      cart: [],
      wishlist: [],
      orders: [],
      role: 'admin',
    };
    const nextUsers = existingAdmin ? users : [adminUser, ...users];
    saveUsers(nextUsers);
    setCurrentUserId('admin');
    persistCurrentUser(adminUser);
    window.location.href = 'admin.html';
    return;
  }
  const user = users.find(
    (item) => normalizePhone(item.phone) === phone && item.password === password
  );
  if (!user) {
    showToast(t('login_error'), 'error');
    return;
  }
  if (phone === ADMIN_PHONE && password === ADMIN_PASSWORD) {
    user.role = 'admin';
  }
  saveUsers(
    users.map((item) => (item.id === user.id ? { ...item, role: user.role } : item))
  );
  setCurrentUserId(user.id);
  persistCurrentUser(user);
  showToast(t('welcome'));
  if (user.role === 'admin') {
    window.location.href = 'admin.html';
    return;
  }
  window.location.href = 'index.html';
});

registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const name = formData.get('name');
  const phone = normalizePhone(formData.get('phone'));
  const password = formData.get('password');
  const users = getUsers();
  if (users.some((user) => normalizePhone(user.phone) === phone)) {
    showToast(t('phone_exists'), 'error');
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
  persistCurrentUser(newUser);
  showToast(t('profile_created'));
  window.location.href = 'index.html';
});

logoutBtn.addEventListener('click', () => {
  setCurrentUserId(null);
  localStorage.removeItem('currentUser');
  showToast(t('logout_done'));
  renderProfile();
});

// ====== SETTINGS ======
settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(settingsForm);
  const lang = formData.get('language');
  setLang(lang);
  applyTranslations();
  const headerSwitch = document.querySelector('[data-lang-switch]');
  if (headerSwitch) headerSwitch.value = lang;
  showToast(t('settings_saved'));
});

wishlistList.addEventListener('click', (event) => {
  const button = event.target.closest('.wishlist-btn');
  if (!button) return;
  const id = Number(button.dataset.id);
  const wishlist = getWishlist().filter((item) => item.id !== id);
  saveWishlist(wishlist);
  showToast(t('wishlist_removed'));
  renderWishlist();
});

const initSettingsForm = () => {
  settingsForm.querySelector('[name="language"]').value = getLang();
};

renderProfile();
renderWishlist();
initSettingsForm();
showLogin();

showRegisterBtn?.addEventListener('click', () => {
  showRegister();
});

showLoginBtn?.addEventListener('click', () => {
  showLogin();
});

window.addEventListener('langChanged', () => {
  renderProfile();
  renderWishlist();
  initSettingsForm();
});
