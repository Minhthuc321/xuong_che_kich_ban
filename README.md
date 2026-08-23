# Xưởng chế kịch bản

Production starter cho `prompt.toiyeuai.online`.

## Chạy local
```bash
cp .env.example .env
npm install
npm run dev
```

## Production bằng Docker
```bash
docker compose up -d --build
```

Ứng dụng bind tại `127.0.0.1:3000`; Nginx reverse proxy theo file `nginx-prompt.toiyeuai.online.conf`.

## Bảo mật
- Không commit `.env`.
- `ANTHROPIC_API_KEY` chỉ dùng trong server route `/api/generate`.
- `APP_PASSWORD` bật Basic Auth cho công cụ riêng.

## Dành cho Codex
Đọc `CODEX_TASK.md`, audit toàn bộ repo, chạy build/test thực tế, sửa tới khi PASS rồi mới deploy.
