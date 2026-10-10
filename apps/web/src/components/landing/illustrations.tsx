import { Mukta } from "next/font/google";

// Stencil lettering on the bin drawings, as on real municipal bins
const devanagari = Mukta({ subsets: ["devanagari"], weight: "700" });

export type BinType = "WET" | "DRY" | "BOTH";

const PIN_PATH = "M0 0C-4-9-14-15-14-26a14 14 0 1 1 28 0C14-15 4-9 0 0Z";

// Map pin with its tip at (x, y). "BOTH" is split green/blue. active: the nearest bin, drawn larger.
export function Pin({ x, y, type, delay = 0, active = false, faded = false }: { x: number; y: number; type: BinType; delay?: number; active?: boolean; faded?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.35 : 1}>
      <g className="motion-safe:animate-[pin-in_.5s_ease-out_both]" style={{ animationDelay: `${delay}s` }}>
        <g
          className="transition-transform duration-300 ease-out"
          style={{ transform: active ? "scale(1.25)" : "scale(1)", transformBox: "fill-box", transformOrigin: "50% 100%" }}
        >
          {type === "BOTH" ? (
            <>
              <path d={PIN_PATH} className="fill-wet" clipPath="url(#pin-left)" />
              <path d={PIN_PATH} className="fill-dry" clipPath="url(#pin-right)" />
            </>
          ) : (
            <path d={PIN_PATH} className={type === "WET" ? "fill-wet" : "fill-dry"} />
          )}
          <circle cy={-26} r={5.5} className="fill-card" />
        </g>
      </g>
    </g>
  );
}

export function PinClips() {
  return (
    <defs>
      <clipPath id="pin-left"><rect x={-15} y={-42} width={15} height={43} /></clipPath>
      <clipPath id="pin-right"><rect x={0} y={-42} width={15} height={43} /></clipPath>
    </defs>
  );
}

// The hero map's streets, in a 600 x 500 viewBox
export function Streets() {
  return (
    <>
      <rect width={600} height={500} className="fill-muted" />
      {/* Park and a few city blocks */}
      <rect x={380} y={34} width={190} height={118} rx={18} className="fill-secondary" />
      <text x={475} y={98} textAnchor="middle" className="fill-secondary-foreground text-[13px] font-semibold opacity-70">Gandhi Park</text>
      <g className="fill-background">
        <rect x={30} y={180} width={170} height={96} rx={10} />
        <rect x={290} y={182} width={100} height={92} rx={10} />
        <rect x={30} y={338} width={186} height={56} rx={10} />
        <rect x={300} y={340} width={110} height={52} rx={10} />
        <rect x={478} y={190} width={100} height={100} rx={10} />
      </g>
      {/* Roads */}
      <g className="stroke-card" fill="none" strokeLinecap="round">
        <path d="M-20 140 L620 168" strokeWidth={16} />
        <path d="M-20 420 L620 404" strokeWidth={16} />
        <path d="M432 -20 C410 150 470 260 452 520" strokeWidth={16} />
        <path d="M236 -20 L262 520" strokeWidth={24} />
        <path d="M-20 312 L260 300 L620 318" strokeWidth={28} />
      </g>
      <text x={36} y={292} className="fill-muted-foreground text-[13px] font-semibold">MG Road</text>
      <text transform="translate(222 70) rotate(87)" className="fill-muted-foreground text-[13px] font-semibold">Station Road</text>
    </>
  );
}

// A municipal street bin with its stencilled label
export function StreetBin({ type, label }: { type: "WET" | "DRY"; label: string }) {
  const body = type === "WET" ? "fill-wet" : "fill-dry";
  return (
    <svg viewBox="0 0 160 190" className="h-auto w-full max-w-40" aria-hidden="true">
      <rect x={18} y={20} width={124} height={22} rx={8} className={body} />
      <rect x={18} y={20} width={124} height={22} rx={8} className="fill-foreground/15" />
      <rect x={62} y={10} width={36} height={14} rx={5} className={body} />
      <path d="M26 46 H134 L124 168 H36 Z" className={body} />
      <path d="M40 60 V150 M120 60 V150" className="stroke-card/25" strokeWidth={4} strokeLinecap="round" />
      <text x={80} y={116} textAnchor="middle" className={`fill-card text-[28px] ${devanagari.className}`}>{label}</text>
      <circle cx={46} cy={174} r={10} className="fill-foreground/80" />
      <circle cx={114} cy={174} r={10} className="fill-foreground/80" />
    </svg>
  );
}
