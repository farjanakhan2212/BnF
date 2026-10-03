// Helpers used by both the shop and the admin panel.

// Always escape text before putting it into innerHTML (customer text is untrusted).
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const money = (n) => "\u09F3" + Number(n || 0).toLocaleString("en-US");

// Price for a quantity. A product can have a deal: { qty: 2, price: 950 } = "2 for 950".
export function lineTotal(p, qty) {
  const d = p.deal;
  if (d && d.qty > 1 && d.price > 0) {
    return Math.floor(qty / d.qty) * d.price + (qty % d.qty) * p.price;
  }
  return p.price * qty;
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
  const bytes = crypto.getRandomValues(new Uint8Array(4));
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
