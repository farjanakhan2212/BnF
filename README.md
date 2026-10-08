# Beauty n Fashion by Shimu Khan: Online Shop

Live site: <https://farjanakhan2212.github.io/BnF/>

HTML + CSS + JavaScript website. Customer order dey, apni admin panel theke shob dekhen.
Hosting: GitHub Pages (free). Database: Firebase (free tier).

## Ki ki ache

| File | Kaj |
|---|---|
| `index.html` | Customer shop (product, cart, checkout) |
| `admin.html` | Apnar admin panel (login lagbe) |
| `js/config.js` | **Prothome eta edit korben**: Firebase config, bKash number, Messenger link, delivery charge, admin UID, limits |
| `js/data.js` | Firebase shesh initialize kore, oita theke shob Firestore/Auth access |
| `js/shared.js` | Common helper: giya chalanor hisab, phone/bKash check, order number, order text |
| `js/app.js` | Customer shop er logic (cart, checkout, order pathano) |
| `js/admin.js` | Admin panel er logic (order, stock, product, report, CSV) |
| `js/seed.js` | Apnar current product list (price, stock, expiry) |
| `firestore.rules` | Security rules |
| `css/style.css`, `css/admin.css` | Design |
| `images/` | Logo ar product er chhobi |

> `js/firebase.js` ekhon shudhu comment er file. Firebase shesh initialize hoy `js/data.js` e,
> tai ek jaygay ektai Firebase chole. Ei file delete o kora jay.

## Product fields (jeno ta Firestore e ache)

Products collection e **flat** field gulo use hoy. Kono nested `deal` object nai.

| Field | Type | Noyto bujhi |
|---|---|---|
| `id` | text | Document ID. E.g. `kojiesan-soap-135`. Chokh, `_`, `-` soho lowercase/normal letter |
| `name` | text | Product er naam |
| `brand` | text | Kojie San, Silka, RDL ... |
| `category` | text | `Skin care` / `Hair care` / `Other` |
| `origin` | text | `Philippines`, `Thailand` ... (khali o cholbe) |
| `size` | text | `135g`, `250ml` |
| `price` | number | **Ek piece er normal daam** (poora taka) |
| `deal_qty` | number | Bundle e koto piece lagbe. `0` ba missing = **kono bundle nai** |
| `deal_price` | number | `deal_qty` piece er **total** daam (poora taka) |
| `stock` | number | Koto piece baki. Khali/`null` mane tracking nai (shobshomoy available) |
| `expiry` | text | Shudhu admin dekhay, customer dekhay na |
| `image` | text | `images/products/x.jpg` ba `https://...` |
| `description` | text | Packer upor thaka |
| `active` | bool | `false` mane website e dekhay na |
| `sort` | number | Choto number age dekhay |

### Bundle deal kibhabe calculate hoy

`deal_price` mane **poora bundle er daam**, ghono daam na. Tai
`quantity × deal_price` kora **galat**.

Formula:

```
complete bundle gulo x deal_price  +  baki piece x price
```

Example — Kojie San 135g: `price = 500`, `deal_qty = 2`, `deal_price = 950`

| Quantity | Math | Subtotal |
|---|---|---|
| 1 | 0 bundle x 950 + 1 x 500 | ৳500 |
| 2 | 1 x 950 | ৳950 |
| 3 | 1 x 950 + 1 x 500 | ৳1450 |
| 4 | 2 x 950 | ৳1900 |
| 5 | 2 x 950 + 1 x 500 | ৳2400 |
| 6 | 3 x 950 | ৳2850 |

Bundle na thakle (`deal_qty`/`deal_price` missing, khali, `0` ba null) —
normal `price × quantity`. `deal_qty = 1` keu bundle na.

Kaj kora jay: `js/shared.js` er `lineTotal()`, `dealOf()`, `snapshotLineTotal()`.
Shob jaygay eki function, tai cart, checkout, order ar Firestore rules ek jaisi.

### Order item e ki ki thake

Protita order item nijer price copy kore rakhe, tai **product er daag porer bodlay
geleo purono order thik thik thake**:

| Field | Type | Ki |
|---|---|---|
| `id` | text | Product ID |
| `name` | text | `Nao (size)` |
| `price` | number | Jog-e daam (order er somoy) |
| `qty` | number | Koto piece |
| `dealQty` | number | Order er somoy `deal_qty`, na deal = `0` |
| `dealPrice` | number | Order er somoy `deal_price`, na deal = `0` |
| `lineTotal` | number | Ei item er total |

`dealQty`/`dealPrice` product er `deal_qty`/`deal_price` theke copy hoy. Order
document e onno field camelCase (`lineTotal`), product e snake_case
(`deal_qty`) — duita alada jinis.

## Business rules

| | Inside Dhaka City | Outside Dhaka |
|---|---|---|
| District | `Dhaka City` | Onno kono district |
| Payment | Cash on delivery | Full bKash (TrxID dewa lagbe) |
| Delivery charge | ৳80 | ৳150 |
| Courier | - | Sundarban Courier |


- Customer order er por Messenger e order text pathate pare, ar order admin panel eo ashe
- Order **delete kora jay na**. Shudhu status change hoy (cancelled, delivered), tai history thake
- Admin panel theke **Orders** tab e **"Download CSV backup"** button e shob order Excel/Sheets e nite paren

## MANUAL FIREBASE CONSOLE ACTION REQUIRED

Ei gulo gulo kaj apnar Firebase account e korte hobe. Ami (AI) kono Firebase Console
e login kore kono setting change korte parbo na, tai eta apnakei korte hobe.

### 1. Firebase project
1. **Add project** (naam: `beautyfashion-shop`).
   Google Analytics lagbe na.
2. **Build > Firestore Database > Create database** (production mode, location: `asia-south1`).
3. **Build > Authentication > Get started > Sign-in method > Email/Password > Enable**.
4. **Users tab > Add user**: apnar admin email ar ekta shokto password dien. Tarpor oi user er
   **User UID** copy korun. Eta `js/config.js` er `ADMIN_UID` ar `firestore.rules` er UID
   er sathe exactly match korte hobe.
5. **Project settings (gear) > Your apps > Web (`</>`)**: app register korun. `firebaseConfig`
   er value gulo `js/config.js` e boshan.

### 2. Config
- `js/config.js` e `firebaseConfig` e oi value gulo boshan (eta shudhu public web config,
  eta GitHub e commit kora thik, kono secret na).
- `ADMIN_UID` e Step 1.4 er UID boshan.
- `bkashNumber` e apnar bKash number dien.
- `messengerLink` e apnar page link dien (Facebook page > About e username paben).
- `DEMO_MODE` apne-i kaj kore: jodi `firebaseConfig.apiKey` `YOUR_` diye shuru hoy, tahole
  demo mode chole (product `js/seed.js` theke, order browser er localStorage e). Asol
  config boshale live mode chole.

### 3. Security rules
- Firebase > Firestore Database > **Rules** tab e `firestore.rules` file er puro content
  paste kore **Publish** korun.
- Eta na korle customer order pathate parbe na, ar admin panel o kaj korbe na.
- Rules e delivery charge (80/150) ar admin UID hardcoded. Code e charge change korle
  rules e o change korte hobe, naivabe customer rules dhorte parbe na.

### 4. GitHub Pages
1. Ei repository already GitHub Pages e ache: <https://farjanakhan2212.github.io/BnF/>
2. Code push korle site nije nije update hoy. Settings > Pages > Source:
   **Deploy from a branch > main / (root)**.
3. Firebase > Authentication > **Settings > Authorized domains** e
   `farjanakhan2212.github.io` add korun (admin login er jonno lagbe).

### 5. Prothom bar admin
1. <https://farjanakhan2212.github.io/BnF/admin.html> e login korun.
2. **Products > Load starter products** click korun. Tahole apnar list ashbe.
   (Button collection khali thaklei dekhay. Starter product er doc ID fixed, tai 2 bar click
   korleo duplicate ashe na.)
3. Price/stock/image thik kore nin. Je product er price `0`, seta hidden ache, price dile
   "Show" korun.

## Stock kibhabe kaj kore

- Product e **Stock** number dile website oi number porjonto bikri hobe. 0 hole "Out of
  stock" dekhay, ar cart e add kora jay na.
- Customer order dey, tab stock **kome na**. Stock komay **admin panel theke order
  Confirmed/Shipped/Delivered korar shomoy**.
- Eta ekta Firestore **transaction** e hoy: order porjonto abar check kore, tarpor
  product er stock update kore. Tai 2 jinish ekshathe hole (2 admin ekshathe save kore,
  ba network issue) stock duibar kombe na.
- Order **Cancelled** korle stock ekbar ferot ashe. Phir Confirmed korle ekbar kome.
- Stock khali rakhle website stock gune na (shobshomoy available).
- **Expiry** field shudhu apni dekhen, customer dekhe na. Low stock Reports e dekhabe.
- Seed e Kojie soap 135g er stock **6** dhorechi (3 packet x 2ta). Ta thik na hole admin e
  theek korun.
- Old order e `stockAdjusted` field na thakle, admin panel seta status theke bujhe nibo.

## CSV backup kibhabe kaj kore

- **Firestore-i primary database.** GitHub Pages ekta static host, tai server e kono
  file e order/CSV *likha* hoy na.
- Admin panel > **Orders** tab e search box er pashei **"Download CSV backup"** button
  click korle browser shob order Firestore theke pore, ekta CSV file download kore
  (Bangla text thik thakte UTF-8 BOM thake).
- CSV e ache: order no, date, status, payment status, zone, name, phone, district, area,
  address, item detail, subtotal, delivery, total, payment method, bKash TrxID, bKash
  sender number, courier, tracking, customer note, admin note.
- Cell e comma/quote/newline thakle handle hoy. Formula diye shuru howa value (`=`, `+`,
  `-`, `@`) thakle apnake safe kore (Excel e formula chalanor jonno).
- Noyto order 5000 porjonto ashe. Beshi thakle message ashe.
- Recommendation: hafte ekbar download kore phone/Google Drive e rakho, tai Firebase
  config bhul holeo order haaj hoye jabe.

## Nirapotta (security)

- **Admin UID** (`firestore.rules` e exact ekta UID): Shudhu ei UID admin panel e dhukte
  parbe. Onno kono login korle panel dekhay na, auto logout hoy.
- Admin password JavaScript e nai. Login Firebase Authentication diye, ar data access
  `firestore.rules` diye atkano.
- **Customer sudhu order create korte pare.** Customer onno customer er order **dekhte
  parbe na** (list na, single order na), update ba delete o parbe na.
- **Order delete kora jay na** niye rules. Tai history kono bhabe hajati noy.
- Order e pathano **dam rules check kore**:
  - Protita item er `id`, `name`, `price`, `qty`, `dealQty`, `dealPrice` Firestore er
    **live product document** er sathe milaiye check hoy. Customer nijer kachhe price
    kome pathate parbe na, ar nijer kachhe fake bundle (`2 for 100`) banate parbe na.
  - Protita item er `lineTotal` o nijer price/qty/deal theke milano hoy, tai
    "2 for 950" bundle o thik thik verify hoy (2 piece = 950, 3 = 1450, 4 = 1900).
  - `total = subtotal + delivery` rules check kore, ar delivery charge zone anuyai (80/150)
    hoy. Customer "delivery 1" pathate parbe na.
  - Inside/outside payment rule: inside = `cod`, bKash field thakte **parbe na**; outside =
    `bkash` + TrxID + sender number, courier dewa lagbe.
  - Name, phone (`01XXXXXXXXX` format), district, address, note — length ar type check hoy.
  - `createdAt` Firebase er nijer timestamp hote hobe (`request.time`), tai fake date
    pathano jay na.
  - Order number format `BF260330-AB12` style, ar order number document ID er satue match
    korte hobe.
- Admin order update e customer name, phone, address, item, price, subtotal, delivery,
  total **change kora jay na** — shudhu status, payment status, tracking no, admin note
  change kora jay.
- Customer er likha shob text escape kora hoy, tai fake script chalanora jay na. Admin panel
  e text baki shob jaygay escape hoy.
- Spam thekate form e hidden honeypot ache. Beshi spam ashle Firebase **App Check**
  (reCAPTCHA) chalu korun.
- `admin.html` ke shudhu nijer account diye use korun. Public link sab loge kora jay, kintu
  login chara kono data dekha jay na.
- Firebase free tier e shuru korle khoroch lage na. Order beshi hole Firebase usage page e
  dekhe nin.

## Ja ekhono nai (pore add kora jay) — jani-i limitation

- **Automatic bKash/SSLCommerz payment** nai. Bkash niye customer nije kore, TrxID pathay,
  apni verify kore "Payment status = Paid" kore din. Real auto payment er jonno alada
  backend lagbe.
- **Server e order ar product er full list-i verify** hobe na. Firestore Rules single
  document write e **max 10 document** porjonto `get()` allow kore, tai ek order e
  **10 tar beshi** alada product rakha jay na. `subtotal` ar `total` rules e tainponno
  hisabe verify kora jay na — kintu **live product price, live deal_qty/deal_price,
  protita item er lineTotal, ar total = subtotal + delivery** rules check kore, ar
  customer UI o live product theke calculate kore. Website-r mulSomoy stock-o live check
  hoy, tai price/shipping dhorte parbe na.
- **Firestore Rules e field na thakle error hoy** — seta poora request reject kore
  (`PERMISSION_DENIED`). Tai optional field gulo `get('field', default')` diye
  porechi. Eta na kore bug korle poora order fail hoy.
- Customer order tracking page nai (customer login o nai, tai order dekhar backend
  banate hobe).
- Coupon / discount code nai.
- Stock Firestore Rules theke trigger hoy na (Rules e write trigger nai). Ei jonno admin
  transaction; tai keu rule bypass korle stock chinte parbe, kintu rules admin UID theke
  eshechilo na.
- Firestore e ek shoptaher beshi purono order theke next e automatic delete hoy na.

## Testing (nigon kore try kora uchit)

### Checkout
- [ ] Cart e product add/remove/qty badano kaj kore
- [ ] Kojie San 135g er card e **"2 for 950"** dekhay (deal_qty 2, deal_price 950)
- [ ] Qty 1 = ৳500, 2 = ৳950, 3 = ৳1450, 4 = ৳1900, 5 = ৳2400
- [ ] Kojie San 100g (bundle nai) qty 3 = ৳1200
- [ ] Stock 0 er product add kora jay na
- [ ] Invalid phone (`12345`) error dey
- [ ] Inside Dhaka = `Dhaka City` + COD + ৳80 (bKash field ashe na)
- [ ] Outside Dhaka = bKash TrxID + sender number + ৳150
- [ ] 10 tar beshi alada product cart e add kora jay na
- [ ] Valid order korle order no (BF...) confirmation screen e ashe, cart khali hoy
- [ ] Confirmation screen e **Copy Order** ar **Open Messenger** kaj kore
- [ ] Invalid order hole success screen dekhay **na**, ekta asol error message dekhay

### Admin
- [ ] Non-admin email diye login korle panel dekhay na + logout hoy
- [ ] Order Confirmed korle stock ekbar kome
- [ ] Same order abar Confirmed korle stock ar kome na
- [ ] Cancelled korle stock ekbar ferot ashe
- [ ] Invalid phone/email login error dey
- [ ] Products > Load starter products duplicate banay na
- [ ] "Download CSV backup" button file download hoy, Bangla thik thik dekhay

### Rules (Firestore > Rules tab e try kora uchit)
- [ ] Normal ekta order save hoy (permission-denied ashle rules debug korte hobe)
- [ ] Devtools console e Firestore SDK diye onno customer er order `get()` kora jay na
- [ ] Order document delete kora jay na
- [ ] Customer `deliveryCharge` 80 → 1 korle write fail hoy
- [ ] Customer `total` bodlale write fail hoy
- [ ] Customer nijer kachhe price kome (500 → 1) pathale write fail hoy
- [ ] Customer nijer kachhe fake bundle (`dealQty 2, dealPrice 100`) pathale write fail hoy
- [ ] Customer item `lineTotal` 950 → 1000 korle write fail hoy

### Live (GitHub Pages)
- [ ] <https://farjanakhan2212.github.io/BnF/> mobile e responsive
- [ ] <https://farjanakhan2212.github.io/BnF/admin.html> login kora jay

## Google search e ashar jonno

1. `index.html`, `robots.txt`, `sitemap.xml` e live link (`https://farjanakhan2212.github.io/BnF/`) ase.
2. <https://search.google.com/search-console> e site add korun, `sitemap.xml` submit korun.
3. Facebook page er website field e site link dien.
4. Notun site, tai index hote kichu din theke kichu shoptah lagte pare. Custom domain
   (`.com`) nile ar Google Business Profile banale shobcheye bhalo result ashe.

## Product chhobi

- Chhobi `images/` folder e rakhun (jemon `images/kojie-soap.jpg`), tarpor admin e **Image
  Path** e `images/kojie-soap.jpg` likhun.
- Nested path (jemon `images/products/x.jpg`) o full link (`https://...`) o cholbe.
  Path-ta project root theke resolve hoy, tai subdirectory te host korleo kaj kore.
- Field-ta khali rakhle ba chhobi load na hole nije placeholder dhekhabe.
- Chhobi 800x1000 er moto, 200KB er niche rakhle site druto khole.
- Facebook er watermark wala chhobi na diye clean chhobi dile bhalo dekhay.
