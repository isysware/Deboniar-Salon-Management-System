# SalonOS Production Build & Deployment Guide (Namecheap / cPanel)

Yeh guide future builds aur deployments ke liye reference hai taake koi database permission, token expiry, ya Namecheap extension ka error dobara na aaye.

---

## 1. Local Machine Par Build Banane Ke Steps

### Step A: Frontend Build
```bash
cd frontend
npm run lint          # Verify TypeScript zero-error
npm run build         # Generates frontend/dist/
```
Output: `frontend/dist/` (is mein `index.html` aur `assets/` hotay hain). Is folder ke contents ko zip karke `frontend-build.zip` banayein.

### Step B: Backend Package
Backend plain Node.js / Express hai. Is mein sirf runtime files zip karni hain:
- ✅ **Shamil Karein:**
  - `src/` (saare modules, routes, lib)
  - `prisma/` (schema.prisma, seed-data.js, seed.js, aur ALL migrations)
  - `scripts/` (build.js, etc.)
  - `package.json` aur `package-lock.json`
- ❌ **KABHI BHI Shamil Na Karein:**
  - `node_modules/` (server par `npm install --omit=dev` khud install karta hai)
  - `.env` (local database credentials server par overwrite na hon)
  - `tests/` ya test artifact logs

---

## 2. Server `.env` Checklist (Important Rules)

Apne server ke backend root par `.env` mein hamesha yeh settings confirm rakhein:

```env
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://isywouhn_debonear_user:[PASSWORD]@localhost:5432/isywouhn_daboniar"
DIRECT_URL="postgresql://isywouhn_debonear_user:[PASSWORD]@localhost:5432/isywouhn_daboniar"
JWT_ACCESS_SECRET="your_long_random_jwt_secret"
JWT_REFRESH_SECRET="your_long_random_refresh_secret"

# ⚠️ TOKEN EXPIRY: HAMESHA 7d RAKHEIN (15m KABHI NAHI!)
JWT_ACCESS_EXPIRES=7d
JWT_REFRESH_EXPIRES=30d

CORS_ORIGIN=*
TZ=Asia/Karachi
```

---

## 3. Namecheap PostgreSQL & Migration Rules

### Rule 1: No PostgreSQL OS Extensions (e.g. pgcrypto)
Namecheap shared hosting par `pgcrypto` ya `gen_random_uuid()` installed nahi hota.
- **Rule:** Kabhi bhi SQL ya migration mein `gen_random_uuid()` na likhein. Hamesha Node.js ka standard `crypto.randomUUID()` use karein.

### Rule 2: Table Ownership in PostgreSQL
Namecheap par jab database ya tables banti hain, to unka owner cPanel ka main user (`isywouhn`) hota hai, jabke backend app connect `isywouhn_debonear_user` se hoti hai.
- Agar kabhi migration mein `ERROR: must be owner of relation ...` ka error aaye, to terminal mein ye one-line command chala kar ownership transfer karein:
  ```bash
  psql -U isywouhn -d isywouhn_daboniar -c 'REASSIGN OWNED BY isywouhn TO isywouhn_debonear_user;'
  ```
  *(Password: Aapka cPanel login password)*

### Rule 3: Migrations Kaise Chalani Hain
Server par naye database changes apply karne ke liye:
```bash
# 1. Node virtual environment activate karein
source /home/isywouhn/nodevenv/api.debonear.isywarecloud.com/*/bin/activate

# 2. Backend directory mein jayen
cd /home/isywouhn/api.debonear.isywarecloud.com

# 3. Migration status check karein
npx prisma migrate status

# 4. Pending migrations live database par apply karein
npx prisma migrate deploy
```

---

## 4. Kya Karna Hai vs Kya Nahi Karna (Do's & Don'ts)

| Kya Karna Hai (DO) ✅ | Kya Nahi Karna (DON'T) ❌ |
| :--- | :--- |
| Hamesha `npx prisma migrate deploy` chalayein. | **KABHI BHI** production par `prisma migrate dev`, `prisma migrate reset`, ya `prisma db push` na chalayein (data wipe ho sakta hai). |
| Backend upload ke baad cPanel se **Restart Application** click karein. | Server par bina `nodevenv` activate kiye `npm` ya `npx` na chalayein (`command not found` aayega). |
| Token expiry hamesha `7d` (7 days) rakhein. | `JWT_ACCESS_EXPIRES=15m` na rakhein, warna cashier/POS ka session har 15 minute baad expire ho jayega. |
| Code mein UUID ke liye `import { randomUUID } from 'crypto'` use karein. | Raw SQL mein `gen_random_uuid()` call na karein. |
| Server `.env` ko secure aur live database credentials par rakhein. | Local machine ki `.env` ko server par upload karke overwrite na karein. |

---

## 5. Quick Deployment Routine (Every Time You Update)

1. **Frontend:**
   - Local: `cd frontend && npm run build`
   - Upload: `frontend/dist/*` ko apne frontend root (`public_html`) par extract karein.
2. **Backend:**
   - Upload: `backend-build.zip` ko backend root (`api.debonear.isywarecloud.com`) par extract karein.
   - Terminal:
     ```bash
     source /home/isywouhn/nodevenv/api.debonear.isywarecloud.com/*/bin/activate
     cd /home/isywouhn/api.debonear.isywarecloud.com
     npx prisma migrate deploy
     ```
   - cPanel: **Restart Application** click karein.
