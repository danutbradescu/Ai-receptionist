#!/bin/bash

# ===========================================
# QUICK START - Cloud Run Deployment
# ===========================================
# Copiază-paste comenzile de mai jos în terminal

# ===== PAȘI SETUP INIȚIAL (o singură dată) =====

# 1. Instalează gcloud CLI
# Windows: choco install google-cloud-sdk
# macOS: brew install google-cloud-sdk
# Linux: curl https://sdk.cloud.google.com | bash

# 2. Autentificare
gcloud auth login
gcloud config set project YOUR_PROJECT_ID  # Înlocuiește cu ID-ul tău

# 3. Configurează Docker
gcloud auth configure-docker

# ===== BUILD & DEPLOY (ori de câte ori se actualizeaza codul) =====

# 4. Build imaginea
gcloud builds submit \
  --tag gcr.io/YOUR_PROJECT_ID/voltera-api:latest \
  --timeout=3600

# 5. Deploy pe Cloud Run
gcloud run deploy voltera-api \
  --image gcr.io/YOUR_PROJECT_ID/voltera-api:latest \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql://..." \
  --set-env-vars JWT_SECRET="your-secret" \
  --set-env-vars RETELL_API_KEY="your-key" \
  --set-env-vars CORS_ORIGINS="https://your-frontend.com" \
  --set-env-vars NODE_ENV="production" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --max-instances 100 \
  --min-instances 0 \
  --port 8080

# 6. Obține URL-ul serviciului
gcloud run services describe voltera-api \
  --region europe-west1 \
  --format='value(status.url)'

# ===== COMENZI UTILE POST-DEPLOY =====

# Vizualizează logs (real-time)
gcloud run logs read voltera-api --region europe-west1 --follow

# Actualizează env vars (fără rebuild)
gcloud run services update voltera-api \
  --update-env-vars DATABASE_URL="new-value" \
  --region europe-west1

# Vizualizează metrics
gcloud run metrics describe voltera-api --region europe-west1

# Testează endpoint-ul
curl https://voltera-api-XXXX.run.app/api/test-db

# Șterge serviciul (dacă vrei să oprești)
gcloud run services delete voltera-api --region europe-west1

# ===== GITHUB ACTIONS (o singură dată, dacă vrei CI/CD) =====

# 1. Crează Service Account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# 2. Acordă drepturi
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# 3. Adaugă Secrets în GitHub
# Settings → Secrets and variables → Actions
# GCP_PROJECT_ID = YOUR_PROJECT_ID
# GCP_SERVICE_ACCOUNT = github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com
# DATABASE_URL = ...
# JWT_SECRET = ...
# RETELL_API_KEY = ...
# CORS_ORIGINS = https://your-frontend.com
