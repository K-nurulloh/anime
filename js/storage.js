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
        email: 'nurullohkomilov163@gmail.com',
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
        email: 'seller@example.com',
      },
      {
        id: 'a-3001',
        name: 'Site Owner',
        phone: '908557475',
        password: 'nur123mm',
        cart: [],
        wishlist: [],
        orders: [],
        role: 'user',
        email: 'nurullohkomilov163@gmail.com',
      },
    ]);
  }

  if (!localStorage.getItem('currentUserId')) {
    writeStorage('currentUserId', null);
  }

  if (!localStorage.getItem('lang')) {
    localStorage.setItem('lang', 'uz');
  }

  if (!localStorage.getItem('sellerProducts')) {
    writeStorage('sellerProducts', []);
  }

  if (!localStorage.getItem('orders')) {
    writeStorage('orders', []);
  }

  if (!localStorage.getItem('cart')) {
    writeStorage('cart', []);
  }
};

export const getUsers = () => {
  const users = readStorage('users', []);
  return users.map((user) => ({
    ...user,
    email: user.email || (user.id === 'a-3001' ? 'nurullohkomilov163@gmail.com' : ''),
  }));
};
export const saveUsers = (users) => writeStorage('users', users);

export const getCurrentUserId = () => readStorage('currentUserId', null);
export const setCurrentUserId = (id) => writeStorage('currentUserId', id);

export const getCurrentUser = () => {
  const rawCurrentUser = localStorage.getItem('currentUser');
  if (!rawCurrentUser) return null;

  try {
    const parsedUser = JSON.parse(rawCurrentUser);
    if (!parsedUser || typeof parsedUser !== 'object') return null;

    const hasIdentityField = Boolean(parsedUser.id || parsedUser.uid || parsedUser.phone || parsedUser.email);
    if (!hasIdentityField) return null;

    return parsedUser;
  } catch {
    return null;
  }
};

export const isLoggedIn = () => Boolean(getCurrentUser());

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

export const getUserCartKey = (user) => {
  const keyPart = user?.id || user?.phone || user?.uid;
  return keyPart ? `CART_${keyPart}` : null;
};

export const getCart = () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  const cartKey = getUserCartKey(currentUser);
  if (!cartKey) return [];
  return readStorage(cartKey, []);
};

export const setCart = (items) => {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  const cartKey = getUserCartKey(currentUser);
  if (!cartKey) return [];

  const normalized = Array.isArray(items)
    ? items
        .filter((item) => item && item.id != null)
        .map((item) => {
          const normalizedItem = {
            id: String(item.id),
            qty: Math.max(1, Number(item.qty) || 1),
          };
          if (item.variantName) normalizedItem.variantName = String(item.variantName);
          if (Number.isFinite(Number(item.variantPrice))) normalizedItem.variantPrice = Number(item.variantPrice);
          return normalizedItem;
        })
    : [];

  writeStorage(cartKey, normalized);
  return normalized;
};

export const saveCart = (cart) => setCart(cart);

export const clearCart = () => {
  const currentUser = getCurrentUser();
  const cartKey = getUserCartKey(currentUser);
  if (!cartKey) return;
  localStorage.removeItem(cartKey);
};

export const addToCart = (productId, qty = 1, options = {}) => {
  const id = String(productId);
  const amount = Math.max(1, Number(qty) || 1);
  const variantName = options?.variantName ? String(options.variantName) : '';
  const variantPrice = Number.isFinite(Number(options?.variantPrice)) ? Number(options.variantPrice) : null;
  const cart = getCart();
  const existing = cart.find(
    (item) => String(item.id) === id && String(item.variantName || '') === variantName
  );
  if (existing) {
    existing.qty += amount;
  } else {
    const payload = { id, qty: amount };
    if (variantName) payload.variantName = variantName;
    if (variantPrice != null) payload.variantPrice = variantPrice;
    cart.push(payload);
  }
  saveCart(cart);
  return cart;
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

export const getAdminProducts = () => readStorage('adminProducts', []);
export const saveAdminProducts = (products) => writeStorage('adminProducts', products);

export const getProductComments = () => readStorage('productComments', {});
export const saveProductComments = (comments) => writeStorage('productComments', comments);

const PRODUCTS_CACHE_KEY = 'firestoreProductsCache';
const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000;

export const getCachedProducts = () => {
  const payload = readStorage(PRODUCTS_CACHE_KEY, null);
  if (!payload || !Array.isArray(payload.items) || !payload.ts) return null;
  if (Date.now() - payload.ts > PRODUCTS_CACHE_TTL_MS) return null;
  return payload.items;
};

export const setCachedProducts = (products) => {
  if (!Array.isArray(products)) return;
  writeStorage(PRODUCTS_CACHE_KEY, { ts: Date.now(), items: products });
};
