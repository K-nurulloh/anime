import { fetchProducts } from './api.js';
import {
  ensureSeedData,
  getCart,
  saveCart,
  getWishlist,
  saveWishlist,
  getCurrentUser,
  getProductComments,
  saveProductComments,
} from './storage.js';
import { renderProductCard, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t, getLang } from './i18n.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const detailWrapper = document.querySelector('#detail-wrapper');
const similarList = document.querySelector('#similar-list');
const moreList = document.querySelector('#more-list');
const errorBox = document.querySelector('#error-box');
const commentForm = document.querySelector('#comment-form');
const commentText = document.querySelector('#comment-text');
const commentRating = document.querySelector('#comment-rating');
const commentsList = document.querySelector('#comments-list');
const commentsEmpty = document.querySelector('#comments-empty');
const commentsLoginNote = document.querySelector('#comments-login-note');

const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

// ====== GALLERY ======
const renderGallery = (images, title) => {
  const unique = images.length
    ? images
    : ['https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80'];
  const thumbnails = unique.slice(0, 10);
  return `
    <div class="space-y-3">
      <div class="overflow-hidden rounded-2xl bg-white/5">
        <img id="main-image" src="${thumbnails[0]}" alt="${title}" class="h-56 w-full object-cover" />
      </div>
      <div class="flex gap-3 overflow-x-auto">
        ${thumbnails
          .map(
            (image, index) => `
          <button class="gallery-thumb flex-shrink-0 overflow-hidden rounded-xl border border-white/10" data-gallery-thumb data-image="${image}">
            <img src="${image}" alt="${title} thumbnail ${index + 1}" class="h-14 w-14 object-cover" />
          </button>`
          )
          .join('')}
      </div>
    </div>
  `;
};

// ====== WISHLIST ======
const handleWishlist = (productId) => {
  const wishlist = getWishlist();
  const index = wishlist.findIndex((item) => item.id === productId);
  if (index >= 0) {
    wishlist.splice(index, 1);
    showToast(t('wishlist_removed'));
  } else {
    wishlist.push({ id: productId });
    showToast(t('wishlist_added'));
  }
  saveWishlist(wishlist);
  document.querySelectorAll(`[data-id="${productId}"]`).forEach((button) => {
    button.textContent = index >= 0 ? '🤍' : '❤️';
  });
};

// ====== CART ACTIONS ======
const addToCart = (productId) => {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  showToast(t('cart_added'));
};

// ====== CARD ACTIONS ======
const initCardActions = (container) => {
  container.addEventListener('click', (event) => {
    const cartBtn = event.target.closest('.add-cart-btn');
    const wishlistBtn = event.target.closest('.wishlist-btn');
    if (cartBtn) {
      addToCart(Number(cartBtn.dataset.id));
    }
    if (wishlistBtn) {
      handleWishlist(Number(wishlistBtn.dataset.id));
    }
  });
};

// ====== COMMENTS ======
const getCommentsForProduct = () => {
  const comments = getProductComments();
  return comments[productId] || [];
};

const renderComments = () => {
  const comments = getCommentsForProduct().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  if (!comments.length) {
    commentsEmpty.classList.remove('hidden');
    commentsList.innerHTML = '';
    return;
  }
  commentsEmpty.classList.add('hidden');
  commentsList.innerHTML = comments
    .map(
      (comment) => `
      <article class="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-200">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-semibold text-white">${comment.userName} (${comment.userPhone || 'Telefon: N/A'})</p>
          <span class="text-xs text-slate-400">${new Date(comment.createdAt).toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ')}</span>
        </div>
        ${comment.rating ? `<p class="mt-1 text-xs text-amber-400">Reyting: ${comment.rating}/5</p>` : ''}
        <p class="mt-2 text-slate-300">${comment.text}</p>
        ${
          comment.replies?.length
            ? `
          <div class="mt-3 space-y-2 border-t border-slate-800 pt-3">
            ${comment.replies
              .map(
                (reply) => `
              <div class="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
                <p class="font-semibold text-white">${reply.adminName}</p>
                <p class="mt-1 text-slate-300">${reply.text}</p>
                <span class="mt-2 block text-[10px] text-slate-400">${new Date(reply.createdAt).toLocaleString(
                  getLang() === 'ru' ? 'ru-RU' : 'uz-UZ'
                )}</span>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
      </article>
    `
    )
    .join('');
};

// ====== DATA BOOTSTRAP ======
const init = async () => {
  const { products, error } = await fetchProducts();
  if (error) {
    errorBox.textContent = error;
    errorBox.classList.remove('hidden');
    return;
  }
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) {
    errorBox.textContent = t('not_found');
    errorBox.classList.remove('hidden');
    return;
  }

  const images = product.images?.length ? product.images : product.img ? [product.img] : [];
  const oldPrice = product.oldPrice && product.oldPrice > product.price ? product.oldPrice : product.price;

  detailWrapper.innerHTML = `
    <div class="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      ${renderGallery(images, product.title)}
      <div class="section flex flex-col gap-4">
        <div>
          <p class="text-sm text-white/70">${product.category}</p>
          <h1 class="text-3xl font-bold text-white">${product.title}</h1>
        </div>
        <div class="flex items-center gap-2 text-amber-300">
          <span>★ ${product.rating ?? 4.8}</span>
          <span class="text-white/60">(stock: ${Math.floor(5 + Math.random() * 30)})</span>
        </div>
        <p class="text-white/70">${product.desc}</p>
        <div class="flex items-center gap-3">
          <span class="text-2xl font-bold text-white">${product.price.toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ')} so'm</span>
          ${
            oldPrice > product.price
              ? `<span class="text-sm text-slate-400 line-through">${oldPrice.toLocaleString(
                  getLang() === 'ru' ? 'ru-RU' : 'uz-UZ'
                )} so'm</span>`
              : ''
          }
        </div>
        <div class="rounded-2xl bg-white/5 p-4 text-sm text-white/70">
          <p>${t('delivery_note')}</p>
          <p>${t('warranty_note')}</p>
        </div>
      </div>
    </div>
  `;

  const isSaved = getWishlist().some((item) => item.id === product.id);
  const wishlistBtn = document.querySelector('[data-wishlist-toggle]');
  wishlistBtn.textContent = isSaved ? `❤️ ${t('wishlist')}` : `🤍 ${t('wishlist')}`;

  const actionPrice = document.querySelector('#detail-action-price');
  const actionCart = document.querySelector('#detail-action-cart');
  const actionBuy = document.querySelector('#detail-action-buy');
  if (actionPrice) {
    actionPrice.textContent = `${product.price.toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ')} so'm`;
  }
  if (actionCart) {
    actionCart.addEventListener('click', () => addToCart(product.id));
  }
  if (actionBuy) {
    actionBuy.addEventListener('click', () => {
      addToCart(product.id);
      window.location.href = 'checkout.html';
    });
  }
  wishlistBtn.addEventListener('click', () => handleWishlist(product.id));
  document.querySelectorAll('[data-gallery-thumb]').forEach((button) => {
    button.addEventListener('click', () => {
      const mainImage = document.querySelector('#main-image');
      if (!mainImage) return;
      mainImage.src = button.dataset.image;
    });
  });

  const similar = products.filter((item) => item.category === product.category && item.id !== product.id);
  similarList.innerHTML = similar.slice(0, 8).map(renderProductCard).join('');
  moreList.innerHTML = products
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)
    .map(renderProductCard)
    .join('');

  initCardActions(similarList);
  initCardActions(moreList);
  renderComments();
  const currentUser = getCurrentUser();
  if (!currentUser) {
    commentForm.classList.add('hidden');
    commentsLoginNote.classList.remove('hidden');
  } else {
    commentForm.classList.remove('hidden');
    commentsLoginNote.classList.add('hidden');
  }
};

init();

window.addEventListener('langChanged', () => {
  init();
});

commentForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const currentUser = getCurrentUser();
  if (!currentUser) {
    commentsLoginNote.classList.remove('hidden');
    return;
  }
  const text = commentText.value.trim();
  if (!text) return;
  const rating = commentRating.value ? Number(commentRating.value) : null;
  const comments = getProductComments();
  const newComment = {
    id: `c-${Date.now()}`,
    productId,
    userId: currentUser.id,
    userName: currentUser.name,
    userPhone: currentUser.phone,
    text,
    rating,
    createdAt: new Date().toISOString(),
    replies: [],
  };
  const list = comments[productId] || [];
  comments[productId] = [newComment, ...list];
  saveProductComments(comments);
  commentText.value = '';
  commentRating.value = '';
  renderComments();
});
