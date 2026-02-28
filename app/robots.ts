import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/session/",
        "/summary/",
        "/api/",
        "/subscribe",
      ],
    },
    sitemap: "https://caesarinayear.com/sitemap.xml",
  };
}
