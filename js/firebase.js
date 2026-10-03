import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxNv5EgeKgU3MegB6fMXzPeJmvWHLi2CQ",
  authDomain: "beautyfashion-shop.firebaseapp.com",
  databaseURL: "https://beautyfashion-shop-default-rtdb.firebaseio.com",
  projectId: "beautyfashion-shop",
  storageBucket: "beautyfashion-shop.firebasestorage.app",
  messagingSenderId: "960538465790",
  appId: "1:960538465790:web:d47f9ec3c538827cf99caf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
