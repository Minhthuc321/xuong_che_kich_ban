export const metadata = {
  title: "Xưởng chế kịch bản | Tôi Yêu AI",
  description: "Phân tích kịch bản viral, giữ flow và tái dựng theo sản phẩm của bạn bằng AI.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
