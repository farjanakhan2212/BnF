import { SHOP, DEMO_MODE, ADMIN_UID } from "./config.js";
import { getFs, getAuthKit, friendlyError } from "./data.js";
import { SEED_PRODUCTS } from "./seed.js";
import { esc, money, fmtDate, toDate, stockLeft, isImagePath, dealOf, num as safeNum } from "./shared.js";

const $ = (s, r = document) => r.querySelector(s);
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENTS = ["unpaid", "paid", "refunded"];
// Stock is taken off when an order is confirmed, and put back if it is later cancelled.
const STOCK_OUT = ["confirmed", "shipped", "delivered"];

const state = { orders: [], products: [], tab: "orders", status: "all", q: "", open: new Set(), dirty: false, flash: {}, ordersLoaded: false };
let fsKit, authKit;
let unsubs = [];
let seeding = false;

// Shown above the login box, so a problem is visible before the panel opens.
function showNotice(text) {
  const n = $("#setup-notice");
  n.textContent = text;
  n.hidden = false;
}
const hideNotice = () => ($("#setup-notice").hidden = true);

function appError(text) {
  const e = $("#a-error");
  e.textContent = text;
  e.hidden = !text;
}

/* ---------- Boot ---------- */
(async function init() {
  if (DEMO_MODE) {
    showNotice("Firebase is not connected yet. Open js/config.js, paste your Firebase settings, then reload this page. Steps are in README.md.");
    return;
  }
  try {
    fsKit = await getFs();
    authKit = await getAuthKit();
  } catch (err) {
    console.error(err);
    showNotice("Could not reach Firebase. Check your internet connection and reload this page.");
    return;
  }
  try {
    authKit.mod.onAuthStateChanged(authKit.auth, onUser, (err) => {
      console.error(err);
      showNotice("Could not read your login. Reload the page and try again.");
    });
  } catch (err) {
    console.error(err);
    showNotice("Could not start the admin panel. Reload the page and try again.");
  }
})();

function onUser(user) {
  unsubs.forEach((u) => u());
  unsubs = [];

  // Signed out.
  if (!user) {
    $("#login").hidden = false;
    $("#app").hidden = true;
    return;
  }

  // Firebase Auth allows any account to sign in; only the UID in firestore.rules
  // (and ADMIN_UID here, purely for a clearer message) reaches the panel.
  if (user.uid !== ADMIN_UID) {
    $("#login").hidden = true;
    $("#app").hidden = true;
    showNotice(`This account is not the shop admin. Log out and sign in with the admin email. Firebase will deny admin data for this account.`);
    authKit.mod.signOut(authKit.auth).catch(() => {});
    return;
  }

  hideNotice();
  $("#login").hidden = true;
  $("#app").hidden = false;
  appError("");
  $("#who").textContent = user.email || "";

  const { fs, db } = fsKit;
  const onErr = (err) => {
    console.error(err);
    appError(
      err?.code === "permission-denied"
        ? "Firestore refused this account. Check that the UID in firestore.rules matches your admin User UID, then publish the rules again."
        : friendlyError(err)
    );
  };
  unsubs.push(
    fs.onSnapshot(fs.query(fs.collection(db, "orders"), fs.orderBy("createdAt", "desc"), fs.limit(500)), (snap) => {
      state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      state.ordersLoaded = true; // so the panel can show a spinner, not an empty list, on first load
      render();
    }, onErr),
    fs.onSnapshot(fs.collection(db, "products"), (snap) => {
      state.products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    }, onErr)
  );
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!authKit) return;
  const err = $("#login-error");
  err.hidden = true;
  const email = $("#l-email").value.trim();
  const pass = $("#l-pass").value;
  if (!email || !pass) {
    err.textContent = "Enter your email and password.";
    err.hidden = false;
    return;
  }
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Logging in...";
  try {
    await authKit.mod.signInWithEmailAndPassword(authKit.auth, email, pass);
  } catch (ex) {
    // Never echo the raw Firebase message, it contains project internals.
    err.textContent =
      ex?.code === "invalid-credential" || ex?.code === "wrong-password" || ex?.code === "user-not-found"
        ? "Email or password is wrong."
        : ex?.code === "too-many-requests"
          ? "Too many tries. Wait a minute and try again."
          : "Could not log in. Check your internet and try again.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Login";
  }
});

// Show/hide the password. Cosmetic only: it flips input#l-pass between
// "password" and "text", so the value the login code reads is untouched.
$("#l-eye")?.addEventListener("click", () => {
  const input = $("#l-pass");
  const eye = $("#l-eye");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  eye.setAttribute("aria-pressed", String(show));
  eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
  input.focus();
});

$("#logout").addEventListener("click", () => {
  if (!authKit) return;
  authKit.mod.signOut(authKit.auth).catch((err) => {
    console.error(err);
    appError("Could not log out. Reload the page.");
  });
});

/* ---------- Tabs ---------- */
document.querySelectorAll("[data-tab]").forEach((b) =>
  b.addEventListener("click", () => {
    state.tab = b.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    render();
  })
);

// force = true redraws even while a field has focus, used right after a save
// where the typed values have already been written to Firestore.
function render(force) {
  const active = document.activeElement;
  if (!force && state.tab === "orders" && active && $("#orders-list").contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) {
    state.dirty = true; // do not wipe what is being typed; redraw after the field loses focus
    return;
  }
  state.dirty = false;
  ["orders", "products", "reports"].forEach((t) => ($(`#tab-${t}`).hidden = state.tab !== t));
  const pending = state.orders.filter((o) => o.status === "pending").length;
  const badge = $("#pending-badge");
  badge.hidden = !pending;
  badge.textContent = pending;
  if (state.tab === "orders") renderOrders();
  if (state.tab === "products") renderProducts();
  if (state.tab === "reports") renderReports();
  if (state.tab === "orders") renderSummary();
}
document.addEventListener("focusout", () => { if (state.dirty) setTimeout(render, 0); });

/* ---------- Orders ---------- */
$("#o-status").innerHTML =
  `<option value="all">All orders</option>` + STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
$("#o-status").addEventListener("change", (e) => { state.status = e.target.value; render(); });
$("#o-search").addEventListener("input", (e) => { state.q = e.target.value; render(); });

const opts = (list, cur) => list.map((v) => `<option value="${v}" ${v === cur ? "selected" : ""}>${v}</option>`).join("");

/* ---------- Small inline icons for the dashboard ----------
   Stroke based and the same 24x24 box for every glyph, so they read as one set.
   Static strings only, never customer text. */
const ICON = {
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  truck: '<path d="M1 4h14v12H1z"/><path d="M15 9h4l3 3v4h-7z"/><circle cx="5.5" cy="18.5" r="2.2"/><circle cx="18.5" cy="18.5" r="2.2"/>',
  note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z"/>',
};
const ico = (n) =>
  `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[n] || ""}</svg>`;

/* Counts come straight from the orders already loaded in state.orders, so they
   can never disagree with the list below them. Nothing is written to Firestore. */
function renderSummary() {
  const count = (s) => state.orders.filter((o) => o.status === s).length;
  const cards = [
    ["Total orders", state.orders.length, "all"],
    ["Pending", count("pending"), "pending"],
    ["Confirmed", count("confirmed"), "confirmed"],
    ["Delivered", count("delivered"), "delivered"],
    ["Cancelled", count("cancelled"), "cancelled"],
  ];
  $("#o-summary").innerHTML = cards
    .map(
      ([label, n, tone]) =>
        `<div class="osum ${tone}"><span class="osum-l">${label}</span><b class="osum-n">${n}</b></div>`
    )
    .join("");
}

function renderOrders() {
  const q = state.q.trim().toLowerCase();
  const list = state.orders
    .filter((o) => state.status === "all" || o.status === state.status)
    .filter((o) => !q || `${o.orderNo} ${o.customer?.name} ${o.customer?.phone}`.toLowerCase().includes(q));
  const box = $("#orders-list");

  // First snapshot has not arrived yet, so there is nothing to say about counts.
  if (!state.ordersLoaded) {
    box.innerHTML = `<div class="oload" role="status"><span class="spin" aria-hidden="true"></span><p>Loading orders...</p></div>`;
    return;
  }

  if (!list.length) {
    const filtered = state.status !== "all" || !!q;
    box.innerHTML = `<div class="oempty">${ico("inbox")}
      <h3>${filtered ? "No matching orders" : "No orders yet"}</h3>
      <p>${filtered
        ? "There are currently no orders matching your search or filter."
        : "New orders placed on the website will appear here."}</p>
    </div>`;
    return;
  }

  const shown = list.length === state.orders.length
    ? `<p class="ocount">${state.orders.length} order${state.orders.length === 1 ? "" : "s"}</p>`
    : `<p class="ocount">Showing ${list.length} of ${state.orders.length} orders</p>`;
  box.innerHTML = shown + list.map(orderCard).join("");
}

/* One order card. Presentation only: saveOrder() still reads this card through
   .order[data-id], [role=status], [data-save-order] and the four [name] fields. */
function orderCard(o) {
  const c = o.customer || {};
  const status = String(o.status || "");
  const paid = String(o.paymentStatus || "");

  // lineTotal is the price this order was actually placed at. The price * qty
  // fallback only ever runs for old documents that predate it, and the live
  // product price is never consulted.
  const items = (o.items || [])
    .map(
      (i) => `<li class="oi">
        <span class="oi-n">${esc(i.name)}</span>
        <span class="oi-q">Qty ${esc(i.qty)}</span>
        <span class="oi-p">${money(i.lineTotal ?? i.price * i.qty)}</span>
        <span class="oi-id mono">ID: ${esc(i.id || "-")}${
          i.dealQty >= 2 ? ` &middot; Bundle ${esc(i.dealQty)} @ ${money(i.dealPrice)}` : ""
        }</span>
      </li>`
    )
    .join("");

  const payment = o.paymentMethod === "cod"
    ? `<span class="v">Cash on Delivery</span>`
    : `<span class="v">bKash</span>
       ${o.bkash?.trxId ? `<span class="k">TrxID ${esc(o.bkash.trxId)}</span>` : ""}
       ${o.bkash?.senderNumber ? `<span class="k">Sent from ${esc(o.bkash.senderNumber)}</span>` : ""}`;

  const tracking = o.trackingNo
    ? `<div class="osec">
        <div class="osec-h">${ico("truck")}Courier / tracking</div>
        <div class="osec-b"><span class="v">${esc(o.courier || SHOP.courier)}</span><span class="k mono">${esc(o.trackingNo)}</span></div>
      </div>`
    : "";

  return `<article class="order ocard" data-id="${esc(o.id)}">
    <header class="oc-head">
      <div class="oc-id">
        <span class="o-no mono">${esc(o.orderNo)}</span>
        <span class="oc-when">${ico("cal")}${esc(fmtDate(o.createdAt))}</span>
      </div>
      <div class="oc-flags">
        <span class="pill ${esc(status)}">${esc(status)}</span>
        <span class="pill ${esc(paid)}">${esc(paid)}</span>
      </div>
    </header>

    <div class="oc-grid">
      <div class="osec">
        <div class="osec-h">${ico("user")}Customer</div>
        <div class="osec-b">
          <span class="v">${esc(c.name)}</span>
          <a class="k tel" href="tel:${esc(c.phone)}">${ico("phone")}${esc(c.phone)}</a>
        </div>
      </div>
      <div class="osec">
        <div class="osec-h">${ico("pin")}Delivery</div>
        <div class="osec-b">
          <span class="v">District: ${esc(c.district || "-")}</span>
          ${c.area ? `<span class="k">Area / Thana: ${esc(c.area)}</span>` : ""}
          <span class="k">Address: ${esc(c.address || "-")}</span>
        </div>
      </div>
      <div class="osec">
        <div class="osec-h">${ico("card")}Payment</div>
        <div class="osec-b">${payment}</div>
      </div>
      ${tracking}
    </div>

    <div class="oc-items">
      <div class="osec-h">${ico("box")}Items</div>
      <ul class="o-items">${items}</ul>
    </div>

    <div class="oc-sum">
      <div class="osum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      <div class="osum-row"><span>Delivery (${o.zone === "inside" ? "inside Dhaka" : "outside Dhaka"})</span><span>${money(o.deliveryCharge)}</span></div>
      <div class="osum-row grand"><span>Total</span><span>${money(o.total)}</span></div>
    </div>

    ${c.note ? `<div class="onote"><b>${ico("note")}Customer note</b><p>${esc(c.note)}</p></div>` : ""}

    <div class="o-ctl">
      <div><label for="os-${esc(o.id)}">Order status</label><select id="os-${esc(o.id)}" name="status">${opts(STATUSES, status)}</select></div>
      <div><label for="op-${esc(o.id)}">Payment status</label><select id="op-${esc(o.id)}" name="paymentStatus">${opts(PAYMENTS, paid)}</select></div>
      <div><label for="ot-${esc(o.id)}">${esc(o.courier || SHOP.courier)} tracking / memo no.</label><input id="ot-${esc(o.id)}" name="trackingNo" maxlength="60" value="${esc(o.trackingNo || "")}"></div>
      <div class="wide"><label for="oa-${esc(o.id)}">Private note (customer cannot see)</label><textarea id="oa-${esc(o.id)}" name="adminNote" rows="2" maxlength="500">${esc(o.adminNote || "")}</textarea></div>
    </div>

    <div class="o-actions">
      <button type="button" class="btn btn-primary" data-save-order="${esc(o.id)}">Save changes</button>
      <button type="button" class="btn btn-ghost" data-print="${esc(o.id)}">Print slip</button>
      <span class="o-card-total">${money(o.total)}</span>
    </div>
    <p class="o-flash" role="status">${esc(state.flash[o.id] || "")}</p>
  </article>`;
}

/* ---------- Order status + stock ----------
   Stock moves only on a real status change, and the whole thing runs inside one
   Firestore transaction that re-reads the order, so:
     pending -> confirmed   deducts once
     confirmed -> confirmed nothing happens
     confirmed -> cancelled puts the stock back once
     cancelled -> cancelled nothing happens
     cancelled -> confirmed  deducts again, which is correct because the earlier
                                cancel had already returned the pieces
*/
class StockError extends Error {}

async function saveOrder(id) {
  const card = document.querySelector(`.order[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  const msg = card.querySelector("[role=status]");
  const btn = card.querySelector("[data-save-order]");
  const val = (n) => card.querySelector(`[name="${n}"]`).value;

  const status = val("status");
  const paymentStatus = val("paymentStatus");
  const trackingNo = val("trackingNo").trim().slice(0, 60);
  const adminNote = val("adminNote").trim().slice(0, 500);

  const { fs, db } = fsKit;
  btn.disabled = true;
  if (msg) msg.textContent = "Saving...";

  try {
    await fs.runTransaction(db, async (tx) => {
      const orderRef = fs.doc(db, "orders", id);
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error("missing-order");
      const o = snap.data();

      // Older orders saved before this field existed: if they already sit in a
      // stock holding status the stock was taken then, so treat it as taken.
      const wasStocked = o.stockAdjusted === true || (!("stockAdjusted" in o) && STOCK_OUT.includes(o.status));
      const willStock = STOCK_OUT.includes(status);

      const update = {
        status,
        paymentStatus,
        trackingNo,
        adminNote,
        stockAdjusted: willStock,
        updatedAt: fs.serverTimestamp(),
      };

      if (wasStocked !== willStock) {
        const pending = [];
        for (const it of o.items || []) {
          const qty = Number(it.qty) || 0;
          if (qty <= 0) continue;
          const pRef = fs.doc(db, "products", it.id);
          // Every read must come before the first write in a transaction.
          const pSnap = await tx.get(pRef);
          if (!pSnap.exists()) continue;                 // product removed, nothing to move
          const stock = pSnap.data().stock;
          if (typeof stock !== "number") continue;       // stock is not tracked
          const next = willStock ? stock - qty : stock + qty;
          if (willStock && next < 0) {
            throw new StockError(`${it.name}: only ${stock} left in stock, this order needs ${qty}.`);
          }
          pending.push([pRef, next]);
        }
        pending.forEach(([ref, next]) => tx.update(ref, { stock: next }));
      }

      tx.update(orderRef, update);
    });
    // Only now is it safe to redraw: the snapshot will not throw away typing.
    state.flash[id] = "Saved.";
    render(true);
  } catch (err) {
    console.error(err);
    const text =
      err instanceof StockError
        ? err.message + " Stock was left untouched."
        : err?.message === "missing-order"
          ? "This order no longer exists."
          : err?.code === "permission-denied"
            ? "Firestore refused this change. Check the rules and the admin UID."
            : friendlyError(err);
    if (msg) msg.textContent = text;
    else {
      state.flash[id] = text;
      render();
    }
  } finally {
    btn.disabled = false;
  }
}

function printSlip(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  const c = o.customer || {};
  const w = window.open("", "_blank", "width=480,height=720");
  if (!w) {
    state.flash[id] = "Your browser blocked the print window. Allow pop ups for this site.";
    render();
    return;
  }
  const rows = (o.items || []).map((i) => `<tr><td>${esc(i.qty)} x ${esc(i.name)}</td><td>${money(i.lineTotal ?? i.price * i.qty)}</td></tr>`).join("");
  const toCollect = o.paymentMethod === "cod" ? o.total : o.paymentStatus === "paid" ? 0 : o.total;
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(o.orderNo)}</title>
  <style>body{font:15px/1.5 system-ui,sans-serif;padding:16px;max-width:420px}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse}td{padding:3px 0;border-bottom:1px dashed #DDD6FE}td:last-child{text-align:right}.big{font-size:20px;font-weight:700}</style>
  <h1>${esc(SHOP.name)}</h1><p>${esc(SHOP.address)}</p><hr>
  <p><strong>Order ${esc(o.orderNo)}</strong><br>${esc(fmtDate(o.createdAt))}</p>
  <p><strong>${esc(c.name)}</strong><br>${esc(c.phone)}<br>${esc(c.address)}${c.area ? ", " + esc(c.area) : ""}, ${esc(c.district)}</p>
  <table>${rows}<tr><td>Delivery</td><td>${money(o.deliveryCharge)}</td></tr><tr><td><strong>Total</strong></td><td><strong>${money(o.total)}</strong></td></tr></table>
  <p class="big">${toCollect ? "Collect: " + money(toCollect) : "Paid in full (bKash)"}</p>
  ${o.trackingNo ? `<p>Tracking: ${esc(o.trackingNo)}</p>` : ""}
  <script>window.onload=function(){window.print()}<\/script>`);
  w.document.close();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.saveOrder) saveOrder(b.dataset.saveOrder);
  else if (b.dataset.print) printSlip(b.dataset.print);
  else if (b.dataset.edit) editProduct(b.dataset.edit);
  else if (b.dataset.toggle) toggleProduct(b.dataset.toggle);
  else if (b.dataset.del) deleteProduct(b.dataset.del, b);
});
document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (d.matches?.(".order")) d.open ? state.open.add(d.dataset.id) : state.open.delete(d.dataset.id);
}, true);

/* ---------- CSV backup ----------
   Firestore stays the primary database. GitHub Pages is a static host, so this
   button is the only way the data leaves it: Customer order -> Firestore ->
   Admin CSV export. Nothing is ever appended to a file on a server.
*/
// Handles commas, quotes, line breaks, Bangla text and spreadsheet formulas.
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return '"' + s.replace(/"/g, '""') + '"';
};

const CSV_HEAD = [
  "Order no", "Date", "Status", "Payment status", "Zone", "Name", "Phone", "District", "Area",
  "Address", "Items", "Subtotal", "Delivery", "Total", "Payment method", "bKash TrxID",
  "bKash sender", "Courier", "Tracking", "Customer note", "Admin note",
];

function orderRow(o) {
  const c = o.customer || {};
  const items = (o.items || [])
    .map((i) => `${i.qty} x ${i.name} @ ${i.price} = ${i.lineTotal ?? (i.price || 0) * (i.qty || 0)}`)
    .join("; ");
  return [
    o.orderNo || o.id, fmtDate(o.createdAt), o.status, o.paymentStatus, o.zone,
    c.name, c.phone, c.district, c.area, c.address, items,
    o.subtotal, o.deliveryCharge, o.total,
    o.paymentMethod, o.bkash?.trxId, o.bkash?.senderNumber, o.courier,
    o.trackingNo, c.note, o.adminNote,
  ];
}

// The UTF-8 BOM keeps Bangla readable when the file is opened in Excel.
function downloadCsv(head, rows, filename) {
  const csv = "\uFEFF" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$("#export-csv").addEventListener("click", async () => {
  const btn = $("#export-csv");
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing CSV...";
  try {
    // Read straight from Firestore instead of the 500 row screen list, so the
    // backup covers every order.
    const { fs, db } = fsKit;
    const snap = await fs.getDocs(
      fs.query(fs.collection(db, "orders"), fs.orderBy("createdAt", "desc"), fs.limit(5000))
    );
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    downloadCsv(CSV_HEAD, orders.map(orderRow), `orders-${new Date().toISOString().slice(0, 10)}.csv`);
    if (orders.length >= 5000) {
      appError("More than 5000 orders exist. This CSV holds the newest 5000 only.");
    }
  } catch (err) {
    console.error(err);
    appError(friendlyError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

/* ---------- Products ---------- */
const pform = $("#product-form");
const pf = (id) => $("#p-" + id);

function fillOrigins(cur) {
  const list = [...new Set(["", ...SHOP.origins, cur || ""])];
  pf("origin").innerHTML = list.map((o) => `<option value="${esc(o)}">${o || "Not specified"}</option>`).join("");
  pf("origin").value = cur || "";
}

function productMsg(text) {
  const m = $("#p-msg");
  m.textContent = text;
}

function renderProducts() {
  // The starter list is only offered while the collection is empty.
  $("#seed-products").hidden = state.products.length > 0 || seeding;
  const box = $("#products-list");
  if (!state.products.length) {
    box.innerHTML = `<p class="empty">No products yet. Use "Load starter products" to add your current list, then fix prices and stock.</p>`;
    return;
  }
  box.innerHTML = [...state.products]
    .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999))
    .map((p) => {
      const left = stockLeft(p);
      const deal = dealOf(p);
      return `<div class="prow ${p.active === false ? "off" : ""}">
        <div>
          <div class="p-name">${esc(p.name)} ${p.size ? `(${esc(p.size)})` : ""}</div>
          <div class="p-meta">${money(p.price)}${deal ? `, ${esc(deal.qty)} for ${money(deal.price)}` : ""} | Stock: ${left === Infinity ? "not tracked" : left} ${p.expiry ? `| Exp: ${esc(p.expiry)}` : ""} | ${p.active === false ? "Hidden" : "Visible"}</div>
        </div>
        <div><button type="button" data-edit="${esc(p.id)}">Edit</button> <button type="button" data-toggle="${esc(p.id)}">${p.active === false ? "Show" : "Hide"}</button> <button type="button" data-del="${esc(p.id)}">Delete</button></div>
      </div>`;
    })
    .join("");
}

function openForm(p) {
  pform.hidden = false;
  pf("id").value = p?.id || "";
  pf("name").value = p?.name || "";
  pf("brand").value = p?.brand || "";
  pf("size").value = p?.size || "";
  pf("category").value = p?.category || "Skin care";
  fillOrigins(p?.origin);
  pf("price").value = p?.price ?? "";
  pf("stock").value = typeof p?.stock === "number" ? p.stock : "";
  pf("dealqty").value = p?.deal_qty ?? "";
  pf("dealprice").value = p?.deal_price ?? "";
  pf("expiry").value = p?.expiry || "";
  pf("image").value = p?.image || "";
  pf("desc").value = p?.description || "";
  pf("sort").value = p?.sort ?? "";
  pf("active").checked = p ? p.active !== false : true;
  $("#p-error").hidden = true;
  pform.scrollIntoView({ behavior: "smooth" });
}
function editProduct(id) { openForm(state.products.find((p) => p.id === id)); }
$("#new-product").addEventListener("click", () => openForm(null));
$("#cancel-product").addEventListener("click", () => (pform.hidden = true));

async function toggleProduct(id) {
  const { fs, db } = fsKit;
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  try {
    await fs.updateDoc(fs.doc(db, "products", id), { active: p.active === false });
  } catch (ex) {
    console.error(ex);
    productMsg(friendlyError(ex));
  }
}

// Deleting a product never touches old orders: an order keeps its own copy of
// the name, price and quantity, so history stays readable.
async function deleteProduct(id, btn) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`Delete "${p.name}" from the shop?\n\nPast orders keep their own copy of this product, so order history is safe.`)) return;
  const { fs, db } = fsKit;
  btn.disabled = true;
  try {
    await fs.deleteDoc(fs.doc(db, "products", id));
    if (pform.hidden === false && pf("id").value === id) pform.hidden = true;
    productMsg(`Deleted "${p.name}".`);
  } catch (ex) {
    console.error(ex);
    productMsg(friendlyError(ex));
    btn.disabled = false;
  }
}

pform.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { fs, db } = fsKit;
  const err = $("#p-error");
  const btn = pform.querySelector('button[type="submit"]');
  const num = (v) => (v === "" ? null : Number(v));
  const price = num(pf("price").value);
  const stock = num(pf("stock").value);
  if (!pf("name").value.trim() || price === null || !Number.isInteger(price) || price < 0) {
    // firestore.rules needs a whole taka amount, so 500.50 would block every order.
    err.textContent = "Enter a product name and a whole number price, like 500.";
    err.hidden = false;
    return;
  }
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    err.textContent = "Stock must be a whole number of 0 or more, or empty for unlimited.";
    err.hidden = false;
    return;
  }
  const image = pf("image").value.trim();
  if (!isImagePath(image)) {
    err.textContent = "Image path must be a relative path (images/product.jpg) or a full https:// link.";
    err.hidden = false;
    return;
  }
// Bundle deal, stored as the two flat Firestore fields deal_qty and deal_price.
// Both 0 means no deal. Empty boxes also mean no deal, never "".
const dq = Math.round(safeNum(pf("dealqty").value));
const dp = Math.round(safeNum(pf("dealprice").value));
if (dq > 0 || dp > 0) {
  if (!Number.isInteger(dq) || dq < 2 || dq > 20) {
    err.textContent = "Bundle pieces must be a whole number from 2 to 20.";
    err.hidden = false;
    return;
  }
  if (!Number.isInteger(dp) || dp <= 0 || dp > 1000000) {
    err.textContent = "Bundle total price must be a whole number above 0.";
    err.hidden = false;
    return;
  }
  // firestore.rules only accepts a bundle cheaper than buying separately.
  if (dp >= dq * price) {
    err.textContent = `A bundle must cost less than ${dq} x ${price} = ${dq * price} taka.`;
    err.hidden = false;
    return;
  }
}

const data = {
  name: pf("name").value.trim(),
  brand: pf("brand").value.trim(),
  size: pf("size").value.trim(),
  category: pf("category").value,
  origin: pf("origin").value,
  price,
  // The real Firestore schema: two flat numbers, 0 = no bundle.
  deal_qty: dq,
  deal_price: dp,
  stock,
  expiry: pf("expiry").value.trim(),
  image,
  description: pf("desc").value.trim(),
  sort: num(pf("sort").value) ?? 999,
  active: pf("active").checked,
};
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Saving...";
  try {
    const id = pf("id").value;
    if (id) await fs.setDoc(fs.doc(db, "products", id), data, { merge: true });
    else await fs.addDoc(fs.collection(db, "products"), data);
    pform.hidden = true;
    productMsg(`Saved "${data.name}".`);
  } catch (ex) {
    console.error(ex);
    err.textContent =
      ex?.code === "permission-denied"
        ? "Firestore refused this save. Check the rules and the admin UID."
        : friendlyError(ex);
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Save product";
  }
});

// Writes the starter list with fixed document ids, so clicking twice can never
// create a duplicate. The button stays hidden while products exist.
$("#seed-products").addEventListener("click", async () => {
  if (seeding) return;
  const { fs, db } = fsKit;
  const btn = $("#seed-products");
  seeding = true;
  btn.disabled = true;
  btn.textContent = "Loading...";
  productMsg("Loading starter products...");
  try {
    const batch = fs.writeBatch(db);
    SEED_PRODUCTS.forEach(({ id, ...p }) => batch.set(fs.doc(db, "products", id), p));
    await batch.commit();
    productMsg(`Loaded ${SEED_PRODUCTS.length} starter products. Check the prices and stock, then press Show on hidden ones.`);
  } catch (ex) {
    console.error(ex);
    productMsg(friendlyError(ex));
    seeding = false;
    btn.disabled = false;
    btn.textContent = "Load starter products";
    renderProducts();
  }
});

/* ---------- Reports ---------- */
function renderReports() {
  const now = new Date();
  const sameDay = (d) => d && d.toDateString() === now.toDateString();
  const sameMonth = (d) => d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const done = state.orders.filter((o) => o.status === "delivered");
  const sum = (arr) => arr.reduce((s, o) => s + (o.total || 0), 0);
  const today = done.filter((o) => sameDay(toDate(o.createdAt)));
  const month = done.filter((o) => sameMonth(toDate(o.createdAt)));
  const count = (s) => state.orders.filter((o) => o.status === s).length;

  const tally = {};
  done.forEach((o) => (o.items || []).forEach((i) => (tally[i.name] = (tally[i.name] || 0) + i.qty)));
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const low = state.products.filter((p) => p.active !== false && typeof p.stock === "number" && p.stock <= 2);

  $("#tab-reports").innerHTML = `
    <div class="stats">
      <div class="stat"><b>${money(sum(today))}</b><span>Delivered today (${today.length})</span></div>
      <div class="stat"><b>${money(sum(month))}</b><span>Delivered this month (${month.length})</span></div>
      <div class="stat"><b>${money(sum(done))}</b><span>All delivered orders (${done.length})</span></div>
      <div class="stat"><b>${count("pending")}</b><span>Waiting for you</span></div>
      <div class="stat"><b>${count("confirmed") + count("shipped")}</b><span>On the way</span></div>
      <div class="stat"><b>${count("cancelled")}</b><span>Cancelled</span></div>
    </div>
    <h3>Best sellers (delivered orders)</h3>
    ${top.length ? `<table class="rtable"><tr><th>Product</th><th>Sold</th></tr>${top.map(([n, q]) => `<tr><td>${esc(n)}</td><td>${q}</td></tr>`).join("")}</table>` : `<p class="empty">No delivered orders yet.</p>`}
    <h3 style="margin-top:1.5rem">Low stock (2 or fewer)</h3>
    ${low.length ? `<table class="rtable"><tr><th>Product</th><th>Left</th></tr>${low.map((p) => `<tr><td>${esc(p.name)} ${esc(p.size || "")}</td><td>${p.stock}</td></tr>`).join("")}</table>` : `<p class="empty">Nothing is running low.</p>`}`;
}
