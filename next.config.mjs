/** @type {import('next').NextConfig} */
const nextConfig = {
    compress: true,
    poweredByHeader: false,
    experimental: {
        optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "recharts", "date-fns"],
    },
    async headers() {
        return [
            {
                source: "/((?!_next/static|_next/image|favicon.ico).*)",
                headers: [
                    { key: "Cache-Control", value: "no-store, must-revalidate" },
                ],
            },
        ]
    },
};

export default nextConfig;
