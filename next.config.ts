import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @react-pdf/renderer pulls in yoga-layout (native bindings); keep it out of
  // the server bundle so Next.js loads it from node_modules at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/microsoft/fluentui-emoji@**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
    ],
  },
}

export default nextConfig
