import { initTRPC } from "@trpc/server";
import { bins, getDb } from "@smartbin/db";

const t = initTRPC.create();

export const appRouter = t.router({
  health: t.procedure.query(() => ({ ok: true as const })),
  bin: t.router({
    list: t.procedure.query(() => getDb().select().from(bins)),
  }),
});

export type AppRouter = typeof appRouter;
