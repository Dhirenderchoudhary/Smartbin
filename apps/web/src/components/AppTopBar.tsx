import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Back bar for the user area's secondary screens. Goes back to the map unless onBack is given.
export function AppTopBar({ title, onBack, backLabel = "Back to map" }: { title: string; onBack?: () => void; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b bg-background px-2">
      {onBack ? (
        <Button variant="ghost" size="icon-lg" aria-label={backLabel} onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
      ) : (
        <Button variant="ghost" size="icon-lg" render={<Link href="/app" aria-label={backLabel} />} nativeButton={false}>
          <ArrowLeftIcon />
        </Button>
      )}
      <h1 className="text-xl">{title}</h1>
    </header>
  );
}
