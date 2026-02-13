# Merchandising Management System

A full-stack monorepo for managing merchandising operations with role-based access control.

## 🏗️ Architecture

This is a monorepo containing:

- **Backend**: Django + Django REST Framework + PostgreSQL
- **Frontend**: React Native (Expo)
- **Authentication**: JWT-based authentication
- **Database**: PostgreSQL (Docker-ready, Supabase-compatible)

## 👥 User Roles

The system supports three user roles:

- **ADMIN**: Full system access
- **SUPERVISOR**: Manage products and view reports
- **MERCHANDISER**: View and update product information

## 📁 Project Structure

```
merchandising-app/
├── backend/                 # Django backend
│   ├── merchandising_project/   # Django project settings
│   ├── users/              # User management app
│   ├── products/           # Products management app
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile         # Backend Docker configuration
│   └── .env.example       # Environment variables template
├── frontend/              # React Native frontend
│   ├── src/
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── navigation/    # Navigation configuration
│   │   ├── screens/       # App screens
│   │   └── services/      # API services
│   └── .env.example       # Frontend environment template
├── docker-compose.yml     # Docker orchestration
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR:
  - Python 3.11+
  - Node.js 18+
  - PostgreSQL 15+

### Option 1: Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd merchandising-app
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Create a superuser**
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

5. **Access the applications**
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/swagger/
   - Admin Panel: http://localhost:8000/admin/

### Option 2: Manual Setup

#### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Run migrations**
   ```bash
   python manage.py migrate
   ```

6. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

7. **Start development server**
   ```bash
   python manage.py runserver
   ```

#### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API URL
   ```

4. **Start Expo development server**
   ```bash
   npm start
   ```

5. **Run on device/emulator**
   - Press `a` for Android
   - Press `i` for iOS
   - Press `w` for Web
   - Scan QR code with Expo Go app

## 🔑 API Endpoints

### Authentication

- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login and get JWT tokens
- `POST /api/auth/token/refresh/` - Refresh access token
- `GET /api/auth/profile/` - Get user profile
- `PUT /api/auth/profile/` - Update user profile
- `POST /api/auth/change-password/` - Change password

### Products

- `GET /api/products/` - List all products
- `POST /api/products/` - Create new product
- `GET /api/products/{id}/` - Get product details
- `PUT /api/products/{id}/` - Update product
- `DELETE /api/products/{id}/` - Delete product

## 🔐 Environment Variables

### Backend (.env)

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=merchandising_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db  # or localhost for local setup
DB_PORT=5432

# For Supabase
# DB_HOST=your-project.supabase.co
# DB_NAME=postgres
# DB_USER=postgres
# DB_PASSWORD=your-supabase-password

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081

# JWT
JWT_ACCESS_TOKEN_LIFETIME=60
JWT_REFRESH_TOKEN_LIFETIME=1440
```

### Frontend (.env)

```env
API_BASE_URL=http://localhost:8000/api
# For Android Emulator: http://10.0.2.2:8000/api
# For physical device: http://YOUR_IP:8000/api
```

## 🗄️ Database

### Using Docker PostgreSQL (Default)

The `docker-compose.yml` includes a PostgreSQL service. No additional setup needed.

### Using Supabase

1. Create a project on [Supabase](https://supabase.com)
2. Get your database credentials from Project Settings > Database
3. Update `backend/.env`:
   ```env
   DB_HOST=db.your-project.supabase.co
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=your-password
   DB_PORT=5432
   ```

## 🧪 Testing

### Backend Tests

```bash
cd backend
python manage.py test
```

### Frontend Tests

```bash
cd frontend
npm test
```

## 📱 Mobile App Features

- **Authentication**: Login/Register with email and password
- **Role-based Navigation**: Different views based on user role
- **Product Management**: View, search, and filter products
- **Profile Management**: Update user profile and password
- **Offline Storage**: JWT tokens stored securely

## 🔧 Development

### Backend

- API documentation available at `/swagger/` and `/redoc/`
- Admin panel at `/admin/`
- Django shell: `python manage.py shell`

### Frontend

- Hot reload enabled in Expo
- React Native debugger compatible
- Can run on web, iOS, and Android

## 📦 Production Deployment

### Backend

1. Set `DEBUG=False` in `.env`
2. Update `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`
3. Use a strong `SECRET_KEY`
4. Set up a production database
5. Collect static files: `python manage.py collectstatic`
6. Use gunicorn (included) or another WSGI server

### Frontend

1. Build for production:
   ```bash
   expo build:android  # For Android
   expo build:ios      # For iOS
   ```
2. Update API URLs in `.env`

## 🛠️ Tech Stack

### Backend

- Django 4.2.7
- Django REST Framework 3.14.0
- Simple JWT 5.3.0
- PostgreSQL (via psycopg2-binary)
- drf-yasg (API documentation)
- django-cors-headers
- Gunicorn (production server)

### Frontend

- React Native (Expo)
- React Navigation
- Axios (API calls)
- AsyncStorage (local storage)

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📧 Support

For issues and questions, please open an issue in the repository.

