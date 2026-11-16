import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import SessionFlow from "@/models/SessionFlow";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-admin-authorization");
    const { searchParams } = new URL(req.url);
    const authQuery = searchParams.get("auth");
    const adminPassword = process.env.ADMIN_PASSWORD || "romeoPistol";

    if (authHeader !== adminPassword && authQuery !== adminPassword) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;
    const date = searchParams.get("date"); // YYYY-MM-DD
    const deviceType = searchParams.get("deviceType");
    const domain = searchParams.get("domain");
    const sessionId = searchParams.get("sessionId");
    const search = searchParams.get("search");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (sessionId) {
      query.sessionId = sessionId;
    }

    if (domain && domain !== "all") {
      query.domain = domain;
    }

    if (deviceType && deviceType !== "all") {
      query.deviceType = deviceType;
    }

    if (date) {
      const [year, month, day] = date.split("-").map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (search) {
      query.$or = [
        { sessionId: { $regex: search, $options: "i" } },
        { deviceId: { $regex: search, $options: "i" } },
        { domain: { $regex: search, $options: "i" } },
        { ip: { $regex: search, $options: "i" } },
        { browser: { $regex: search, $options: "i" } },
        { os: { $regex: search, $options: "i" } },
      ];
    }

    // Sort: when viewing a specific date, sort chronological (start of day to end)
    // Otherwise sort newest sessions first
    const sortField = date ? "createdAt" : "-updatedAt";

    const [sessions, total, availableDomains] = await Promise.all([
      SessionFlow.find(query).sort(sortField).skip(skip).limit(limit).lean(),
      SessionFlow.countDocuments(query),
      SessionFlow.distinct("domain"),
    ]);

    return NextResponse.json({
      success: true,
      sessions,
      availableDomains: availableDomains.filter(Boolean),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET sessions error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || "Server error" },
      { status: 500 }
    );
  }
}
