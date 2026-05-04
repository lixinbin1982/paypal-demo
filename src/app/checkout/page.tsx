"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  PayPalProvider,
  PayPalOneTimePaymentButton,
  VenmoOneTimePaymentButton,
  PayLaterOneTimePaymentButton,
  PayPalGuestPaymentButton,
  PayPalCardFieldsProvider,
  PayPalCardNumberField,
  PayPalCardExpiryField,
  PayPalCardCvvField,
  usePayPalCardFieldsOneTimePaymentSession,
  usePayPal,
  useEligibleMethods,
  INSTANCE_LOADING_STATE,
  type OnApproveDataOneTimePayments,
  type OnCancelDataOneTimePayments,
  type OnCompleteData,
  type OnErrorData,
} from "@paypal/react-paypal-js/sdk-v6";
import { PRODUCT, getCart, clearCart, type CartItem } from "@/lib/product";
import {
  getBrowserSafeClientId,
  createOrder,
  captureOrder,
} from "@/actions/paypal";

import ApiHistoryPanel, { type ApiLog } from "@/components/ApiHistoryPanel";

export type PaymentStatus = "idle" | "success" | "cancel" | "error";

export { type ApiLog };

const PaymentButtons = ({
  cart,
  onStatusChange,
  addLog,
  shippingCost = 10,
}: {
  cart: CartItem;
  onStatusChange: (status: PaymentStatus) => void;
  addLog: (log: Omit<ApiLog, "timestamp">) => void;
  shippingCost?: number;
}) => {
  const [shippingAddress, setShippingAddress] = useState<Record<string, string> | null>(null);
  const { loadingStatus } = usePayPal();
  const { error: eligibilityError } = useEligibleMethods({
    payload: {
      currencyCode: "USD",
      paymentFlow: "ONE_TIME_PAYMENT",
    },
  });

  const isLoading = loadingStatus === INSTANCE_LOADING_STATE.PENDING;

  const handleCreateOrder = async () => {
    const result = await createOrder({
      cart: [{ sku: cart.sku, quantity: cart.quantity }],
    });
    setShippingAddress(null);
    addLog({
      type: "createOrder",
      method: "POST",
      url: "/api/paypal/orders",
      status: 201,
      request: { sku: cart.sku, quantity: cart.quantity },
      response: result as unknown as Record<string, unknown>,
    });
    return result;
  };

  const extractShipping = (data: OnApproveDataOneTimePayments) => {
    const payer = (data as any).payer;
    const shipping = (data as any).shipping;
    const addr = shipping?.address || payer?.address || {};
    setShippingAddress({
      fullName:
        shipping?.name?.fullName ||
        (payer?.name?.givenName
          ? `${payer.name.givenName} ${payer.name.surname}`
          : "") ||
        "",
      addressLine1: addr?.addressLine1 ?? addr?.streetAddress ?? "",
      adminArea2: addr?.adminArea2 ?? addr?.locality ?? "",
      adminArea1: addr?.adminArea1 ?? addr?.region ?? "",
      postalCode: addr?.postalCode ?? "",
      countryCode: addr?.countryCode ?? "US",
    });
  };

  const handlePaymentCallbacks = {
    onApprove: async (data: OnApproveDataOneTimePayments) => {
      console.log("Payment approved:", data);
      extractShipping(data);
      const captureResult = await captureOrder({ orderId: data.orderId });
      addLog({
        type: "captureOrder",
        method: "POST",
        url: "/api/paypal/orders/capture",
        status: 200,
        request: { orderId: data.orderId },
        response: captureResult as unknown as Record<string, unknown>,
      });
      console.log("Payment capture result:", captureResult);
      clearCart();
      onStatusChange("success");
    },

    onCancel: (data: OnCancelDataOneTimePayments) => {
      console.log("Payment cancelled:", data);
      onStatusChange("cancel");
    },

    onError: (data: OnErrorData) => {
      console.error("Payment error:", data.message ?? data);
      addLog({
        type: "error",
        method: "POST",
        url: "—",
        status: 0,
        request: {} as Record<string, unknown>,
        response: { error: data.message } as Record<string, unknown>,
      });
      onStatusChange("error");
    },

    onComplete: (data: OnCompleteData) => {
      console.log("Payment session completed:", data);
    },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
        <span className="ml-3 text-sm text-[var(--foreground-secondary)]">
          Loading payment methods...
        </span>
      </div>
    );
  }

  if (eligibilityError) {
    return (
      <div className="py-8 text-center text-sm text-[var(--error)]">
        Unable to determine eligible payment methods.{" "}
        {eligibilityError.message || "Please refresh the page and try again."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PayPalOneTimePaymentButton
        createOrder={handleCreateOrder}
        presentationMode="auto"
        {...handlePaymentCallbacks}
      />

      <VenmoOneTimePaymentButton
        createOrder={handleCreateOrder}
        presentationMode="auto"
        {...handlePaymentCallbacks}
      />

      <PayLaterOneTimePaymentButton
        createOrder={handleCreateOrder}
        presentationMode="auto"
        {...handlePaymentCallbacks}
      />

      <PayPalGuestPaymentButton
        createOrder={handleCreateOrder}
        {...handlePaymentCallbacks}
      />

      {/* Advanced Credit & Debit Card */}
      <PayPalCardFieldsProvider
        amount={{
          currencyCode: "USD",
          value: (parseFloat(PRODUCT.price) * cart.quantity).toFixed(2),
        }}
        isCobrandedEligible={true}
      >
        <AdvancedCardForm
          cart={cart}
          onStatusChange={onStatusChange}
          addLog={addLog}
        />
      </PayPalCardFieldsProvider>
    </div>
  );
};

const AdvancedCardForm = ({
  cart,
  onStatusChange,
  addLog,
}: {
  cart: CartItem;
  onStatusChange: (status: PaymentStatus) => void;
  addLog: (log: Omit<ApiLog, "timestamp">) => void;
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { submit: submitPayment, submitResponse } =
    usePayPalCardFieldsOneTimePaymentSession();

  useEffect(() => {
    (async () => {
      if (!submitResponse || submitResponse.state !== "succeeded") return;
      try {
        const result = await captureOrder({
          orderId: submitResponse.data.orderId,
        });
        const enriched = {
          ...((result as unknown as Record<string, unknown>) || {}),
          _liabilityShift: submitResponse.data.liabilityShift ?? "N/A",
          _3dsState: submitResponse.state,
        };
        addLog({
          type: "captureOrder",
          method: "POST",
          url: "/api/paypal/orders/capture",
          status: 200,
          request: { orderId: submitResponse.data.orderId },
          response: enriched,
        });
        console.log("Card capture result:", result);
        clearCart();
        onStatusChange("success");
      } catch (err) {
        console.error("Card capture error:", err);
        onStatusChange("error");
      }
    })();
  }, [submitResponse]);

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const orderId = await createOrder({
        cart: [{ sku: cart.sku, quantity: cart.quantity }],
      }).then((r: any) => r.orderId ?? r);
      await submitPayment(orderId);
    } catch (err) {
      console.error("Card submit error:", err);
      onStatusChange("error");
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-xs font-medium tracking-widest uppercase text-[var(--foreground-secondary)] mb-3">
        Or pay with card
      </p>
      <form
        onSubmit={handleCardSubmit}
        className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--border)]"
      >
        <PayPalCardNumberField
          style={{
            input: { height: "32px", padding: "4px 8px", fontSize: "13px" },
          }}
        />
        <div className="flex gap-2">
          <PayPalCardExpiryField
            style={{
              input: { height: "32px", padding: "4px 8px", fontSize: "13px" },
            }}
          />
          <PayPalCardCvvField
            style={{
              input: { height: "32px", padding: "4px 8px", fontSize: "13px" },
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full px-4 py-2.5 rounded-lg bg-[#003087] text-white text-sm font-medium hover:bg-[#002266] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? "Processing..." : "Pay with Card"}
        </button>
      </form>
    </div>
  );
};



const Checkout = () => {
  const [cart, setCart] = useState<CartItem | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("idle");
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

  const SHIPPING_OPTIONS: { id: string; label: string; desc: string; cost: number }[] = [
    { id: "us", label: "US Shipping", desc: "5-8 business days", cost: 10 },
    { id: "ca", label: "Canada Shipping", desc: "5-8 business days", cost: 20 },
    { id: "intl", label: "International", desc: "7-14 business days", cost: 14.99 },
  ];
  const [shippingOption, setShippingOption] = useState(SHIPPING_OPTIONS[0]);

  useEffect(() => {
    const saved = getCart();
    if (!saved) {
      router.replace("/");
      return;
    }
    setCart(saved);
    getBrowserSafeClientId().then(setClientId);
  }, [router]);

  if (!cart || !clientId) return null;

  const subtotal = parseFloat(PRODUCT.price) * cart.quantity;
  const total = subtotal + shippingOption.cost;

  return (
    <div className="flex">
      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex flex-col items-center px-6 py-16">
          <div className="max-w-lg w-full">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-10">
              Checkout
            </h1>

            {status === "idle" ? (
              <>
                <div className="mb-8">
                  <h2 className="text-sm font-medium tracking-widest uppercase text-[var(--foreground-secondary)] mb-4">
                    Order Summary
                  </h2>

                  <div className="flex items-center gap-4 py-4 border-t border-[var(--border)]">
                    <div className="w-16 h-16 rounded-xl bg-[var(--background-secondary)] flex items-center justify-center shrink-0">
                      <span className="text-2xl">⚽</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {PRODUCT.name}
                      </p>
                      <p className="text-sm text-[var(--foreground-secondary)]">
                        Qty: {cart.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      ${subtotal.toFixed(2)}
                    </p>
                  </div>

                  {/* Shipping Selection */}
                  <div className="py-4 border-t border-[var(--border)] space-y-3">
                    <p className="text-sm font-medium tracking-widest uppercase text-[var(--foreground-secondary)]">
                      Shipping
                    </p>
                    {SHIPPING_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          shippingOption.id === opt.id
                            ? "border-[var(--accent)] bg-[var(--accent)]/5"
                            : "border-[var(--border)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingOption.id === opt.id}
                          onChange={() => setShippingOption(opt)}
                          className="accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {opt.label}
                          </p>
                          <p className="text-xs text-[var(--foreground-secondary)]">
                            {opt.desc}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          ${opt.cost.toFixed(2)}
                        </p>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between py-4 border-t border-[var(--border)]">
                    <span className="text-base font-medium text-[var(--foreground)]">
                      Total
                    </span>
                    <span className="text-base font-medium text-[var(--foreground)]">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <PayPalProvider
                  clientId={clientId}
                  components={[
                    "paypal-payments",
                    "venmo-payments",
                    "paypal-guest-payments",
                    "card-fields",
                  ]}
                  pageType="checkout"
                >
                  <PaymentButtons
                    cart={cart}
                    onStatusChange={setStatus}
                    addLog={addLog}
                    shippingCost={shippingOption.cost}
                  />
                </PayPalProvider>
              </>
            ) : (
              <div className="text-center py-16">
                {status === "success" && (
                  <>
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--success)]/10 flex items-center justify-center">
                      <span className="text-3xl">✓</span>
                    </div>
                    <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
                      Payment Successful
                    </h2>
                    <p className="text-base text-[var(--foreground-secondary)] mb-8">
                      Thank you for your purchase.
                    </p>
                  </>
                )}

                {status === "cancel" && (
                  <>
                    <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
                      Payment Cancelled
                    </h2>
                    <p className="text-base text-[var(--foreground-secondary)] mb-8">
                      Your payment was not completed. No charges were made.
                    </p>
                  </>
                )}

                {status === "error" && (
                  <>
                    <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
                      Payment Error
                    </h2>
                    <p className="text-base text-[var(--foreground-secondary)] mb-8">
                      Something went wrong while processing your payment.
                    </p>
                  </>
                )}

                <button
                  onClick={() => router.push("/")}
                  className="inline-block px-8 py-3 rounded-full bg-[var(--accent)] text-white text-base font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
      <ApiHistoryPanel logs={apiLogs} />
    </div>
  );
};

export default Checkout;
