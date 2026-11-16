import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import SessionFlow from "@/models/SessionFlow";
import { parseUserAgent } from "@/lib/deviceDetector";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, deviceId, userAgent, events, referrer } = body;

    if (!sessionId || !deviceId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId or deviceId" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract client IP address
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const cfIp = req.headers.get("cf-connecting-ip");
    const rawIp = cfIp || (forwarded ? forwarded.split(",")[0].trim() : realIp || "");
    const clientIp = rawIp.replace(/^::ffff:/, "").trim();

    const ua = userAgent || req.headers.get("user-agent") || "";
    const { deviceType, os, browser } = parseUserAgent(ua);

    await connectDB();

    // Upsert session
    const updatedSession = await SessionFlow.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          deviceId,
          userAgent: ua,
          deviceType,
          os,
          browser,
          ...(referrer ? { referrer } : {}),
          ...(clientIp ? { ip: clientIp } : {}),
        },
        $push: {
          events: { $each: events || [] },
        },
      },
      { new: true, upsert: true }
    );

    // Calculate duration from events
    if (updatedSession && updatedSession.events.length > 0) {
      const firstEvent = updatedSession.events[0];
      const lastEvent = updatedSession.events[updatedSession.events.length - 1];
      const start = new Date(firstEvent.timestamp).getTime();
      const end = new Date(lastEvent.timestamp).getTime();
      const totalDuration = Math.max(0, Math.round((end - start) / 1000));
      updatedSession.totalDuration = totalDuration;
      await updatedSession.save();
    }

    return NextResponse.json(
      { success: true, message: "Sync complete" },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Analytics sync error:", error);
    return NextResponse.json(
      { success: false, error: "Server error during sync" },
      { status: 500, headers: corsHeaders }
    );
  }
}
