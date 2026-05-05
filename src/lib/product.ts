export type ProductInfo = {
  name: string;
  tagline: string;
  description: string;
  price: string;
  sku: string;
  image: string;
  emoji: string;
};

export const PRODUCTS: ProductInfo[] = [
  {
    name: "Silk Evening Dress",
    tagline: "Elegance meets sophistication.",
    description:
      "Luxurious silk evening gown with a flattering A-line silhouette. Features a subtle V-neckline and delicate embroidery along the hem. Perfect for galas, weddings, and formal events.",
    price: "189.00",
    sku: "dress01",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&q=80&auto=format&fit=crop",
    emoji: "👗",
  },
  {
    name: "Cashmere Wrap Coat",
    tagline: "Warmth without compromise.",
    description:
      "Premium cashmere-blend wrap coat with oversized lapels and a self-tie belt. Double-faced fabric for warmth without bulk. A timeless investment piece.",
    price: "295.00",
    sku: "coat01",
    image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=600&q=80&auto=format&fit=crop",
    emoji: "🧥",
  },
  {
    name: "Pearl Drop Earrings",
    tagline: "Timeless elegance.",
    description:
      "Freshwater pearl drop earrings set in 14k gold-plated sterling silver. Each pearl is hand-selected for lustre and uniformity. Secured with French hook closures.",
    price: "79.00",
    sku: "pearl01",
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80&auto=format&fit=crop",
    emoji: "📿",
  },
  {
    name: "Leather Crossbody Bag",
    tagline: "Everyday luxury.",
    description:
      "Full-grain Italian leather crossbody bag with adjustable strap and gold-tone hardware. Features multiple interior pockets and a magnetic snap closure. Ages beautifully over time.",
    price: "149.00",
    sku: "bag01",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80&auto=format&fit=crop",
    emoji: "👜",
  },
  {
    name: "Silk Scarf",
    tagline: "A touch of Parisian chic.",
    description:
      "Hand-rolled 100% silk twill scarf featuring an exclusive botanical print. Can be worn as a neckerchief, headband, or bag accessory. Arrives in a gift-ready box.",
    price: "65.00",
    sku: "scarf01",
    image: "https://images.unsplash.com/photo-1602751584553-8ba014387552?w=600&q=80&auto=format&fit=crop",
    emoji: "🧣",
  },
  {
    name: "Gold Cuff Bracelet",
    tagline: "Make a statement.",
    description:
      "Hammered 18k gold vermeil cuff bracelet with an organic textured finish. Open back design fits most wrist sizes. Layer it or wear it solo.",
    price: "99.00",
    sku: "cuff01",
    image: "https://images.unsplash.com/photo-1603561597606-1e9a09e7cdc0?w=600&q=80&auto=format&fit=crop",
    emoji: "💎",
  },
];

export const PRODUCT = PRODUCTS[0];

export type CartItem = {
  sku: string;
  quantity: number;
};

const CART_KEY = "paypal-cart";

export const getCart = (): CartItem | null => {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(CART_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const saveCart = (item: CartItem): void => {
  sessionStorage.setItem(CART_KEY, JSON.stringify(item));
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
