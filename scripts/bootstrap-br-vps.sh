#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo ./bootstrap-br-vps.sh" >&2
  exit 1
fi

if ! command -v lsb_release >/dev/null 2>&1; then
  apt-get update
  apt-get install -y lsb-release
fi

DISTRO_ID="$(lsb_release -is | tr '[:upper:]' '[:lower:]')"
DISTRO_CODENAME="$(lsb_release -cs)"

if [[ "${DISTRO_ID}" != "ubuntu" ]]; then
  echo "This script expects Ubuntu LTS. Detected: ${DISTRO_ID}" >&2
  exit 1
fi

echo "Installing base packages..."
apt-get update
apt-get install -y ca-certificates curl gnupg ufw

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${DISTRO_CODENAME} stable
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable docker
systemctl start docker

echo "Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

PUBLIC_IP="$(curl -fsSL https://api.ipify.org || true)"
if [[ -z "${PUBLIC_IP}" ]]; then
  PUBLIC_IP="$(hostname -I | awk '{print $1}')"
fi

echo "Starting CapRover..."
docker run -d \
  --name captain-captain \
  --restart=always \
  -e ACCEPTED_TERMS=true \
  -e MAIN_NODE_IP_ADDRESS="${PUBLIC_IP}" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /captain:/captain \
  -p 80:80 \
  -p 443:443 \
  -p 3000:3000 \
  caprover/caprover || {
    echo "CapRover container may already exist. Current containers:"
    docker ps -a --filter "name=captain-captain"
  }

echo
echo "Bootstrap complete."
echo "Open: http://${PUBLIC_IP}:3000"
echo "Then configure your CapRover root domain and enable HTTPS."

