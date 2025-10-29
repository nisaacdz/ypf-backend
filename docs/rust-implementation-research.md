# Rust Implementation Research

## Executive Summary

This document analyzes the feasibility of translating the YPF Backend from TypeScript/Express to Rust, comparing **Actix-web** and **Axum** frameworks, and provides a comprehensive implementation plan with recommended crates and architectural patterns.

**Recommended Framework**: **Axum** (with considerations for Actix-web for specific use cases)

---

## Current Architecture Analysis

### Tech Stack Overview

The current YPF Backend is built with:
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 5.1.0
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod 4.1.8
- **Authentication**: JWT (jsonwebtoken) with cookie-based tokens (access + refresh)
- **Security**: Helmet, CORS, rate limiting
- **Real-time**: Socket.IO (partially implemented for chat)
- **File Upload**: Multer with Azure Blob Storage and ImageKit
- **Email**: Nodemailer with SMTP
- **Logging**: Pino
- **Documentation**: Swagger with swagger-jsdoc
- **Testing**: Vitest with Supertest

### Key Architectural Patterns

1. **Feature-based organization**: Routes organized in `features/api/v*` with handlers
2. **Service layer**: Business logic in `shared/services/`
3. **Middleware stacking**: auth, validation, rate limiting, error handling
4. **Type-safe validation**: Zod schemas with automatic TypeScript type inference
5. **Centralized config**: Environment variables validated and typed via `configs/env.ts`
6. **Custom authorization**: Guard functions with role/profile-based access control
7. **Structured error handling**: `AppError` class with status codes
8. **Standardized API responses**: `ApiResponse<T>` type with success/data/message fields

---

## Framework Comparison: Actix-web vs Axum

### Axum (Recommended)

**Pros**:
- **Modern async/await**: Built on Tokio, native async/await support
- **Type safety**: Leverages Rust's type system extensively with extractors
- **Tower ecosystem**: Access to tower middleware (battle-tested)
- **Ergonomic API**: Clean, composable middleware via `tower::Layer`
- **Better documentation**: Clear examples and growing community
- **Extractor pattern**: Similar to Express middleware, very intuitive
- **Less boilerplate**: More concise route definitions
- **Better for API-first**: Designed with REST APIs in mind

**Cons**:
- Slightly newer (but stable and production-ready)
- Smaller ecosystem than Actix (but growing rapidly)

**Best fit for YPF Backend**: ✅
- Middleware stacking aligns well with Tower layers
- Extractor pattern matches our validation approach
- Type safety similar to TypeScript + Zod
- Clean separation of concerns

### Actix-web

**Pros**:
- **Mature ecosystem**: Large community, extensive middleware
- **Performance**: Often cited as one of the fastest web frameworks
- **Feature-rich**: Built-in session management, WebSocket support
- **Well-documented**: Extensive examples and guides
- **Actor model**: Built on Actix actor system (optional to use)

**Cons**:
- **More complex API**: Steeper learning curve
- **Macro-heavy**: Heavy use of procedural macros can be confusing
- **Less "Rust-idiomatic"**: Some patterns feel less natural
- **Middleware composition**: Not as clean as Tower's layer approach

**Best fit for YPF Backend**: 🟡
- Still viable, especially if maximum performance is critical
- Good for WebSocket if we expand chat features
- More mature, but less ergonomic

### Verdict

**Choose Axum** because:
1. Cleaner middleware composition matches our Express patterns
2. Better type safety and extractor pattern for validation
3. More intuitive for TypeScript developers transitioning to Rust
4. Tower middleware ecosystem is excellent
5. Growing rapidly with strong backing from Tokio team

---

## Implementation Plan by Domain

### 1. Project Structure

**Rust equivalent organization**:

```
ypf-backend-rust/
├── Cargo.toml
├── .env.example
├── migrations/          # SQLx migrations
├── src/
│   ├── main.rs
│   ├── config/         # Environment and app configuration
│   │   ├── mod.rs
│   │   ├── env.rs      # Environment variables (dotenv + validation)
│   │   ├── database.rs # Database pool setup
│   │   └── auth.rs     # JWT secret and config
│   ├── models/         # Database models (SQLx or SeaORM)
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   ├── constituent.rs
│   │   └── ...
│   ├── schemas/        # Request/response validation schemas
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   └── ...
│   ├── routes/         # API route definitions
│   │   ├── mod.rs
│   │   ├── v1/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs
│   │   │   ├── users.rs
│   │   │   └── ...
│   ├── handlers/       # Route handlers (business logic)
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   └── ...
│   ├── services/       # Business logic services
│   │   ├── mod.rs
│   │   ├── auth_service.rs
│   │   ├── user_service.rs
│   │   └── ...
│   ├── middleware/     # Custom middleware
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   ├── error_handler.rs
│   │   ├── rate_limit.rs
│   │   └── cors.rs
│   ├── utils/          # Utility functions
│   │   ├── mod.rs
│   │   ├── jwt.rs
│   │   ├── email.rs
│   │   └── ...
│   ├── error.rs        # Custom error types
│   └── types.rs        # Shared types and DTOs
├── tests/
│   ├── integration/
│   └── unit/
└── docs/
```

**Alignment**: ✅ Very similar structure, maintains feature organization

---

### 2. HTTP Server & Routing

**Recommended Crates**:
- `axum = "0.7"` - Web framework
- `tokio = { version = "1", features = ["full"] }` - Async runtime
- `tower = "0.4"` - Middleware
- `tower-http = "0.5"` - HTTP-specific middleware

**Pattern Translation**:

TypeScript (Express):
```typescript
app.use(helmet());
app.use(cors({ origin: variables.security.allowedOrigins }));
app.use(express.json());
app.use("/api/v1", apiRouter);
```

Rust (Axum):
```rust
use axum::{Router, routing::get};
use tower_http::{
    cors::CorsLayer,
    compression::CompressionLayer,
    trace::TraceLayer,
};

let app = Router::new()
    .route("/api/v1/auth/login", post(handlers::auth::login))
    .layer(CorsLayer::permissive()) // Configure with allowed origins
    .layer(CompressionLayer::new())
    .layer(TraceLayer::new_for_http());
```

**Difficulty**: 🟢 Easy - Very similar conceptual model

---

### 3. Configuration & Environment Variables

**Recommended Crates**:
- `dotenvy = "0.15"` - Load .env files
- `serde = { version = "1", features = ["derive"] }` - Serialization
- `config = "0.14"` - Configuration management
- `validator = { version = "0.18", features = ["derive"] }` - Validation

**Pattern Translation**:

TypeScript (Zod):
```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().positive().default(3000),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.url(),
});

const variables = envSchema.parse(process.env);
```

Rust (config + validator):
```rust
use serde::Deserialize;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct Config {
    #[validate(length(min = 32))]
    pub jwt_secret: String,
    
    #[validate(url)]
    pub database_url: String,
    
    #[serde(default = "default_port")]
    pub port: u16,
    
    pub node_env: Environment,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Development,
    Production,
    Test,
}

impl Config {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        dotenvy::dotenv().ok();
        
        let config = config::Config::builder()
            .add_source(config::Environment::default())
            .build()?;
            
        let cfg: Config = config.try_deserialize()?;
        cfg.validate()
            .map_err(|e| config::ConfigError::Message(e.to_string()))?;
        Ok(cfg)
    }
}
```

**Difficulty**: 🟢 Easy - Similar validation approach, Rust provides stronger compile-time guarantees

---

### 4. Database & ORM

**Recommended Approach**: **SQLx** (compile-time query checking)

**Alternative**: SeaORM (more ORM-like, similar to Drizzle)

**Recommended Crates**:
- `sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "migrate", "uuid", "chrono"] }`
- `uuid = { version = "1.6", features = ["serde", "v4"] }`
- `chrono = { version = "0.4", features = ["serde"] }`

**Pattern Translation**:

TypeScript (Drizzle):
```typescript
const [user] = await pgPool.db
  .select({
    id: schema.Users.id,
    email: schema.Users.email,
    password: schema.Users.password,
  })
  .from(schema.Users)
  .where(eq(schema.Users.username, username));
```

Rust (SQLx):
```rust
use sqlx::PgPool;
use uuid::Uuid;

#[derive(sqlx::FromRow)]
struct User {
    id: Uuid,
    email: String,
    password: String,
}

let user = sqlx::query_as::<_, User>(
    "SELECT id, email, password FROM users WHERE username = $1"
)
.bind(&username)
.fetch_optional(&pool)
.await?;
```

**Migration Management**:
```bash
# SQLx CLI
cargo install sqlx-cli --no-default-features --features postgres
sqlx migrate add create_users_table
sqlx migrate run
```

**Difficulty**: 🟡 Medium - Different query style, but compile-time checking is a huge advantage

**Why SQLx over SeaORM**:
- Compile-time query verification
- Less abstraction = easier to optimize
- More control over SQL
- Better performance
- SeaORM is good for rapid development but adds overhead

---

### 5. Validation

**Recommended Crates**:
- `validator = { version = "0.18", features = ["derive"] }` - Validation
- `serde = { version = "1", features = ["derive"] }` - Serialization
- `serde_json = "1"` - JSON handling

**Pattern Translation**:

TypeScript (Zod):
```typescript
export const UsernameAndPasswordSchema = z.object({
  username: z.string(),
  password: z.string().min(4).max(55),
});

// Middleware
export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError(result.error.issues[0]?.message, 400));
    }
    req.Body = result.data;
    return next();
  };
}
```

Rust (validator + Axum):
```rust
use axum::{Json, extract::rejection::JsonRejection};
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    pub username: String,
    
    #[validate(length(min = 4, max = 55))]
    pub password: String,
}

// Custom extractor that validates
pub struct ValidatedJson<T>(pub T);

#[axum::async_trait]
impl<S, T> FromRequest<S> for ValidatedJson<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<ErrorResponse>);

    async fn from_request(
        req: Request<Body>,
        state: &S,
    ) -> Result<Self, Self::Rejection> {
        let Json(data) = Json::<T>::from_request(req, state)
            .await
            .map_err(|e| {
                let error = ErrorResponse {
                    success: false,
                    message: format!("Invalid JSON: {}", e),
                };
                (StatusCode::BAD_REQUEST, Json(error))
            })?;
        
        data.validate().map_err(|e| {
            let error = ErrorResponse {
                success: false,
                message: format!("Validation error: {}", e),
            };
            (StatusCode::BAD_REQUEST, Json(error))
        })?;
        
        Ok(ValidatedJson(data))
    }
}

// Usage in handler
async fn login(
    ValidatedJson(payload): ValidatedJson<LoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AppError> {
    // payload is already validated
    // ...
}
```

**Difficulty**: 🟢 Easy - Actually more ergonomic with Axum extractors

---

### 6. Authentication & Authorization

**Recommended Crates**:
- `jsonwebtoken = "9"` - JWT encoding/decoding
- `bcrypt = "0.15"` - Password hashing
- `tower-cookies = "0.10"` - Cookie management (works with Axum)

**Pattern Translation**:

TypeScript (JWT + Cookies):
```typescript
export async function authenticate(req, res, next) {
  const accessToken = req.cookies.access_token;
  
  const decoded = decodeData(accessToken, AuthenticatedUserSchema);
  
  if (decoded && "valid" in decoded) {
    req.User = decoded.valid;
    return next();
  }
  
  return next(new AppError("Invalid token", 401));
}
```

Rust (JWT + Tower Cookies):
```rust
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use tower_cookies::Cookies;

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticatedUser {
    pub id: Uuid,
    pub email: String,
    pub roles: Vec<String>,
    pub profiles: Vec<String>,
}

// Extension to add user to request
pub async fn authenticate_middleware(
    State(config): State<Arc<Config>>,
    cookies: Cookies,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let access_token = cookies
        .get("access_token")
        .ok_or_else(|| AppError::Unauthorized("Missing token".into()))?
        .value();
    
    let token_data = decode::<AuthenticatedUser>(
        access_token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized("Invalid token".into()))?;
    
    req.extensions_mut().insert(token_data.claims);
    
    Ok(next.run(req).await)
}

// Extractor to get user from request
pub struct AuthUser(pub AuthenticatedUser);

#[axum::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let user = parts
            .extensions
            .get::<AuthenticatedUser>()
            .ok_or_else(|| AppError::Unauthorized("No user found".into()))?
            .clone();
        
        Ok(AuthUser(user))
    }
}
```

**Authorization Guards**:

TypeScript:
```typescript
export const authorize = (guard: GuardFunction) => {
  return async (req, res, next) => {
    const hasAccess = await guard(req);
    if (hasAccess) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
};
```

Rust:
```rust
pub struct RequireRole(pub Vec<String>);

#[axum::async_trait]
impl<S> FromRequestParts<S> for RequireRole
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let AuthUser(user) = AuthUser::from_request_parts(parts, _state).await?;
        
        // Check roles - this would be more sophisticated
        if user.roles.is_empty() {
            return Err(AppError::Forbidden("Insufficient permissions".into()));
        }
        
        Ok(RequireRole(user.roles))
    }
}

// Usage
async fn admin_only(
    AuthUser(user): AuthUser,
    RequireRole(roles): RequireRole,
) -> Result<Json<ApiResponse<()>>, AppError> {
    // Only called if user has required role
    Ok(Json(ApiResponse::success((), "Success")))
}
```

**Difficulty**: 🟡 Medium - Different pattern (extractors vs middleware chain), but more type-safe

---

### 7. Error Handling

**Pattern Translation**:

TypeScript:
```typescript
export class AppError extends Error {
  public statusCode: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.statusCode = status;
  }
}

export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
```

Rust:
```rust
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug)]
pub enum AppError {
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    BadRequest(String),
    InternalServerError(String),
    DatabaseError(sqlx::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::InternalServerError(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".into())
            }
            AppError::DatabaseError(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".into())
            }
        };
        
        let body = Json(ErrorResponse {
            success: false,
            message,
        });
        
        (status, body).into_response()
    }
}

// Convenient From implementations
impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::DatabaseError(e)
    }
}
```

**Difficulty**: 🟢 Easy - Rust's Result type makes error handling more explicit and safer

---

### 8. API Response Structure

**Pattern Translation**:

TypeScript:
```typescript
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

// Usage
return {
  success: true,
  data: user,
  message: "Login successful",
};
```

Rust:
```rust
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T, message: impl Into<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: Some(message.into()),
        }
    }
    
    pub fn success_no_message(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }
}

// Usage
Ok(Json(ApiResponse::success(user, "Login successful")))
```

**Difficulty**: 🟢 Easy - Nearly identical pattern

---

### 9. Middleware & Rate Limiting

**Recommended Crates**:
- `tower-http = "0.5"` - Standard HTTP middleware
- `tower-governor = "0.3"` - Rate limiting
- `tracing = "0.1"` - Logging
- `tracing-subscriber = "0.3"` - Log formatting

**Pattern Translation**:

TypeScript:
```typescript
app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 99 }));
```

Rust:
```rust
use tower_governor::{
    governor::GovernorConfigBuilder,
    GovernorLayer,
};
use std::time::Duration;

let governor_conf = Box::new(
    GovernorConfigBuilder::default()
        .per_second(99)
        .burst_size(99)
        .finish()
        .unwrap()
);

let app = Router::new()
    // ... routes
    .layer(GovernorLayer {
        config: Box::leak(governor_conf),
    });
```

**Logging**:

TypeScript (Pino):
```typescript
import logger from "@/configs/logger";
logger.info("Server is live");
logger.error(err.stack);
```

Rust (tracing):
```rust
use tracing::{info, error};

info!("Server is live on http://{}:{}", config.host, config.port);
error!("Error occurred: {:?}", err);
```

**Difficulty**: 🟢 Easy - Similar concepts, Tower provides excellent middleware

---

### 10. File Upload & Storage

**Recommended Crates**:
- `multer = "3"` - Multipart form handling
- `azure_storage_blobs = "0.20"` - Azure Blob Storage
- `bytes = "1"` - Byte handling
- `tokio-util = { version = "0.7", features = ["io"] }` - Stream utilities

**Pattern Translation**:

TypeScript (Multer):
```typescript
router.post(
  "/upload",
  multipart.single("file"),
  validateFile(ImageFileSchema),
  handler
);
```

Rust (Multer):
```rust
use axum::extract::Multipart;
use bytes::Bytes;

async fn upload_handler(
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<String>>, AppError> {
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("");
        if name == "file" {
            let content_type = field.content_type().unwrap_or("");
            let data = field.bytes().await?;
            
            // Validate file type, size, etc.
            validate_file(&data, content_type)?;
            
            // Upload to Azure
            let url = upload_to_azure(data).await?;
            
            return Ok(Json(ApiResponse::success(url, "Upload successful")));
        }
    }
    
    Err(AppError::BadRequest("No file provided".into()))
}
```

**Difficulty**: 🟡 Medium - More manual but more control over streams

---

### 11. Email Service

**Recommended Crates**:
- `lettre = "0.11"` - Email sending
- `tera = "1"` - Template engine (similar to Handlebars)

**Pattern Translation**:

TypeScript (Nodemailer):
```typescript
await emailer.send({
  to: user.email,
  subject: "Password Reset",
  text: `Your OTP is: ${otp}`,
});
```

Rust (Lettre):
```rust
use lettre::{
    Message, SmtpTransport, Transport,
    transport::smtp::authentication::Credentials,
};

pub struct EmailService {
    mailer: SmtpTransport,
    from: String,
}

impl EmailService {
    pub fn new(config: &Config) -> Result<Self, Box<dyn std::error::Error>> {
        let creds = Credentials::new(
            config.smtp_user.clone(),
            config.smtp_pass.clone(),
        );
        
        let mailer = SmtpTransport::relay(&config.smtp_host)?
            .credentials(creds)
            .build();
        
        Ok(Self {
            mailer,
            from: config.emailer.clone(),
        })
    }
    
    pub async fn send_email(
        &self,
        to: &str,
        subject: &str,
        body: &str,
    ) -> Result<(), AppError> {
        let email = Message::builder()
            .from(self.from.parse().unwrap())
            .to(to.parse().unwrap())
            .subject(subject)
            .body(body.to_string())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        
        self.mailer.send(&email)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        
        Ok(())
    }
}
```

**Difficulty**: 🟢 Easy - Very similar API

---

### 12. WebSocket / Real-time Communication

**Recommended Crates**:
- `axum = { version = "0.7", features = ["ws"] }` - WebSocket support in Axum
- `tokio = { version = "1", features = ["sync"] }` - Async channels

**Pattern Translation**:

TypeScript (Socket.IO):
```typescript
io.on("connection", (socket) => {
  socket.on("sendMessage", (data) => {
    // Handle message
  });
});
```

Rust (Axum WebSocket):
```rust
use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade},
    response::Response,
};

async fn websocket_handler(
    ws: WebSocketUpgrade,
) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    while let Some(msg) = socket.recv().await {
        if let Ok(msg) = msg {
            match msg {
                Message::Text(text) => {
                    // Handle text message
                    if socket.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
                _ => {}
            }
        } else {
            break;
        }
    }
}
```

**Difficulty**: 🟡 Medium - Socket.IO has more features out of the box; Axum WS is lower-level but sufficient

---

### 13. API Documentation

**Recommended Crates**:
- `utoipa = { version = "4", features = ["axum_extras"] }` - OpenAPI generation
- `utoipa-swagger-ui = { version = "6", features = ["axum"] }` - Swagger UI

**Pattern Translation**:

TypeScript (swagger-jsdoc):
```typescript
/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 */
router.post("/login", handler);
```

Rust (utoipa):
```rust
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        routes::auth::login,
        routes::auth::logout,
    ),
    components(
        schemas(LoginRequest, AuthResponse, ErrorResponse)
    ),
    tags(
        (name = "Authentication", description = "Authentication endpoints")
    )
)]
struct ApiDoc;

// In handler
#[utoipa::path(
    post,
    path = "/api/v1/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = ApiResponse<AuthResponse>),
        (status = 401, description = "Invalid credentials", body = ErrorResponse)
    ),
    tag = "Authentication"
)]
async fn login(
    ValidatedJson(payload): ValidatedJson<LoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AppError> {
    // ...
}

// Serve Swagger UI
let app = Router::new()
    .merge(SwaggerUi::new("/docs")
        .url("/api-docs/openapi.json", ApiDoc::openapi()));
```

**Difficulty**: 🟢 Easy - Actually better integration with utoipa (compile-time checking)

---

### 14. Testing

**Recommended Crates**:
- Built-in `cargo test`
- `tokio = { version = "1", features = ["test-util", "macros"] }` - Async test runtime
- `sqlx = { version = "0.7", features = ["test"] }` - Database testing helpers
- `tower = { version = "0.4", features = ["util"] }` - Test utilities
- `axum-test = "14"` - Easier Axum route testing (alternative to manual approach)

**Pattern Translation**:

TypeScript (Vitest + Supertest):
```typescript
describe("Auth API", () => {
  it("should login with valid credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test", password: "password" });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

Rust (tokio + axum):
```rust
use axum::http::{Request, StatusCode};
use tower::ServiceExt; // for `oneshot`

#[tokio::test]
async fn test_login_success() {
    let app = create_test_app().await;
    
    let request = Request::builder()
        .uri("/api/v1/auth/login")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_string(&LoginRequest {
                username: "test".into(),
                password: "password".into(),
            }).unwrap()
        ))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let api_response: ApiResponse<AuthResponse> = 
        serde_json::from_slice(&body).unwrap();
    
    assert!(api_response.success);
}
```

**Difficulty**: 🟡 Medium - More verbose but same concepts

---

## Complete Crate Recommendations

### Core Framework
```toml
[dependencies]
# Web framework
axum = { version = "0.7", features = ["ws", "macros"] }
tokio = { version = "1", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["fs", "trace", "cors", "compression"] }
tower-cookies = "0.10"
tower-governor = "0.3"

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Validation
validator = { version = "0.18", features = ["derive"] }

# Database
sqlx = { version = "0.7", features = [
    "runtime-tokio-rustls",
    "postgres",
    "uuid",
    "chrono",
    "migrate",
    "macros"
] }

# Authentication
jsonwebtoken = "9"
bcrypt = "0.15"

# Configuration
dotenvy = "0.15"
config = "0.14"

# Error handling
anyhow = "1"
thiserror = "1"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Utilities
uuid = { version = "1.6", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
bytes = "1"

# File upload & storage
multer = "3"
azure_storage_blobs = "0.20"
tokio-util = { version = "0.7", features = ["io"] }

# Email
lettre = { version = "0.11", features = ["tokio1-rustls-tls"] }
tera = "1"

# API Documentation
utoipa = { version = "4", features = ["axum_extras", "uuid", "chrono"] }
utoipa-swagger-ui = { version = "6", features = ["axum"] }

[dev-dependencies]
tokio = { version = "1", features = ["test-util", "macros"] }
axum-test = "14"
sqlx = { version = "0.7", features = ["test"] }
```

---

## Migration Strategy

### Phase 1: Foundation (2-3 weeks)
1. Set up project structure
2. Implement configuration management
3. Set up database connection and migrations
4. Implement error handling patterns
5. Set up logging and tracing

### Phase 2: Core Authentication (2 weeks)
1. Implement JWT utilities
2. Create authentication middleware
3. Build authorization guards
4. Port auth routes and handlers

### Phase 3: API Features (4-6 weeks)
1. Port validation schemas
2. Migrate API routes one by one:
   - Users
   - Members
   - Chapters
   - Committees
   - Events
   - Projects
3. Implement services layer
4. Add middleware (rate limiting, CORS, etc.)

### Phase 4: External Services (1-2 weeks)
1. File upload and storage
2. Email service
3. WebSocket/real-time features

### Phase 5: Testing & Documentation (2 weeks)
1. Write integration tests
2. Write unit tests
3. Set up API documentation with utoipa
4. Performance testing and optimization

### Phase 6: Deployment & DevOps (1 week)
1. Dockerize application
2. CI/CD setup
3. Production deployment
4. Monitoring and logging setup

**Total Estimated Time**: 12-16 weeks for a full port

---

## Advantages of Rust Implementation

1. **Type Safety**: Compile-time guarantees prevent entire classes of runtime errors
2. **Performance**: 2-10x faster than Node.js in most benchmarks
3. **Memory Safety**: No garbage collection pauses, predictable memory usage
4. **Concurrency**: Fearless concurrency with Rust's ownership model
5. **Error Handling**: Explicit Result types force proper error handling
6. **Binary Size**: Single compiled binary, no runtime needed
7. **Deployment**: No dependency on Node.js runtime
8. **Resource Usage**: Lower memory footprint, ideal for containers

---

## Challenges & Considerations

1. **Learning Curve**: Rust has a steep learning curve (ownership, lifetimes)
2. **Development Speed**: Initially slower development compared to TypeScript
3. **Ecosystem Maturity**: Some crates less mature than NPM equivalents
4. **Team Skill**: Team needs to learn Rust
5. **Debugging**: Different debugging tools and techniques
6. **Async Complexity**: Async Rust can be complex for beginners

---

## Difficulty Assessment by Component

| Component | Difficulty | Notes |
|-----------|-----------|-------|
| HTTP Server & Routing | 🟢 Easy | Axum is very ergonomic |
| Configuration | 🟢 Easy | Similar validation patterns |
| Database/ORM | 🟡 Medium | Different query style, but SQLx is excellent |
| Validation | 🟢 Easy | Actually more ergonomic with extractors |
| Authentication | 🟡 Medium | Different patterns, but more type-safe |
| Authorization | 🟡 Medium | Extractor pattern needs learning |
| Error Handling | 🟢 Easy | More explicit, safer |
| API Responses | 🟢 Easy | Nearly identical |
| Middleware | 🟢 Easy | Tower middleware is excellent |
| File Upload | 🟡 Medium | More manual, but more control |
| Email | 🟢 Easy | Very similar API |
| WebSocket | 🟡 Medium | Lower-level but sufficient |
| Documentation | 🟢 Easy | Better compile-time integration |
| Testing | 🟡 Medium | More verbose, same concepts |

**Overall Difficulty**: 🟡 **Medium** - Feasible for a team willing to invest in learning Rust

---

## Conclusion

**Is it worth migrating to Rust?**

**Yes, if:**
- Performance and resource efficiency are priorities
- Team is willing to invest time in learning Rust
- Long-term maintainability and type safety are valued
- Scaling and deployment costs are concerns

**No, if:**
- Team has no Rust experience and tight deadlines
- Current TypeScript solution meets all performance needs
- Rapid feature development is the primary goal
- Ecosystem maturity for specific features is critical

**Recommendation**: Start with a **pilot project** or **proof of concept** implementing 1-2 endpoints in Rust to evaluate:
1. Team learning curve
2. Development velocity
3. Performance gains
4. Integration with existing systems

The architecture and patterns translate well to Rust, especially with Axum. The main investment is in team training and initial setup, but the long-term benefits of type safety, performance, and resource efficiency can be substantial.

---

## Additional Resources

- [Axum Documentation](https://docs.rs/axum/)
- [SQLx Documentation](https://docs.rs/sqlx/)
- [The Rust Book](https://doc.rust-lang.org/book/)
- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Zero To Production In Rust](https://www.zero2prod.com/) - Excellent book on building production Rust APIs

