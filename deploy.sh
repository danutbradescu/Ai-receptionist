#!/bin/bash

# ========================================
# Google Cloud Run Deployment Script
# ========================================
# Configurează aceste variabile înainte de a rula:

PROJECT_ID="your-gcp-project-id"
REGION="europe-west1"  # sau alta regiune
SERVICE_NAME="voltera-api"
IMAGE_NAME="voltera-api"

# Variabile de mediu pentru Cloud Run
DATABASE_URL="postgresql://..."
JWT_SECRET="your-jwt-secret"
RETELL_API_KEY="your-retell-api-key"
CORS_ORIGINS="https://your-frontend.com"

# ========================================
# Step 1: Verifică gcloud CLI
# ========================================
echo "✓ Verificând gcloud CLI..."
gcloud version

# ========================================
# Step 2: Setează proiectul GCP
# ========================================
echo "✓ Setând proiectul GCP..."
gcloud config set project $PROJECT_ID
gcloud auth configure-docker

# ========================================
# Step 3: Build-ul imaginii cu Cloud Build
# ========================================
echo "✓ Build-ul imaginii Docker pe Google Cloud Build..."
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$IMAGE_NAME:latest \
  --tag gcr.io/$PROJECT_ID/$IMAGE_NAME:$(date +%Y%m%d-%H%M%S) \
  --dir . \
  --timeout=3600

# ========================================
# Step 4: Deploy pe Cloud Run
# ========================================
echo "✓ Deploy-ul pe Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="$DATABASE_URL" \
  --set-env-vars JWT_SECRET="$JWT_SECRET" \
  --set-env-vars RETELL_API_KEY="$RETELL_API_KEY" \
  --set-env-vars CORS_ORIGINS="$CORS_ORIGINS" \
  --set-env-vars NODE_ENV="production" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --max-instances 100 \
  --min-instances 1 \
  --port 8080 \
  --ingress all

# ========================================
# Step 5: Afișează URL-ul serviciului
# ========================================
echo "✓ Deployment complet!"
echo ""
echo "URL-ul serviciului:"
gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)'

echo ""
echo "Comenzi utile:"
echo "  • Vizualizează logs: gcloud run logs read $SERVICE_NAME --region $REGION --limit 50"
echo "  • Vizualizează metrici: gcloud run metrics describe $SERVICE_NAME --region $REGION"
echo "  • Actualizează env vars: gcloud run services update $SERVICE_NAME --update-env-vars KEY=VALUE --region $REGION"
