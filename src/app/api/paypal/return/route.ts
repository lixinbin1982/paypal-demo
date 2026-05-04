import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  console.log("PayPal return — redirecting to main page with approval");
  // Redirect to product page; the SDK will detect the return and trigger onApprove
  return NextResponse.redirect(new URL("/", url.origin));
}

export async function POST(req: Request) {
  return GET(req);
}
