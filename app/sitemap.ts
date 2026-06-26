import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://app.irion.finance";
  const lastModified = "2026-06-26T00:00:00.000Z";

  return [
    { url: baseUrl, lastModified, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/app`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/docs`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/support`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];
}
