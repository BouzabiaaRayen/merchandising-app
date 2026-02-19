# Merchandising Backoffice

A React-based admin panel for managing the merchandising application.

## Structure

```
backoffice/src/
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Users.jsx
│   └── Products.jsx
├── components/
│   ├── Sidebar.jsx
│   ├── Navbar.jsx
│   └── ProtectedRoute.jsx
├── services/
│   └── api.js
└── App.jsx
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The backoffice will run on `http://localhost:3001`

## Features

- **Login**: Authentication with JWT tokens
- **Dashboard**: Overview statistics
- **Users**: User management interface
- **Products**: Product catalog management
- **Protected Routes**: Authentication-based routing
- **API Integration**: Axios-based API client with token refresh

## API Configuration

The API base URL is configured in `vite.config.js` proxy settings. By default, it proxies `/api` requests to `http://localhost:8000`.

To change the backend URL, update the proxy configuration in `vite.config.js`.
