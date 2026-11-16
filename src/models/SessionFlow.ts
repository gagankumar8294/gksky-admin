import mongoose, { Schema, Document } from "mongoose";

export interface IEvent {
  type: "nav" | "click" | "heartbeat";
  path: string;
  title?: string;
  label?: string;
  duration?: number;
  timestamp: Date;
}

export interface ISessionFlow extends Document {
  sessionId: string;
  deviceId: string;
  domain: string; // supports multi-domain & subdomains e.g. gksky.in, blog.gksky.in
  userAgent?: string;
  ip?: string;
  deviceType?: "mobile" | "desktop" | "tablet";
  os?: string;
  browser?: string;
  referrer?: string;
  totalDuration: number;
  startedAt: Date;
  events: IEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>({
  type: { type: String, enum: ["nav", "click", "heartbeat"], required: true },
  path: { type: String, required: true },
  title: { type: String, default: "" },
  label: { type: String, default: "" },
  duration: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

const sessionFlowSchema = new Schema<ISessionFlow>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    deviceId: { type: String, required: true, index: true },
    domain: { type: String, default: "gksky.in", index: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    deviceType: { type: String, enum: ["mobile", "desktop", "tablet"], default: "desktop" },
    os: { type: String, default: "Unknown" },
    browser: { type: String, default: "Unknown" },
    referrer: { type: String, default: "" },
    totalDuration: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    events: [eventSchema],
  },
  { timestamps: true }
);

sessionFlowSchema.index({ sessionId: 1 });
sessionFlowSchema.index({ deviceId: 1 });
sessionFlowSchema.index({ domain: 1 });
sessionFlowSchema.index({ createdAt: -1 });
sessionFlowSchema.index({ updatedAt: -1 });

export default mongoose.models.SessionFlow ||
  mongoose.model<ISessionFlow>("SessionFlow", sessionFlowSchema);
