# supplyhub-api

SupplyHub platformunun NestJS backend servisi. Kimlik doğrulama, ürün yönetimi, sipariş ve teklif işlemlerini yönetir.

**Frontend:** [supplyhub](https://github.com/serhatcamadan/supplyhub) — Next.js 16, Vercel

---

## Tech Stack

| | |
|---|---|
| Framework | NestJS 12, ESM (`"type": "module"`) |
| Dil | TypeScript (strict) |
| ORM | Prisma v6 |
| Veritabanı | Supabase PostgreSQL |
| Auth | JWT (access 15dk + refresh 7gün) + OTP e-posta doğrulama |
| E-posta | Resend HTTP API |
| Test | Vitest |
| Deploy | Railway |

---

## Kurulum

```bash
# 1. Bağımlılıkları kur
npm install

# 2. Ortam değişkenlerini tanımla
cp .env.example .env
# .env dosyasını düzenle (aşağıya bakın)

# 3. Prisma client üret
npx prisma generate

# 4. Geliştirme sunucusunu başlat
npm run start:dev
```

API: `http://localhost:3001`
Swagger: `http://localhost:3001/api`

### Ortam Değişkenleri (`.env`)

```env
# Veritabanı (Supabase)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# JWT
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# E-posta (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=SupplyHub <onboarding@resend.dev>

# Uygulama
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

> **Not:** Railway SMTP port 587'yi bloke eder. `nodemailer` yerine Resend HTTP API kullanılır (`RESEND_API_KEY` gerekli). `RESEND_API_KEY` yoksa OTP kodları console'a yazılır (`[OTP - DEV]`).

---

## API Endpoints

### Auth (`/auth`)

| Method | Path | Açıklama |
|---|---|---|
| POST | `/auth/send-verification` | OTP kodu oluştur ve e-posta ile gönder |
| POST | `/auth/signup` | OTP doğrula + şirket + kullanıcı oluştur |
| POST | `/auth/login` | E-posta/şifre ile giriş, JWT cookie set |
| POST | `/auth/refresh` | Refresh token ile access token yenile |
| POST | `/auth/logout` | Cookie'leri temizle |
| GET | `/auth/me` | Mevcut kullanıcı bilgisi (JWT gerekli) |

### Products (`/products`, `/seller/products`)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/products` | Aktif ürün listesi (public) |
| GET | `/products/:id` | Ürün detayı (public) |
| GET | `/seller/products?sellerId=` | Satıcının ürünleri (JWT gerekli) |
| POST | `/seller/products?sellerId=` | Yeni ürün oluştur |
| PATCH | `/seller/products/:id` | Ürün güncelle |
| PATCH | `/seller/products/:id/status` | Ürün durumu güncelle |

### Orders, QuoteRequests, Companies, Users

Ayrıntılar için Swagger UI: `/api`

---

## Testler

```bash
npm run test          # Vitest (unit)
npm run test:watch    # Watch modu
npm run test:cov      # Coverage raporu
```

---

## Proje Yapısı

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── email.service.ts      → Resend HTTP API
│   │   ├── otp.store.ts          → In-memory OTP (6 hane, 10dk TTL)
│   │   ├── dto/
│   │   ├── guards/               → JwtAuthGuard
│   │   ├── strategies/           → JwtStrategy
│   │   └── decorators/           → @CurrentUser()
│   ├── products/
│   ├── orders/
│   ├── quote-requests/
│   ├── companies/
│   └── users/
├── prisma/
│   └── prisma.service.ts
└── main.ts
```

---

## Lisans

MIT
