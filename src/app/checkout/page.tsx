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
import { PRODUCT, getCart, clearCart, getProduct, type CartItem } from "@/lib/product";
import {
  getBrowserSafeClientId,
  createOrder,
  captureOrder,
} from "@/actions/paypal";

import ApiHistoryPanel, { type ApiLog } from "@/components/ApiHistoryPanel";

export type PaymentStatus = { type: "idle" } | { type: "success"; data?: any } | { type: "cancel" } | { type: "error" };

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
  const PAYMENT_OPTIONS = [
    { id: "paypal", label: "PayPal", emoji: "💳", desc: "Fast & secure" },
    { id: "venmo", label: "Venmo", emoji: "💸", desc: "Split with friends" },
    { id: "paylater", label: "Pay Later", emoji: "📅", desc: "Buy now, pay over time" },
    { id: "guest", label: "Guest Checkout", emoji: "👤", desc: "Pay as guest" },
  ];
  const [selectedPayment, setSelectedPayment] = useState("paypal");
  const [shippingAddress, setShippingAddress] = useState<Record<string, string> | null>(null);
  const { loadingStatus } = usePayPal();
  const { error: eligibilityError } = useEligibleMethods({
    payload: {
      currencyCode: "USD",
      paymentFlow: "ONE_TIME_PAYMENT",
    },
  });

  const isLoading = loadingStatus === INSTANCE_LOADING_STATE.PENDING;

  const TAX_RATE = 0.05;

  const handleCreateOrder = async () => {
    const itemSub = parseFloat(PRODUCT.price) * cart.quantity;
    const shipping = shippingCost ?? 10;
    const tax = parseFloat((itemSub * TAX_RATE).toFixed(2));

    const result = await createOrder({
      cart: [{ sku: cart.sku, quantity: cart.quantity }],
      shippingCost: shipping,
      tax,
    });
    setShippingAddress(null);
    addLog({
      type: "createOrder",
      method: "POST",
      url: "/api/paypal/orders",
      status: 201,
      request: { sku: cart.sku, quantity: cart.quantity, shippingCost: shipping, tax },
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
      const shCost = shippingCost ?? 10;
      const itemSub = parseFloat(PRODUCT.price) * cart.quantity;
      const taxVal = parseFloat((itemSub * 0.05).toFixed(2));
      onStatusChange({ type: "success", data: { ...captureResult, _subtotal: itemSub, _shipping: shCost, _tax: taxVal } });
    },

    onCancel: (data: OnCancelDataOneTimePayments) => {
      console.log("Payment cancelled:", data);
      onStatusChange({ type: "cancel" });
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
      onStatusChange({ type: "error" });
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
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium tracking-widest uppercase text-[var(--foreground-secondary)] text-center">
        Choose a payment method
      </p>
      <div className="space-y-2">
        {PAYMENT_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedPayment === opt.id
                ? "border-[var(--accent)] bg-[var(--accent)]/5"
                : "border-[var(--border)]"
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              value={opt.id}
              checked={selectedPayment === opt.id}
              onChange={() => setSelectedPayment(opt.id)}
              className="accent-[var(--accent)]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{opt.emoji}</span>
                <p className="text-sm font-medium text-[var(--foreground)]">{opt.label}</p>
              </div>
              <p className="text-xs text-[var(--foreground-secondary)] ml-8">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-1">
        {selectedPayment === "paypal" && (
          <PayPalOneTimePaymentButton
            createOrder={handleCreateOrder}
            presentationMode="auto"
            {...handlePaymentCallbacks}
          />
        )}
        {selectedPayment === "venmo" && (
          <VenmoOneTimePaymentButton
            createOrder={handleCreateOrder}
            presentationMode="auto"
            {...handlePaymentCallbacks}
          />
        )}
        {selectedPayment === "paylater" && (
          <PayLaterOneTimePaymentButton
            createOrder={handleCreateOrder}
            presentationMode="auto"
            {...handlePaymentCallbacks}
          />
        )}
        {selectedPayment === "guest" && (
          <PayPalGuestPaymentButton
            createOrder={handleCreateOrder}
            {...handlePaymentCallbacks}
          />
        )}
      </div>

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
          shippingCost={shippingCost}
        />
      </PayPalCardFieldsProvider>
    </div>
  );
};

const AdvancedCardForm = ({
  cart,
  onStatusChange,
  addLog,
  shippingCost,
}: {
  cart: CartItem;
  onStatusChange: (status: PaymentStatus) => void;
  addLog: (log: Omit<ApiLog, "timestamp">) => void;
  shippingCost?: number;
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
        const itemSub = parseFloat(PRODUCT.price) * cart.quantity;
        const shCost = shippingCost ?? 10;
        const taxVal = parseFloat((itemSub * 0.05).toFixed(2));
        console.log("Card capture result:", result);
        clearCart();
        onStatusChange({ type: "success", data: { ...result, _subtotal: itemSub, _shipping: shCost, _tax: taxVal } });
      } catch (err) {
        console.error("Card capture error:", err);
        onStatusChange({ type: "error" });
      }
    })();
  }, [submitResponse]);

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const itemSub = parseFloat(PRODUCT.price) * cart.quantity;
      const shipping = shippingCost ?? 10;
      const tax = parseFloat((itemSub * 0.05).toFixed(2));

      const orderId = await createOrder({
        cart: [{ sku: cart.sku, quantity: cart.quantity }],
        shippingCost: shipping,
        tax,
      }).then((r: any) => r.orderId ?? r);
      await submitPayment(orderId);
    } catch (err) {
      console.error("Card submit error:", err);
      onStatusChange({ type: "error" });
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
  const [status, setStatus] = useState<PaymentStatus>({ type: "idle" });
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
  const tax = parseFloat((subtotal * 0.05).toFixed(2));
  const total = subtotal + shippingOption.cost + tax;

  return (
    <div className="flex">
      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex flex-col items-center px-6 py-16">
          <div className="max-w-lg w-full">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-10">
              Checkout
            </h1>

            {status.type === "idle" ? (
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

                  <div className="text-sm space-y-1 py-4 border-t border-[var(--border)]">
                    <div className="flex justify-between text-[var(--foreground-secondary)]">
                      <span>Subtotal</span>
                      <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--foreground-secondary)]">
                      <span>Shipping ({shippingOption.label})</span>
                      <span>$${shippingOption.cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--foreground-secondary)]">
                      <span>Tax (5%)</span>
                      <span>$${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-[var(--border)]">
                      <span>Total</span>
                      <span>$${total.toFixed(2)}</span>
                    </div>
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
                  testBuyerCountry="US"
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
                {status.type === "success" && (
                  <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-6 mx-auto max-w-md text-left space-y-3">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--success)]/10 flex items-center justify-center">
                        <span className="text-3xl">✓</span>
                      </div>
                      <h2 className="text-xl font-semibold text-green-500">
                        Payment Successful
                      </h2>
                      <p className="text-sm text-[var(--foreground-secondary)] mt-1">
                        Total charged: <strong className="text-green-400">${status.data?.purchase_units?.[0]?.amount?.value || status.data?.purchase_units?.[0]?.amount?.value || "—"}</strong>
                      </p>
                    </div>
                    <hr className="border-green-500/20" />
                    <div className="text-xs space-y-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div>
                          <p className="text-[var(--foreground-secondary)]">Order ID</p>
                          <p className="font-mono font-medium break-all">{status.data?.id || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground-secondary)]">Status</p>
                          <p className="text-green-500 font-semibold">{(status.data?.status || "COMPLETED").toUpperCase()}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground-secondary)]">Payer</p>
                          <p className="font-medium">{status.data?.payer?.name?.given_name || status.data?.payer?.name?.givenName || ""} {status.data?.payer?.name?.surname || status.data?.payer?.name?.surname || ""}</p>
                        </div>
                        <div>
                          <p className="text-[var(--foreground-secondary)]">Email</p>
                          <p className="font-medium text-[10px]">{status.data?.payer?.email_address || status.data?.payer?.emailAddress || "—"}</p>
                        </div>
                      </div>
                      <hr className="border-green-500/20" />
                      <p className="font-medium text-[var(--foreground-secondary)]">Items</p>
                      {(status.data?.purchase_units?.[0]?.items || []).map((item: any, idx: number) => {
                        const prod = getProduct(item.sku);
                        const unitPrice = item.unit_amount?.value || item.unitAmount?.value || "0";
                        return (
                          <div key={idx} className="flex justify-between">
                            <span>{prod?.emoji || "📦"} {prod?.name || item.name} × {item.quantity}</span>
                            <span className="font-medium">${(parseFloat(unitPrice) * parseInt(item.quantity)).toFixed(2)}</span>
                          </div>
                        );
                      })}
                      <hr className="border-green-500/20" />
                      <div className="flex justify-between text-[var(--foreground-secondary)]">
                        <span>Subtotal</span>
                        <span>${(status.data?._subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[var(--foreground-secondary)]">
                        <span>Shipping</span>
                        <span>${(status.data?._shipping || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[var(--foreground-secondary)]">
                        <span>Tax (5%)</span>
                        <span>${(status.data?._tax || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-green-500 border-t border-green-500/20 pt-2">
                        <span>Total</span>
                        <span>${((status.data?._subtotal || 0) + (status.data?._shipping || 0) + (status.data?._tax || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                    <hr className="border-green-500/20" />
                    <div className="text-center">
                      <button
                        onClick={() => setStatus({ type: "idle" })}
                        className="text-[var(--accent)] hover:underline text-sm"
                      >
                        Continue Shopping →
                      </button>
                    </div>
                  </div>
                )}

                {status.type === "cancel" && (
                  <>
                    <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
                      Payment Cancelled
                    </h2>
                    <p className="text-base text-[var(--foreground-secondary)] mb-8">
                      Your payment was not completed. No charges were made.
                    </p>
                  </>
                )}

                {status.type === "error" && (
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
