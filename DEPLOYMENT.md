# Synera AI - Deployment Guide

This guide will walk you through deploying Synera AI to Render.com using Docker.

## Prerequisites

1. A Render.com account
2. A MongoDB Atlas database (or another MongoDB instance)
3. A Redis instance (optional, but recommended for production)
4. Docker installed locally (for building the Docker image)
5. Git installed locally

## Deployment to Render.com

### 1. Prepare your environment variables

1. Copy `.env.example` to `.env.production`
2. Update all the values in `.env.production` with your production values
3. Make sure to set `NODE_ENV=production` and update all API keys and secrets

### 2. Push your code to a Git repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-git-repo-url>
git push -u origin main
```

### 3. Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" and select "Web Service"
3. Connect your Git repository
4. Configure your service:
   - **Name**: synera-ai (or your preferred name)
   - **Region**: Choose the region closest to your users
   - **Branch**: main (or your default branch)
   - **Root Directory**: / (root of the repository)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: Free (for testing) or a paid plan for production
   - **Auto-Deploy**: Enable for automatic deployments on push

5. Add environment variables:
   - Copy all variables from your `.env.production` file
   - Add `NODE_ENV=production`
   - Add `PORT=10000` (Render uses port 10000 by default)

6. Click "Create Web Service"

### 4. Set up custom domain (optional)

1. Go to your service in the Render dashboard
2. Click on "Settings"
3. Under "Custom Domains", click "Add Custom Domain"
4. Follow the instructions to verify domain ownership

## Local Development with Docker

1. Make sure Docker and Docker Compose are installed
2. Copy `.env.example` to `.env` and update the values
3. Run the application:

```bash
# Make the start script executable if not already
chmod +x start-docker.sh

# Start the application
./start-docker.sh
```

The application will be available at http://localhost:3000

## Environment Variables

See `.env.example` for a list of required environment variables.

## Updating the Application

1. Make your changes
2. Commit and push to your repository
3. Render will automatically deploy the changes if auto-deploy is enabled

## Troubleshooting

### View Logs

```bash
# View logs in Render dashboard
# Or locally:
docker-compose logs -f
```

### Common Issues

- **Build failures**: Check the build logs in the Render dashboard
- **Database connection issues**: Verify your MongoDB connection string
- **Port conflicts**: Make sure no other services are using ports 3000, 27017, 8081, or 8082

## Support

For support, please open an issue in the repository or contact the development team.
