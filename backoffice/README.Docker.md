# Backoffice Docker Setup

## Quick Start

### Using Docker Compose (Recommended)

From the backoffice directory:

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f backoffice

# Stop the container
docker-compose down
```

The backoffice will be available at: http://localhost:3001

### Using Docker Directly

From the backoffice directory:

```bash
# Build the image
docker build -t merchandising-backoffice .

# Run the container
docker run -d -p 3001:80 --name backoffice merchandising-backoffice

# View logs
docker logs -f backoffice

# Stop and remove the container
docker stop backoffice
docker rm backoffice
```

## Development vs Production

- **Development**: Use `npm run dev` for hot-reload and faster iteration
- **Production**: Use Docker for consistent deployment across environments

## Configuration

### Environment Variables

Create a `.env` file in the backoffice directory for environment-specific configuration:

```env
VITE_API_URL=http://localhost:8000
```

### API Backend

The nginx configuration proxies `/api` requests to a backend service. Update the `nginx.conf` file if your backend runs on a different host or port.

## Useful Commands

```bash
# Rebuild after changes
docker-compose up -d --build

# Access container shell
docker exec -it merchandising-backoffice sh

# Remove all containers and volumes
docker-compose down -v
```
