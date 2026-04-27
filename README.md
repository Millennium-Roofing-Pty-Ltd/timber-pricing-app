# timber-pricing-app
Professional timber pricing calculator managing 37 timber items with supplier tracking, historical pricing, and comprehensive reporting (Excel/CSV/PDF exports)

## VS Code Development (Live Reload)

1. Install dependencies once:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Start local Postgres:

```bash
docker compose up -d postgres
```

4. Push schema to the database:

```bash
npm run db:push
```

5. In VS Code, press `F5` and choose `App Dev Server (Live Reload)`.

6. Open `http://localhost:5000`.

During development:
- Client changes update live through Vite HMR.
- Server TypeScript changes restart automatically via `tsx watch`.
