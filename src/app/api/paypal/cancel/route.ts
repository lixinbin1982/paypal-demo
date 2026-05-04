import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  console.log("PayPal cancel — redirecting to main page");
  return NextResponse.redirect(new URL("/", url.origin));
}

export async function POST(req: Request) {
  return GET(req);
}
