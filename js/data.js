// Data layer: Firestore when configured, otherwise demo mode (sample products, orders kept in this browser).
import { FIREBASE_CONFIG, DEMO_MODE, FB_VERSION } from "./config.js";
import { SEED_PRODUCTS } from "./seed.js";

let core;
async function getCore() {
  if (core) return core;
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
  const appMod = await import(base + "firebase-app.js");
  core = { app: appMod.initializeApp(FIREBASE_CONFIG), base };
  return core;
}

export async function getFs() {
  const c = await getCore();
  const fs = await import(c.base + "firebase-firestore.js");
  return { fs, db: fs.getFirestore(c.app) };
}

export async function getAuthKit() {
  const c = await getCore();
  const mod = await import(c.base + "firebase-auth.js");
  return { mod, auth: mod.getAuth(c.app) };
}

export async function fetchProducts() {
  if (DEMO_MODE) return SEED_PRODUCTS;
  const { fs, db } = await getFs();
  const snap = await fs.getDocs(fs.collection(db, "products"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createOrder(order) {
  if (DEMO_MODE) {
    const all = JSON.parse(localStorage.getItem("bf_demo_orders") || "[]");
    all.push({ ...order, createdAt: new Date().toISOString() });
    localStorage.setItem("bf_demo_orders", JSON.stringify(all));
    return;
  }
  const { fs, db } = await getFs();
  // setDoc on a new id = "create". Security rules block overwriting an existing order.
  await fs.setDoc(fs.doc(db, "orders", order.orderNo), { ...order, createdAt: fs.serverTimestamp() });
}
