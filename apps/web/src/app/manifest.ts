import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Lets phones "Add to home screen" and open SmartBin like an app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/app",
    display: "standalone",
    background_color: "#f5f7f2",
    theme_color: "#16794a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
