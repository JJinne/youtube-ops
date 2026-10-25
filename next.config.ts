import type { NextConfig } from "next";

// 4단계부터 로그인·저장(서버 기능)을 쓰므로 정적 미리보기(output: "export")는 더 쓰지 않는다.
// 확인은 Vercel 배포 주소에서 한다. 3단계 정적 미리보기는 별도로 게시해 둔 것이 남아 있다.
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
