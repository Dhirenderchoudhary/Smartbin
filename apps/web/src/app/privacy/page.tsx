import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What SmartBin collects when you find, add or report dustbins, why, who can see it and how to delete it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "10 October 2026";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "What we collect",
    body: (
      <ul>
        <li><strong>Your account:</strong> your email address and a password, held by our sign-in provider (Amazon Cognito). We never see your password.</li>
        <li><strong>Bins you add:</strong> the photo, the bin&apos;s location, its waste type and name, the time, and that it was added by you.</li>
        <li><strong>Missing reports:</strong> your GPS position at the moment you report a bin missing, the time, and that the report came from you. We use it to confirm you were within 20 metres of the bin.</li>
        <li><strong>Your monthly counts:</strong> how many bins you added and reports you made this month, to apply the monthly limits.</li>
        <li><strong>Searching nearby:</strong> your location is sent to find the closest bins. We don&apos;t store it.</li>
      </ul>
    ),
  },
  {
    title: "How photos are checked",
    body: (
      <p>
        When you add a bin, its photo is sent to an AI service (OpenAI or Amazon Bedrock) only to check that it shows a dustbin.
        If the check fails, we delete the photo. Please photograph the bin, not people; avoid faces and number plates.
      </p>
    ),
  },
  {
    title: "Who can see what",
    body: (
      <ul>
        <li>Other signed-in users see each bin&apos;s photo, location, waste type and name. They don&apos;t see who added or reported it.</li>
        <li>SmartBin admins can see which account added or reported each bin, and where the reporter was standing, to handle misuse.</li>
        <li>We don&apos;t sell your data or show ads.</li>
      </ul>
    ),
  },
  {
    title: "Where it's stored and for how long",
    body: (
      <ul>
        <li>Data is stored on Amazon Web Services in the Mumbai (ap-south-1) region.</li>
        <li>A bin&apos;s photo is deleted when the bin is removed after missing reports or deleted by an admin.</li>
        <li>Each bin&apos;s history (when it was added, reported and removed, including reporters&apos; positions) is kept so admins can review it, even after the bin is removed.</li>
        <li>Your account is kept until you ask us to delete it.</li>
      </ul>
    ),
  },
  {
    title: "Cookies and storage",
    body: <p>We keep your sign-in session in your browser&apos;s storage. We don&apos;t use advertising or tracking cookies.</p>,
  },
  {
    title: "Your choices",
    body: (
      <p>
        You can ask to see the data linked to your account, correct it, or delete your account by writing to{" "}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. We aim to reply within 30 days, in line with India&apos;s
        Digital Personal Data Protection Act, 2023. SmartBin isn&apos;t meant for children under 18 without a parent&apos;s consent.
      </p>
    ),
  },
  {
    title: "Changes",
    body: <p>If we change this policy, we&apos;ll update the date at the top and, for important changes, tell you in the app.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          SmartBin helps people find public dustbins. This page explains what we collect to make that work, and nothing more.
        </p>
        {sections.map((s) => (
          <section key={s.title} className="mt-9">
            <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
            <div className="mt-3 flex flex-col gap-2 leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_li]:pl-1 [&_strong]:text-foreground [&_li+li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
