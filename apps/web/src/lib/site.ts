export const SITE = {
  name: "SmartBin",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  tagline: "Find the nearest dustbin. Map the missing ones.",
  description:
    "SmartBin is a community map of public dustbins in India. Find the closest wet or dry waste bin, add new bins with a photo, and flag bins that have gone missing.",
  // Store pages for the phone app. Empty = the landing page shows "Coming soon"
  appLinks: { android: "", ios: "" },
  // TODO: replace with the team's real contact address before launch
  contactEmail: "privacy@smartbin.example",
};
