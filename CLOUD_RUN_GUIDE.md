# 🚀 Ghid Deploy pe Google Cloud Run

## Prerequisite-uri

### 1. Instalează gcloud CLI
```bash
# Windows (PowerShell)
choco install google-cloud-sdk  # Dacă ai Chocolatey

# Sau download direct: https://cloud.google.com/sdk/docs/install
```

### 2. Autentificare GCP
```bash
# Conectează-te la GCP
gcloud auth login

# Setează proiectul default
gcloud config set project YOUR_PROJECT_ID
```

### 3. Configurează Artifact Registry (dacă folosești)
```bash
# Crează un repo (alternativ la GCR)
gcloud artifacts repositories create voltera-api \
  --repository-format=docker \
  --location=europe-west1

# Configurează Docker
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

---

## Proces de Deploy

### Step 1: Build imaginii cu Google Cloud Build

```bash
# Din rădăcina proiectului
gcloud builds submit \
  --tag gcr.io/YOUR_PROJECT_ID/voltera-api:latest \
  --tag gcr.io/YOUR_PROJECT_ID/voltera-api:v1.0.0 \
  --timeout=3600
```

**Avantaje Cloud Build:**
- Build-ul se execută pe serverele Google (nu local)
- Puteți vedea progresul în Cloud Console
- Stochează automat imaginea în Container Registry

### Step 2: Deploy pe Cloud Run

```bash
gcloud run deploy voltera-api \
  --image gcr.io/YOUR_PROJECT_ID/voltera-api:latest \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --max-instances 100 \
  --min-instances 0
```

### Step 3: Setează variabilele de mediu

```bash
gcloud run services update voltera-api \
  --update-env-vars DATABASE_URL="postgresql://..." \
  --update-env-vars JWT_SECRET="your-secret" \
  --update-env-vars RETELL_API_KEY="your-key" \
  --update-env-vars CORS_ORIGINS="https://your-frontend.com" \
  --update-env-vars NODE_ENV="production" \
  --region europe-west1
```

**OU** setați la deploy (cu `--set-env-vars`):
```bash
gcloud run deploy voltera-api \
  --image gcr.io/YOUR_PROJECT_ID/voltera-api:latest \
  --set-env-vars DATABASE_URL="..." \
  --set-env-vars JWT_SECRET="..." \
  ...
```

---

## Configurare Google Cloud Setup (o singură dată)

### 1. Crează Service Account pentru CI/CD

```bash
# Crează service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment"

# Acordă rolul de Cloud Run Deployer
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Acordă rolul de Storage Admin (pentru Container Registry)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Acordă rolul de Cloud Build Editor
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"
```

### 2. Configurează Workload Identity Federation (Securitate)

```bash
# Crează Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="YOUR_PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Crează Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="YOUR_PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.environment=assertion.environment,attribute.aud=assertion.aud,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Bind Workload Identity
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --project="YOUR_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/YOUR_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/USERNAME/REPO_NAME"

# Obține Workload Identity Provider Resource Name
gcloud iam workload-identity-pools providers describe github-provider \
  --project="YOUR_PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

### 3. Adaugă Secrets în GitHub

Mergi la: **Settings → Secrets and variables → Actions**

Adaugă:
- `GCP_PROJECT_ID`: Your GCP Project ID
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Resource Name obținut mai sus
- `GCP_SERVICE_ACCOUNT`: github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com
- `DATABASE_URL`: your-postgres-connection-string
- `JWT_SECRET`: your-jwt-secret
- `RETELL_API_KEY`: your-retell-api-key
- `CORS_ORIGINS`: https://your-frontend.com

---

## Comenzi Utile Post-Deploy

### Vizualizează Logs
```bash
gcloud run logs read voltera-api --region europe-west1 --limit 50 --follow
```

### Vizualizează Metrici
```bash
gcloud run metrics describe voltera-api --region europe-west1
```

### Actualizează Service
```bash
gcloud run services update voltera-api \
  --update-env-vars KEY=VALUE \
  --region europe-west1
```

### Șterge Service
```bash
gcloud run services delete voltera-api --region europe-west1
```

### Obține URL Serviciu
```bash
gcloud run services describe voltera-api --region europe-west1 --format='value(status.url)'
```

---

## Troubleshooting

### Eroare: "Permission denied on Cloud Build"
→ Verifică că service account-ul are rolul `roles/cloudbuild.builds.editor`

### Eroare: "Container failed to start"
→ Verifică logs: `gcloud run logs read voltera-api --follow`

### Eroare: "Connection refused to database"
→ Verifică că `DATABASE_URL` este corect și IP-ul Cloud Run este whitelisted în baza de date

### Eroare: "CORS error"
→ Asigură-te că `CORS_ORIGINS` conține domeniul frontend-ului tău

---

## Cost Estimation (Google Cloud Run)

- **Cereri**: $0.40 per 1 milion de cereri
- **Calcul**: $0.00002400 per vCPU-second
- **Memorie**: $0.00000250 per GB-second
- **Network**: $0.12 per GB outbound

Cu configurare 512Mi RAM și min-instances=0, cost estimat: **$1-10/lună** pentru trafic mic
