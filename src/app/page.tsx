"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PayPalProvider,
  PayPalOneTimePaymentButton,
  VenmoOneTimePaymentButton,
  PayLaterOneTimePaymentButton,
  usePayPal,
  useEligibleMethods,
  INSTANCE_LOADING_STATE,
  type OnApproveDataOneTimePayments,
} from "@paypal/react-paypal-js/sdk-v6";
import { PRODUCTS, saveCart, type ProductInfo, type CartInput } from "@/lib/product";
import {
  getBrowserSafeClientId,
  createOrder,
} from "@/actions/paypal";
import ApiHistoryPanel, { type ApiLog } from "@/components/ApiHistoryPanel";
import type { PaymentStatus } from "@/app/checkout/page";

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5];

const EcsButtons = ({
  product,
  quantity,
  selectedSize,
  selectedColor,
  addLog,
}: {
  product: ProductInfo;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  addLog: (log: Omit<ApiLog, "timestamp">) => void;
}) => {
  const { loadingStatus } = usePayPal();
  const { error: eligibilityError } = useEligibleMethods({
    payload: {
      currencyCode: "USD",
      paymentFlow: "ONE_TIME_PAYMENT",
    },
  });

  const isLoading = loadingStatus === INSTANCE_LOADING_STATE.PENDING;

  const handleCreateOrder = async () => {
    const { orderId } = await createOrder({
      cart: [{
        sku: product.sku,
        quantity,
        size: selectedSize,
        color: selectedColor,
        colorLabel: product.colors?.find(c => c.value === selectedColor)?.label,
      }],
    });
    addLog({
      type: "createOrder",
      method: "POST",
      url: "/api/paypal/orders",
      status: 201,
      request: { sku: product.sku, quantity },
      response: { orderId },
    });
    return { orderId };
  };

  const handleApprove = async (data: OnApproveDataOneTimePayments) => {
    window.location.href = `/confirmation?token=${data.orderId}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (eligibilityError) {
    return (
      <p className="text-sm text-[var(--error)] text-center">
        Payment methods unavailable
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <p className="text-xs font-medium tracking-widest uppercase text-[var(--foreground-secondary)] text-center">
        Or quick buy
      </p>
      <div className="w-full max-w-sm mx-auto flex flex-col gap-2">
        <PayPalOneTimePaymentButton
          createOrder={handleCreateOrder}
          onApprove={handleApprove}
          presentationMode="auto"
        />

        <VenmoOneTimePaymentButton
          createOrder={handleCreateOrder}
          onApprove={handleApprove}
          presentationMode="auto"
        />

        <PayLaterOneTimePaymentButton
          createOrder={handleCreateOrder}
          onApprove={handleApprove}
          presentationMode="auto"
        />
      </div>
    </div>
  );
};

type VariantSelectorProps = {
  label: string;
  options: { label: string; value: string }[];
  selected: string;
  onChange: (val: string) => void;
  type?: "size" | "color";
};

const VariantSelector = ({ label, options, selected, onChange, type = "size" }: VariantSelectorProps) => {
  if (type === "color") {
    return (
      <div className="mb-3">
        <p className="text-[10px] font-medium tracking-wide uppercase text-[var(--foreground-secondary)] mb-2">
          {label}
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                selected === opt.value
                  ? "border-[var(--accent)] scale-110 shadow-sm"
                  : "border-[var(--border)] hover:border-[var(--foreground-secondary)]"
              }`}
              style={{ backgroundColor: opt.value }}
              title={opt.label}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <p className="text-[10px] font-medium tracking-wide uppercase text-[var(--foreground-secondary)] mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-xs rounded-md border transition-all cursor-pointer ${
              selected === opt.value
                ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)] font-medium"
                : "border-[var(--border)] text-[var(--foreground-secondary)] hover:border-[var(--foreground-secondary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const ProductCard = ({
  product,
  onAddToBag,
}: {
  product: ProductInfo;
  onAddToBag: (product: ProductInfo, opts: { quantity: number; size?: string; color?: string }) => void;
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0]?.value || "");
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0]?.value || "");
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col group">
      {/* Product Image */}
      <div className="aspect-[4/5] bg-[var(--background-secondary)] relative overflow-hidden">
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        )}
        <img
          src={product.image}
          alt={product.name}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
        />
      </div>

      {/* Product Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1 space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--accent)]">
            New Arrival
          </p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {product.name}
          </h3>
          <p className="text-sm text-[var(--foreground-secondary)] line-clamp-2">
            {product.tagline}
          </p>
          <p className="text-xs text-[var(--foreground-secondary)]/70 line-clamp-3 mb-3">
            {product.description}
          </p>
        </div>

        <p className="text-xl font-medium text-[var(--foreground)] mb-3">
          ${product.price}
        </p>

        {/* Size Selector */}
        {product.sizes && (
          <VariantSelector
            label="Size"
            options={product.sizes}
            selected={selectedSize}
            onChange={setSelectedSize}
            type="size"
          />
        )}

        {/* Color Selector */}
        {product.colors && (
          <VariantSelector
            label="Color"
            options={product.colors}
            selected={selectedColor}
            onChange={setSelectedColor}
            type="color"
          />
        )}

        {/* Quantity */}
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-[var(--foreground-secondary)]">Qty</label>
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] appearance-none cursor-pointer"
          >
            {QUANTITY_OPTIONS.map((qty) => (
              <option key={qty} value={qty}>{qty}</option>
            ))}
          </select>
        </div>

        {/* Add to Bag */}
        <button
          onClick={() => onAddToBag(product, { quantity, size: selectedSize || undefined, color: selectedColor || undefined })}
          className="w-full py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
        >
          Add to Bag
        </button>
      </div>
    </div>
  );
};

const Home = () => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [heroSize, setHeroSize] = useState(PRODUCTS[0].sizes?.[0]?.value || "");
  const [heroColor, setHeroColor] = useState(PRODUCTS[0].colors?.[0]?.value || "");
  const [heroIndex, setHeroIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const router = useRouter();

  const addLog = useCallback(
    (log: Omit<ApiLog, "timestamp">) => {
      setApiLogs((prev) => [
        ...prev,
        { ...log, timestamp: new Date().toLocaleTimeString() },
      ]);
    },
    []
  );

  useEffect(() => {
    getBrowserSafeClientId().then(setClientId);
  }, []);

  const handleAddToBag = (product: ProductInfo, opts: { quantity: number; size?: string; color?: string }) => {
    const cartItem: CartInput = {
      sku: product.sku,
      quantity: opts.quantity,
      size: opts.size,
      color: opts.color,
    };
    saveCart(cartItem);
    router.push("/checkout");
  };

  const heroProduct = PRODUCTS[heroIndex];

  // Sync hero variants when hero product changes
  useEffect(() => {
    setHeroSize(heroProduct.sizes?.[0]?.value || "");
    setHeroColor(heroProduct.colors?.[0]?.value || "");
  }, [heroIndex]);
  // Collection: show up to 3 products (excluding hero)
  const otherProducts = PRODUCTS.filter((_, i) => i !== heroIndex).slice(0, 3);

  return (
    <div className="flex">
      <main className="flex-1 flex flex-col">
        {/* Hero Section — featured product */}
        <section className="px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-start">
              {/* Hero Visual */}
              <div className="aspect-square rounded-3xl bg-[var(--background-secondary)] relative overflow-hidden order-2 md:order-1 sticky top-8">
                <img
                  src={heroProduct.image}
                  alt={heroProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Hero Info */}
              <div className="order-1 md:order-2">
                <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--accent)] mb-3">
                  Featured
                </p>
                <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[var(--foreground)] mb-4">
                  {heroProduct.name}
                </h1>
                <p className="text-xl md:text-2xl font-light text-[var(--foreground-secondary)] mb-4">
                  {heroProduct.tagline}
                </p>
                <p className="text-sm leading-relaxed text-[var(--foreground-secondary)] max-w-md mb-8">
                  {heroProduct.description}
                </p>
                <p className="text-3xl font-medium text-[var(--foreground)] mb-6">
                  ${heroProduct.price}
                </p>

                {/* Hero Variant Selectors */}
                {heroProduct.sizes && (
                  <div className="mb-4">
                    <p className="text-xs font-medium tracking-wide uppercase text-[var(--foreground-secondary)] mb-2">
                      Size
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {heroProduct.sizes.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setHeroSize(opt.value)}
                          className={`px-4 py-1.5 text-sm rounded-md border transition-all cursor-pointer ${
                            heroSize === opt.value
                              ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)] font-medium"
                              : "border-[var(--border)] text-[var(--foreground-secondary)] hover:border-[var(--foreground-secondary)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {heroProduct.colors && (
                  <div className="mb-6">
                    <p className="text-xs font-medium tracking-wide uppercase text-[var(--foreground-secondary)] mb-2">
                      Color
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {heroProduct.colors.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setHeroColor(opt.value)}
                          className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                            heroColor === opt.value
                              ? "border-[var(--accent)] scale-110 shadow-sm"
                              : "border-[var(--border)] hover:border-[var(--foreground-secondary)]"
                          }`}
                          style={{ backgroundColor: opt.value }}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleAddToBag(heroProduct, { quantity: 1, size: heroSize || undefined, color: heroColor || undefined })}
                  className="inline-block px-10 py-3.5 rounded-full bg-[var(--accent)] text-white text-base font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Shop Now
                </button>

                {/* ECS Quick Buy — inside info column */}
                {clientId && (
                  <div className="mt-6">
                    <PayPalProvider
                      clientId={clientId}
                      components={["paypal-payments", "venmo-payments"]}
                      pageType="checkout"
                      testBuyerCountry="US"
                    >
                      <EcsButtons product={heroProduct} quantity={1} selectedSize={heroSize} selectedColor={heroColor} addLog={addLog} />
                    </PayPalProvider>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="max-w-6xl mx-auto w-full px-6">
          <hr className="border-[var(--border)]" />
        </div>

        {/* Product Grid */}
        <section className="px-6 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Collection
              </h2>
              <p className="text-xs text-[var(--foreground-secondary)]">
                {PRODUCTS.length} items
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherProducts.map((product) => (
                <ProductCard
                  key={product.sku}
                  product={product}
                  onAddToBag={handleAddToBag}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <ApiHistoryPanel logs={apiLogs} show={showHistory} />
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="fixed bottom-6 right-6 z-50 px-4 py-2 text-xs font-semibold bg-[var(--accent)] text-white rounded-lg shadow-lg hover:opacity-90 cursor-pointer"
      >
        {showHistory ? "✕ Close API Log" : "📋 API Log"}
      </button>
    </div>
  );
};

export default Home;
