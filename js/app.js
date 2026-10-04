import { SHOP, DEMO_MODE, LIMITS } from "./config.js";
import { fetchProducts, createOrder } from "./data.js";
import {
  esc, money, DISTRICTS, DHAKA_CITY, orderText, newOrderNo, lineTotal, stockLeft, available,
  imgSrc, placeholderImg, normPhone, phoneOk, trxOk, orderProblems, orderItem, dealOf,
} from "./shared.js";

const $ = (s, r = document) => r.querySelector(s);

const state = {
  products: [],
  cart: loadCart(), // { productId: qty }
  category: "all",
  origin: "all",
  q: "",
  loadError: false,
  loaded: false, // products have arrived, so the saved cart can safely be pruned
  cartMsg: "",   // short note shown in the cart, e.g. the per order item limit
  placing: false,
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
      const d = dealOf(p);
      const deal = d ? `<span class="deal">${esc(d.qty)} for ${money(d.price)}</span>` : "";
      const expiryHtml = p.expiry ? `<p class="item-expiry">Expiry: ${esc(p.expiry)}</p>` : "";
      return `<article class="item">
        <div class="item-img"><img src="${esc(imgSrc(p))}" alt="${esc(p.name)}" loading="lazy" width="400" height="500" data-ph="${esc(placeholderImg(p))}"></div>
        ${p.origin ? `<p class="item-origin">Imported from ${esc(p.origin)}</p>` : ""}
        <h3>${esc(p.name)}</h3>
        ${p.size ? `<p class="item-size">${esc(p.size)}</p>` : ""}
        ${expiryHtml}
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
    const q = Math.min(Math.max(1, Math.floor(qty)), stockLeft(p), LIMITS.maxQtyPerItem);
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
    ${state.cartMsg ? `<p class="form-error" role="alert">${esc(state.cartMsg)}</p>` : ""}
    <button type="button" class="btn btn-primary btn-block" id="go-checkout">Checkout</button>`;
}

// Returns false when the change was refused (so the caller can leave a note).
function setQty(id, qty) {
  const p = byId(id);
  if (!p) return false;
  state.cartMsg = "";
  const isNew = !(id in state.cart);
  if (isNew && qty > 0 && Object.keys(state.cart).length >= LIMITS.maxCartItems) {
    state.cartMsg = `One order can hold ${LIMITS.maxCartItems} different products. Remove one to add another.`;
    renderCart();
    return false;
  }
  qty = Math.min(qty, stockLeft(p), LIMITS.maxQtyPerItem);
  if (qty <= 0) delete state.cart[id];
  else state.cart[id] = qty;
  renderCart();
  return true;
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
      <div class="field"><label for="f-sender">bKash number you paid from</label><input id="f-sender" name="senderNumber" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX" maxlength="14" required></div>`;
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
  fallbackSaved = null;         // a new checkout attempt gets its own order number
  hideFallback();
  renderPayAndSum();
  openDialog();
}
districtSel.addEventListener("change", renderPayAndSum);

// Older mobile browsers have no <dialog>.showModal(), so fall back to the
// open attribute instead of throwing and leaving no way to check out.
function openDialog() {
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
}

function fail(msg, el) {
  const e = $("#form-error");
  e.textContent = msg;
  e.hidden = false;
  form.querySelectorAll(".err").forEach((x) => x.classList.remove("err"));
  if (el) { el.classList.add("err"); el.focus(); }
  return false;
}

// Re-read the products before writing, so an item that sold out while the page
// was open is caught instead of being ordered anyway.
async function refreshProducts() {
  try {
    state.products = await fetchProducts();
    state.loaded = true;
    state.loadError = false;
    return true;
  } catch (err) {
    console.warn("Product refresh failed, using the last known list.", err);
    return false;
  }
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (state.placing) return;
  const btn = $("#place-order");
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  const phone = normPhone(fd.get("phone"));
  const district = String(fd.get("district") || "");
  const area = String(fd.get("area") || "").trim();
  const address = String(fd.get("address") || "").trim();
  const note = String(fd.get("note") || "").trim();

  // Spam trap: real people never fill this field. Pretend it worked.
  if (fd.get("website")) { closeDialog(); return; }

  if (name.length < 2 || name.length > LIMITS.maxName)
    return fail("Please enter your full name.", $("#f-name"));
  if (!phoneOk(phone))
    return fail("Enter a valid mobile number, like 01712345678.", $("#f-phone"));
  if (!district) return fail("Choose your district.", districtSel);
  if (area.length > LIMITS.maxArea) return fail("Thana / Upazila is too long.", $("#f-area"));
  if (address.length < 8 || address.length > LIMITS.maxAddress)
    return fail("Enter your full address so the courier can find you.", $("#f-address"));
  if (note.length > LIMITS.maxNote) return fail("The note is too long.", $("#f-note"));

  state.placing = true;
  btn.disabled = true;
  btn.textContent = "Checking stock...";
  await refreshProducts();

  // Recalculated from the fresh product list, never from what was typed.
  const { lines, sub, delivery, total, zone } = computeTotals();

  if (!lines.length) {
    state.placing = false;
    btn.disabled = false;
    btn.textContent = "Place order";
    renderGrid();
    renderCart();
    return fail("Your cart is empty now. Please pick your products again.");
  }
  for (const { p, qty } of lines) {
    if (!available(p) || stockLeft(p) < qty) {
      state.placing = false;
      btn.disabled = false;
      btn.textContent = "Place order";
      renderGrid();
      renderCart();
      return fail(`${p.name} is out of stock now. Please update your cart.`);
    }
  }

  let bkash = null;
  if (zone === "outside") {
    const trxId = String(fd.get("trxId") || "").trim().toUpperCase();
    const senderNumber = normPhone(fd.get("senderNumber"));
    if (!trxOk(trxId)) return stopPlacing(btn, "Enter the bKash TrxID from your payment message.", "#f-trx");
    if (!phoneOk(senderNumber)) return stopPlacing(btn, "Enter the bKash number you paid from.", "#f-sender");
    bkash = { trxId, senderNumber };
  }

  const order = {
    orderNo: newOrderNo(),
    status: "pending",
    paymentStatus: "unpaid",
    zone,
    paymentMethod: zone === "inside" ? "cod" : "bkash",
    courier: zone === "outside" ? SHOP.courier : "",
    customer: { name, phone, district, area, address, note },
    // Every item copies the price and the bundle deal in, so this order stays
    // correct even if the product price is changed or the product is deleted.
    items: lines.map(({ p, qty }) => orderItem(p, qty)),
    subtotal: sub,
    deliveryCharge: delivery,
    total,
    source: "website",
  };
  if (bkash) order.bkash = bkash;

  // Same checks firestore.rules runs, so the customer sees a sentence and not a
  // permission error. See shared.js orderProblems().
  const problems = orderProblems(order);
  if (problems.length) {
    console.warn("Order rejected by the local check:", problems);
    return stopPlacing(btn, "Something in the order is not right. Please check your details and try again.");
  }

  btn.textContent = "Placing order...";
  let saved;
  try {
    saved = await createOrder(order);
  } catch (err) {
    console.error("Order could not be saved:", err);
    // Nothing is lost: the cart, the totals and every form field stay exactly as
    // they are, so the customer can send the same order to us on Messenger.
    hideFallback();
    showMessengerFallback(order);
    return stopPlacing(btn, err?.code === "invalid-order"
      ? "Something in the order is not right. Please check your details and try again."
      : "Your order could not be submitted automatically. You can still place your order through Messenger.");
  }

  state.placing = false;
  btn.disabled = false;
  btn.textContent = "Place order";
  state.cart = {};
  state.cartMsg = "";
  saveCart();
  renderCart();
  form.reset();
  hideFallback();
  showDone(saved || order);
});

function stopPlacing(btn, msg, field) {
  state.placing = false;
  btn.disabled = false;
  btn.textContent = "Place order";
  return fail(msg, field ? $(field) : null);
}

/* ---------- Messenger fallback ---------- */
// Used only when Firestore refuses the order. The checkout form, the cart and
// the totals are all left untouched, so this only adds a way to finish the
// order by hand.
const fallbackBox = () => $("#checkout-fallback");

function hideFallback() {
  const box = fallbackBox();
  if (box) { box.hidden = true; box.innerHTML = ""; }
}

// The message the customer sends us. Every value comes from the live cart and
// the live form, so it always matches what is shown on the checkout page.
// The Order ID is the one that was actually written to Firestore.
function fallbackText(o) {
  const items = o.items.map((i, n) =>
    `${n + 1}. ${i.name} × ${i.qty} — ${money(i.lineTotal ?? i.price * i.qty)}`);
  return [
    "BnF Order Request",
    "",
    `Order ID: ${o.orderNo}`,
    "",
    "Order Items:",
    ...items,
    "",
    `Subtotal: ${money(o.subtotal)}`,
    `Delivery: ${money(o.deliveryCharge)}`,
    `Total: ${money(o.total)}`,
    "",
    "Customer Information:",
    `Name: ${o.customer.name}`,
    `Mobile: ${o.customer.phone}`,
    `District: ${o.customer.district}`,
    `Thana / Upazila: ${o.customer.area || "-"}`,
    `Full Address: ${o.customer.address}`,
    ...(o.customer.note ? [`Note: ${o.customer.note}`] : []),
    "",
    o.paymentMethod === "cod"
      ? "Payment Method: Cash on Delivery"
      : `Payment Method: bKash (TrxID ${o.bkash?.trxId || "-"}, from ${o.bkash?.senderNumber || "-"})`,
    "",
    "Please confirm my order.",
  ].join("\n");
}

// The order that has ALREADY been written for the current checkout attempt, so
// every retry reuses the very same order number. A visitor cannot read orders
// (firestore.rules allows reads for the admin only), so this saved reference is
// what stops a second click from creating a duplicate document.
let fallbackSaved = null;

function showMessengerFallback(order) {
  const box = fallbackBox();
  if (!box) return;
  box.hidden = false;
  box.className = "done";
  box.innerHTML = `
    <h2>Your order could not be submitted automatically.</h2>
    <p>Send the order to us on Messenger and we will confirm it for you.</p>
    <div class="stack">
      <button type="button" class="btn btn-primary" id="fallback-send">Copy &amp; Open Messenger</button>
      <button type="button" class="btn btn-ghost" data-close-checkout>Back to Website</button>
    </div>
    <p class="hint" id="fallback-hint" role="status"></p>`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const btn = $("#fallback-send");
  const hint = $("#fallback-hint");
  const label = "Copy & Open Messenger";

  btn.addEventListener("click", async () => {
    if (btn.disabled) return;                       // one run at a time
    btn.disabled = true;
    btn.textContent = "Saving your order...";
    hint.textContent = "";

    // 1. Record the order first, so the admin panel receives it as "pending".
    //    Same createOrder(), same validation, same firestore.rules as the
    //    normal checkout. Messenger itself can never write to Firestore.
    //    keepNo keeps this checkout attempt's order number for every retry, so a
    //    second click can only reuse the order that already exists.
    let saved = fallbackSaved || order;
    if (!fallbackSaved) {
      try {
        saved = await createOrder(order, { keepNo: true });
        fallbackSaved = saved;
      } catch (err) {
        if (err?.code === "order-exists") {
          // Already stored under this number: reuse it, never write it twice.
          saved = order;
          fallbackSaved = order;
        } else {
          console.error("Fallback order could not be saved:", err);
          btn.disabled = false;
          btn.textContent = label;
          hint.textContent = "Your order details could not be saved automatically. Please try again.";
          return;                                    // never pretend it was saved
        }
      }
    }

    // 2. Copy the details, then 3. open Messenger. The copied message carries the
    //    same order number that Firestore stored.
    const text = fallbackText(saved);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      hint.textContent = "Could not copy the order details automatically. Please try again.";
    }
    btn.disabled = false;
    btn.textContent = label;
    // Only open Messenger once the details really are on the clipboard. This
    // tab, with the cart and the form still filled in, stays open behind it.
    if (!copied) return;
    hint.textContent = `Order saved. Your Order ID is ${saved.orderNo} — please keep it for future reference. `
      + "Paste the details into the Messenger chat and send.";
    window.open(SHOP.messengerLink, "_blank", "noopener");
  });
}

function showDone(order) {
  // `order` is what createOrder() actually wrote, so this Order ID is the
  // Firestore document id and the orderNo field, not a display-only number.
  const text = orderText(order);
  $("#checkout-form-wrap").hidden = true;
  const done = $("#checkout-done");
  done.hidden = false;
  done.className = "done";
  done.innerHTML = `
    <h2>Order placed successfully!</h2>
    <p>Your Order ID is</p>
    <p class="order-no">${esc(order.orderNo)}</p>
    <p>Please keep this Order ID for future reference.</p>
    <p>${
      order.paymentMethod === "cod"
        ? `We will send you a confirmation message through Messenger. Keep <strong>${money(order.total)}</strong> ready in cash for delivery.`
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

function closeDialog() {
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
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
  else if (t.hasAttribute("data-close-checkout")) closeDialog();
});
scrim.addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeCart(); });
$("#search").addEventListener("input", (e) => { state.q = e.target.value; renderGrid(); });

// Nothing should ever leave a silent promise rejection behind on the page.
window.addEventListener("unhandledrejection", (e) => {
  console.warn("Unhandled promise rejection:", e.reason);
});

/* ---------- Boot ---------- */
(async function init() {
  renderStamps(); renderChips(); renderGrid(); renderCart();
  if (!(await refreshProducts())) state.loadError = true;
  renderStamps(); renderChips(); renderGrid(); renderCart();
})();
