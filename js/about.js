import { ensureSeedData } from './storage.js';
import { initThemeToggle, updateCartBadge } from './ui.js';

ensureSeedData();
initThemeToggle();
updateCartBadge();