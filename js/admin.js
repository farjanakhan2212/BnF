import { SHOP, DEMO_MODE } from "./config.js";
import { getFs, getAuthKit } from "./data.js";
import { SEED_PRODUCTS } from "./seed.js";
import { esc, money, fmtDate, toDate, stockLeft, isImagePath } from "./shared.js";

const $ = (s, r = document) => r.querySelector(s);
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENTS = ["unpaid", "paid", "refunded"];
// Stock is taken off when an order is confirmed, and put back if it is later cancelled.
const STOCK_OUT = ["confirmed", "shipped", "delivered"];

const state = { orders: [], products: [], tab: "orders", status: "all", q: "", open: new Set(), dirty: false };
let fsKit, authKit;
let unsubs = [];

/* ---------- Boot ---------- */
(async function init() {
  if (DEMO_MODE) { $("#setup-notice").hidden = false; return; }
  fsKit = await getFs();
  authKit = await getAuthKit();
  authKit.mod.onAuthStateChanged(authKit.auth, onUser);
})();

function onUser(user) {
  unsubs.forEach((u) => u());
  unsubs = [];
  $("#login").hidden = !!user;
  $("#app").hidden = !user;
  if (!user) return;
  $("#who").textContent = user.email || "";
  const { fs, db } = fsKit;
  const onErr = (err) => {
    console.error(err);
    const e = $("#a-error");
    e.hidden = false;
    e.textContent =
      err.code === "permission-denied"
        ? "This account is not allowed to open the admin panel. Check ADMIN_UID in firestore.rules."
        : "Could not load data: " + err.message;
  };
  unsubs.push(
    fs.onSnapshot(fs.query(fs.collection(db, "orders"), fs.orderBy("createdAt", "desc"), fs.limit(500)), (snap) => {
      state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  const err = $("#login-error");
  err.hidden = true;
  try {
    await authKit.mod.signInWithEmailAndPassword(authKit.auth, $("#l-email").value.trim(), $("#l-pass").value);
  } catch {
    err.textContent = "Email or password is wrong.";
    err.hidden = false;
  }
});
$("#logout").addEventListener("click", () => authKit.mod.signOut(authKit.auth));

/* ---------- Tabs ---------- */
document.querySelectorAll("[data-tab]").forEach((b) =>
  b.addEventListener("click", () => {
    state.tab = b.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    render();
  })
);

function render() {
  const active = document.activeElement;
  if (state.tab === "orders" && active && $("#orders-list").contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) {
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
}
document.addEventListener("focusout", () => { if (state.dirty) setTimeout(render, 0); });

/* ---------- Orders ---------- */
$("#o-status").innerHTML =
  `<option value="all">All orders</option>` + STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
$("#o-status").addEventListener("change", (e) => { state.status = e.target.value; render(); });
$("#o-search").addEventListener("input", (e) => { state.q = e.target.value; render(); });

const opts = (list, cur) => list.map((v) => `<option value="${v}" ${v === cur ? "selected" : ""}>${v}</option>`).join("");

function renderOrders() {
  const q = state.q.trim().toLowerCase();
  const list = state.orders
    .filter((o) => state.status === "all" || o.status === state.status)
    .filter((o) => !q || `${o.orderNo} ${o.customer?.name} ${o.customer?.phone}`.toLowerCase().includes(q));
  const box = $("#orders-list");
  if (!list.length) { box.innerHTML = `<p class="empty">No orders here yet.</p>`; return; }
  box.innerHTML = list.map(orderCard).join("");
}

function orderCard(o) {
  const c = o.customer || {};
  const items = (o.items || [])
    .map((i) => `<tr><td>${esc(i.qty)} x ${esc(i.name)}</td><td>${money(i.lineTotal ?? i.price * i.qty)}</td></tr>`)
    .join("");
  const pay = o.paymentMethod === "cod"
    ? "Cash on delivery"
    : `bKash. TrxID <strong>${esc(o.bkash?.trxId || "-")}</strong>, paid from ${esc(o.bkash?.senderNumber || "-")}`;
  return `<details class="order" data-id="${esc(o.id)}" ${state.open.has(o.id) ? "open" : ""}>
    <summary>
      <span><span class="o-no">${esc(o.orderNo)}</span> <span class="pill ${esc(o.status)}">${esc(o.status)}</span><span class="pill ${esc(o.paymentStatus)}">${esc(o.paymentStatus)}</span></span>
      <span class="o-total">${money(o.total)}</span>
      <span class="o-meta">${esc(c.name)}, ${esc(c.district)}</span>
      <span class="o-meta" style="text-align:right">${esc(fmtDate(o.createdAt))}</span>
    </summary>
    <div class="o-body">
      <h4>Customer</h4>
      <p>${esc(c.name)}, <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></p>
      <p>${esc(c.address)}${c.area ? ", " + esc(c.area) : ""}, ${esc(c.district)}</p>
      ${c.note ? `<p><em>Note: ${esc(c.note)}</em></p>` : ""}
      <h4>Items</h4>
      <table class="o-items">${items}
        <tr><td>Delivery (${o.zone === "inside" ? "inside Dhaka" : "outside Dhaka"})</td><td>${money(o.deliveryCharge)}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${money(o.total)}</strong></td></tr>
      </table>
      <h4>Payment</h4>
      <p>${pay}</p>
      <div class="o-ctl">
        <div><label>Order status</label><select name="status">${opts(STATUSES, o.status)}</select></div>
        <div><label>Payment status</label><select name="paymentStatus">${opts(PAYMENTS, o.paymentStatus)}</select></div>
        <div><label>${esc(o.courier || SHOP.courier)} tracking / memo no.</label><input name="trackingNo" maxlength="60" value="${esc(o.trackingNo || "")}"></div>
        <div class="wide"><label>Private note (customer cannot see)</label><textarea name="adminNote" rows="2" maxlength="500">${esc(o.adminNote || "")}</textarea></div>
      </div>
      <div class="o-actions">
        <button type="button" class="btn btn-primary" data-save-order="${esc(o.id)}">Save changes</button>
        <button type="button" class="btn btn-ghost" data-print="${esc(o.id)}">Print slip</button>
      </div>
      <p class="o-meta" data-msg="${esc(o.id)}" role="status"></p>
    </div>
  </details>`;
}

async function saveOrder(id) {
  const o = state.orders.find((x) => x.id === id);
  const card = document.querySelector(`.order[data-id="${CSS.escape(id)}"]`);
  const msg = card.querySelector("[data-msg]");
  const { fs, db } = fsKit;
  const status = card.querySelector("[name=status]").value;
  const update = {
    status,
    paymentStatus: card.querySelector("[name=paymentStatus]").value,
    trackingNo: card.querySelector("[name=trackingNo]").value.trim(),
    adminNote: card.querySelector("[name=adminNote]").value.trim(),
    updatedAt: fs.serverTimestamp(),
  };
  const batch = fs.writeBatch(db);
  const shouldTake = STOCK_OUT.includes(status);
  if (shouldTake !== !!o.stockAdjusted) {
    for (const it of o.items || []) {
      const p = state.products.find((x) => x.id === it.id);
      if (p && typeof p.stock === "number") {
        batch.update(fs.doc(db, "products", p.id), { stock: fs.increment(shouldTake ? -it.qty : it.qty) });
      }
    }
    update.stockAdjusted = shouldTake;
  }
  batch.update(fs.doc(db, "orders", id), update);
  msg.textContent = "Saving...";
  try {
    await batch.commit();
    msg.textContent = "Saved.";
  } catch (err) {
    console.error(err);
    msg.textContent = "Could not save: " + err.message;
  }
}

function printSlip(id) {
  const o = state.orders.find((x) => x.id === id);
  const c = o.customer || {};
  const w = window.open("", "_blank", "width=480,height=720");
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
});
document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (d.matches?.(".order")) d.open ? state.open.add(d.dataset.id) : state.open.delete(d.dataset.id);
}, true);

/* ---------- CSV backup ---------- */
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return '"' + s.replace(/"/g, '""') + '"';
};
$("#export-csv").addEventListener("click", () => {
  const head = ["Order no", "Date", "Status", "Payment status", "Name", "Phone", "District", "Area", "Address", "Zone", "Payment", "bKash TrxID", "Items", "Subtotal", "Delivery", "Total", "Tracking", "Note"];
  const rows = state.orders.map((o) => {
    const c = o.customer || {};
    return [o.orderNo, fmtDate(o.createdAt), o.status, o.paymentStatus, c.name, c.phone, c.district, c.area, c.address, o.zone, o.paymentMethod, o.bkash?.trxId, (o.items || []).map((i) => `${i.qty} x ${i.name}`).join("; "), o.subtotal, o.deliveryCharge, o.total, o.trackingNo, o.adminNote];
  });
  const csv = "\uFEFF" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- Products ---------- */
const pform = $("#product-form");
const pf = (id) => $("#p-" + id);

function fillOrigins(cur) {
  const list = [...new Set(["", ...SHOP.origins, cur || ""])];
  pf("origin").innerHTML = list.map((o) => `<option value="${esc(o)}">${o || "Not specified"}</option>`).join("");
  pf("origin").value = cur || "";
}

function renderProducts() {
  $("#seed-products").hidden = state.products.length > 0;
  const box = $("#products-list");
  if (!state.products.length) {
    box.innerHTML = `<p class="empty">No products yet. Use "Load starter products" to add your current list, then fix prices and stock.</p>`;
    return;
  }
  box.innerHTML = [...state.products]
    .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999))
    .map((p) => {
      const left = stockLeft(p);
      return `<div class="prow ${p.active === false ? "off" : ""}">
        <div>
          <div class="p-name">${esc(p.name)} ${p.size ? `(${esc(p.size)})` : ""}</div>
          <div class="p-meta">${money(p.price)}${p.deal ? `, ${esc(p.deal.qty)} for ${money(p.deal.price)}` : ""} | Stock: ${left === Infinity ? "not tracked" : left} ${p.expiry ? `| Exp: ${esc(p.expiry)}` : ""} | ${p.active === false ? "Hidden" : "Visible"}</div>
        </div>
        <div><button type="button" data-edit="${esc(p.id)}">Edit</button> <button type="button" data-toggle="${esc(p.id)}">${p.active === false ? "Show" : "Hide"}</button></div>
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
  pf("dealqty").value = p?.deal?.qty || "";
  pf("dealprice").value = p?.deal?.price || "";
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
  await fs.updateDoc(fs.doc(db, "products", id), { active: p.active === false });
}

pform.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { fs, db } = fsKit;
  const err = $("#p-error");
  const num = (v) => (v === "" ? null : Number(v));
  const price = num(pf("price").value);
  if (!pf("name").value.trim() || price === null || price < 0) {
    err.textContent = "Enter a product name and a price.";
    err.hidden = false;
    return;
  }
  const image = pf("image").value.trim();
  if (!isImagePath(image)) {
    err.textContent = "Image path must be a relative path (images/product.jpg) or a full https:// link.";
    err.hidden = false;
    return;
  }
  const dq = num(pf("dealqty").value), dp = num(pf("dealprice").value);
  const data = {
    name: pf("name").value.trim(),
    brand: pf("brand").value.trim(),
    size: pf("size").value.trim(),
    category: pf("category").value,
    origin: pf("origin").value,
    price,
    deal: dq && dp ? { qty: dq, price: dp } : null,
    stock: num(pf("stock").value),
    expiry: pf("expiry").value.trim(),
    image,
    description: pf("desc").value.trim(),
    sort: num(pf("sort").value) ?? 999,
    active: pf("active").checked,
  };
  try {
    const id = pf("id").value;
    if (id) await fs.setDoc(fs.doc(db, "products", id), data, { merge: true });
    else await fs.addDoc(fs.collection(db, "products"), data);
    pform.hidden = true;
  } catch (ex) {
    err.textContent = "Could not save: " + ex.message;
    err.hidden = false;
  }
});

$("#seed-products").addEventListener("click", async () => {
  const { fs, db } = fsKit;
  const batch = fs.writeBatch(db);
  SEED_PRODUCTS.forEach(({ id, ...p }) => batch.set(fs.doc(db, "products", id), p));
  await batch.commit();
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
