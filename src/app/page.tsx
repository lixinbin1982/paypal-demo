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
import { PRODUCT, saveCart } from "@/lib/product";
import {
  getBrowserSafeClientId,
  createOrder,
} from "@/actions/paypal";
import ApiHistoryPanel, { type ApiLog } from "@/components/ApiHistoryPanel";
import type { PaymentStatus } from "@/app/checkout/page";

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5];

const EcsButtons = ({
  quantity,
  addLog,
}: {
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
      cart: [{ sku: PRODUCT.sku, quantity }],
    });
    addLog({
      type: "createOrder",
      method: "POST",
      url: "/api/paypal/orders",
      status: 201,
      request: { sku: PRODUCT.sku, quantity },
      response: { orderId },
    });
    return { orderId };
  };

  const handleApprove = async (data: OnApproveDataOneTimePayments) => {
    // Redirect to confirmation page instead of capturing directly
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

const Home = () => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
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

  const handleAddToBag = () => {
    saveCart({ sku: PRODUCT.sku, quantity });
    router.push("/checkout");
  };

  return (
    <div className="flex">
      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-24">
          <div className="max-w-lg w-full text-center">
            {/* Product Visual */}
            <div className="w-48 h-48 mx-auto mb-12 rounded-full bg-[var(--background-secondary)] flex items-center justify-center">
              <span className="text-7xl">⚽</span>
            </div>

            {/* Product Info */}
            <p className="text-sm font-medium tracking-widest uppercase text-[var(--accent)] mb-3">
              New
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-[var(--foreground)] mb-4">
              {PRODUCT.name}
            </h1>
            <p className="text-2xl font-light text-[var(--foreground-secondary)] mb-6">
              {PRODUCT.tagline}
            </p>
            <p className="text-base leading-relaxed text-[var(--foreground-secondary)] max-w-lg mx-auto mb-10">
              {PRODUCT.description}
            </p>

            {/* Price */}
            <p className="text-3xl font-medium text-[var(--foreground)] mb-8">
              ${PRODUCT.price}
            </p>

            {/* Quantity Selector */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <label
                htmlFor="quantity"
                className="text-sm text-[var(--foreground-secondary)]"
              >
                Quantity
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] appearance-none cursor-pointer"
              >
                {QUANTITY_OPTIONS.map((qty) => (
                  <option key={qty} value={qty}>
                    {qty}
                  </option>
                ))}
              </select>
            </div>

            {/* Add to Bag */}
            <button
              onClick={handleAddToBag}
              className="inline-block px-8 py-3 rounded-full bg-[var(--accent)] text-white text-base font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              Add to Bag
            </button>

            {/* ECS: PayPal / Venmo / Pay Later quick buy */}
            {clientId && (
              <PayPalProvider
                clientId={clientId}
                components={[
                  "paypal-payments",
                  "venmo-payments",
                ]}
                pageType="checkout"
                testBuyerCountry="US"
              >
                <EcsButtons quantity={quantity} addLog={addLog} />
              </PayPalProvider>
            )}
          </div>
        </section>
      </main>
      <ApiHistoryPanel logs={apiLogs} />
    </div>
  );
};

export default Home;
