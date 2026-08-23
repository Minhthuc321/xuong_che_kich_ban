# Codex task — Xưởng chế kịch bản

Mục tiêu: hoàn thiện production app trong repo này và triển khai cho `https://prompt.toiyeuai.online`.

## Bắt buộc
1. Đọc toàn bộ repo trước khi sửa.
2. Giữ workflow AI 4 bước: mổ kịch bản → ghép sản phẩm → dựng bản mới → nấu giọng.
3. Frontend chỉ gọi `/api/generate`; tuyệt đối không gọi Anthropic trực tiếp từ browser.
4. Không commit `.env`, API key hoặc APP_PASSWORD. Repo là public.
5. Giữ model mặc định `claude-sonnet-4-6` nếu model ID còn hợp lệ.
6. Audit React/Next.js 16, `proxy.js`, API route, upload file, clipboard, responsive, error handling.
7. Không bịa giá/ưu đãi/thông số sản phẩm khi người dùng chưa cung cấp.
8. Chạy `npm install` và `npm run build`; sửa đến khi PASS.
9. Chạy Docker build và test local.
10. Source phải nằm trực tiếp ở root repo.
11. Nếu có quyền VPS, deploy bằng Docker Compose, Nginx reverse proxy về `127.0.0.1:3000`, cấp HTTPS bằng Certbot.
12. Nếu không có quyền VPS, không giả vờ đã deploy; chỉ hoàn thiện repo và đưa đúng lệnh deploy.

## Env production
```env
ANTHROPIC_API_KEY=<secret>
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MAX_TOKENS=3500
AI_TIMEOUT_MS=90000
RATE_LIMIT_PER_MINUTE=12
APP_PASSWORD=<secret>
```

## Definition of done
- `npm run build` PASS
- Docker build PASS
- `/api/generate` validation PASS
- secret không nằm trong Git
- UI và pipeline 4 bước hoạt động
- README được cập nhật
- báo commit SHA cuối cùng
- nếu deploy được: kiểm tra `https://prompt.toiyeuai.online`
