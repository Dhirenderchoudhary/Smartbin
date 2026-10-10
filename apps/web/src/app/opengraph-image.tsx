import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#f5f7f2", color: "#12201a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, fontWeight: 700 }}>
          <svg viewBox="0 0 32 32" width="72" height="72">
            <path d="M16 1.5C9.6 1.5 4.5 6.6 4.5 13c0 8.6 11.5 17.5 11.5 17.5S27.5 21.6 27.5 13C27.5 6.6 22.4 1.5 16 1.5z" fill="#16794a" />
            <path d="M10.5 10.5h11M14 8.5h4M12 10.5l1 8.5h6l1-8.5M15 13v4M17 13v4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {SITE.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>Find the nearest dustbin in seconds.</div>
          <div style={{ fontSize: 34, color: "#5a6b62" }}>A community map of public dustbins in India</div>
        </div>
      </div>
    ),
    size
  );
}
