import { NextResponse } from "next/server";

export function proxy(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const splitAt = decoded.indexOf(":");
      const suppliedPassword = splitAt >= 0 ? decoded.slice(splitAt + 1) : "";
      if (suppliedPassword === password) return NextResponse.next();
    } catch {}
  }

  return new NextResponse("Cần đăng nhập để sử dụng Xưởng chế kịch bản.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="prompt.toiyeuai.online"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
