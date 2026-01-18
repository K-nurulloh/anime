import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getFirestore,
  serverTimestamp,
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

// Firestore + Storage must be enabled in Firebase Console (test mode is fine for now).
const firebaseConfig = {
  apiKey: 'AIzaSyB8Bdb48shjwEuu8r5bi4FIhZZhxM8abpk',
  authDomain: 'anime-shop-18e2d.firebaseapp.com',
  projectId: 'anime-shop-18e2d',
  storageBucket: 'anime-shop-18e2d.firebasestorage.app',
  messagingSenderId: '864687916195',
  appId: '1:864687916195:web:9800944521fdac6df9ab16',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const uploadImageToStorage = async (file, pathPrefix = 'uploads') => {
  const safeName = file.name?.replace(/\s+/g, '-') || 'image.jpg';
  const filePath = `${pathPrefix}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};

export {
  serverTimestamp,
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
};
