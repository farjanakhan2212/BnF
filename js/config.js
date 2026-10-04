// ============================================================
//  EDIT THIS FILE FIRST. Everything shop-specific lives here.
// ============================================================

// Firebase > Project settings > Your apps > Web app > "firebaseConfig"
<<<<<<< HEAD
// These are public client values, not a secret. Everything is protected by
// firestore.rules, not by hiding this file. Never put a service account,
// private key or Admin SDK credential in this project.
=======
// (These values are safe to publish. Security comes from firestore.rules.)
>>>>>>> 12d012c2160422f2ebdc359841946b7ae45713d6
export const firebaseConfig = {
  apiKey: "AIzaSyDxNv5EgeKgU3MegB6fMXzPeJmvWHLi2CQ",
  authDomain: "beautyfashion-shop.firebaseapp.com",
  databaseURL: "https://beautyfashion-shop-default-rtdb.firebaseio.com",
  projectId: "beautyfashion-shop",
  storageBucket: "beautyfashion-shop.firebasestorage.app",
  messagingSenderId: "960538465790",
  appId: "1:960538465790:web:d47f9ec3c538827cf99caf"
};

// The one admin account. Copy it from Firebase console > Authentication > Users.
// The same value sits in firestore.rules -> isAdmin(). Rules are the real
// gate; this copy only lets the panel show a friendly message sooner.
export const ADMIN_UID = "9PxeiKhy7YTFXKeCZDtLXMvHu313";

export const SHOP = {
  name: "Beauty n Fashion by Shimu Khan",
  tagline: "Authentic beauty & skincare products from the Philippines, Thailand, Malaysia, Singapore & more.",
  address: "188/1 North Ibrahimpur, Dhaka, Bangladesh",

  // Messenger: use your page username, e.g. https://m.me/beautynfashionbyshimukhan
  MESSENGER_PAGE_URL: "https://m.me/100027246954906",
  messengerLink: "https://m.me/100027246954906",

  // bKash number customers outside Dhaka pay to
  bkashNumber: "01974457055",
  bkashType: "Personal", // Personal / Merchant

  // Delivery charge in taka
  deliveryInsideDhaka: 80,
  deliveryOutsideDhaka: 150,
  courier: "Sundarban Courier",

  // Origin stamps shown on the home page
  origins: ["Philippines", "Thailand", "Malaysia", "Singapore"],
};

// True until you paste real Firebase values above.
// In demo mode the shop works with sample products and orders stay in this browser only.
export const DEMO_MODE = firebaseConfig.apiKey.startsWith("YOUR_");
export const FB_VERSION = "10.12.2";

// Hard limits. These mirror firestore.rules, so an order that breaks them is
// rejected by Firestore instead of silently landing in the database.
export const LIMITS = {
  maxCartItems: 10,      // 10 = the get() call limit Firestore allows per order write
  maxQtyPerItem: 20,
  maxName: 100,
  maxPhone: 20,
  maxArea: 80,
  maxAddress: 400,
  maxNote: 300,
};
