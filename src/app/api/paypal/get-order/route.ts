import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  try {
    // Get OAuth token
    const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
    const baseUrl = process.env.PAYPAL_SANDBOX_BASE_URL || "https://api-m.sandbox.paypal.com";

    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch order with full representation
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      return NextResponse.json({ error: "Failed to get order", details: orderData }, { status: orderRes.status });
    }

    // Reconstruct the original createOrder request from the order data
    const purchaseUnit = orderData?.purchase_units?.[0];
    const items = purchaseUnit?.items?.map((i: any) => ({
      name: i.name,
      unit_amount: {
        currency_code: i.unit_amount?.currency_code || "USD",
        value: i.unit_amount?.value || "0",
      },
      quantity: i.quantity,
      sku: i.sku,
      category: i.category || "PHYSICAL_GOODS",
    })) || [];

    const createOrderRequest = {
      intent: orderData?.intent || "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: purchaseUnit?.amount?.currency_code || "USD",
            value: purchaseUnit?.amount?.value || "0",
            breakdown: {
              item_total: {
                currency_code: purchaseUnit?.amount?.breakdown?.item_total?.currency_code || "USD",
                value: purchaseUnit?.amount?.breakdown?.item_total?.value || purchaseUnit?.amount?.value || "0",
              },
            },
          },
          items,
        },
      ],
    };

    return NextResponse.json({
      ...orderData,
      _createOrderRequest: createOrderRequest,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
    }, { status: 500 });
  }
}
