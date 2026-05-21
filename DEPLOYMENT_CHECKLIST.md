# ✅ Checklist Deploy Cloud Run - Voltera

## 📝 Fișiere Modificate

### 1. **apps/api/Dockerfile** ✓
**Modificări:**
- Schimbat din npm → pnpm (pentru workspace)
- Adăugat pnpm workspace setup cu `pnpm install --frozen-lockfile`
- Corectat Prisma generate pentru packages/db: `pnpm --filter @voltera/db exec prisma generate`
- Corectat build path: `pnpm --filter api run build`
- Adăugat Health Check endpoint
- Optat pentru staging optim (slim, instalare doar prod dependencies)

**De verificat:**
- [ ] Pnpm e instalat corect în imagini (verifică `docker build`)
- [ ] Calea din CMD: `node apps/api/dist/server.js` - OK
- [ ] PORT 8080 e configurat - OK
- [ ] Health check e funcțional

---

### 2. **apps/api/src/server.ts** ✓
**Modificări:**
- CORS origins sunt acum dinamice din `process.env.CORS_ORIGINS`
- Separat cu virgulă pentru multiple origins (ex: `https://app.com,https://www.app.com`)
- Default la `http://localhost:3000` dacă nu-i setat

**De verificat:**
- [ ] Setează `CORS_ORIGINS=https://your-domain.com` la deploy
- [ ] Localhost 3000 e păstrat pentru development

---

### 3. **apps/api/.env.example** ✓ (NOUĂ)
**Template cu:**
- DATABASE_URL (Neon PostgreSQL)
- JWT_SECRET
- RETELL_API_KEY
- CORS_ORIGINS
- NODE_ENV=production
- PORT=8080

**De verificat:**
- [ ] Copiază la `.env` local și completează valorile reale

---

## 📄 Fișiere NOI - Helpere Deployment

### 4. **deploy.sh** ✓ (SCRIPT BASH)
**Conține:**
- Variabile configurabile (PROJECT_ID, REGION, etc.)
- Step 1: Verificare gcloud CLI
- Step 2: Setare proiect GCP
- Step 3: Build cu Google Cloud Build
- Step 4: Deploy pe Cloud Run
- Step 5: Afișare URL și comenzi utile

**Utilizare:**
```bash
chmod +x deploy.sh
./deploy.sh  # După ce completezi variabilele PROJECT_ID și altele
```

---

### 5. **.github/workflows/deploy-to-cloud-run.yml** ✓ (GITHUB ACTIONS)
**Ce face:**
- Trigger pe push la main dacă se modifică `apps/api/**` sau `packages/db/**`
- Autentificare securată cu Workload Identity
- Build imagine cu Docker
- Push pe GCR
- Deploy pe Cloud Run cu env vars din GitHub Secrets
- Notificare la final

**De configurat în GitHub:**
- [ ] Settings → Secrets and variables → Actions
- [ ] Adaugă: GCP_PROJECT_ID, GCP_WORKLOAD_IDENTITY_PROVIDER, etc. (vezi gudul)

---

### 6. **CLOUD_RUN_GUIDE.md** ✓ (DOCUMENTAȚIE)
**Conține:**
- Prerequisites (gcloud CLI, auth)
- Proces de deploy step-by-step
- Setup one-time GCP (Service Account, Workload Identity)
- Comenzi utile (logs, metrici, update, delete)
- Troubleshooting
- Cost estimation

---

## 🚀 PAȘI IMPLEMENTARE

### Faza 1: Pregătire Locală (azi)
1. ✓ Editează Dockerfile (done)
2. ✓ Editează server.ts pentru CORS dinamic (done)
3. ✓ Creează .env.example (done)
4. Copiază `.env.example` → `.env` local și completează valorile
5. Testează local: `pnpm --filter api run dev`

```bash
cd apps/api
pnpm install
pnpm run dev
```

### Faza 2: Setup GCP (o singură dată)
1. Instalează gcloud CLI
2. Rulează comenzile din CLOUD_RUN_GUIDE.md (Configurare GCP Setup)
3. Creează Service Account și Workload Identity
4. Notează `GCP_WORKLOAD_IDENTITY_PROVIDER` resource name

### Faza 3: Configurare GitHub (dacă vrei CI/CD)
1. Adaugă Secrets în GitHub
2. Workflow-ul se va trigera automat pe next push

### Faza 4: Manual Deploy (quick test)
```bash
# Setează variabilele în deploy.sh
nano deploy.sh

# Execută
./deploy.sh
```

---

## 🔐 Environment Variables de Setat

```
Production pe Cloud Run:
├─ DATABASE_URL → Neon PostgreSQL connection string
├─ JWT_SECRET → Secret string (min 32 chars)
├─ RETELL_API_KEY → API key din Retell
├─ CORS_ORIGINS → https://your-frontend.com,https://www.your-frontend.com
├─ NODE_ENV → production
└─ PORT → 8080 (default Cloud Run)
```

---

## ✨ Validare Deploy

După deploy, testează:

```bash
# 1. Obține URL serviciu
SERVICE_URL=$(gcloud run services describe voltera-api --region europe-west1 --format='value(status.url)')

# 2. Testează health endpoint
curl -X GET "$SERVICE_URL/api/test-db"

# 3. Verifică logs
gcloud run logs read voltera-api --follow

# 4. Testează CORS (din frontend)
curl -X OPTIONS "$SERVICE_URL/api/auth/login" \
  -H "Origin: https://your-frontend.com" \
  -H "Access-Control-Request-Method: POST"
```

---

## ❓ Întrebări Frecvente

**Q: Pot folosi GCR sau Artifact Registry?**
A: Da, ambele funcționează. GCR e mai simplu (`gcr.io/`), Artifact Registry e mai nou.

**Q: Cum actualizez env vars fără re-deploy?**
A: `gcloud run services update voltera-api --update-env-vars KEY=VALUE --region europe-west1`

**Q: Cloud Run poate accesa baza de date on-premise?**
A: Nu direct. Trebuie Neon (cloud) sau Cloud SQL. Recomand Neon (serverless).

**Q: Care e pricing-ul?**
A: ~$1-10/lună pentru trafic mic, 0 cost dacă 0 cereri (min-instances=0).

---

## 📞 Suport

Pentru erori sau întrebări:
1. Citește troubleshooting din CLOUD_RUN_GUIDE.md
2. Verifică logs: `gcloud run logs read voltera-api --follow`
3. Consultă documentația Cloud Run: https://cloud.google.com/run/docs
