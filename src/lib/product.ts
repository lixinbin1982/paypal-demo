export type VariantOption = {
  label: string;
  value: string;
};

export type ProductInfo = {
  name: string;
  tagline: string;
  description: string;
  price: string;
  sku: string;
  image: string;
  emoji: string;
  sizes?: VariantOption[];
  colors?: VariantOption[];
};

export const PRODUCTS: ProductInfo[] = [
  {
    name: "Silk Evening Dress",
    tagline: "Elegance meets sophistication.",
    description:
      "Luxurious silk evening gown with a flattering A-line silhouette. Features a subtle V-neckline and delicate embroidery along the hem. Perfect for galas, weddings, and formal events.",
    price: "189.00",
    sku: "dress01",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=75&auto=format&fit=crop",
    emoji: "👗",
    sizes: [
      { label: "XS", value: "xs" },
      { label: "S", value: "s" },
      { label: "M", value: "m" },
      { label: "L", value: "l" },
      { label: "XL", value: "xl" },
    ],
    colors: [
      { label: "Midnight Black", value: "#1a1a2e" },
      { label: "Burgundy", value: "#800020" },
      { label: "Navy", value: "#0a2342" },
      { label: "Forest Green", value: "#1b5e20" },
    ],
  },
  {
    name: "Cropped Denim Jacket",
    tagline: "Street-ready edge.",
    description:
      "Vintage-wash cropped denim jacket with raw hem and silver hardware. Features a relaxed oversized fit that layers perfectly over dresses or tees. Distressed details for that lived-in look.",
    price: "128.00",
    sku: "jacket01",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=75&auto=format&fit=crop",
    emoji: "🧥",
    sizes: [
      { label: "XS", value: "xs" },
      { label: "S", value: "s" },
      { label: "M", value: "m" },
      { label: "L", value: "l" },
    ],
    colors: [
      { label: "Light Wash", value: "#8ba8c4" },
      { label: "Black", value: "#2a2a2a" },
    ],
  },
  {
    name: "Pearl Drop Earrings",
    tagline: "Timeless elegance.",
    description:
      "Freshwater pearl drop earrings set in 14k gold-plated sterling silver. Each pearl is hand-selected for lustre and uniformity. Secured with French hook closures.",
    price: "79.00",
    sku: "pearl01",
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=75&auto=format&fit=crop",
    emoji: "📿",
  },
  {
    name: "Leather Crossbody Bag",
    tagline: "Everyday luxury.",
    description:
      "Full-grain Italian leather crossbody bag with adjustable strap and gold-tone hardware. Features multiple interior pockets and a magnetic snap closure. Ages beautifully over time.",
    price: "149.00",
    sku: "bag01",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=75&auto=format&fit=crop",
    emoji: "👜",
    colors: [
      { label: "Tan", value: "#d2a679" },
      { label: "Black", value: "#222222" },
      { label: "Burgundy", value: "#800020" },
    ],
  },
  {
    name: "Silk Scarf",
    tagline: "A touch of Parisian chic.",
    description:
      "Hand-rolled 100% silk twill scarf featuring an exclusive botanical print. Can be worn as a neckerchief, headband, or bag accessory. Arrives in a gift-ready box.",
    price: "65.00",
    sku: "scarf01",
    image: "https://images.unsplash.com/photo-1602751584553-8ba014387552?w=400&q=75&auto=format&fit=crop",
    emoji: "🧣",
    colors: [
      { label: "Blush Pink", value: "#f4c2c2" },
      { label: "Sage Green", value: "#9caf88" },
      { label: "Dusty Blue", value: "#7a9eb1" },
      { label: "Warm Ivory", value: "#f5e6d3" },
    ],
  },
  {
    name: "Gold Cuff Bracelet",
    tagline: "Make a statement.",
    description:
      "Hammered 18k gold vermeil cuff bracelet with an organic textured finish. Open back design fits most wrist sizes. Layer it or wear it solo.",
    price: "99.00",
    sku: "cuff01",
    image: "https://images.unsplash.com/photo-1603561597606-1e9a09e7cdc0?w=400&q=75&auto=format&fit=crop",
    emoji: "💎",
  },
];

export const PRODUCT = PRODUCTS[0];

export type CartItem = {
  sku: string;
  quantity: number;
  size?: string;
  color?: string;
  colorLabel?: string;
};

const CART_KEY = "paypal-cart";

export const getCart = (): CartItem | null => {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(CART_KEY);
  return stored ? JSON.parse(stored) : null;
};

export type CartInput = {
  sku: string;
  quantity: number;
  size?: string;
  color?: string;
};

export const saveCart = (item: CartInput): void => {
  // Resolve color label from value for display/order
  const product = PRODUCTS.find(p => p.sku === item.sku);
  const colorLabel = product?.colors?.find(c => c.value === item.color)?.label;
  sessionStorage.setItem(CART_KEY, JSON.stringify({ ...item, colorLabel }));
};

export const clearCart = (): void => {
  sessionStorage.removeItem(CART_KEY);
};

export function getProduct(sku: string) {
  const product = PRODUCTS.find((p) => p.sku === sku);
  if (!product) {
    throw new Error(`Product not found: ${sku}`);
  }
  return product;
}

export function getAllProducts() {
  return [...PRODUCTS];
}
