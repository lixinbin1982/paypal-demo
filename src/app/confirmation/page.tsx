"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { captureOrder, patchOrderItems } from "@/actions/paypal";
import { PRODUCTS, getProduct, type CartItem } from "@/lib/product";
import ApiHistoryPanel, { type ApiLog } from "@/components/ApiHistoryPanel";

type ShippingOption = {
  id: string;
  label: string;
  cost: number;
};

const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "us", label: "US Shipping", cost: 10 },
  { id: "ca", label: "Canada Shipping", cost: 20 },
  { id: "intl", label: "International", cost: 14.99 },
];

const TAX_RATE = 0.05;

const EXTRA_PRODUCTS = PRODUCTS.filter((_, i) => i !== 0).slice(0, 3);

function Confirmation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const canceled = searchParams.get("canceled");
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "placing" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption>(SHIPPING_OPTIONS[0]);
  const [extras, setExtras] = useState<Record<string, number>>(
    Object.fromEntries(EXTRA_PRODUCTS.map((p) => [p.sku, 0]))
  );

  const addLog = (log: Omit<ApiLog, "timestamp">) => {
    setLogs((prev) => [...prev, { ...log, timestamp: new Date().toLocaleTimeString() }]);
  };

  useEffect(() => {
    if (!order) return;
    const cc = order?.purchase_units?.[0]?.shipping?.address?.country_code ||
               order?.purchase_units?.[0]?.shipping?.address?.countryCode ||
               order?.payer?.address?.country_code ||
               order?.payer?.address?.countryCode || "";
    if (cc === "CA") setSelectedShipping(SHIPPING_OPTIONS[1]);
    else if (cc && cc !== "US") setSelectedShipping(SHIPPING_OPTIONS[2]);
    else setSelectedShipping(SHIPPING_OPTIONS[0]);
  }, [order]);

  useEffect(() => {
    if (canceled === "true") { setOrder(null); setStatus("ready"); return; }
    if (!token) { setStatus("error"); setErrorMsg("No order token found"); return; }
    fetchOrderDetails(token);
  }, [token, canceled]);

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const res = await fetch(`/api/paypal/get-order?orderId=${orderId}`);
      const data = await res.json();
      setOrder(data);
      setStatus("ready");

      // Use the _createOrderRequest from the get-order API (server-side reconstruction)
      const createReq = data._createOrderRequest;
      if (createReq) {
        addLog({ type: "createOrder", method: "POST", url: "/v2/checkout/orders", status: 201, request: createReq as Record<string, unknown>, response: data });
      }
      addLog({ type: "getOrder", method: "GET", url: `/api/paypal/orders/${orderId}`, status: data.id ? 200 : 404, request: { orderId }, response: data });
    } catch (err: any) {
      setStatus("error"); setErrorMsg(err.message);
    }
  };

  const itemTotal = parseFloat(order?.purchase_units?.[0]?.amount?.breakdown?.item_total?.value || "75");
  const extrasTotal = EXTRA_PRODUCTS.reduce((sum, p) => sum + parseFloat(p.price) * (extras[p.sku] || 0), 0);
  const combinedSubtotal = itemTotal + extrasTotal;
  const shippingCost = selectedShipping.cost;
  const tax = parseFloat((combinedSubtotal * TAX_RATE).toFixed(2));
  const grandTotal = parseFloat((combinedSubtotal + shippingCost + tax).toFixed(2));

  const buildFullCart = (): CartItem[] => {
    const originalItem: CartItem = {
      sku: order?.purchase_units?.[0]?.items?.[0]?.sku || PRODUCTS[0].sku,
      quantity: parseInt(order?.purchase_units?.[0]?.items?.[0]?.quantity || "1"),
    };
    const extraItems: CartItem[] = Object.entries(extras).filter(([_, q]) => q > 0).map(([sku, qty]) => ({ sku, quantity: qty }));
    return [originalItem, ...extraItems];
  };

  const handlePlaceOrder = async () => {
    if (!token) return;
    setStatus("placing");
    try {
      const fullCart = buildFullCart();
      console.log("ABOUT TO PATCH: cart=", JSON.stringify(fullCart), "shipping=", shippingCost, "tax=", tax);
      const patchRes = await patchOrderItems({ orderId: token, cart: fullCart, shippingCost, tax });
      console.log("PATCH RESULT:", JSON.stringify(patchRes));
      addLog({ type: "patchOrder", method: "PATCH", url: `/api/paypal/orders/${token}`, status: patchRes.success ? 200 : 500, request: { cart: fullCart, shippingCost, tax }, response: patchRes as unknown as Record<string, unknown> });
      if (!patchRes.success) throw new Error("Failed to patch order");
      const result = await captureOrder({ orderId: token });
      addLog({ type: "captureOrder", method: "POST", url: `/api/paypal/orders/${token}/capture`, status: 200, request: { orderId: token }, response: result as unknown as Record<string, unknown> });

      // Fetch final captured amount
      const finalRes = await fetch(`/api/paypal/get-order?orderId=${token}`);
      const finalOrder = await finalRes.json();
      const capturedAmount = finalOrder?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || finalOrder?.purchase_units?.[0]?.amount?.value || grandTotal.toFixed(2);
      addLog({ type: "getOrder", method: "GET", url: `/api/paypal/orders/${token}/final`, status: 200, request: { orderId: token }, response: finalOrder });
      setStatus("done");
    } catch (err: any) {
      setStatus("error"); setErrorMsg(err.message);
    }
  };

  if (canceled === "true") {
    return (
      <div className="flex min-h-screen">
        <div className="flex-1 max-w-xl mx-auto py-12 px-6">
          <div className="text-center border border-[var(--border)] rounded-lg p-8">
            <p className="text-lg text-[var(--foreground-secondary)] mb-4">Payment canceled</p>
            <Link href="/" className="text-[var(--accent)] hover:underline">← Back to product</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 max-w-xl mx-auto py-12 px-6">
        <h1 className="text-2xl font-bold mb-6">Review Your Order</h1>

        {status === "loading" && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        )}

        {status === "error" && (
          <div className="text-center border border-[var(--border)] rounded-lg p-8">
            <p className="text-lg text-[var(--error)] mb-2">Error</p>
            <p className="text-sm text-[var(--foreground-secondary)] mb-4">{errorMsg}</p>
            <Link href="/" className="text-[var(--accent)] hover:underline">← Back to product</Link>
          </div>
        )}

        {status === "ready" && order && (
          <div className="border border-[var(--border)] rounded-lg p-6 space-y-5">
            {/* 📦 Order Summary — clean table layout */}
            <h2 className="text-lg font-bold">📦 Order Summary</h2>

            {/* Items Table */}
            <div>
              <p className="text-[var(--foreground-secondary)] text-xs font-medium mb-2">ITEMS</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--foreground-secondary)] text-[11px] uppercase tracking-wider border-b border-[var(--border)]">
                    <th className="text-left pb-2 font-medium">Item</th>
                    <th className="text-center pb-2 font-medium">Qty</th>
                    <th className="text-right pb-2 font-medium">Unit Price</th>
                    <th className="text-right pb-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order?.purchase_units?.[0]?.items?.map((item: any, idx: number) => {
                    const prod = getProduct(item.sku);
                    const unitPrice = item.unit_amount?.value || item.unitAmount?.value || "0";
                    const lineTotal = (parseFloat(unitPrice) * parseInt(item.quantity)).toFixed(2);
                    return (
                      <tr key={idx} className="border-b border-[var(--border)]/50">
                        <td className="py-2.5 flex items-center gap-2">
                          <span>{prod.emoji}</span>
                          <span className="font-medium">{prod.name}</span>
                        </td>
                        <td className="py-2.5 text-center">{item.quantity}</td>
                        <td className="py-2.5 text-right">${unitPrice}</td>
                        <td className="py-2.5 text-right font-semibold">${lineTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <hr className="border-[var(--border)]" />

            {/* Extra Products — add/remove inline */}
            <div>
              <p className="text-[var(--foreground-secondary)] text-xs font-medium mb-2">ADD MORE</p>
              <div className="space-y-2">
                {EXTRA_PRODUCTS.map((p) => {
                  const qty = extras[p.sku] || 0;
                  return (
                    <div key={p.sku} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[var(--background-secondary)] overflow-hidden shrink-0">
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-[var(--foreground-secondary)] truncate">{p.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--foreground-secondary)] w-10 text-right">${p.price}</span>
                        <button
                          onClick={() => setExtras(prev => ({ ...prev, [p.sku]: Math.max(0, (prev[p.sku] || 0) - 1) }))}
                          className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center text-xs hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer"
                        >−</button>
                        <span className="w-5 text-center text-sm font-medium">{qty}</span>
                        <button
                          onClick={() => setExtras(prev => ({ ...prev, [p.sku]: (prev[p.sku] || 0) + 1 }))}
                          className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center text-xs hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <hr className="border-[var(--border)]" />

            {/* Order & Payer Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[var(--foreground-secondary)] mb-1 font-medium">ORDER INFO</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">ID</span><span className="font-mono">{order?.id || token}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Intent</span><span>{order?.intent}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Status</span><span className="text-yellow-500 font-semibold">{order?.status}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Created</span><span>{order?.create_time ? new Date(order.create_time).toLocaleString() : "—"}</span></div>
                </div>
              </div>
              <div>
                <p className="text-[var(--foreground-secondary)] mb-1 font-medium">PAYER</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Name</span><span>{order?.payer?.name?.given_name || ""} {order?.payer?.name?.surname || ""}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Email</span><span className="text-[10px]">{order?.payer?.email_address || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--foreground-secondary)]">Country</span><span>{order?.payer?.address?.country_code || order?.payer?.address?.countryCode || "—"}</span></div>
                </div>
              </div>
            </div>
            <hr className="border-[var(--border)]" />

            {/* Shipping Address */}
            <div className="text-xs">
              <p className="text-[var(--foreground-secondary)] mb-1 font-medium">SHIPPING ADDRESS</p>
              <p className="font-medium text-sm">{order.purchase_units?.[0]?.shipping?.name?.full_name || order.payer?.name?.given_name + " " + order.payer?.name?.surname || "—"}</p>
              <p className="text-[var(--foreground-secondary)]">{order.purchase_units?.[0]?.shipping?.address?.address_line_1 || order.purchase_units?.[0]?.shipping?.address?.addressLine1 || "—"}</p>
              <p className="text-[var(--foreground-secondary)]">{order.purchase_units?.[0]?.shipping?.address?.address_line_2 || order.purchase_units?.[0]?.shipping?.address?.addressLine2 || ""}</p>
              <p className="text-[var(--foreground-secondary)]">{[
                order.purchase_units?.[0]?.shipping?.address?.admin_area_2 || order.purchase_units?.[0]?.shipping?.address?.adminArea2 || "",
                order.purchase_units?.[0]?.shipping?.address?.admin_area_1 || order.purchase_units?.[0]?.shipping?.address?.adminArea1 || "",
                order.purchase_units?.[0]?.shipping?.address?.postal_code || order.purchase_units?.[0]?.shipping?.address?.postalCode || "",
              ].filter(Boolean).join(", ")}</p>
              <p className="text-[var(--foreground-secondary)]">{order.purchase_units?.[0]?.shipping?.address?.country_code || order.purchase_units?.[0]?.shipping?.address?.countryCode || order.payer?.address?.country_code || order.payer?.address?.countryCode || "US"}</p>
            </div>
            <hr className="border-[var(--border)]" />

            {/* Shipping Method */}
            <div className="text-xs">
              <p className="text-[var(--foreground-secondary)] mb-2 font-medium">SHIPPING METHOD</p>
              <div className="space-y-1.5">
                {SHIPPING_OPTIONS.map((opt) => (
                  <label key={opt.id} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedShipping.id === opt.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
                    <div className="flex items-center gap-2.5">
                      <input type="radio" name="shipping" checked={selectedShipping.id === opt.id} onChange={() => setSelectedShipping(opt)} className="accent-[var(--accent)]" />
                      <span className="text-sm">{opt.label}</span>
                    </div>
                    <span className="font-medium text-sm">${opt.cost.toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>
            <hr className="border-[var(--border)]" />

            {/* Price Breakdown — itemized */}
            <div className="text-sm">
              <p className="text-[var(--foreground-secondary)] mb-2 font-medium">PRICE BREAKDOWN</p>
              {/* Line items from order */}
              {order?.purchase_units?.[0]?.items?.map((item: any, idx: number) => {
                const prod = getProduct(item.sku);
                const unitPrice = item.unit_amount?.value || item.unitAmount?.value || "0";
                const lineTotal = (parseFloat(unitPrice) * parseInt(item.quantity)).toFixed(2);
                return (
                  <div key={idx} className="flex justify-between text-[var(--foreground-secondary)] text-xs items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-[var(--background-secondary)] overflow-hidden shrink-0">
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                      </div>
                      <span>{prod.name} × {item.quantity}</span>
                    </div>
                    <span>${lineTotal}</span>
                  </div>
                );
              })}
              {/* Added extras */}
              {EXTRA_PRODUCTS.filter(p => (extras[p.sku] || 0) > 0).map(p => (
                <div key={p.sku} className="flex justify-between text-[var(--accent)] text-xs">
                  <span>{p.emoji} {p.name} × {extras[p.sku]}</span>
                  <span>${(parseFloat(p.price) * extras[p.sku]).toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-[var(--border)]/50" />
              <div className="flex justify-between text-xs"><span>Items Subtotal</span><span>${combinedSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span>Shipping ({selectedShipping.label})</span><span>${shippingCost.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span>Tax (5%)</span><span>${tax.toFixed(2)}</span></div>
              <hr className="border-[var(--border)] my-2" />
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>
              {extrasTotal > 0 && <p className="text-[10px] text-[var(--foreground-secondary)] italic mt-1">* Items will be patched into the order before capture</p>}
            </div>

            {/* Place Order */}
            <button onClick={handlePlaceOrder} className="w-full py-3 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity cursor-pointer">
              Place Order — ${grandTotal.toFixed(2)}
            </button>
          </div>
        )}

        {status === "placing" && (
          <div className="text-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--foreground-secondary)]">Processing payment...</p>
          </div>
        )}

        {status === "done" && (
          <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-6 space-y-4">
            <div className="text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-lg font-semibold text-green-500 mb-1">Payment Successful!</p>
              <p className="text-sm text-[var(--foreground-secondary)]">Your order has been placed. Total charged: <strong>${grandTotal.toFixed(2)}</strong></p>
            </div>
            <hr className="border-green-500/20" />
            {/* Final Order Detail */}
            <div className="text-xs space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div>
                  <p className="text-[var(--foreground-secondary)]">Order ID</p>
                  <p className="font-mono font-medium break-all">{token}</p>
                </div>
                <div>
                  <p className="text-[var(--foreground-secondary)]">Status</p>
                  <p className="text-green-500 font-semibold">COMPLETED</p>
                </div>
                <div>
                  <p className="text-[var(--foreground-secondary)]">Payer</p>
                  <p className="font-medium">{order?.payer?.name?.given_name || ""} {order?.payer?.name?.surname || ""}</p>
                </div>
                <div>
                  <p className="text-[var(--foreground-secondary)]">Email</p>
                  <p className="font-medium text-[10px]">{order?.payer?.email_address || "—"}</p>
                </div>
              </div>
              <hr className="border-green-500/20" />
              {/* Final items */}
              <p className="font-medium text-[var(--foreground-secondary)]">Items</p>
              {order?.purchase_units?.[0]?.items?.map((item: any, idx: number) => {
                const prod = getProduct(item.sku);
                const unitPrice = item.unit_amount?.value || item.unitAmount?.value || "0";
                return (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-[var(--background-secondary)] overflow-hidden shrink-0">
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                      </div>
                      <span>{prod.name} × {item.quantity}</span>
                    </div>
                    <span className="font-medium">${(parseFloat(unitPrice) * parseInt(item.quantity)).toFixed(2)}</span>
                  </div>
                );
              })}
              {EXTRA_PRODUCTS.filter(p => (extras[p.sku] || 0) > 0).map(p => (
                <div key={p.sku} className="flex justify-between text-green-400 items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-[var(--background-secondary)] overflow-hidden shrink-0">
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <span>{p.name} × {extras[p.sku]}</span>
                  </div>
                  <span className="font-medium">${(parseFloat(p.price) * extras[p.sku]).toFixed(2)}</span>
                </div>
              ))}
              <hr className="border-green-500/20" />
              <div className="flex justify-between"><span>Shipping ({selectedShipping.label})</span><span>${shippingCost.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax (5%)</span><span>${tax.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm font-bold text-green-500"><span>Total Charged</span><span>${grandTotal.toFixed(2)}</span></div>
            </div>
            <hr className="border-green-500/20" />
            <div className="text-center">
              <Link href="/" className="text-[var(--accent)] hover:underline text-sm">← Back to shop</Link>
            </div>
          </div>
        )}
      </div>

      <ApiHistoryPanel logs={logs} />
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--foreground-secondary)]">Loading confirmation...</div>}>
      <Confirmation />
    </Suspense>
  );
}
