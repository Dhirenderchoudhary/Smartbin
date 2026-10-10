import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Back-to-map bar for the user area's secondary screens
export function AppTopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b bg-background px-2">
      <Button variant="ghost" size="icon-lg" render={<Link href="/app" aria-label="Back to map" />} nativeButton={false}>
        <ArrowLeftIcon />
      </Button>
      <h1 className="text-xl">{title}</h1>
    </header>
  );
}
