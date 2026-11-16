"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Activity,
  Clock,
  Smartphone,
  Laptop,
  Tablet,
  MousePointer,
  Navigation,
  Calendar,
  RefreshCw,
  LogOut,
  Lock,
  Search,
  ExternalLink,
  Volume2,
  VolumeX,
  Eye,
  Globe,
  Zap,
  X,
  Layers,
  Sparkles,
} from "lucide-react";

interface IEvent {
  type: "nav" | "click" | "heartbeat";
  path: string;
  title?: string;
  label?: string;
  duration?: number;
  timestamp: string;
}

interface ISession {
  _id: string;
  sessionId: string;
  deviceId: string;
  domain?: string;
  userAgent?: string;
  ip?: string;
  deviceType?: "mobile" | "desktop" | "tablet";
  os?: string;
  browser?: string;
  referrer?: string;
  totalDuration: number;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
  events: IEvent[];
}

interface IStats {
  activeNow: number;
  totalSessions: number;
  todaySessions: number;
  uniqueVisitors: number;
  avgDuration: number;
  deviceBreakdown: { _id: string; count: number }[];
  domainBreakdown?: { _id: string; count: number }[];
  conversions: {
    telegramClicks: number;
    emailClicks: number;
    copyClicks: number;
    totalClicks: number;
  };
}

// Web Audio API Chime for New Live Visitor
const playVisitorChime = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.2);

    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1320, ctx.currentTime);
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      } catch {
        // silent fail
      }
    }, 100);
  } catch {
    // silent fail
  }
};

export default function AdminPortal() {
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (typeof window !== "undefined") {
      return !!sessionStorage.getItem("gksky_admin_auth");
    }
    return false;
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Analytics states
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [stats, setStats] = useState<IStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ISession | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<"all" | "desktop" | "mobile" | "tablet">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousSessionCount = useRef(0);

  // Quick 7-Day Date Filter Pills computed safely
  const [recentDays] = useState(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      const dayName =
        i === 0 ? "Today" : i === 1 ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      list.push({ ymd, dayName, dayNum, monthName, isToday: i === 0 });
    }
    return list;
  });

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("gksky_admin_auth", data.token);
        setIsAuthorized(true);
      } else {
        setAuthError(data.error || "Incorrect password");
      }
    } catch {
      setAuthError("Failed to connect to authentication service");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("gksky_admin_auth");
    setIsAuthorized(false);
    setPassword("");
  };

  // Fetch stats and sessions
  const fetchData = useCallback(async () => {
    const token = sessionStorage.getItem("gksky_admin_auth");
    if (!token) return;

    try {
      const headers = { "x-admin-authorization": token };

      // 1. Fetch Stats (filtered by domain if set)
      const statsParams = new URLSearchParams();
      if (selectedDomain !== "all") statsParams.append("domain", selectedDomain);

      const statsRes = await fetch(`/api/analytics/stats?${statsParams.toString()}`, { headers });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // 2. Fetch Sessions
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (selectedDomain !== "all") params.append("domain", selectedDomain);
      if (selectedDate) params.append("date", selectedDate);
      if (deviceFilter !== "all") params.append("deviceType", deviceFilter);
      if (searchTerm) params.append("search", searchTerm);

      const sessRes = await fetch(`/api/analytics/sessions?${params.toString()}`, { headers });
      const sessData = await sessRes.json();
      if (sessData.success) {
        setSessions(sessData.sessions || []);
        if (sessData.availableDomains && Array.isArray(sessData.availableDomains)) {
          const domains = Array.from(new Set(["gksky.in", ...sessData.availableDomains]));
          setAvailableDomains(domains);
        }
        setTotalPages(sessData.pagination?.pages || 1);
        setTotalRecords(sessData.pagination?.total || 0);

        // Chime on new sessions
        if (
          previousSessionCount.current > 0 &&
          sessData.pagination?.total > previousSessionCount.current &&
          soundEnabled
        ) {
          playVisitorChime();
        }
        previousSessionCount.current = sessData.pagination?.total || 0;
      }
    } catch (err) {
      console.error("Fetch data error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedDomain, selectedDate, deviceFilter, searchTerm, soundEnabled]);

  // Initial load & filter change (fetches once on render/filter change, no polling)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthorized) {
        fetchData();
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [isAuthorized, fetchData]);

  // Helper formatting duration
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "< 5s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Helper relative time
  const timeAgo = (dateStr: string) => {
    const now = new Date().getTime();
    const past = new Date(dateStr).getTime();
    const diffSec = Math.floor((now - past) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  // -------------------------------------------------------------
  // 1. LOGIN SCREEN (Themed with GK Sky aesthetic)
  // -------------------------------------------------------------
  if (!isAuthorized) {
    return (
      <div className="relative min-h-screen bg-[#fbdbc6] text-[#1c1815] flex flex-col items-center justify-center p-6 selection:bg-[#1c1815] selection:text-[#fbdbc6]">
        {/* Soft Background Artwork Watermark */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center -z-10 select-none overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gksky-logo.jpg"
            alt="GK Sky Artwork Backdrop"
            className="w-full h-full max-w-xl object-contain opacity-25 filter blur-[2px]"
          />
        </div>

        <div className="w-full max-w-md p-8 sm:p-9 rounded-3xl bg-white/60 border border-[#1c1815]/15 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="flex flex-col items-center text-center space-y-4 mb-7">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border border-[#1c1815]/20 bg-[#fbdbc6] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gksky-logo.jpg"
                alt="GK Sky Logo"
                className="w-full h-full object-cover scale-110"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1c1815] flex items-center justify-center gap-2">
                GK Sky Admin
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#1c1815]/10 text-[#1c1815] border border-[#1c1815]/15 font-semibold">
                  Portal
                </span>
              </h1>
              <p className="text-xs text-[#554741] mt-1.5 font-medium">
                Enter your admin password to view visitor journeys across all domains &amp; subdomains
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1c1815] mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#554741] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (default: romeoPistol)"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/75 border border-[#1c1815]/20 text-[#1c1815] placeholder-[#807067] focus:outline-none focus:border-[#1c1815] focus:ring-1 focus:ring-[#1c1815] text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-900 text-xs text-center font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#1c1815] text-[#fbdbc6] font-semibold text-sm shadow-lg shadow-[#1c1815]/20 hover:bg-[#2e2622] transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            >
              {authLoading ? "Authenticating..." : "Unlock Analytics Dashboard"}
            </button>
          </form>

          <div className="mt-8 pt-4 border-t border-[#1c1815]/10 text-center text-xs text-[#6e5d55]">
            GK Sky &bull; admin.gksky.in
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. MAIN ADMIN ANALYTICS DASHBOARD (Themed matching gksky.in)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#fbdbc6] text-[#1c1815] flex flex-col selection:bg-[#1c1815] selection:text-[#fbdbc6]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#fbdbc6]/90 backdrop-blur-md border-b border-[#1c1815]/12 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm border border-[#1c1815]/20 bg-[#fbdbc6] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gksky-logo.jpg"
                alt="GK Sky Logo"
                className="w-full h-full object-cover scale-110"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-[#1c1815] tracking-tight">GK Sky Analytics</h1>
                <span className="px-2 py-0.5 rounded-full bg-[#1c1815]/8 border border-[#1c1815]/15 text-[#1c1815] text-[10px] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c85f40] animate-pulse" />
                  Live Engine
                </span>
              </div>
              <p className="text-xs text-[#5f5049] flex items-center gap-1 font-medium">
                <span>admin.gksky.in</span>
                <span>&bull;</span>
                <span className="text-[#c85f40]">
                  {selectedDomain === "all" ? "All Domains & Subdomains" : selectedDomain}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live website link */}
            <a
              href="https://gksky.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 hover:bg-white/90 border border-[#1c1815]/15 text-xs text-[#1c1815] font-medium transition-colors shadow-xs"
            >
              <span>Visit gksky.in</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>

            {/* Sound chime toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-colors ${
                soundEnabled
                  ? "bg-[#1c1815] text-[#fbdbc6] border-[#1c1815]"
                  : "bg-white/50 border-[#1c1815]/15 text-[#554741]"
              }`}
              title={soundEnabled ? "Audio Chime ON" : "Audio Chime OFF"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white border border-[#1c1815]/15 text-[#1c1815] text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
              title="Refresh data manually"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#c85f40]" : ""}`} />
              <span className="hidden md:inline">{loading ? "Refreshing..." : "Refresh"}</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-white/60 hover:bg-rose-500/10 border border-[#1c1815]/15 hover:border-rose-500/30 text-[#1c1815] hover:text-rose-800 transition-colors shadow-xs"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full space-y-7 flex-1">
        {/* DOMAIN & SUBDOMAIN SELECTOR BAR */}
        <section className="p-4 rounded-2xl bg-white/50 border border-[#1c1815]/12 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1c1815]">
            <Layers className="w-4 h-4 text-[#c85f40]" />
            <span>Active Domain Filter:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedDomain("all");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedDomain === "all"
                  ? "bg-[#1c1815] text-[#fbdbc6] shadow-md shadow-[#1c1815]/15"
                  : "bg-white/60 hover:bg-white text-[#1c1815] border border-[#1c1815]/12"
              }`}
            >
              🌐 All Domains &amp; Subdomains
            </button>

            <button
              onClick={() => {
                setSelectedDomain("gksky.in");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedDomain === "gksky.in"
                  ? "bg-[#1c1815] text-[#fbdbc6] shadow-md shadow-[#1c1815]/15"
                  : "bg-white/60 hover:bg-white text-[#1c1815] border border-[#1c1815]/12"
              }`}
            >
              gksky.in (Main Site)
            </button>

            {/* Dynamic additional subdomains */}
            {availableDomains
              .filter((d) => d !== "gksky.in")
              .map((dom) => (
                <button
                  key={dom}
                  onClick={() => {
                    setSelectedDomain(dom);
                    setPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedDomain === dom
                      ? "bg-[#1c1815] text-[#fbdbc6] shadow-md shadow-[#1c1815]/15"
                      : "bg-white/60 hover:bg-white text-[#1c1815] border border-[#1c1815]/12"
                  }`}
                >
                  {dom}
                </button>
              ))}
          </div>
        </section>

        {/* STATS OVERVIEW CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Active Now */}
          <div className="p-5 rounded-2xl bg-white/60 border border-[#1c1815]/12 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#c85f40] font-bold mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#c85f40] animate-ping" />
                Active Now
              </span>
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-3xl font-extrabold text-[#1c1815] tracking-tight">
              {stats?.activeNow ?? 0}
            </div>
            <p className="text-[11px] text-[#554741] mt-1 font-medium">Visitors browsing in last 5m</p>
          </div>

          {/* Card 2: Today's Visitors */}
          <div className="p-5 rounded-2xl bg-white/60 border border-[#1c1815]/12 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#1c1815] font-bold mb-3">
              <span>Today&apos;s Sessions</span>
              <Calendar className="w-4 h-4 text-[#c85f40]" />
            </div>
            <div className="text-3xl font-extrabold text-[#1c1815] tracking-tight">
              {stats?.todaySessions ?? 0}
            </div>
            <p className="text-[11px] text-[#554741] mt-1 font-medium">Recorded visits today</p>
          </div>

          {/* Card 3: Total Visitors */}
          <div className="p-5 rounded-2xl bg-white/60 border border-[#1c1815]/12 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#1c1815] font-bold mb-3">
              <span>Unique Devices</span>
              <Users className="w-4 h-4 text-[#c85f40]" />
            </div>
            <div className="text-3xl font-extrabold text-[#1c1815] tracking-tight">
              {stats?.uniqueVisitors ?? 0}
            </div>
            <p className="text-[11px] text-[#554741] mt-1 font-medium">Distinct visitors all-time</p>
          </div>

          {/* Card 4: Avg Duration */}
          <div className="p-5 rounded-2xl bg-white/60 border border-[#1c1815]/12 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#1c1815] font-bold mb-3">
              <span>Avg Duration</span>
              <Clock className="w-4 h-4 text-[#c85f40]" />
            </div>
            <div className="text-3xl font-extrabold text-[#1c1815] tracking-tight">
              {formatDuration(stats?.avgDuration ?? 0)}
            </div>
            <p className="text-[11px] text-[#554741] mt-1 font-medium">Average time spent per visit</p>
          </div>

          {/* Card 5: Conversion Clicks */}
          <div className="p-5 rounded-2xl bg-white/60 border border-[#1c1815]/12 shadow-sm col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-xs text-[#1c1815] font-bold mb-3">
              <span>Action Clicks</span>
              <Zap className="w-4 h-4 text-[#c85f40]" />
            </div>
            <div className="text-3xl font-extrabold text-[#1c1815] tracking-tight">
              {stats?.conversions.totalClicks ?? 0}
            </div>
            <p className="text-[11px] text-[#554741] mt-1 font-medium">
              Telegram: {stats?.conversions.telegramClicks || 0} &bull; Email:{" "}
              {stats?.conversions.emailClicks || 0}
            </p>
          </div>
        </section>

        {/* DATE FILTER PILLS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#554741]">
            <span>Filter by Day</span>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="text-[#c85f40] hover:underline font-semibold normal-case flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Date Filter</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedDate("")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                selectedDate === ""
                  ? "bg-[#1c1815] text-[#fbdbc6] shadow-md shadow-[#1c1815]/15"
                  : "bg-white/60 hover:bg-white text-[#1c1815] border border-[#1c1815]/12"
              }`}
            >
              All Time
            </button>

            {recentDays.map((day) => {
              const isSelected = selectedDate === day.ymd;
              return (
                <button
                  key={day.ymd}
                  onClick={() => setSelectedDate(day.ymd)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? "bg-[#1c1815] text-[#fbdbc6] shadow-md shadow-[#1c1815]/15"
                      : "bg-white/60 hover:bg-white text-[#1c1815] border border-[#1c1815]/12"
                  }`}
                >
                  <span>{day.dayName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected ? "bg-white/20 text-[#fbdbc6]" : "bg-[#1c1815]/8 text-[#554741]"
                    }`}
                  >
                    {day.monthName} {day.dayNum}
                  </span>
                </button>
              );
            })}

            {/* Custom Date Input */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 border border-[#1c1815]/15 text-xs text-[#1c1815]">
              <Calendar className="w-3.5 h-3.5 text-[#554741]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-[#1c1815] text-xs font-medium focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* SEARCH & DEVICE TABS */}
        <section className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Device Tabs */}
          <div className="p-1 rounded-2xl bg-white/60 border border-[#1c1815]/12 flex items-center gap-1 text-xs font-semibold shadow-xs">
            <button
              onClick={() => setDeviceFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl transition-colors ${
                deviceFilter === "all" ? "bg-[#1c1815] text-[#fbdbc6]" : "text-[#554741] hover:text-[#1c1815]"
              }`}
            >
              All Devices
            </button>
            <button
              onClick={() => setDeviceFilter("desktop")}
              className={`px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                deviceFilter === "desktop" ? "bg-[#1c1815] text-[#fbdbc6]" : "text-[#554741] hover:text-[#1c1815]"
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setDeviceFilter("mobile")}
              className={`px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                deviceFilter === "mobile" ? "bg-[#1c1815] text-[#fbdbc6]" : "text-[#554741] hover:text-[#1c1815]"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
            <button
              onClick={() => setDeviceFilter("tablet")}
              className={`px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                deviceFilter === "tablet" ? "bg-[#1c1815] text-[#fbdbc6]" : "text-[#554741] hover:text-[#1c1815]"
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 text-[#807067] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by IP, Domain, Device ID, or Session..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white/70 border border-[#1c1815]/15 text-xs text-[#1c1815] placeholder-[#807067] focus:outline-none focus:border-[#1c1815] font-medium shadow-xs"
            />
          </div>
        </section>

        {/* SESSIONS JOURNEY STREAM LIST */}
        <section className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#554741] font-medium">
            <span>
              Showing <strong className="text-[#1c1815]">{sessions.length}</strong> of{" "}
              <strong className="text-[#1c1815]">{totalRecords}</strong> visitor journeys
            </span>
            {selectedDate && (
              <span className="font-mono text-[#c85f40] font-semibold">
                Sorted chronological (morning ➔ evening)
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#554741] space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#c85f40]" />
              <p className="text-xs font-medium">Loading visitor journeys...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white/60 border border-[#1c1815]/12 text-[#554741] space-y-3 shadow-sm">
              <Globe className="w-10 h-10 mx-auto text-[#a08f85]" />
              <h3 className="text-sm font-bold text-[#1c1815]">No visitor sessions recorded yet</h3>
              <p className="text-xs text-[#6e5d55] max-w-md mx-auto">
                Once visitors start browsing <span className="text-[#c85f40] font-semibold">gksky.in</span> or your subdomains, their live journeys, clicks, and device stats will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((sess) => {
                const isMobile = sess.deviceType === "mobile";
                const isTablet = sess.deviceType === "tablet";
                const eventsCount = sess.events?.length || 0;
                const hasClick = sess.events?.some((ev) => ev.type === "click");

                return (
                  <div
                    key={sess.sessionId}
                    onClick={() => setSelectedSession(sess)}
                    className="p-4 sm:p-5 rounded-2xl bg-white/65 hover:bg-white border border-[#1c1815]/12 hover:border-[#1c1815]/30 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group shadow-sm"
                  >
                    {/* Left: Device & Visitor Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#1c1815]/8 border border-[#1c1815]/15 flex items-center justify-center text-[#1c1815] group-hover:scale-105 transition-transform shrink-0">
                        {isMobile ? (
                          <Smartphone className="w-5 h-5 text-[#c85f40]" />
                        ) : isTablet ? (
                          <Tablet className="w-5 h-5 text-purple-700" />
                        ) : (
                          <Laptop className="w-5 h-5 text-[#1c1815]" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[#1c1815]">
                            {sess.os || "Unknown OS"} &bull; {sess.browser || "Browser"}
                          </span>

                          {/* Domain / Subdomain Badge */}
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1c1815]/10 text-[#1c1815] border border-[#1c1815]/15 font-semibold">
                            {sess.domain || "gksky.in"}
                          </span>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-[#1c1815]/10 text-[#554741]">
                            IP: {sess.ip || "Direct"}
                          </span>

                          {hasClick && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#c85f40]/15 text-[#9a3d24] border border-[#c85f40]/25 font-semibold flex items-center gap-1">
                              <MousePointer className="w-3 h-3" />
                              Interacted
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#554741] font-medium">
                          <span className="font-mono text-[11px] text-[#705e55]">
                            Device #{sess.deviceId.slice(-6)}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#705e55]" />
                            {timeAgo(sess.createdAt)}
                          </span>
                          <span>&bull;</span>
                          <span className="text-[#1c1815] font-semibold">
                            Duration: {formatDuration(sess.totalDuration)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions Count & Inspect button */}
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs text-[#1c1815] font-bold">
                          {eventsCount} {eventsCount === 1 ? "Event" : "Events"}
                        </div>
                        <div className="text-[11px] text-[#705e55] font-medium">
                          {new Date(sess.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSession(sess);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1c1815] hover:bg-[#2e2622] text-[#fbdbc6] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Journey</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 rounded-xl bg-white/70 hover:bg-white border border-[#1c1815]/15 text-xs font-semibold text-[#1c1815] disabled:opacity-40 shadow-xs"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-[#554741] px-3">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-4 py-2 rounded-xl bg-white/70 hover:bg-white border border-[#1c1815]/15 text-xs font-semibold text-[#1c1815] disabled:opacity-40 shadow-xs"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </main>

      {/* JOURNEY INSPECTOR TIMELINE MODAL (Themed in warm porcelain & charcoal) */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-[#1c1815]/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#fbdbc6] border border-[#1c1815]/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#1c1815]/12 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#1c1815]">Visitor Journey Flow</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#1c1815]/10 text-[#1c1815] border border-[#1c1815]/15 font-semibold">
                    {selectedSession.domain || "gksky.in"}
                  </span>
                </div>
                <p className="text-xs text-[#554741] mt-1 font-medium">
                  Started at {new Date(selectedSession.createdAt).toLocaleString()} &bull; Duration:{" "}
                  {formatDuration(selectedSession.totalDuration)}
                </p>
              </div>

              <button
                onClick={() => setSelectedSession(null)}
                className="p-2 rounded-xl bg-white/60 hover:bg-white text-[#1c1815] border border-[#1c1815]/15 transition-colors shadow-xs"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Device & Client Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-white/65 border border-[#1c1815]/12 shadow-xs">
                <span className="text-[#705e55] block text-[10px] uppercase font-bold">Domain</span>
                <span className="font-bold text-[#1c1815] truncate block">
                  {selectedSession.domain || "gksky.in"}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white/65 border border-[#1c1815]/12 shadow-xs">
                <span className="text-[#705e55] block text-[10px] uppercase font-bold">Device</span>
                <span className="font-bold text-[#1c1815] capitalize">
                  {selectedSession.deviceType || "Desktop"}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white/65 border border-[#1c1815]/12 shadow-xs">
                <span className="text-[#705e55] block text-[10px] uppercase font-bold">OS / Browser</span>
                <span className="font-bold text-[#1c1815] truncate block">
                  {selectedSession.os || "OS"} &bull; {selectedSession.browser || "Browser"}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white/65 border border-[#1c1815]/12 shadow-xs">
                <span className="text-[#705e55] block text-[10px] uppercase font-bold">Client IP</span>
                <span className="font-bold text-[#1c1815] font-mono">{selectedSession.ip || "Direct"}</span>
              </div>
            </div>

            {/* Interactive Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1c1815] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#c85f40]" />
                <span>Step-by-Step Activity Log ({selectedSession.events?.length || 0} Events)</span>
              </h4>

              <div className="relative pl-6 space-y-3 border-l-2 border-[#1c1815]/20 py-2 max-h-[300px] overflow-y-auto pr-2">
                {selectedSession.events && selectedSession.events.length > 0 ? (
                  selectedSession.events.map((ev, idx) => {
                    const isClick = ev.type === "click";
                    const isNav = ev.type === "nav";

                    return (
                      <div key={idx} className="relative group">
                        {/* Dot marker */}
                        <div
                          className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-[#fbdbc6] flex items-center justify-center ${
                            isClick ? "bg-[#c85f40]" : isNav ? "bg-[#1c1815]" : "bg-emerald-600"
                          }`}
                        />

                        <div className="p-3 rounded-2xl bg-white/70 border border-[#1c1815]/12 space-y-1 shadow-xs">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#1c1815] flex items-center gap-1.5">
                              {isClick ? (
                                <>
                                  <MousePointer className="w-3.5 h-3.5 text-[#c85f40]" />
                                  <span>Clicked: {ev.label || ev.title || "Button"}</span>
                                </>
                              ) : (
                                <>
                                  <Navigation className="w-3.5 h-3.5 text-[#1c1815]" />
                                  <span>Navigated to: {ev.path || "/"}</span>
                                </>
                              )}
                            </span>
                            <span className="text-[11px] font-mono text-[#705e55]">
                              {new Date(ev.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          {ev.duration ? (
                            <p className="text-[11px] text-[#554741] font-medium">
                              Spent <strong className="text-[#1c1815]">{formatDuration(ev.duration)}</strong>{" "}
                              on this section
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-[#705e55] italic">No detailed micro-events recorded for this session.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#1c1815]/12 flex items-center justify-between text-xs text-[#554741]">
              <span className="font-mono text-[11px]">Session ID: {selectedSession.sessionId}</span>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-5 py-2.5 rounded-xl bg-[#1c1815] text-[#fbdbc6] font-semibold hover:bg-[#2e2622] transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
