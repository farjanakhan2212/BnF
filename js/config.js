// ============================================================
//  EDIT THIS FILE FIRST. Everything shop-specific lives here.
// ============================================================

// Firebase > Project settings > Your apps > Web app > "firebaseConfig"
// (These values are safe to publish. Security comes from firestore.rules.)
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const SHOP = {
  name: "Beauty n Fashion by Shimu Khan",
  tagline: "Authentic beauty & skincare products from the Philippines, Thailand, Malaysia, Singapore & more.",
  address: "188/1 North Ibrahimpur, Dhaka, Bangladesh",

  // Messenger: use your page username, e.g. https://m.me/beautynfashionbyshimukhan
  messengerLink: "https://m.me/YOUR_PAGE_USERNAME",

  // bKash number customers outside Dhaka pay to
  bkashNumber: "01XXXXXXXXX",
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
export const DEMO_MODE = FIREBASE_CONFIG.apiKey.startsWith("YOUR_");
export const FB_VERSION = "10.12.2";
