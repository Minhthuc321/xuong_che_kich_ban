#!/usr/bin/env bash
# Deploy Xưởng chế kịch bản lên VPS Ubuntu/Debian.
#
#   curl -fsSL https://raw.githubusercontent.com/Minhthuc321/xuong_che_kich_ban/main/deploy-vps.sh -o deploy-vps.sh
#   sudo bash deploy-vps.sh
#
# Script chạy lại nhiều lần được (idempotent). Không xoá cấu hình Nginx sẵn có.

set -euo pipefail

DOMAIN="prompt.toiyeuai.online"
APP_DIR="/opt/xuong-che-kich-ban"
REPO="https://github.com/Minhthuc321/xuong_che_kich_ban.git"
HOST_PORT="3005"

msg()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Cần chạy bằng root: sudo bash $0"
command -v apt-get >/dev/null || die "Script này chỉ hỗ trợ Ubuntu/Debian."

# ---------------------------------------------------------------- 1. Gói nền
msg "Cài gói nền"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git nginx >/dev/null

if ! command -v docker >/dev/null; then
  msg "Cài Docker"
  curl -fsSL https://get.docker.com | sh
else
  echo "Docker đã có: $(docker --version)"
fi
docker compose version >/dev/null 2>&1 || die "Thiếu docker compose plugin."

# ------------------------------------------------------------------ 2. Source
msg "Lấy mã nguồn về $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin main
  git -C "$APP_DIR" reset --hard --quiet origin/main
  echo "Đã cập nhật lên $(git -C "$APP_DIR" rev-parse --short HEAD)"
else
  git clone --quiet "$REPO" "$APP_DIR"
  echo "Đã clone $(git -C "$APP_DIR" rev-parse --short HEAD)"
fi
cd "$APP_DIR"

# --------------------------------------------------------------------- 3. Env
if [ -f .env ]; then
  msg ".env đã tồn tại — giữ nguyên, không ghi đè"
else
  msg "Tạo .env"
  read -rsp "ANTHROPIC_API_KEY: " API_KEY;   echo
  read -rp  "APP_USERNAME (tên đăng nhập web) [admin]: " APP_USER; echo
  APP_USER="${APP_USER:-admin}"
  read -rsp "APP_PASSWORD (mật khẩu vào web): " APP_PW; echo
  [ -n "$API_KEY" ] || die "ANTHROPIC_API_KEY không được trống."
  [ -n "$APP_PW" ]  || warn "APP_PASSWORD trống — web sẽ mở công khai, ai cũng vào được."

  umask 077
  cat > .env <<EOF
ANTHROPIC_API_KEY=$API_KEY
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MAX_TOKENS=3500
AI_TIMEOUT_MS=90000
RATE_LIMIT_PER_MINUTE=12
APP_USERNAME=$APP_USER
APP_PASSWORD=$APP_PW
EOF
  unset API_KEY APP_PW APP_USER
fi
chmod 600 .env
chown root:root .env

# ------------------------------------------------------------------ 4. Chạy
msg "Build và khởi động container"
docker compose up -d --build

msg "Chờ container khoẻ (tối đa 90 giây)"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$HOST_PORT" || true)
  case "$code" in
    200|401) echo "App trả HTTP $code — OK."; break ;;
  esac
  [ "$i" -eq 30 ] && { docker compose logs --tail 40; die "App không phản hồi ở cổng $HOST_PORT."; }
  sleep 3
done

# ------------------------------------------------------------------ 5. Nginx
msg "Cấu hình Nginx"
AVAIL="/etc/nginx/sites-available/$DOMAIN"
if grep -q "listen 443" "$AVAIL" 2>/dev/null; then
  warn "$AVAIL đã có block 443 (Certbot đã sửa trước đó) — giữ nguyên để không mất cấu hình TLS."
else
  cp "nginx-$DOMAIN.conf" "$AVAIL"
  echo "Đã ghi $AVAIL"
fi
ln -sfn "$AVAIL" "/etc/nginx/sites-enabled/$DOMAIN"
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default && echo "Đã gỡ site default."
nginx -t
systemctl reload nginx

# --------------------------------------------------------------- 6. Tường lửa
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  msg "Mở cổng 80/443 trên ufw"
  ufw allow 80/tcp  >/dev/null
  ufw allow 443/tcp >/dev/null
  echo "Cổng $HOST_PORT vẫn chỉ bind loopback — không mở ra ngoài."
fi

# -------------------------------------------------------------------- 7. HTTPS
msg "Kiểm tra DNS trước khi xin chứng chỉ"
SERVER_IP=$(curl -fsS --max-time 10 https://api.ipify.org || echo "")
DNS_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || echo "")
echo "IP máy chủ : ${SERVER_IP:-không xác định}"
echo "DNS trỏ về : ${DNS_IP:-không phân giải được}"

if [ -n "$SERVER_IP" ] && [ -n "$DNS_IP" ] && [ "$SERVER_IP" != "$DNS_IP" ]; then
  warn "DNS chưa trỏ đúng về máy này. Bỏ qua bước cấp HTTPS."
  warn "Sửa bản ghi A của $DOMAIN thành $SERVER_IP rồi chạy lại script."
elif [ -z "$DNS_IP" ]; then
  warn "Không phân giải được $DOMAIN. Bỏ qua bước cấp HTTPS."
else
  msg "Cấp chứng chỉ HTTPS bằng Certbot"
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo "Chứng chỉ đã tồn tại — Certbot tự gia hạn, không xin lại."
  else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
            --register-unsafely-without-email --redirect \
      || warn "Certbot thất bại. Xem: journalctl -u nginx và /var/log/letsencrypt/"
  fi
fi

# ----------------------------------------------------------------- 8. Tổng kết
msg "Kiểm tra cuối"
docker compose ps
echo
for url in "http://127.0.0.1:$HOST_PORT" "https://$DOMAIN"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo "lỗi")
  printf '  %-38s -> %s\n' "$url" "$code"
done

cat <<EOF

------------------------------------------------------------------
Xong. HTTP 401 là ĐÚNG khi đã bật APP_PASSWORD — trình duyệt sẽ hỏi
đăng nhập bằng APP_USERNAME + APP_PASSWORD vừa đặt ở trên.

Lệnh hay dùng:
  cd $APP_DIR
  docker compose logs -f          # xem log
  docker compose restart          # khởi động lại
  git pull && docker compose up -d --build   # cập nhật code mới

BẢO MẬT — làm ngay sau khi deploy xong:
  passwd root                     # đổi mật khẩu root
  # rồi chuyển sang SSH key và tắt đăng nhập bằng mật khẩu:
  #   nano /etc/ssh/sshd_config  ->  PasswordAuthentication no
  #   systemctl restart ssh
------------------------------------------------------------------
EOF
