"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export default function Home() {
  const trpc = useTRPC();
  const health = useQuery(trpc.health.queryOptions());

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Smartbin</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {health.isPending ? "Checking API…" : health.isError ? "API unreachable" : "API ok"}
        </p>
      </div>
    </main>
  );
}
