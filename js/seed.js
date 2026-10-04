// Starting product list, built from your stock list and price messages.
// In the admin panel > Products > "Load starter products" copies these into the database.
// stock: number left (the shop hides the product at 0). expiry: earliest batch, shown in admin only.
// deal_qty + deal_price = bundle, e.g. deal_qty 2 with deal_price 950 means 2 pieces for 950 taka.
// Products with no bundle simply leave both fields out. An empty or 0 deal_qty means NO DEAL.
// Items with price 0 are hidden (active: false) until you set a price.
export const SEED_PRODUCTS = [
  {
    id: "kojiesan-soap-135", name: "Kojie San Skin Lightening Soap", brand: "Kojie San", category: "Skin care",
    origin: "Philippines", size: "135g", price: 500, deal_qty: 2, deal_price: 950, stock: 6, expiry: "24/9/2027",
    description: "Classic skin lightening soap bar. Dermatologically tested, as printed on the pack.",
    image: "images/products/kojie-soap.jpg", active: true, sort: 10,
  },
  {
    id: "kojiesan-soap-100", name: "Kojie San Skin Lightening Soap", brand: "Kojie San", category: "Skin care",
    origin: "Philippines", size: "100g", price: 400, stock: 10, expiry: "21/10/2027",
    description: "Classic skin lightening soap bar. Dermatologically tested, as printed on the pack.",
    image: "images/products/kojie-soap100.png", active: true, sort: 11,
  },
  {
    id: "kojiesan-cream-30", name: "Kojie San Skin Lightening Face Cream", brand: "Kojie San", category: "Skin care",
    origin: "Philippines", size: "30g", price: 600, stock: 6, expiry: "",
    description: "Face cream with HydroMoist. The pack says it lightens, restores and moisturizes skin.",
    image: "images/products/kojie-cream.jpg", active: true, sort: 20,
  },
  {
    id: "kojiesan-lotion-250", name: "Kojie San Skin Lightening Body Lotion", brand: "Kojie San", category: "Skin care",
    origin: "Philippines", size: "250g", price: 1000, stock: 2, expiry: "3/10/2027",
    description: "Body lotion with HydroMoist. Dermatologically tested, hypoallergenic, paraben free, as printed on the pack.",
    image: "images/products/kojie-lotion250.jpg", active: true, sort: 30,
  },
  {
    id: "kojiesan-lotion-200", name: "Kojie San Skin Lightening Body Lotion", brand: "Kojie San", category: "Skin care",
    origin: "Philippines", size: "200g", price: 900, stock: 0, expiry: "",
    description: "Body lotion with HydroMoist. Dermatologically tested, hypoallergenic, paraben free, as printed on the pack.",
    image: "images/products/kojie-lotion200.jpg", active: true, sort: 31,
  },
  {
    id: "silka-soap-135", name: "Silka Papaya Whitening Herbal Soap", brand: "Silka", category: "Skin care",
    origin: "Philippines", size: "135g", price: 500, stock: 18, expiry: "12/2027",
    description: "Papaya herbal soap enriched with Vitamin E. Dermatologist tested, as printed on the pack. 100% original, directly imported.",
    image: "images/products/silka-soap135.jpg", active: true, sort: 40,
  },
  {
    id: "silka-soap-90", name: "Silka Papaya Whitening Herbal Soap", brand: "Silka", category: "Skin care",
    origin: "Philippines", size: "90g", price: 350, stock: 7, expiry: "10/2027",
    description: "Papaya herbal soap enriched with Vitamin E. Dermatologist tested, as printed on the pack. 100% original, directly imported.",
    image: "images/products/silka-soap90.jpg", active: true, sort: 41,
  },
  {
    id: "silka-lotion-200", name: "Silka Papaya Whitening Lotion", brand: "Silka", category: "Skin care",
    origin: "Philippines", size: "200ml", price: 600, stock: 5, expiry: "10/2027",
    description: "Papaya lotion with Nutriblend Complex (vitamins B3, B5, B6, C and E) and SPF 6. Dermatologist tested, as printed on the pack.",
    image: "images/products/silka-lotion200.jpg", active: true, sort: 50,
  },
  {
    id: "silka-lotion-100", name: "Silka Papaya Whitening Lotion", brand: "Silka", category: "Skin care",
    origin: "Philippines", size: "100ml", price: 450, stock: 0, expiry: "",
    description: "Papaya lotion with Nutriblend Complex (vitamins B3, B5, B6, C and E) and SPF 6. Dermatologist tested, as printed on the pack.",
    image: "images/products/silka-lotion100.jpg", active: true, sort: 51,
  },
  {
    id: "rdl-papaya-soap-135", name: "RDL Papaya Whitening Soap + Sunscreen", brand: "RDL", category: "Skin care",
    origin: "Philippines", size: "135g", price: 500, stock: 0, expiry: "",
    description: "Papaya soap with sunscreen and Vitamins A, C and E, as printed on the pack.",
    image: "images/products/rdl-soap.jpg", active: true, sort: 60,
  },
  {
    id: "garnier-micellar-vitc-125", name: "Garnier Micellar Cleansing Water Vitamin C", brand: "Garnier", category: "Skin care",
    origin: "", size: "125ml", price: 550, stock: 1, expiry: "06/2028",
    description: "Dull, tired, uneven skin tone এর জন্য ভালো। যাদের মুখ নিস্তেজ লাগে, ব্রাইট দেখাতে চান তাদের জন্য উপযোগী। Normal to combination skin এ ভালো মানায়। No rinse off, no perfume, no alcohol.",
    image: "images/products/garnier.webp", active: true, sort: 70,
  },
  {
    id: "nivea-soft-200", name: "Nivea Soft Cream", brand: "Nivea", category: "Skin care",
    origin: "", size: "200ml", price: 0, stock: 1, expiry: "",
    description: "Soft moisturizing cream.",
    image: "", active: false, sort: 80,
  },
  {
    id: "tresemme-keratin-mask-180", name: "TRESemm\u00e9 Keratin Smooth Hair Mask", brand: "TRESemm\u00e9", category: "Hair care",
    origin: "Thailand", size: "180ml", price: 900, stock: 0, expiry: "",
    description: "Keratin hair mask, made in Thailand.",
    image: "images/products/hair-mask.jpg", active: true, sort: 90,
  },
];
