// Helpers used by both the shop and the admin panel.
import { LIMITS, SHOP } from "./config.js";

// Always escape text before putting it into innerHTML (customer text is untrusted).
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const money = (n) => "\u09F3" + Number(n || 0).toLocaleString("en-US");

/* ---------- Prices and bundle deals ----------

   A product can have a bundle deal using the two FLAT fields that already exist
   in Firestore:

     price      = normal price of one piece
     deal_qty   = how many pieces the bundle needs
     deal_price = TOTAL taka for those deal_qty pieces   (not price x deal_qty)

   price 500, deal_qty 2, deal_price 950 gives:
     1 piece  =  500
     2 pieces =  950          <- the pair costs 950, not 2 x 500 = 1000
     3 pieces = 1450          <- 950 + 500
     4 pieces = 1900          <- 950 x 2
     5 pieces = 2400          <- 950 x 2 + 500

   So: complete bundles x deal_price + leftover pieces x price.
*/

// A number that is safe to do maths with. undefined, null, "" and "abc" all
// become 0 instead of NaN, so a half filled product can never produce a NaN
// total that would be rejected by Firestore.
export const num = (v) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

// Whole taka only, because firestore.rules requires whole numbers.
export const unitPrice = (p) => Math.max(0, Math.round(num(p?.price)));

// { qty, price } for a real bundle, or null when there is no deal.
// Absent, null, "", 0 and nonsense all mean NO DEAL. deal_qty = 0 is not a deal.
export function dealOf(p) {
  let q = p?.deal_qty;
  let v = p?.deal_price;
  // Tolerate the nested shape in case an older build already wrote one.
  if (p?.deal && typeof p.deal === "object") {
    if (q === undefined) q = p.deal.qty;
    if (v === undefined) v = p.deal.price;
  }
  const dq = Math.round(num(q));
  const dp = Math.round(num(v));
  if (dq < 2 || dp <= 0) return null;
  return { qty: dq, price: dp };
}

// price for a quantity, using the bundle when the product has one.
export function lineTotal(p, qty) {
  const price = unitPrice(p);
  const n = Math.max(0, Math.floor(num(qty)));
  const d = dealOf(p);
  if (!d) return price * n;
  return Math.floor(n / d.qty) * d.price + (n % d.qty) * price;
}

// The same maths, but from an order item that already copied the deal in.
// This is what keeps an old order correct after the product price changes.
export function snapshotLineTotal(it) {
  const price = Math.round(num(it?.price));
  const n = Math.floor(num(it?.qty));
  const dq = Math.round(num(it?.dealQty));
  const dp = Math.round(num(it?.dealPrice));
  if (dq < 2 || dp <= 0) return price * n;
  return Math.floor(n / dq) * dp + (n % dq) * price;
}

// One order item. It copies the price AND the deal in, so the order stays
// accurate even if you change or delete the product later.
// dealQty / dealPrice are 0 when the product has no deal.
export function orderItem(p, qty) {
  const d = dealOf(p);
  const n = Math.max(0, Math.floor(num(qty)));
  return {
    id: p.id,
    name: p.name + (p.size ? ` (${p.size})` : ""),
    price: unitPrice(p),
    qty: n,
    dealQty: d ? d.qty : 0,
    dealPrice: d ? d.price : 0,
    lineTotal: lineTotal(p, n),
  };
}

// null/undefined stock = not tracked (always available)
export const stockLeft = (p) => (typeof p.stock === "number" ? p.stock : Infinity);
export const available = (p) => p.active !== false && stockLeft(p) > 0;

/* ---------- Product images ---------- */
// One resolver for every place a product image is shown (product card, cart).
// Relative paths are resolved against the project root, taken from this module's own URL
// (js/shared.js sits in <root>/js/), so "images/x.jpg" works both at
// http://localhost/... and when the site lives in a subdirectory such as
// http://domain.com/Projects/BnF/ -- without hardcoding a leading "/".
const ROOT = new URL("../", import.meta.url);

const ABSOLUTE = /^(?:https?:|data:|\/\/)/i;

export function placeholderImg(p) {
  const hue = p?.category === "Hair care" ? "#EDE9FE" : "#F5F3FF";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="${hue}"/>` +
    `<circle cx="200" cy="230" r="90" fill="none" stroke="#A78BFA" stroke-width="3"/>` +
    `<text x="200" y="245" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#5B21B6">${esc((p?.brand || "").slice(0, 12))}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Empty, a full URL, or any relative path (images/x.jpg, images/products/x.jpg, assets/images/x.jpg).
export function isImagePath(v) {
  const s = String(v ?? "").trim();
  if (s === "" || ABSOLUTE.test(s)) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(s); // reject javascript:, vbscript:, ...
}

export function imgSrc(p) {
  const raw = String(p?.image ?? "").trim();
  if (raw === "") return placeholderImg(p);
  if (ABSOLUTE.test(raw)) return raw;
  // Leading slashes are dropped so "/images/x.jpg" stays inside the project folder
  // instead of jumping to the domain root.
  return new URL(raw.replace(/^\/+/, ""), ROOT).href;
}

export const DHAKA_CITY = "Dhaka City";

/* ---------- Bangladeshi phone ---------- */
// "01712345678", "+8801712345678" and "0171 234 5678" all become 01712345678.
export const normPhone = (v) => String(v ?? "").replace(/[\s\-()]/g, "").replace(/^\+?88/, "");
export const phoneOk = (v) => /^01[3-9]\d{8}$/.test(v);

// TrxID: bKash shows 6 to 10 characters, digits and letters.
export const trxOk = (v) => /^[A-Za-z0-9]{6,30}$/.test(String(v ?? "").trim());

// Same shape firestore.rules requires from orderNo.
export const ORDER_NO_RE = /^BF[0-9]{6}-[0-9A-Z]{4}$/;

export const isInt = (v) => Number.isInteger(v);

/* ---------- Client side order check ----------
   Mirrors validOrder() in firestore.rules. Firestore is the real gate; this
   exists so the customer gets a plain sentence instead of a permission error.
   Returns an array of problems. An empty array means the order is well formed.
*/
export function orderProblems(o) {
  const bad = [];
  const text = (v, min, max, label) => {
    if (typeof v !== "string" || v.length < min || v.length > max) bad.push(label);
  };

  if (!o || typeof o !== "object") return ["order"];

  text(o.orderNo, 1, 20, "order number");
  if (!ORDER_NO_RE.test(o.orderNo || "")) bad.push("order number format");
  if (o.status !== "pending") bad.push("status");
  if (o.paymentStatus !== "unpaid") bad.push("payment status");
  if (o.source !== "website") bad.push("source");
  text(o.courier, 0, 40, "courier");

  if (o.zone !== "inside" && o.zone !== "outside") {
    bad.push("zone");
  } else if (o.zone === "inside") {
    if (o.customer?.district !== DHAKA_CITY) bad.push("district");
    if (o.paymentMethod !== "cod") bad.push("payment method");
    if (o.deliveryCharge !== SHOP.deliveryInsideDhaka) bad.push("delivery charge");
    if (o.bkash != null) bad.push("bKash block on an inside Dhaka order");
  } else {
    if (o.paymentMethod !== "bkash") bad.push("payment method");
    if (o.deliveryCharge !== SHOP.deliveryOutsideDhaka) bad.push("delivery charge");
    if (!o.courier) bad.push("courier");
    if (!trxOk(o.bkash?.trxId)) bad.push("bKash TrxID");
    if (!phoneOk(o.bkash?.senderNumber)) bad.push("bKash sender number");
  }

  const c = o.customer || {};
  text(c.name, 2, LIMITS.maxName, "name");
  if (!phoneOk(c.phone)) bad.push("phone");
  text(c.district, 2, 60, "district");
  text(c.area, 0, LIMITS.maxArea, "area");
  text(c.address, 8, LIMITS.maxAddress, "address");
  text(c.note, 0, LIMITS.maxNote, "note");

  const items = o.items;
  if (!Array.isArray(items) || !items.length || items.length > LIMITS.maxCartItems) bad.push("items");
  else {
    items.forEach((it) => {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(it.id || "")) bad.push("item id");
      if (!isInt(it.price) || it.price < 0) bad.push("item price");
      if (!isInt(it.qty) || it.qty < 1 || it.qty > LIMITS.maxQtyPerItem) bad.push("item quantity");
      if (!isInt(it.dealQty) || it.dealQty < 0) bad.push("item deal qty");
      if (!isInt(it.dealPrice) || it.dealPrice < 0) bad.push("item deal price");
      if (!isInt(it.lineTotal) || it.lineTotal < 0) bad.push("item line total");
      // The bundle maths itself, checked here so the customer gets a sentence
      // instead of a permission error. firestore.rules repeats this check.
      else if (it.lineTotal !== snapshotLineTotal(it)) bad.push("item line total maths");
    });
    const sum = items.reduce((s, it) => s + (it.lineTotal || 0), 0);
    if (o.subtotal !== sum) bad.push("subtotal");
  }

  if (!isInt(o.subtotal) || o.subtotal < 0) bad.push("subtotal");
  if (!isInt(o.deliveryCharge) || o.deliveryCharge < 0) bad.push("delivery charge");
  if (!isInt(o.total) || o.total <= 0) bad.push("total");
  if (o.total !== (o.subtotal || 0) + (o.deliveryCharge || 0)) bad.push("total");

  return [...new Set(bad)];
}

// Dhaka City = inside Dhaka (cash on delivery). Everything else = outside (bKash, courier).
export const DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria", "Chandpur",
  "Chapainawabganj", "Chattogram", "Chuadanga", "Cox's Bazar", "Cumilla", "Dhaka (outside Dhaka City)",
  "Dinajpur", "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jashore",
  "Jhalokathi", "Jhenaidah", "Joypurhat", "Khagrachhari", "Khulna", "Kishoreganj", "Kurigram", "Kushtia",
  "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj", "Meherpur", "Moulvibazar", "Munshiganj",
  "Mymensingh", "Naogaon", "Narail", "Narayanganj", "Narsingdi", "Natore", "Netrokona", "Nilphamari",
  "Noakhali", "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati",
  "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon",
];

// Readable order number, e.g. BF261002-K7Q2
export function newOrderNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const day = String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate());
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let bytes;
  try {
    bytes = crypto.getRandomValues(new Uint8Array(4));
  } catch {
    bytes = Uint8Array.from({ length: 4 }, () => Math.floor(Math.random() * 256));
  }
  return "BF" + day + "-" + Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

export function fmtDate(v) {
  const d = toDate(v);
  return d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

// Plain-text order summary, sent to Messenger by the customer
export function orderText(o) {
  const lines = [
    `New order ${o.orderNo}`,
    "",
    ...o.items.map((i) => `${i.qty} x ${i.name} = ${money(i.lineTotal ?? i.price * i.qty)}`),
    "",
    `Subtotal: ${money(o.subtotal)}`,
    `Delivery: ${money(o.deliveryCharge)}`,
    `Total: ${money(o.total)}`,
    "",
    o.paymentMethod === "cod"
      ? "Payment: Cash on delivery"
      : `Payment: bKash (TrxID ${o.bkash?.trxId || "-"}, from ${o.bkash?.senderNumber || "-"})`,
    "",
    `Name: ${o.customer.name}`,
    `Phone: ${o.customer.phone}`,
    `Address: ${o.customer.address}, ${o.customer.area ? o.customer.area + ", " : ""}${o.customer.district}`,
  ];
  return lines.join("\n");
}
