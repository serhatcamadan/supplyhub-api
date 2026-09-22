# supplyhub-api

SupplyHub platformunun NestJS backend servisi. Kimlik doğrulama, ürün yönetimi, sipariş/teklif işlemleri ve canlı ihale (WebSocket) akışını yönetir.

**Frontend:** [supplyhub](https://github.com/serhatcamadan/supplyhub) — Next.js 16, Vercel

---

## Tech Stack

| | |
|---|---|
| Framework | NestJS 12, ESM (`"type": "module"`) |
| Dil | TypeScript (strict) |
| ORM | Prisma v6 |
| Veritabanı | Supabase PostgreSQL |
| Auth | JWT (access 15dk + refresh 7gün) + OTP e-posta doğrulama, `RolesGuard` ile company-type/role bazlı yetkilendirme |
| Canlı veri | Socket.IO (`@nestjs/websockets`) — aynı Nest sunucusuna gömülü, ayrı bir servis değil |
| Zamanlanmış işler | `@nestjs/schedule` — süresi dolan ihaleleri kapatan periyodik sweep |
| Rate limiting | `@nestjs/throttler` (100 istek/dk, global) |
| Güvenlik | `helmet`, `cookie-parser`, global `ValidationPipe` (whitelist + forbidNonWhitelisted) |
| Health check | `@nestjs/terminus` (`/health`) |
| E-posta | Resend HTTP API |
| Test | Vitest |
| Deploy | Railway (Docker, `node dist/main.js` — uzun ömürlü process, serverless değil) |

---

## Kurulum

```bash
# 1. Bağımlılıkları kur
npm install

# 2. Ortam değişkenlerini tanımla
cp .env.example .env
# .env dosyasını düzenle (aşağıya bakın)

# 3. Şemayı veritabanına uygula + Prisma client üret
npx prisma db push
npx prisma generate

# 4. Geliştirme sunucusunu başlat
npm run start:dev
```

API: `http://localhost:3001`
Swagger: `http://localhost:3001/api` (yalnızca `NODE_ENV !== 'production'`)

> **Şema değişiklikleri:** Bu proje `prisma migrate` yerine `prisma db push` kullanır — `prisma/migrations/` klasöründeki eski kayıtlar artık aktif akışın parçası değil, sadece tarihsel referans. Yeni bir model/alan eklerken `schema.prisma`'yı düzenleyip `npx prisma db push && npx prisma generate` çalıştırın.

### Ortam Değişkenleri (`.env`)

```env
# Veritabanı (Supabase)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# JWT — access ve refresh secret'ları FARKLI olmalı (Joi validasyonu eşit olmalarını reddeder)
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
>
> **Not:** `FRONTEND_URL` hem HTTP CORS'u (`app.enableCors`) hem de WebSocket Gateway CORS'unu (`AuctionsGateway`) besler — ikisi ayrı ayrı yapılandırılır, tek env var'dan okunur.

---

## API Endpoints

### Auth (`/auth`)

| Method | Path | Açıklama |
|---|---|---|
| POST | `/auth/send-verification` | OTP kodu oluştur ve e-posta ile gönder |
| POST | `/auth/signup` | OTP doğrula + şirket + kullanıcı oluştur |
| POST | `/auth/login` | E-posta/şifre ile giriş, JWT cookie set |
| POST | `/auth/refresh` | Refresh token ile access token yenile (DB'den taze rol/şirket tipiyle) |
| POST | `/auth/logout` | Cookie'leri temizle |
| POST | `/auth/forgot-password` | Şifre sıfırlama e-postası gönder |
| POST | `/auth/reset-password` | Token ile şifre sıfırla |
| GET | `/auth/me` | Mevcut kullanıcı bilgisi (JWT gerekli) |

### Products (`/products`, `/seller/products`)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/products` | Aktif ürün listesi (public) |
| GET | `/products/:id` | Ürün detayı — taslak ürünler herkese 404 döner (public) |
| GET | `/products/:id/price-history` | Fiyat geçmişi — aynı görünürlük kuralı (public) |
| GET | `/seller/products` | Satıcının kendi ürünleri (JWT + `seller` rolü) |
| GET | `/seller/products/:id` | Satıcının kendi ürün detayı — taslak dahil, sahiplik kontrollü |
| POST | `/seller/products` | Yeni ürün oluştur |
| PATCH | `/seller/products/:id` | Ürün güncelle |
| PATCH | `/seller/products/:id/status` | Ürün durumu güncelle (active/draft) |
| DELETE | `/seller/products/:id` | Ürün sil |

### Orders (`/orders`)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/orders` | Sipariş listesi (buyer: kendi, seller: aldıkları) |
| GET | `/orders/:id` | Sipariş detayı |
| POST | `/orders` | Sipariş oluştur (`buyer` rolü, sunucu taraflı fiyatlandırma, `sellerId` ürün sahibiyle doğrulanır) |
| PATCH | `/orders/:id/status` | Durum güncelle (`seller` rolü: confirmed/shipped/delivered) |
| POST | `/orders/:id/approve` | Sipariş onayla (`buyer/admin` rolü) |
| POST | `/orders/:id/reject` | Sipariş reddet + stok iadesi (`buyer/admin` rolü) |

### Auctions (`/auctions`, `/seller/auctions`) — canlı ihale

| Method | Path | Açıklama |
|---|---|---|
| GET | `/auctions?status=active` | İhale listesi (public, varsayılan: aktif) |
| GET | `/auctions/:id` | İhale detayı (public) |
| GET | `/auctions/:id/bids` | Teklif geçmişi, en yeni 50 (public) |
| POST | `/auctions/:id/bids` | Teklif ver (`buyer` rolü) — REST fallback, gerçek akış WebSocket üzerinden |
| GET | `/seller/auctions` | Satıcının kendi ihaleleri, tüm statüler (`seller` rolü) |
| POST | `/seller/auctions` | Mevcut bir üründen ihale oluştur (`seller` rolü) |
| PATCH | `/seller/auctions/:id/cancel` | İhaleyi iptal et (`seller` rolü) |

**WebSocket** (`/auctions` namespace, `socket.io`): handshake'te `auth: { token }` ile JWT doğrulanır (`JwtService.verifyAsync`, HTTP guard'larından bağımsız — bkz. `auctions.gateway.ts`).

| Event (client → server) | Payload | Açıklama |
|---|---|---|
| `join_auction` | `{ auctionId }` | İhale odasına katıl |
| `leave_auction` | `{ auctionId }` | Odadan ayrıl |
| `place_bid` | `{ auctionId, amount }` | Teklif ver — ack callback `{ ok, code?, message?, currentPrice? }` döner |

| Event (server → client) | Açıklama |
|---|---|
| `new_bid` | Odadaki herkese yayınlanır — `{ auction, bid, previousBidderId }` |
| `auction_ended` | İhale bitince/iptal olunca — `{ auctionId, reason: 'expired'\|'cancelled', winnerId?, finalPrice? }` |

**Teklif çakışması (race condition) koruması:** Redis/dağıtık kilit kullanılmaz. `AuctionsService.placeBid()` bir Prisma `$transaction` içinde `updateMany({ where: { id, status:'active', current_price: {lt: amount} } })` çalıştırır; dönen `count === 0` ise başka bir teklif önce kazanmıştır ve istemciye güncel fiyatla `ConflictException` (`stale_price`) döner. Bu, Postgres'in satır seviyesi atomikliğine dayanır — uygulama seviyesinde ayrı bir lock/kuyruk mekanizması yoktur.

**İhaleleri kapatma:** `AuctionsSweepService` her 15 saniyede bir süresi dolmuş (`ends_at <= now()`) aktif ihaleleri bulup `ended` durumuna çeker, kazananı belirler, bildirim gönderir ve `auction_ended` yayınlar — bu, `active → ended` geçişini yapan tek yerdir. `placeBid()` içindeki gecikmeli (`ends_at` kontrolü) kontrol ise sadece süresi geçmiş teklifleri reddeder, hiçbir zaman durumu kendisi değiştirmez.

### QuoteRequests (`/quote-requests`)

Alıcı-satıcı arası 1:1 teklif pazarlığı — talep/yanıt/kabul/red akışı. Ayrıntılar için Swagger.

### Reviews (`/reviews`)

`POST /reviews` — teslim edilmiş bir siparişteki ürünü değerlendir (`buyer` rolü, 1-5 puan).

### Companies, Users, Notifications

| Method | Path | Açıklama |
|---|---|---|
| GET | `/companies/:id` | Şirket detayı (kargo ayarları, teslimat oranı) |
| PATCH | `/companies/my` | Kendi şirketini güncelle |
| GET | `/users/me` | Kendi profilini getir |
| PATCH | `/users/me` | Profil güncelle (şifre değişikliği `currentPassword` doğrulaması ister) |
| GET | `/notifications` | Kendi şirketinin bildirimleri |
| PATCH | `/notifications/:id/read` | Tek bildirimi okundu işaretle |
| PATCH | `/notifications/read-all` | Tümünü okundu işaretle |

### Health

`GET /health` — `@nestjs/terminus` ile DB bağlantısı kontrolü.

---

## Güvenlik

- Her mutasyon endpoint'i `JwtAuthGuard` + `RolesGuard` (`@Roles('seller' | 'buyer' | 'buyer/admin' | 'buyer/staff')`) ile korunur; salt-okunur public endpoint'ler (`GET /products`, `GET /auctions`) bilinçli olarak açık.
- Sahiplik kontrolleri servis katmanında yapılır (ör. `products.service.ts`, `orders.service.ts`, `auctions.service.ts`) — JWT'deki `companyId` ile kaynak sahibi karşılaştırılır.
- `POST /orders` sipariş oluştururken client'ın gönderdiği `sellerId`'yi ürünlerin gerçek sahibiyle doğrular (cross-tenant sipariş enjeksiyonu engellenir).
- OTP kodları `crypto.randomInt`, şifre sıfırlama token'ları `crypto.randomBytes(32)` ile üretilir — `Math.random()` kullanılmaz.
- `JWT_ACCESS_SECRET` ile `JWT_REFRESH_SECRET`'ın aynı değer olması Joi validasyonunda reddedilir.
- `AuctionsGateway`, global `ThrottlerGuard`'ın HTTP'ye özgü rate-limit header mantığıyla çakışmaması için `@SkipThrottle()` ile işaretlenmiştir.

---

## Testler

```bash
npm run test          # Vitest (unit) — tüm servisler için mock Prisma + fixture JWT payload'larıyla
npm run test:watch    # Watch modu
npm run test:cov      # Coverage raporu
```

`AuctionsService`/`AuctionsSweepService` testleri özellikle teklif yarışı senaryolarını kapsar: `updateMany` çağrısının `count: 0` (kaybedilen yarış) ve `count: 1` (kazanılan yarış) döndürdüğü durumlar ayrı ayrı doğrulanır. Gerçek çok-istemcili WebSocket yarışları Playwright'ta güvenilir şekilde reprodüklenemediğinden bilinçli olarak otomatik test kapsamı dışında bırakılmıştır — bu senaryolar manuel olarak (iki farklı tarayıcı oturumu) doğrulanır.

---

## Proje Yapısı

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── email.service.ts      → Resend HTTP API
│   │   ├── otp.store.ts          → In-memory OTP (6 hane, crypto.randomInt, 10dk TTL)
│   │   ├── reset-token.store.ts  → In-memory reset token (crypto.randomBytes(32))
│   │   ├── dto/
│   │   ├── guards/               → JwtAuthGuard
│   │   ├── strategies/           → JwtStrategy
│   │   └── decorators/           → @CurrentUser()
│   ├── products/
│   ├── orders/
│   ├── quote-requests/
│   ├── auctions/
│   │   ├── auctions.controller.ts   → REST
│   │   ├── auctions.service.ts      → tek doğruluk kaynağı — hem REST hem gateway bunu çağırır
│   │   ├── auctions.gateway.ts      → WebSocket (Socket.IO), aynı Nest sunucusuna gömülü
│   │   ├── auctions-sweep.service.ts → @Interval(15000), süresi dolan ihaleleri kapatır
│   │   └── dto/
│   ├── reviews/
│   ├── companies/
│   ├── users/
│   └── notifications/
├── common/
│   ├── guards/                   → RolesGuard
│   ├── decorators/                → @Roles()
│   └── filters/                   → GlobalExceptionFilter
├── config/
│   └── env.validation.ts         → Joi ile ortam değişkeni doğrulama
├── health/
├── prisma/
│   └── prisma.service.ts
└── main.ts
```

---

## Lisans

MIT
