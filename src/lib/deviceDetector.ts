export interface DeviceInfo {
  deviceType: "mobile" | "desktop" | "tablet";
  os: string;
  browser: string;
}

export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent || "";
  let deviceType: "mobile" | "desktop" | "tablet" = "desktop";
  let os = "Unknown";
  let browser = "Unknown";

  // Device detection
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "tablet";
  } else if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      ua
    )
  ) {
    deviceType = "mobile";
  } else {
    deviceType = "desktop";
  }

  // OS detection
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt 6.3/i.test(ua)) os = "Windows 8.1";
  else if (/windows nt 6.2/i.test(ua)) os = "Windows 8";
  else if (/windows nt 6.1/i.test(ua)) os = "Windows 7";
  else if (/windows nt/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  // Browser detection
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";

  return { deviceType, os, browser };
}
