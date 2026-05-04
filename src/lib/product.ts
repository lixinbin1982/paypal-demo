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
    name: "World Cup Ball",
    tagline: "Precision. Control. Perfection.",
    description:
      "Tournament-grade match ball engineered for peak performance. Thermal-bonded panels deliver consistent flight and true touch in every condition.",
    price: "75.00",
    sku: "1blwyeo8",
    image: "https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=400&q=80",
    emoji: "⚽",
  },
  {
    name: "Training Jersey",
    tagline: "Lightweight. Breathable. Pro Fit.",
    description:
      "Official training jersey with moisture-wicking fabric. Perfect for warm-ups and casual wear.",
    price: "45.00",
    sku: "jersey01",
    image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=400&q=80",
    emoji: "👕",
  },
  {
    name: "Stadium Seat Cushion",
    tagline: "Comfort for the big game.",
    description:
      "Padded stadium seat cushion with carry strap. Never sit on cold bleachers again.",
    price: "25.00",
    sku: "cushion01",
    image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&q=80",
    emoji: "🪑",
  },
  {
    name: "Scarf & Hat Set",
    tagline: "Rep your team in style.",
    description:
      "Knit scarf and beanie set. 100% acrylic, available in team colors. One size fits most.",
    price: "35.00",
    sku: "scarfset01",
    image: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c2?w=400&q=80",
    emoji: "🧣",
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
