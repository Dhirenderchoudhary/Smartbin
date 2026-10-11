import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { EvalsView } from "@/components/evals/EvalsView";

export const metadata: Metadata = {
  title: "AI evaluation: can it spot a fake bin?",
  description:
    "How SmartBin's AI photo check tells real dustbins from buckets, post boxes and garbage piles: every test photo, the model's verdict and reason, and a live run you can watch.",
  alternates: { canonical: "/evals" },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <EvalsView />
      <SiteFooter />
    </>
  );
}
