import { Mukta } from "next/font/google";
import { Badge } from "@/components/ui/badge";

// Stencil lettering on the bin drawings, as on real municipal bins
const devanagari = Mukta({ subsets: ["devanagari"], weight: "700" });

type BinType = "WET" | "DRY" | "BOTH";

const PIN_PATH = "M0 0C-4-9-14-15-14-26a14 14 0 1 1 28 0C14-15 4-9 0 0Z";

// Map pin with its tip at (x, y). "BOTH" is split green/blue.
function Pin({ x, y, type, delay = 0, faded = false }: { x: number; y: number; type: BinType; delay?: number; faded?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.35 : 1}>
      <g className="motion-safe:animate-[pin-in_.5s_ease-out_both]" style={{ animationDelay: `${delay}s` }}>
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
  );
}

function PinClips() {
  return (
    <defs>
      <clipPath id="pin-left"><rect x={-15} y={-42} width={15} height={43} /></clipPath>
      <clipPath id="pin-right"><rect x={0} y={-42} width={15} height={43} /></clipPath>
    </defs>
  );
}

export function HeroMap() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted">
      <svg
        viewBox="0 0 600 500"
        className="block h-auto w-full"
        role="img"
        aria-label="Street map with your position and five dustbins nearby. A walking route leads 40 metres to the closest one, which takes wet and dry waste."
      >
        <PinClips />
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

        {/* Walking route to the nearest bin: the one moment of motion on the page */}
        <path
          d="M256 378 L251 300 L349 304"
          pathLength={1}
          strokeDasharray="1"
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-foreground motion-safe:animate-[route-draw_1.1s_cubic-bezier(.6,0,.2,1)_.9s_both]"
        />

        <Pin x={120} y={150} type="DRY" delay={0.1} />
        <Pin x={470} y={226} type="WET" delay={0.2} />
        <Pin x={88} y={404} type="WET" delay={0.3} />
        <Pin x={540} y={316} type="DRY" delay={0.4} />
        <Pin x={350} y={304} type="BOTH" delay={0.5} />

        {/* You are here */}
        <circle cx={256} cy={380} r={20} className="fill-foreground/15" />
        <circle cx={256} cy={380} r={9} className="fill-foreground stroke-background" strokeWidth={3} />
        <text x={236} y={385} textAnchor="end" className="fill-foreground text-[14px] font-bold">You</text>
      </svg>

      <div className="m-3 mt-0 flex items-center justify-between gap-4 rounded-2xl bg-card p-4 shadow-sheet sm:absolute sm:right-4 sm:bottom-4 sm:m-0 sm:min-w-72 motion-safe:animate-[rise-in_.5s_ease-out_1.9s_both]">
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">Metro gate 2</p>
          <div className="flex gap-1.5">
            <Badge variant="wet">Wet</Badge>
            <Badge variant="dry">Dry</Badge>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-3xl leading-none font-bold">40 m</p>
          <p className="mt-1 text-sm text-muted-foreground">1 min walk</p>
        </div>
      </div>
    </div>
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

// Small diagrams for the three rules
export function RuleDiagram({ rule }: { rule: "spacing" | "nearby" | "reports" }) {
  return (
    <svg viewBox="0 0 220 160" className="h-auto w-full max-w-72" aria-hidden="true">
      <PinClips />
      <rect width={220} height={160} rx={20} className="fill-muted" />
      {rule === "spacing" && (
        <>
          <circle cx={92} cy={86} r={56} className="fill-foreground/5 stroke-foreground" strokeDasharray="5 6" strokeWidth={2} />
          <line x1={92} y1={86} x2={148} y2={86} className="stroke-foreground" strokeWidth={2} />
          <text x={132} y={78} textAnchor="middle" className="fill-foreground text-[14px] font-bold">15 m</text>
          <Pin x={92} y={96} type="WET" />
          <Pin x={70} y={136} type="DRY" faded />
          <path d="M62 112 l16 16 M78 112 l-16 16" className="stroke-destructive" strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {rule === "nearby" && (
        <>
          <circle cx={110} cy={84} r={60} className="fill-foreground/5 stroke-foreground" strokeDasharray="5 6" strokeWidth={2} />
          <line x1={110} y1={84} x2={110} y2={24} className="stroke-foreground" strokeWidth={2} />
          <text x={118} y={48} className="fill-foreground text-[14px] font-bold">20 m</text>
          <Pin x={110} y={94} type="DRY" />
          <circle cx={146} cy={116} r={8} className="fill-foreground stroke-background" strokeWidth={3} />
        </>
      )}
      {rule === "reports" && (
        <>
          <Pin x={110} y={110} type="WET" faded />
          {[64, 110, 156].map((x, i) => (
            <g key={x} transform={`translate(${x} ${i === 1 ? 32 : 52})`}>
              <circle r={13} className="fill-destructive" />
              <text y={5} textAnchor="middle" className="fill-card text-[14px] font-bold">{i + 1}</text>
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
