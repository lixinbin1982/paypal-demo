import { NextRequest, NextResponse } from "next/server";

type Address = {
  country_code: string;
  admin_area_1?: string;
  admin_area_2?: string;
  postal_code?: string;
};

type FullAddress = Address & {
  address_line_1?: string;
};

/**
 * PayPal Shipping Callback
 *
 * Called by PayPal when the user changes their shipping address or shipping options
 * in the PayPal popup. We respond with available shipping options and the new amount.
 */
export async function POST(req: NextRequest) {
  console.log("\n========== SHIPPING CALLBACK ==========");

  try {
    const body = await req.json();
    console.log("Callback body:", JSON.stringify(body, null, 2));

    const address: Address | undefined =
      body?.shipping_address?.address ||
      body?.address?.address ||
      body?.shipping_address;

    if (!address) {
      console.log("No address found in callback, using defaults");
      return shippingResponse({
        options: [
          { id: "standard", label: "US Shipping", cost: 10, selected: true },
        ],
      });
    }

    const cc = address.country_code ?? "";
    const state = address.admin_area_1 ?? "";

    // Calculate shipping based on country
    const options = getShippingOptions(cc, state);

    console.log(`Address: ${cc}/${state} → options:`, options);

    // Determine which option is selected (first = default)
    const selectedId = body?.selected_shipping_option?.id ?? options[0].id;
    const selected = options.find((o) => o.id === selectedId) ?? options[0];

    return shippingResponse({
      options: options.map((o) => ({
        ...o,
        selected: o.id === selectedId,
      })),
    });
  } catch (error) {
    console.error("Shipping callback error:", error);
    return shippingResponse({
      options: [
        { id: "us", label: "US Shipping", cost: 10, selected: true },
      ],
    });
  } finally {
    console.log("========================================\n");
  }
}

function getShippingOptions(countryCode: string, _state: string) {
  switch (countryCode) {
    case "US":
      return [
        { id: "us_standard", label: "US Standard", cost: 10, selected: true },
        { id: "us_express", label: "US Express", cost: 18, selected: false },
      ];
    case "CA":
      return [
        { id: "ca_standard", label: "Canada Standard", cost: 20, selected: true },
      ];
    default:
      return [
        { id: "intl_standard", label: "International", cost: 14.99, selected: true },
      ];
  }
}

type ShippingOption = {
  id: string;
  label: string;
  cost: number;
  selected?: boolean;
  type?: "SHIPPING" | "PICKUP";
};

type ShippingResponseBody = {
  shipping_options: {
    id: string;
    label: string;
    selected: boolean;
    type: "SHIPPING" | "PICKUP";
    amount: {
      currency_code: string;
      value: string;
    };
  }[];
};

function shippingResponse({ options }: { options: ShippingOption[] }) {
  const body: ShippingResponseBody = {
    shipping_options: options.map((o) => ({
      id: o.id,
      label: o.label,
      selected: o.selected ?? false,
      type: o.type ?? "SHIPPING",
      amount: {
        currency_code: "USD",
        value: o.cost.toFixed(2),
      },
    })),
  };

  return NextResponse.json(body, { status: 200 });
}
