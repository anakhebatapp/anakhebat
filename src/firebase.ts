// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXza0NxCZ2E81XabSuWgarM1-0qKDDFig",
  authDomain: "aku-anak-hebat.firebaseapp.com",
  projectId: "aku-anak-hebat",
  storageBucket: "aku-anak-hebat.firebasestorage.app",
  messagingSenderId: "65354220102",
  appId: "1:65354220102:web:ff6bf6c9de02c3da3c0047",
  measurementId: "G-HJRBSKWVGD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// Export for use in other modules
export { app, analytics, db, auth, collection, addDoc, serverTimestamp };

// Helper function to generate voucher code
export function generateVoucherCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AHA-';

  // Generate two blocks of 4 characters
  for (let block = 0; block < 2; block++) {
    for (let i = 0; i < 4; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    if (block === 0) code += '-';
  }

  return code;
}

// Helper function to save voucher to Firestore
export async function saveVoucher(voucherData) {
  try {
    const vouchersRef = collection(db, 'vouchers');
    const docRef = await addDoc(vouchersRef, {
      ...voucherData,
      createdAt: serverTimestamp(),
      usedAt: null,
      usedBy: null,
      status: 'paid'
    });

    console.log('Voucher saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving voucher:', error);
    throw error;
  }
}

// Package information
export const packages = {
  siswa: {
    name: 'Siswa',
    price: 50000,
    accounts: 1,
    description: 'Paket individual untuk 1 siswa'
  },
  kelas: {
    name: 'Kelas',
    price: 100000,
    accounts: 40,
    description: 'Paket untuk 1 kelas (40 akun)'
  },
  angkatan: {
    name: 'Angkatan',
    price: 500000,
    accounts: 600,
    description: 'Paket untuk 1 angkatan (15 kelas, 600 akun)'
  },
  sekolah: {
    name: 'Sekolah',
    price: 1000000,
    accounts: 1800,
    description: 'Paket untuk seluruh sekolah (45 kelas, 1800 akun)'
  }
};
