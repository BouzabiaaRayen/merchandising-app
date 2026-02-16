# Merchandising Frontend

Expo (React Native) app for the merchandising management system.

## Structure

| Path | Purpose |
|------|---------|
| **src/contexts/** | Auth state (AuthContext) |
| **src/navigation/** | Navigation setup and role-based routes |
| **src/screens/** | Login, Register, Home, Products |
| **src/services/api.js** | Axios instance (base URL, auth header, token refresh) |
| **src/services/apiService.js** | Auth and product API calls using `api.js` |

## API URL

Set `API_BASE_URL` in `.env` (copy from `.env.example`):

- **Android emulator:** `http://10.0.2.2:8000/api`
- **iOS simulator / web:** `http://localhost:8000/api`
- **Physical device:** `http://YOUR_COMPUTER_IP:8000/api`

## Run

```bash
npm install
npm start          # then press a (Android) or i (iOS) or w (web)
npm run android    # or open Android directly
```
