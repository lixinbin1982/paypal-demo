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
import { PRODUCTS, saveCart, type ProductInfo } from "@/lib/product";
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
  addLog,
}: {
  product: ProductInfo;
  quantity: number;
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
      cart: [{ sku: product.sku, quantity }],
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

const ProductCard = ({
  product,
  onAddToBag,
  clientId,
  addLog,
}: {
  product: ProductInfo;
  onAddToBag: (product: ProductInfo, quantity: number) => void;
  clientId: string | null;
  addLog: (log: Omit<ApiLog, "timestamp">) => void;
}) => {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col">
      {/* Product Image */}
      <div className="aspect-[4/5] bg-[var(--background-secondary)] flex items-center justify-center overflow-hidden">
        <span className="text-7xl">{product.emoji}</span>
      </div>

      {/* Product Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--accent)] mb-1.5">
            New Arrival
          </p>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
            {product.name}
          </h3>
          <p className="text-sm text-[var(--foreground-secondary)] mb-2 line-clamp-2">
            {product.tagline}
          </p>
          <p className="text-xs text-[var(--foreground-secondary)]/70 mb-4 line-clamp-3">
            {product.description}
          </p>
        </div>

        <p className="text-xl font-medium text-[var(--foreground)] mb-4">
          ${product.price}
        </p>

        {/* Quantity */}
        <div className="flex items-center justify-between mb-4">
          <label className="text-xs text-[var(--foreground-secondary)]">Quantity</label>
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
          onClick={() => onAddToBag(product, quantity)}
          className="w-full py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer mb-3"
        >
          Add to Bag
        </button>

        {/* ECS Quick Buy */}
        {clientId && (
          <PayPalProvider
            clientId={clientId}
            components={["paypal-payments", "venmo-payments"]}
            pageType="checkout"
            testBuyerCountry="US"
          >
            <EcsButtons product={product} quantity={quantity} addLog={addLog} />
          </PayPalProvider>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
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

  const handleAddToBag = (product: ProductInfo, quantity: number) => {
    saveCart({ sku: product.sku, quantity });
    router.push("/checkout");
  };

  const heroProduct = PRODUCTS[heroIndex];
  const otherProducts = PRODUCTS.filter((_, i) => i !== heroIndex);

  return (
    <div className="flex">
      <main className="flex-1 flex flex-col">
        {/* Hero Section — featured product */}
        <section className="px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              {/* Hero Visual */}
              <div className="aspect-square rounded-3xl bg-[var(--background-secondary)] flex items-center justify-center order-2 md:order-1">
                <span className="text-[8rem] md:text-[10rem]">{heroProduct.emoji}</span>
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
                <button
                  onClick={() => handleAddToBag(heroProduct, 1)}
                  className="inline-block px-10 py-3.5 rounded-full bg-[var(--accent)] text-white text-base font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Shop Now
                </button>
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
                  clientId={clientId}
                  addLog={addLog}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <ApiHistoryPanel logs={apiLogs} />
    </div>
  );
};

export default Home;
