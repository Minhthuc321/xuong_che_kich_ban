# Xưởng chế kịch bản

Ứng dụng production cho **“Kịch bản người ta, sản phẩm của mình.”** tại `prompt.toiyeuai.online`. Xưởng không phải chatbot: mỗi mẻ lần lượt mổ kịch bản nguồn, ghép dữ liệu sản phẩm vào chức năng tâm lý của từng beat, dựng lời thoại video và nấu lại thành bản đọc tự nhiên.

## Yêu cầu

- Node.js 22 (Docker image cũng dùng Node 22)
- Docker Engine + Docker Compose plugin nếu chạy production
- Anthropic API key có quyền dùng model được cấu hình

## Chạy local

```bash
cp .env.example .env
# Điền secret thật trong .env; tuyệt đối không commit file này.
npm install
npm run dev
```

Mở `http://127.0.0.1:3000`. Nếu có `APP_PASSWORD`, trình duyệt sẽ hỏi Basic Auth — username là `APP_USERNAME` (mặc định `admin`), password là `APP_PASSWORD`. Cả hai vế đều được kiểm. Để kiểm tra production build ngoài Docker:

```bash
npm run build
npm start
```

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | bắt buộc | Chỉ được đọc tại server route; không dùng tiền tố `NEXT_PUBLIC_` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Model Anthropic |
| `ANTHROPIC_MAX_TOKENS` | `3500` | Output token tối đa (server chặn ở 8192) |
| `AI_TIMEOUT_MS` | `90000` | Timeout upstream (server chặn ở 180 giây) |
| `RATE_LIMIT_PER_MINUTE` | `12` | Số request/IP/phút |
| `APP_USERNAME` | `admin` | Tên đăng nhập Basic Auth |
| `APP_PASSWORD` | trống | Bật Basic Auth khi có giá trị. Để trống là web mở công khai |

Frontend chỉ gọi `POST /api/generate`. API key không được bundle, log hoặc trả về browser. Rate limiter là `Map` trong process với cleanup bucket cũ: phù hợp một container trên VPS, tự reset khi restart và **không chia sẻ** giữa nhiều replica. Nếu sau này scale ngang mới cần limiter dùng storage chung.

## API và lỗi an toàn

`POST /api/generate` nhận JSON `{ "prompt": "..." }`, giới hạn 140.000 ký tự. Route trả thông báo tiếng Việt cho JSON sai, prompt trống/quá dài, thiếu hoặc sai key, rate limit, timeout, lỗi upstream và response rỗng. Chi tiết response Anthropic không được chuyển tiếp về client.

Kiểm tra nhanh không cần key:

```bash
curl -i -X POST http://127.0.0.1:3000/api/generate \
  -H 'Content-Type: application/json' --data '{"prompt":""}'
```

Nếu Basic Auth đang bật, thêm `-u any-user:"$APP_PASSWORD"`.

## Production bằng Docker

```bash
cp .env.example .env
nano .env                         # nhập secret trực tiếp trên VPS
docker build -t xuong-che-kich-ban .
docker compose up -d --build
docker compose ps
curl -I http://127.0.0.1:3005     # 401 là đúng khi APP_PASSWORD bật
```

Container chạy standalone Next server bằng `node server.js`, không chạy development server. Trong container app nghe cổng `3000`, nhưng compose chỉ bind ra host ở loopback `127.0.0.1:3005` — đây mới là cổng Nginx trỏ tới. Có healthcheck.

## Nginx, DNS và HTTPS

Trỏ bản ghi A/AAAA của `prompt.toiyeuai.online` về VPS, sau đó:

```bash
sudo cp nginx-prompt.toiyeuai.online.conf /etc/nginx/sites-available/prompt.toiyeuai.online
sudo ln -sfn /etc/nginx/sites-available/prompt.toiyeuai.online /etc/nginx/sites-enabled/prompt.toiyeuai.online
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d prompt.toiyeuai.online
curl -I https://prompt.toiyeuai.online
```

Nginx chuyển tiếp IP thật cho rate limit và chờ upstream tối đa 120 giây. Không public trực tiếp cổng `3005`; chỉ Nginx trên chính máy được phép gọi vào.

## MCP cho Claude Code

Repo khai báo sẵn một MCP server trong `.mcp.json`: **Playwright**, cho phép Claude Code mở trình duyệt thật để kiểm thử giao diện xưởng — điều hướng `http://127.0.0.1:3000`, bấm qua luồng tạo kịch bản, chụp màn hình, đọc console và network request khi UI lỗi.

```bash
npx playwright install chromium   # chỉ cần chạy một lần trên máy local
npm run dev                       # mở app ở cổng 3000 để Claude điều khiển
```

Lần đầu mở Claude Code trong repo, gõ `/mcp` để duyệt server (config theo project luôn cần xác nhận thủ công) và kiểm tra trạng thái là `connected`. Server chạy với `--isolated`: profile trình duyệt giữ trong RAM, không ghi cookie hay session xuống đĩa.

Truy cập file bị giới hạn trong thư mục repo theo mặc định. Nếu cần Basic Auth, đưa `APP_PASSWORD` vào URL dạng `http://user:password@127.0.0.1:3000` — dùng password local, không dùng credential production.

## Checklist trước khi phát hành

```bash
npm install
npm run build
docker build -t xuong-che-kich-ban .
git status --short
git diff --check
git grep -nE 'sk-ant-[A-Za-z0-9_-]{12,}|ANTHROPIC_API_KEY=sk-' -- ':!README.md'
```

Không đưa `.env`, API key, password hoặc log chứa credential vào Git. AI end-to-end cần secret thật trong `.env`; validation và UI vẫn có thể kiểm thử mà không có credential.
