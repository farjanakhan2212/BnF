<<<<<<< HEAD
# Beauty n Fashion by Shimu Khan: Online Shop

HTML + CSS + JavaScript website. Customer order dey, apni admin panel theke shob dekhen. Hosting: GitHub Pages (free). Database: Firebase (free tier).

## Ki ki ache

| File | Kaj |
|---|---|
| `index.html` | Customer shop (product, cart, checkout) |
| `admin.html` | Apnar admin panel (login lagbe) |
| `js/config.js` | **Prothome eta edit korben**: Firebase, bKash number, Messenger link, delivery charge |
| `js/seed.js` | Apnar current product list (price, stock, expiry) |
| `firestore.rules` | Security rules (customer sudhu order dite pare, dekhte pare na) |
| `images/` | Logo ar product er chhobi |

## Rules jeta set kora ache

- **Inside Dhaka City**: Cash on delivery, delivery 80 taka
- **Outside Dhaka**: Full bKash payment, Sundarban Courier, delivery 150 taka
- Customer order er por Messenger e order text pathate pare, ar order admin panel eo ashe
- Order **delete kora jay na**. Shudhu status change hoy (cancelled, delivered), tai history thake
- "Download CSV backup" button e shob order Excel e nite paren

## Setup (ekbar korlei hobe)

### 1. Firebase project
1. https://console.firebase.google.com e jan, **Add project** (naam: `beautyfashion-shop`). Google Analytics lagbe na.
2. **Build > Firestore Database > Create database** (production mode, location: `asia-south1` ba `asia-southeast1`).
3. **Build > Authentication > Get started > Email/Password > Enable**.
4. **Users tab > Add user**: apnar admin email ar ekta shokto password dien. Tarpor oi user er **User UID** copy korun.
5. **Project settings (gear) > Your apps > Web (`</>`)**: app register korun. `firebaseConfig` er value gulo copy korun.

### 2. Config
- `js/config.js` e `FIREBASE_CONFIG` e oi value gulo boshan.
- `bkashNumber` e apnar bKash number dien.
- `messengerLink` e apnar page username dien, jemon `https://m.me/yourpagename`. (Facebook page > About e username paben.)

### 3. Security rules
- `firestore.rules` file er `ADMIN_UID_HERE` er jaygay Step 1.4 er UID boshan.
- Firebase > Firestore > **Rules** tab e puro file paste kore **Publish** korun.
- Eta na korle admin panel khulbe na, ar security thik thakbe na.

### 4. GitHub Pages
1. GitHub e notun repository banan (jemon `beautyfashion`).
2. Ei folder er shob file upload korun (`index.html` root e thakte hobe).
3. **Settings > Pages > Source: Deploy from a branch > main / (root) > Save**.
4. Kichukkhon pore site ashbe: `https://YOUR_USERNAME.github.io/beautyfashion/`
5. Firebase > Authentication > **Settings > Authorized domains** e `YOUR_USERNAME.github.io` add korun (admin login er jonno lagbe).

### 5. Prothom bar admin
1. `https://YOUR_USERNAME.github.io/beautyfashion/admin.html` e login korun.
2. **Products > Load starter products** click korun. Tahole apnar list ashbe.
3. Price/stock/image thik kore nin. Je product er price `0`, seta hidden ache, price dile "Show" korun.

## Stock kibhabe kaj kore

- Product e **Stock** number dile website oi number porjonto bikri hobe. 0 hole "Out of stock" dekhabe.
- Admin e order **Confirmed** korle stock automatic kome. Pore **Cancelled** korle stock abar ferot ashe.
- Stock khali rakhle website stock gune na (shobshomoy available).
- **Expiry** field shudhu apni dekhen, customer dekhe na. Low stock Reports e dekhabe.
- Seed e Kojie soap 135g er stock **6** dhorechi (3 packet x 2ta). Ta thik na hole admin e theek korun.

## Google search e ashar jonno

1. `index.html`, `robots.txt`, `sitemap.xml` e `YOUR_USERNAME` ar `YOUR_REPO` er jaygay asol link boshan.
2. https://search.google.com/search-console e site add korun, `sitemap.xml` submit korun.
3. Facebook page er website field e site link dien.
4. Notun site, tai index hote kichu din theke kichu shoptah lagte pare. Custom domain (`.com`) nile ar Google Business Profile banale shobcheye bhalo result ashe.

## Product chhobi

- Chhobi `images/` folder e rakhun (jemon `images/kojie-soap.jpg`), tarpor admin e **Image Path** e `images/kojie-soap.jpg` likhun.
- Nested path (jemon `images/products/x.jpg`) o full link (`https://...`) o cholbe. Path-ta project root theke resolve hoy, tai subdirectory te host korleo kaj kore.
- Field-ta khali rakhle ba chhobi load na hole nije placeholder dhekhabe.
- Chhobi 800x1000 er moto, 200KB er niche rakhle site druto khole.
- Facebook er watermark wala chhobi na diye clean chhobi dile bhalo dekhay.

## Nirapotta (security)

- Admin password JavaScript e nai. Login Firebase Authentication diye, ar data access `firestore.rules` diye atkano.
- Customer er likha shob text escape kora hoy, tai fake script chalano jay na.
- Customer order e dam pathay, kintu rules `total = subtotal + delivery` check kore. Dam nijer kachhe verify korte admin e order khulle item o total mile dekhun, bishesh kore bKash payment er amount.
- Spam thekate form e hidden trap ache. Beshi spam ashle Firebase **App Check** (reCAPTCHA) chalu korun.
- Firebase free tier e shuru korle khoroch lage na. Order beshi hole Firebase usage page e dekhe nin.

## Ja ekhono nai (pore add kora jay)

- Automatic bKash/SSLCommerz payment (alada backend lage)
- Customer order tracking page
- Customer er SMS/email notification
- Coupon / discount code
=======
# BnF
https://farjanakhan2212.github.io/BnF/
>>>>>>> 44c288531fa8970765ac620f53946c5ba31c4726
