// Data layer. This is the ONLY place where Firebase is initialised.
// Firestore is the primary database; demo mode keeps sample products and orders
// in this browser when js/config.js still has a placeholder API key.
import { firebaseConfig, DEMO_MODE, FB_VERSION } from "./config.js";
import { SEED_PRODUCTS } from "./seed.js";
import { newOrderNo, orderProblems } from "./shared.js";

const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;

let core;
let firestoreKit;
let authKit;

/* ---------- One app, one Firestore, one Auth ---------- */
async function getCore() {
  if (core) return core;
  const appMod = await import(base + "firebase-app.js");
  core = { app: appMod.initializeApp(firebaseConfig), base };
  return core;
}

export async function getFs() {
  if (firestoreKit) return firestoreKit;
  const c = await getCore();
  const fs = await import(c.base + "firebase-firestore.js");
  firestoreKit = { fs, db: fs.getFirestore(c.app) };
  return firestoreKit;
}

export async function getAuthKit() {
  if (authKit) return authKit;
  const c = await getCore();
  const mod = await import(c.base + "firebase-auth.js");
  authKit = { mod, auth: mod.getAuth(c.app) };
  return authKit;
}

/* ---------- Errors ---------- */
// Raw Firebase errors quote project ids, collection names and document paths.
// Visitors only ever get a plain sentence.
export function friendlyError(err) {
  switch (err?.code) {
    case "permission-denied":
      return "The shop refused this request. Please refresh the page, or message us on Messenger to place the order.";
    case "unavailable":
    case "deadline-exceeded":
    case "network-request-failed":
      return "No connection to the shop right now. Check your internet and try again.";
    case "unauthenticated":
      return "Your session expired. Log in again.";
    case "resource-exhausted":
    case "failed-precondition":
      return "The shop is busy. Please try again in a moment.";
    default:
      return "Something went wrong. Please try again, or message us on Messenger.";
  }
}

/* ---------- Products ---------- */
export async function fetchProducts() {
  if (DEMO_MODE) return SEED_PRODUCTS.map((p) => ({ id: p.id, ...p }));
  const { fs, db } = await getFs();
  const snap = await fs.getDocs(fs.collection(db, "products"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ---------- Orders ---------- */
// Returns the order exactly as it was written (the order number can change if
// the first one collided with an existing document).
//
// The order number is also the Firestore document id, so the id the customer is
// shown, the orderNo field and the document the admin panel reads can never
// drift apart.
//
// keepNo: the caller already owns this exact order number (a retried Messenger
// fallback), so it must never be swapped for a new one. A number Firestore
// refuses then means this same order is already stored, and err.code is
// "order-exists" instead of a second document being created.
export async function createOrder(order, { keepNo = false } = {}) {
  const problems = orderProblems(order);
  if (problems.length) {
    const err = new Error("Order data is not valid: " + problems.join(", "));
    err.code = "invalid-order";
    err.problems = problems;
    throw err;
  }

  if (DEMO_MODE) {
    let all = [];
    try {
      all = JSON.parse(localStorage.getItem("bf_demo_orders") || "[]");
      if (!Array.isArray(all)) all = [];
    } catch {
      all = [];
    }
    // The same order number is the same order, so a retry reuses it instead of
    // adding a duplicate.
    const already = all.find((o) => o.orderNo === order.orderNo);
    if (already) return already;
    all.push({ ...order, createdAt: new Date().toISOString() });
    localStorage.setItem("bf_demo_orders", JSON.stringify(all));
    return order;
  }

  const { fs, db } = await getFs();
  // A brand new document id can only ever be created, never overwritten, and
  // firestore.rules additionally requires documentId == orderNo.
  const attempts = keepNo ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const o = attempt === 0 ? order : { ...order, orderNo: newOrderNo() };
    try {
      await fs.setDoc(fs.doc(db, "orders", o.orderNo), { ...o, createdAt: fs.serverTimestamp() });
      return o;
    } catch (err) {
      // Never retry a network error, so a placed order can never be written twice.
      if (err?.code !== "permission-denied") throw err;
      // A taken order number arrives as permission-denied because writing over an
      // existing order is refused. Try a fresh number.
      if (attempt < attempts - 1) continue;
      if (keepNo) {
        const taken = new Error(`Order ${o.orderNo} is already saved.`);
        taken.code = "order-exists";
        taken.orderNo = o.orderNo;
        throw taken;
      }
      throw err;
    }
  }
}