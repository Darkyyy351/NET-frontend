# NET Frontend

NET Core dashboard shell for the NET 0.1 test environment.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

The frontend expects the backend API URL and token in `.env`:

```bash
VITE_NET_API_URL=http://localhost:3000/api/v1
VITE_NET_API_TOKEN=change-me-to-the-backend-api-token
```

## Production Build

```bash
npm run build
```

## Docker Export

```bash
docker build \
  --build-arg VITE_NET_API_URL=http://localhost:3000/api/v1 \
  --build-arg VITE_NET_API_TOKEN=change-me-to-the-backend-api-token \
  -t net-frontend .
docker run -p 8080:80 net-frontend
```

Open:

```text
http://localhost:8080
```

Or use Compose:

```bash
cp .env.example .env
docker compose up -d --build
```

For CM5 deployment, set the final backend URL/token before building the image. Vite embeds these values into the static frontend bundle, so do not use a long-term production secret here until NET gets real user sessions or a backend proxy.
