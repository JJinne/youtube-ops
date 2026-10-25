import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 이메일 로그인 링크가 돌아오는 곳. 링크의 코드를 세션으로 바꾼 뒤 홈으로 보낸다.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  url.search = "";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }
  url.pathname = "/login";
  url.search = "?error=link";
  return NextResponse.redirect(url);
}
