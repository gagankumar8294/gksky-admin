import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import SessionFlow from "@/models/SessionFlow";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-admin-authorization");
    const { searchParams } = new URL(req.url);
    const authQuery = searchParams.get("auth");
    const domain = searchParams.get("domain");
    const adminPassword = process.env.ADMIN_PASSWORD || "romeoPistol";

    if (authHeader !== adminPassword && authQuery !== adminPassword) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filterQuery: any = {};
    if (domain && domain !== "all") {
      filterQuery.domain = domain;
    }

    const [
      activeNowCount,
      totalSessions,
      todaySessions,
      uniqueDevices,
      deviceBreakdown,
      domainBreakdown,
      allSessions,
    ] = await Promise.all([
      SessionFlow.countDocuments({ ...filterQuery, updatedAt: { $gte: fiveMinutesAgo } }),
      SessionFlow.countDocuments(filterQuery),
      SessionFlow.countDocuments({ ...filterQuery, createdAt: { $gte: startOfToday } }),
      SessionFlow.distinct("deviceId", filterQuery),
      SessionFlow.aggregate([
        { $match: filterQuery },
        { $group: { _id: "$deviceType", count: { $sum: 1 } } },
      ]),
      SessionFlow.aggregate([
        { $group: { _id: "$domain", count: { $sum: 1 } } },
      ]),
      SessionFlow.find(filterQuery, { totalDuration: 1, events: 1 }).lean(),
    ]);

    // Calculate averages & click metrics
    let totalDurationSum = 0;
    let telegramClicks = 0;
    let emailClicks = 0;
    let copyClicks = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allSessions.forEach((s: any) => {
      totalDurationSum += s.totalDuration || 0;
      if (s.events && Array.isArray(s.events)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        s.events.forEach((ev: any) => {
          if (ev.type === "click") {
            const lbl = (ev.label || "").toLowerCase();
            if (lbl.includes("telegram")) telegramClicks++;
            else if (lbl.includes("email") || lbl.includes("mail")) emailClicks++;
            else if (lbl.includes("copy")) copyClicks++;
          }
        });
      }
    });

    const avgDuration =
      totalSessions > 0 ? Math.round(totalDurationSum / totalSessions) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        activeNow: activeNowCount,
        totalSessions,
        todaySessions,
        uniqueVisitors: uniqueDevices.length,
        avgDuration, // in seconds
        deviceBreakdown,
        domainBreakdown,
        conversions: {
          telegramClicks,
          emailClicks,
          copyClicks,
          totalClicks: telegramClicks + emailClicks + copyClicks,
        },
      },
    });
  } catch (error) {
    console.error("GET stats error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
