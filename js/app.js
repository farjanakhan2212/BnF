import { SHOP, DEMO_MODE } from "./config.js";
import { fetchProducts, createOrder } from "./data.js";
import { esc, money, DISTRICTS, DHAKA_CITY, orderText, newOrderNo, lineTotal, stockLeft, available, imgSrc, placeholderImg } from "./shared.js";

const $ = (s, r = document) => r.querySelector(s);

const state = {
  products: [],
  cart: loadCart(), // { productId: qty }
  category: "all",
  origin: "all",
  q: "",
  loadError: false,
  loaded: false, // products have arrived, so the saved cart can safely be pruned
};

function loadCart() {
  try {
    const c = JSON.parse(localStorage.getItem("bf_cart") || "{}");
    return c && typeof c === "object" ? c : {};
  } catch { return {}; }
}
function saveCart() {
  try { localStorage.setItem("bf_cart", JSON.stringify(state.cart)); } catch { /* private mode */ }
}

/* ---------- Static bits from config ---------- */
$("#tagline").textContent = SHOP.tagline;
$("#fee-inside").textContent = `Delivery charge: ${money(SHOP.deliveryInsideDhaka)}`;
$("#fee-outside").textContent = `Delivery charge: ${money(SHOP.deliveryOutsideDhaka)}`;
$("#courier-name").textContent = SHOP.courier;
$("#foot-address").textContent = SHOP.address;
document.querySelectorAll("[data-messenger]").forEach((a) => (a.href = SHOP.messengerLink));
$("#demo-note").hidden = !DEMO_MODE;

/* ---------- Helpers ---------- */
const byId = (id) => state.products.find((p) => p.id === id);
const visible = () => state.products.filter((p) => p.active !== false);

/* ---------- Filters ---------- */
function renderStamps() {
  const box = $("#stamps");
  box.innerHTML = SHOP.origins
    .map((o) => {
      const n = visible().filter((p) => p.origin === o).length;
      return `<button type="button" class="stamp" data-origin="${esc(o)}" aria-pressed="${state.origin === o}">
        <span class="s-small">Imported from</span>
        <span class="s-name">${esc(o)}</span>
        <span class="s-count">${n} ${n === 1 ? "product" : "products"}</span>
      </button>`;
    })
    .join("");
}
function renderChips() {
  const cats = ["all", ...new Set(visible().map((p) => p.category).filter(Boolean))];
  $("#chips").innerHTML = cats
    .map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${state.category === c}">${c === "all" ? "All" : esc(c)}</button>`)
    .join("");
}

/* ---------- Product grid ---------- */
function renderGrid() {
  const q = state.q.trim().toLowerCase();
  const list = visible()
    .filter((p) => state.category === "all" || p.category === state.category)
    .filter((p) => state.origin === "all" || p.origin === state.origin)
    .filter((p) => !q || `${p.name} ${p.brand}`.toLowerCase().includes(q))
    .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));

  const grid = $("#grid");
  if (state.loadError) {
    grid.innerHTML = `<p class="empty">We could not load products. Check your internet and refresh the page.</p>`;
    return;
  }
  if (!list.length) {
    grid.innerHTML = `<p class="empty">${state.products.length ? "No products match this filter." : "Products are coming soon. Message us on Messenger to order now."}</p>`;
    return;
  }
  grid.innerHTML = list
    .map((p) => {
      const left = stockLeft(p);
      const ok = available(p);
      const deal = p.deal && p.deal.qty > 1 ? `<span class="deal">${p.deal.qty} for ${money(p.deal.price)}</span>` : "";
      return `<article class="item">
        <div class="item-img"><img src="${esc(imgSrc(p))}" alt="${esc(p.name)}" loading="lazy" width="400" height="500" data-ph="${esc(placeholderImg(p))}"></div>
        ${p.origin ? `<p class="item-origin">Imported from ${esc(p.origin)}</p>` : ""}
        <h3>${esc(p.name)}</h3>
        ${p.size ? `<p class="item-size">${esc(p.size)}</p>` : ""}
        <p class="item-desc">${esc(p.description || "")}</p>
        ${ok && left <= 3 ? `<p class="low">Only ${left} left</p>` : ""}
        <div class="item-foot">
          <div><span class="price">${money(p.price)}</span>${deal}</div>
          <button type="button" class="add" data-add="${esc(p.id)}" ${ok ? "" : "disabled"}>${ok ? "Add to cart" : "Out of stock"}</button>
        </div>
      </article>`;
    })
    .join("");
}

/* ---------- Cart ---------- */
function cartLines() {
  const lines = [];
  for (const [id, qty] of Object.entries(state.cart)) {
    const p = byId(id);
    if (!p || !available(p)) continue;
    const q = Math.min(Math.max(1, Math.floor(qty)), stockLeft(p), 20);
    lines.push({ p, qty: q, total: lineTotal(p, q) });
  }
  return lines;
}
const subtotal = (lines) => lines.reduce((s, l) => s + l.total, 0);

function renderCart() {
  const lines = cartLines();
  // drop items that disappeared or sold out
  // (skipped until the products are loaded -- byId() matches nothing before then and
  //  pruning would throw away the cart the customer saved on a previous visit)
  if (state.loaded) {
    const clean = {};
    lines.forEach((l) => (clean[l.p.id] = l.qty));
    state.cart = clean;
    saveCart();
  }

  const count = lines.reduce((s, l) => s + l.qty, 0);
  $("#cart-count").textContent = count;

  const body = $("#cart-body");
  const foot = $("#cart-foot");
  if (!lines.length) {
    body.innerHTML = `<p class="empty">Your cart is empty. Pick a product to start.</p>`;
    foot.innerHTML = "";
    return;
  }
  body.innerHTML = lines
    .map(
      ({ p, qty, total }) => `<div class="line">
      <div class="line-main">
        <img class="line-img" src="${esc(imgSrc(p))}" alt="${esc(p.name)}" loading="lazy" width="56" height="70" data-ph="${esc(placeholderImg(p))}">
        <div>
          <div class="line-name">${esc(p.name)}</div>
          ${p.size ? `<div class="line-size">${esc(p.size)}</div>` : ""}
          <div class="qty">
            <button type="button" data-dec="${esc(p.id)}" aria-label="Decrease quantity of ${esc(p.name)}">&minus;</button>
            <span aria-live="polite">${qty}</span>
            <button type="button" data-inc="${esc(p.id)}" aria-label="Increase quantity of ${esc(p.name)}" ${qty >= stockLeft(p) ? "disabled" : ""}>+</button>
          </div>
        </div>
      </div>
      <div class="line-total">${money(total)}</div>
      <span></span>
      <button type="button" class="rm" data-rm="${esc(p.id)}">Remove</button>
    </div>`
    )
    .join("");
  foot.innerHTML = `
    <div class="row"><span>Subtotal</span><strong>${money(subtotal(lines))}</strong></div>
    <p class="hint">Delivery charge is added at checkout (${money(SHOP.deliveryInsideDhaka)} inside Dhaka City, ${money(SHOP.deliveryOutsideDhaka)} outside).</p>
    <button type="button" class="btn btn-primary btn-block" id="go-checkout">Checkout</button>`;
}

function setQty(id, qty) {
  const p = byId(id);
  if (!p) return;
  qty = Math.min(qty, stockLeft(p), 20);
  if (qty <= 0) delete state.cart[id];
  else state.cart[id] = qty;
  renderCart();
}

const drawer = $("#drawer");
const scrim = $("#scrim");
let lastFocus = null;
function openCart() {
  lastFocus = document.activeElement;
  renderCart();
  scrim.hidden = false;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  drawer.focus();
}
function closeCart() {
  scrim.hidden = true;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  lastFocus?.focus?.();
}

/* ---------- Checkout ---------- */
const dlg = $("#checkout");
const form = $("#order-form");
const districtSel = $("#f-district");
districtSel.innerHTML =
  `<option value="">Choose district</option>` +
  [DHAKA_CITY, ...DISTRICTS].map((d) => `<option>${esc(d)}</option>`).join("");

const zoneOf = () => (districtSel.value === DHAKA_CITY ? "inside" : "outside");

// Pure calculation, safe to call at submit time (does not touch the form).
function computeTotals() {
  const lines = cartLines();
  const sub = subtotal(lines);
  const hasDistrict = !!districtSel.value;
  const zone = zoneOf();
  const delivery = !hasDistrict ? 0 : zone === "inside" ? SHOP.deliveryInsideDhaka : SHOP.deliveryOutsideDhaka;
  return { lines, sub, hasDistrict, zone, delivery, total: sub + delivery };
}

function renderPayAndSum() {
  const t = computeTotals();
  const { lines, sub, hasDistrict, zone, delivery, total } = t;

  const box = $("#pay-box");
  if (!hasDistrict) {
    box.innerHTML = `<h3>Payment</h3><p>Choose your district to see how to pay.</p>`;
  } else if (zone === "inside") {
    box.innerHTML = `<h3>Cash on delivery</h3><p>Pay <span class="big">${money(total)}</span> in cash when your order arrives.</p>`;
  } else {
    box.innerHTML = `<h3>Pay full amount with bKash</h3>
      <p>Send <span class="big">${money(total)}</span> to <strong>${esc(SHOP.bkashNumber)}</strong> (${esc(SHOP.bkashType)}), then enter the details below. We ship by ${esc(SHOP.courier)} after we confirm your payment.</p>
      <div class="field"><label for="f-trx">bKash Transaction ID (TrxID)</label><input id="f-trx" name="trxId" maxlength="30" autocomplete="off" required></div>
      <div class="field"><label for="f-sender">bKash number you paid from</label><input id="f-sender" name="senderNumber" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX" required></div>`;
  }
  $("#order-sum").innerHTML = `
    <div class="row"><span>Subtotal</span><span>${money(sub)}</span></div>
    <div class="row"><span>Delivery</span><span>${hasDistrict ? money(delivery) : "Choose district"}</span></div>
    <div class="row total"><span>Total</span><span>${money(total)}</span></div>`;
  return t;
}

function openCheckout() {
  if (!cartLines().length) return;
  closeCart();
  $("#checkout-form-wrap").hidden = false;
  $("#checkout-done").hidden = true;
  $("#form-error").hidden = true;
  renderPayAndSum();
  dlg.showModal();
}
districtSel.addEventListener("change", renderPayAndSum);

const normPhone = (v) => String(v || "").replace(/[\s-]/g, "").replace(/^\+?88/, "");
const phoneOk = (v) => /^01[3-9]\d{8}$/.test(v);

function fail(msg, el) {
  const e = $("#form-error");
  e.textContent = msg;
  e.hidden = false;
  form.querySelectorAll(".err").forEach((x) => x.classList.remove("err"));
  if (el) { el.classList.add("err"); el.focus(); }
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = $("#place-order");
  const { lines, sub, delivery, total, zone } = computeTotals();
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  const phone = normPhone(fd.get("phone"));
  const district = String(fd.get("district") || "");
  const area = String(fd.get("area") || "").trim();
  const address = String(fd.get("address") || "").trim();
  const note = String(fd.get("note") || "").trim();

  if (!lines.length) return fail("Your cart is empty.");
  if (name.length < 2) return fail("Please enter your full name.", $("#f-name"));
  if (!phoneOk(phone)) return fail("Enter a valid mobile number, like 01712345678.", $("#f-phone"));
  if (!district) return fail("Choose your district.", districtSel);
  if (address.length < 8) return fail("Enter your full address so the courier can find you.", $("#f-address"));

  let bkash = null;
  if (zone === "outside") {
    const trxId = String(fd.get("trxId") || "").trim().toUpperCase();
    const senderNumber = normPhone(fd.get("senderNumber"));
    if (trxId.length < 6) return fail("Enter the bKash TrxID from your payment message.", $("#f-trx"));
    if (!phoneOk(senderNumber)) return fail("Enter the bKash number you paid from.", $("#f-sender"));
    bkash = { trxId, senderNumber };
  }

  // Spam trap: real people never fill this field. Pretend it worked.
  if (fd.get("website")) { dlg.close(); return; }

  const order = {
    orderNo: newOrderNo(),
    status: "pending",
    paymentStatus: "unpaid",
    zone,
    paymentMethod: zone === "inside" ? "cod" : "bkash",
    courier: zone === "outside" ? SHOP.courier : "",
    customer: { name, phone, district, area, address, note },
    items: lines.map(({ p, qty, total: lt }) => ({ id: p.id, name: p.name + (p.size ? ` (${p.size})` : ""), price: p.price, qty, lineTotal: lt })),
    subtotal: sub,
    deliveryCharge: delivery,
    total,
    source: "website",
  };
  if (bkash) order.bkash = bkash;

  btn.disabled = true;
  btn.textContent = "Placing order...";
  try {
    await createOrder(order);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = "Place order";
    return fail("We could not place your order. Check your internet and try again, or message us on Messenger.");
  }
  btn.disabled = false;
  btn.textContent = "Place order";
  state.cart = {};
  saveCart();
  renderCart();
  form.reset();
  showDone(order);
});

function showDone(order) {
  const text = orderText(order);
  $("#checkout-form-wrap").hidden = true;
  const done = $("#checkout-done");
  done.hidden = false;
  done.className = "done";
  done.innerHTML = `
    <h2>Order received</h2>
    <p>Your order number is</p>
    <p class="order-no">${esc(order.orderNo)}</p>
    <p>${
      order.paymentMethod === "cod"
        ? `We will call you to confirm. Keep <strong>${money(order.total)}</strong> ready in cash for delivery.`
        : `We will check your bKash payment and then ship by ${esc(SHOP.courier)}.`
    }</p>
    <p>Send this order to us on Messenger so we can confirm faster:</p>
    <textarea class="copy-box" id="order-text" rows="9" readonly>${esc(text)}</textarea>
    <div class="stack">
      <button type="button" class="btn btn-primary" id="send-messenger">Copy and open Messenger</button>
      <button type="button" class="btn btn-ghost" data-close-checkout>Back to shop</button>
    </div>
    <p class="hint" id="copy-hint" role="status"></p>`;
  $("#send-messenger").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      $("#copy-hint").textContent = "Order copied. Paste it in the Messenger chat and send.";
    } catch {
      $("#order-text").select();
      $("#copy-hint").textContent = "Copy the text above, then paste it in Messenger.";
    }
    window.open(SHOP.messengerLink, "_blank", "noopener");
  });
}

/* ---------- Events ---------- */
// "error" does not bubble, so listen in the capture phase: a stored path that 404s
// falls back to the placeholder instead of showing a broken image icon.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img?.tagName === "IMG" && img.dataset.ph && img.getAttribute("src") !== img.dataset.ph) {
    img.setAttribute("src", img.dataset.ph);
  }
}, true);

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  if (t.dataset.add) { setQty(t.dataset.add, (state.cart[t.dataset.add] || 0) + 1); openCart(); }
  else if (t.dataset.inc) setQty(t.dataset.inc, (state.cart[t.dataset.inc] || 0) + 1);
  else if (t.dataset.dec) setQty(t.dataset.dec, (state.cart[t.dataset.dec] || 0) - 1);
  else if (t.dataset.rm) setQty(t.dataset.rm, 0);
  else if (t.dataset.origin) {
    state.origin = state.origin === t.dataset.origin ? "all" : t.dataset.origin;
    renderStamps(); renderGrid();
    $("#shop").scrollIntoView({ behavior: "smooth" });
  } else if (t.dataset.cat) { state.category = t.dataset.cat; renderChips(); renderGrid(); }
  else if (t.id === "go-checkout") openCheckout();
  else if (t.id === "open-cart") openCart();
  else if (t.id === "close-cart") closeCart();
  else if (t.hasAttribute("data-close-checkout")) dlg.close();
});
scrim.addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeCart(); });
$("#search").addEventListener("input", (e) => { state.q = e.target.value; renderGrid(); });

/* ---------- Boot ---------- */
(async function init() {
  renderStamps(); renderChips(); renderGrid(); renderCart();
  try {
    state.products = await fetchProducts();
  } catch (err) {
    console.error(err);
    state.loadError = true;
  }
  state.loaded = true;
  renderStamps(); renderChips(); renderGrid(); renderCart();
})();
