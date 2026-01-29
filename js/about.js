import { ensureSeedData } from './storage.js';
import { applyTranslations, initLangSwitcher } from './i18n.js';
import { updateCartBadge } from './ui.js';

ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();
