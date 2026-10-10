import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#ffffff", color: "#000000" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, fontWeight: 700 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 32 32" width="56" height="56">
              <path d="M9 11h14M13.5 8.5h5M11 11l1.3 12.5h7.4L21 11M14.6 14.5v5.5M17.4 14.5v5.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {SITE.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>Find the nearest dustbin in seconds.</div>
          <div style={{ fontSize: 34, color: "#5e5e5e" }}>A community map of public dustbins in India</div>
        </div>
      </div>
    ),
    size
  );
}
