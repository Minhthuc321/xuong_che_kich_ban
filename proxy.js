import { NextResponse } from "next/server";

const DEFAULT_USERNAME = "admin";

// So sánh toàn bộ chuỗi thay vì thoát ngay tại ký tự sai đầu tiên, để thời gian
// phản hồi không tiết lộ đã đúng được bao nhiêu ký tự.
function constantTimeEquals(supplied, expected) {
  const maxLength = Math.max(supplied.length, expected.length);
  let difference = supplied.length ^ expected.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (supplied.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function proxy(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const username = process.env.APP_USERNAME || DEFAULT_USERNAME;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const splitAt = decoded.indexOf(":");
      const suppliedUsername = splitAt >= 0 ? decoded.slice(0, splitAt) : decoded;
      const suppliedPassword = splitAt >= 0 ? decoded.slice(splitAt + 1) : "";
      // Kiểm cả hai vế rồi mới kết luận: thoát sớm khi sai tên đăng nhập sẽ để lộ
      // tên nào có thật qua chênh lệch thời gian.
      const usernameOk = constantTimeEquals(suppliedUsername, username);
      const passwordOk = constantTimeEquals(suppliedPassword, password);
      if (usernameOk && passwordOk) return NextResponse.next();
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
