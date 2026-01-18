export const readStorage = (key, fallback) => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Storage parse error for ${key}`, error);
    return fallback;
  }
};

export const writeStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const ensureSeedData = () => {
  if (!localStorage.getItem('users')) {
    writeStorage('users', [
      {
        id: 'u-1001',
        name: 'Demo User',
        phone: '+998901234567',
        password: '1234',
        cart: [],
        wishlist: [],
        orders: [],
        role: 'user',
      },
      {
        id: 's-2001',
        name: 'Seller Admin',
        phone: '+998911112233',
        password: 'seller',
        cart: [],
        wishlist: [],
        orders: [],
        role: 'seller',
      },
    ]);
  }

  if (!localStorage.getItem('currentUserId')) {
    writeStorage('currentUserId', null);
  }

  if (!localStorage.getItem('settings')) {
    writeStorage('settings', {
      darkMode: false,
      language: 'uz',
    });
  }

  if (!localStorage.getItem('sellerProducts')) {
    writeStorage('sellerProducts', []);
  }

  if (!localStorage.getItem('orders')) {
    writeStorage('orders', []);
  }
};

export const getUsers = () => readStorage('users', []);
export const saveUsers = (users) => writeStorage('users', users);

export const getCurrentUserId = () => readStorage('currentUserId', null);
export const setCurrentUserId = (id) => writeStorage('currentUserId', id);

export const getCurrentUser = () => {
  const users = getUsers();
  const currentId = getCurrentUserId();
  return users.find((user) => user.id === currentId) || null;
};

export const updateCurrentUser = (updater) => {
  const users = getUsers();
  const currentId = getCurrentUserId();
  const index = users.findIndex((user) => user.id === currentId);
  if (index === -1) return null;
  const updatedUser = updater(users[index]);
  users[index] = updatedUser;
  saveUsers(users);
  return updatedUser;
};

export const getSettings = () => readStorage('settings', { darkMode: false, language: 'uz' });
export const saveSettings = (settings) => writeStorage('settings', settings);

export const getCart = () => {
  const currentUser = getCurrentUser();
  if (currentUser) return currentUser.cart || [];
  return readStorage('guestCart', []);
};

export const saveCart = (cart) => {
  const currentUser = getCurrentUser();
  if (currentUser) {
    updateCurrentUser((user) => ({ ...user, cart }));
  } else {
    writeStorage('guestCart', cart);
  }
};

export const getWishlist = () => {
  const currentUser = getCurrentUser();
  if (currentUser) return currentUser.wishlist || [];
  return readStorage('guestWishlist', []);
};

export const saveWishlist = (wishlist) => {
  const currentUser = getCurrentUser();
  if (currentUser) {
    updateCurrentUser((user) => ({ ...user, wishlist }));
  } else {
    writeStorage('guestWishlist', wishlist);
  }
};

export const getOrders = () => readStorage('orders', []);
export const saveOrders = (orders) => writeStorage('orders', orders);