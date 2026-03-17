/** @type {import('next').NextConfig} */
const nextConfig = {
    compress: true,
    poweredByHeader: false,
    experimental: {
        optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "recharts"],
    },
    async headers() {
        return [
            {
                // Only apply no-store to API routes — NOT to static assets
                source: "/api/:path*",
                headers: [
                    { key: "Cache-Control", value: "no-store, must-revalidate" },
                ],
            },
            {
                // Static assets should be cached normally by the browser
                source: "/_next/static/:path*",
                headers: [
                    { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
                ],
            },
        ]
    },
};

export default nextConfig;
