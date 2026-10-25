"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저용 클라이언트. 로그인 링크 보내기에만 쓴다 (데이터 읽기·쓰기는 서버에서).
 * 주소와 공개 키는 서버가 실행 시점 값으로 넘겨준다. NEXT_PUBLIC_ 변수는 빌드 때 고정되므로,
 * 빌드 뒤에 키를 넣어도 로그인이 되도록 하기 위해서다.
 */
export function createSupabaseBrowserClient(url: string, key: string) {
  return createBrowserClient(url, key);
}
