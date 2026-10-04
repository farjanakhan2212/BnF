// ============================================================
//  EDIT THIS FILE FIRST. Everything shop-specific lives here.
// ============================================================

// Firebase > Project settings > Your apps > Web app > "firebaseConfig"
// (These values are safe to publish. Security comes from firestore.rules.)
export const firebaseConfig = {
  apiKey: "AIzaSyDxNv5EgeKgU3MegB6fMXzPeJmvWHLi2CQ",
  authDomain: "beautyfashion-shop.firebaseapp.com",
  databaseURL: "https://beautyfashion-shop-default-rtdb.firebaseio.com",
  projectId: "beautyfashion-shop",
  storageBucket: "beautyfashion-shop.firebasestorage.app",
  messagingSenderId: "960538465790",
  appId: "1:960538465790:web:d47f9ec3c538827cf99caf"
};

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
