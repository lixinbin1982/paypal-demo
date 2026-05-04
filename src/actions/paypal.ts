"use server";

import {
  CheckoutPaymentIntent,
  ItemCategory,
  OrdersController,
  PatchOp,
} from "@paypal/paypal-server-sdk";
import { randomUUID } from "node:crypto";
import { paypalClient } from "@/lib/paypalClient";
import { getProduct, type CartItem } from "@/lib/product";

const ordersController = new OrdersController(paypalClient);

/**
 * Get the PayPal Client ID for SDK initialization
 */
export const getBrowserSafeClientId = async () => {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  if (!clientId) {
    throw new Error("PAYPAL_SANDBOX_CLIENT_ID is not defined");
  }
  return clientId;
};

function buildItemsArray(cart: CartItem[]) {
  let totalAmount = 0;
  const items = cart.map((item) => {
    const product = getProduct(item.sku);
    const itemTotal = (parseFloat(product.price) * item.quantity).toFixed(2);
    totalAmount += parseFloat(itemTotal);

    return {
      sku: item.sku,
      name: product.name,
      quantity: String(item.quantity),
      unitAmount: {
        currencyCode: "USD",
        value: product.price,
      },
      category: ItemCategory.PhysicalGoods,
    };
  });
  const itemSubtotal = totalAmount.toFixed(2);
  return { items, itemSubtotal };
}

/**
 * Create a PayPal order — simple item-only order
 */
export const createOrder = async ({
  cart,
}: {
  cart: CartItem[];
}) => {
  const { items, itemSubtotal } = buildItemsArray(cart);

  const orderRequestBody = {
    intent: CheckoutPaymentIntent.Capture,
    purchaseUnits: [
      {
        amount: {
          currencyCode: "USD",
          value: itemSubtotal,
          breakdown: {
            itemTotal: {
              currencyCode: "USD",
              value: itemSubtotal,
            },
          },
        },
        items,
      },
    ],
  };

  try {
    console.log("\n=== CREATE ORDER ===");
    console.log("REQUEST:", JSON.stringify(orderRequestBody, null, 2));

    const { result, statusCode } = await ordersController.createOrder({
      body: orderRequestBody,
      paypalRequestId: randomUUID(),
    });

    if (statusCode !== 201) {
      throw new Error(`Failed to create order: ${statusCode}`);
    }

    if (!result?.id) {
      throw new Error("No order ID returned from PayPal");
    }

    console.log("RESPONSE:", JSON.stringify(result, null, 2));
    console.log("================================\n");

    return { orderId: result.id };
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    throw error;
  }
};

/**
 * Patch a PayPal order's amount with shipping + tax before capture
 */
export const patchOrderAmount = async ({
  orderId,
  shippingCost,
  subtotal,
  tax,
}: {
  orderId: string;
  shippingCost: number;
  subtotal: number;
  tax?: number;
}) => {
  try {
    const taxValue = tax ?? 0;
    const total = (subtotal + shippingCost + taxValue).toFixed(2);
    const breakdown: Record<string, { currency_code: string; value: string }> = {
      item_total: { currency_code: "USD", value: subtotal.toFixed(2) },
      shipping: { currency_code: "USD", value: shippingCost.toFixed(2) },
    };
    if (taxValue > 0) {
      breakdown.tax_total = { currency_code: "USD", value: taxValue.toFixed(2) };
    }

    await ordersController.patchOrder({
      id: orderId,
      body: [
        {
          op: PatchOp.Replace,
          path: "/purchase_units/@reference_id=='default'/amount",
          value: {
            currency_code: "USD",
            value: total,
            breakdown,
          },
        },
      ],
    });

    console.log(
      `Patched order ${orderId}: subtotal $${subtotal.toFixed(2)} + shipping $${shippingCost.toFixed(2)} + tax $${taxValue.toFixed(2)} = $${total}`
    );
    return { success: true };
  } catch (error) {
    console.error("Error patching order:", error);
    return { success: false };
  }
};

/**
 * Patch a PayPal order's items AND amount in one call
 */
export const patchOrderItems = async ({
  orderId,
  cart,
  shippingCost,
  tax,
}: {
  orderId: string;
  cart: CartItem[];
  shippingCost: number;
  tax?: number;
}) => {
  try {
    const { items: camelItems, itemSubtotal } = buildItemsArray(cart);
    const itemSub = parseFloat(itemSubtotal);
    const taxValue = tax ?? 0;
    const total = (itemSub + shippingCost + taxValue).toFixed(2);
    const breakdown: Record<string, { currency_code: string; value: string }> = {
      item_total: { currency_code: "USD", value: itemSubtotal },
      shipping: { currency_code: "USD", value: shippingCost.toFixed(2) },
    };
    if (taxValue > 0) {
      breakdown.tax_total = { currency_code: "USD", value: taxValue.toFixed(2) };
    }

    // Convert items from SDK camelCase to REST snake_case
    const restItems = camelItems.map((i: any) => ({
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unit_amount: {
        currency_code: i.unitAmount.currencyCode,
        value: i.unitAmount.value,
      },
      category: "PHYSICAL_GOODS",
    }));

    // Combined PATCH — items + amount in one request (item_total must match items sum)
    console.log("COMBINED PATCH items + amount:", JSON.stringify({ items: restItems, amount: { value: total, breakdown } }, null, 2));
    await ordersController.patchOrder({
      id: orderId,
      body: [
        {
          op: PatchOp.Replace,
          path: "/purchase_units/@reference_id=='default'/items",
          value: restItems,
        },
        {
          op: PatchOp.Replace,
          path: "/purchase_units/@reference_id=='default'/amount",
          value: {
            currency_code: "USD",
            value: total,
            breakdown,
          },
        },
      ],
    });

    console.log(`Patched order ${orderId}: items and amount updated to $${total}`);
    return { success: true, itemSubtotal: itemSub };
  } catch (error) {
    console.error("Error patching order items:", error);
    return { success: false, itemSubtotal: 0 };
  }
};

/**
 * Capture a PayPal order (finalize payment)
 */
export const captureOrder = async ({ orderId }: { orderId: string }) => {
  try {
    const { result, statusCode } = await ordersController.captureOrder({
      id: orderId,
      prefer: "return=representation",
      paypalRequestId: randomUUID(),
    });

    if (statusCode !== 201) {
      throw new Error(`Failed to capture order: ${statusCode}`);
    }

    console.log(`\n========== CAPTURE FULL: ${orderId} ==========`);
    console.log(JSON.stringify(result, null, 2));
    console.log("========================================\n");

    return result;
  } catch (error) {
    console.error("Error capturing PayPal order:", error);
    throw error;
  }
};
