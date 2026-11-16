import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD || "romeoPistol";

    if (password === adminPassword) {
      return NextResponse.json({ success: true, token: adminPassword });
    } else {
      return NextResponse.json(
        { success: false, error: "Incorrect admin password" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
