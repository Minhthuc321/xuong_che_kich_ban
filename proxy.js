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
      // So sánh toàn bộ chuỗi thay vì thoát ngay tại ký tự sai đầu tiên.
      const maxLength = Math.max(suppliedPassword.length, password.length);
      let difference = suppliedPassword.length ^ password.length;
      for (let index = 0; index < maxLength; index += 1) {
        difference |= (suppliedPassword.charCodeAt(index) || 0) ^ (password.charCodeAt(index) || 0);
      }
      if (difference === 0) return NextResponse.next();
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
