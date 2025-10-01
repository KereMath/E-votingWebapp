use axum::{
    body::Body,
    extract::{Multipart, State},
    http::{Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router, TypedHeader,
};
use axum::headers::Authorization;
use axum::headers::authorization::Bearer;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use sha2::{Sha256, Digest};
use rand::Rng;
use chrono::{Utc, Duration};
use jsonwebtoken::{encode, Header, EncodingKey, decode, Validation, DecodingKey};
use tower_http::cors::{CorsLayer, Any};

// --- Sabitler ---
const JWT_SECRET: &str = "cok-gizli-bir-anahtar-bunu-degistir";
const OTP_LIFESPAN_SECONDS: i64 = 300; // OTP'ler 5 dakika geçerli

// --- Veri Yapıları & Uygulama Durumu ---
type OtpStore = Mutex<HashMap<i32, (String, String, i64)>>;

struct AppState {
    db: PgPool,
    otp_store: OtpStore,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    admin_id: i32,
    exp: usize,
}

#[derive(Serialize, Deserialize)]
struct AdminRegistration { tc: String, email: String, phone: String }

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Admin { id: i32, email: String, tc_hash: String, phone_hash: String }

#[derive(Serialize, Deserialize)]
struct LoginStartPayload { tc: String, email: String }

#[derive(Debug, Serialize, Deserialize)]
struct LoginVerifyPayload { tc: String, email: String, email_otp: String, phone_otp: String }

#[derive(Debug, Deserialize, sqlx::FromRow)]
struct VoterRecord { tc: String, email: String, phone: String }

// --- Ana Fonksiyon ---
#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to create pool.");
    
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    tracing::debug!("Database connected and migrations are up-to-date.");
    
    let shared_state = Arc::new(AppState {
        db: pool.clone(),
        otp_store: Mutex::new(HashMap::new()),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    // JWT ile korunacak rotaları tanımla
    let admin_routes = Router::new()
        .route("/admin/upload_voters", post(upload_voters))
        .route_layer(middleware::from_fn_with_state(shared_state.clone(), auth));

    // Genel, korumasız rotaları tanımla
    let app = Router::new()
        .route("/", get(health_check))
        .route("/admin/register", post(register_admin))
        .route("/admin/login_start", post(login_start))
        .route("/admin/login_verify", post(login_verify))
        .merge(admin_routes) // Korumalı rotaları genel rotalarla birleştir
        .with_state(shared_state)
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    tracing::debug!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// --- JWT Yetkilendirme (Authentication Middleware) ---
async fn auth(
    State(_state): State<Arc<AppState>>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    mut request: Request<Body>,
    next: Next<Body>,  // <<<--- FIX: Body generic parameter eklendi
) -> Result<Response, StatusCode> {
    let token = auth_header.token();
    let decoding_key = DecodingKey::from_secret(JWT_SECRET.as_ref());
    
    match decode::<Claims>(token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            request.extensions_mut().insert(token_data.claims.admin_id);
            Ok(next.run(request).await)
        }
        Err(_) => {
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

// --- Yeni API Handler (CSV Yükleme) ---
async fn upload_voters(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> (StatusCode, Json<Value>) {
    let mut total_records = 0;
    let mut successful_inserts = 0;

    while let Some(field) = multipart.next_field().await.unwrap() {
        if field.name() == Some("voters_file") {
            let data = field.bytes().await.unwrap();
            let mut rdr = csv::ReaderBuilder::new().has_headers(false).from_reader(data.as_ref());
            
            for result in rdr.deserialize::<VoterRecord>() {
                total_records += 1;
                match result {
                    Ok(record) => {
                        let tc_hash = hash_data(&record.tc);
                        let phone_hash = hash_data(&record.phone);
                        
                        let insert_result = sqlx::query(
                            "INSERT INTO voters (tc_hash, email, phone_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING"
                        )
                        .bind(tc_hash)
                        .bind(record.email.clone())
                        .bind(phone_hash)
                        .execute(&state.db)
                        .await;

                        if let Ok(query_res) = insert_result {
                            if query_res.rows_affected() > 0 {
                                successful_inserts += 1;
                            }
                        } else {
                            tracing::warn!("Failed to insert record for email: {}", record.email);
                        }
                    },
                    Err(e) => {
                        tracing::warn!("Failed to parse a CSV record: {}", e);
                    }
                }
            }
        }
    }
    
    (StatusCode::OK, Json(json!({
        "message": "File processed.",
        "total_records_in_file": total_records,
        "new_voters_inserted": successful_inserts
    })))
}

// --- Yardımcı Fonksiyonlar ---
fn hash_data(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_otp() -> String {
    rand::thread_rng().gen_range(100000..=999999).to_string()
}

// --- Temel API Handler'ları ---
async fn health_check() -> (StatusCode, &'static str) {
    (StatusCode::OK, "Service is running healthy!")
}

async fn register_admin(State(state): State<Arc<AppState>>, Json(payload): Json<AdminRegistration>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let phone_hash = hash_data(&payload.phone);
    let result = sqlx::query_as!(Admin, "INSERT INTO admins (tc_hash, email, phone_hash) VALUES ($1, $2, $3) RETURNING id, email, tc_hash, phone_hash", tc_hash, payload.email, phone_hash).fetch_one(&state.db).await;
    match result { Ok(admin) => (StatusCode::CREATED, Json(json!({"message": "Admin successfully registered", "admin_id": admin.id, "email": admin.email}))), Err(e) => { tracing::error!("Failed to register admin: {}", e); if e.to_string().contains("duplicate key value") { return (StatusCode::CONFLICT, Json(json!({"error": "Admin with this TC or email already exists."}))); } (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not register admin."}))) } }
}

async fn login_start(State(state): State<Arc<AppState>>, Json(payload): Json<LoginStartPayload>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let result = sqlx::query_as!(Admin, "SELECT id, email, tc_hash, phone_hash FROM admins WHERE tc_hash = $1 AND email = $2", tc_hash, payload.email).fetch_optional(&state.db).await;
    match result { Ok(Some(admin)) => { let email_otp = generate_otp(); let phone_otp = generate_otp(); let expiration = Utc::now().timestamp() + OTP_LIFESPAN_SECONDS; state.otp_store.lock().unwrap().insert(admin.id, (email_otp.clone(), phone_otp.clone(), expiration)); tracing::info!("Login attempt for admin_id: {}", admin.id); tracing::info!("--> Email OTP: {}", email_otp); tracing::info!("--> Phone OTP: {}", phone_otp); (StatusCode::OK, Json(json!({"message": "Admin found. OTP codes generated. Check server logs."}))) }, Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Admin not found with provided credentials"}))), Err(e) => { tracing::error!("Database error during login_start: {}", e); (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "A database error occurred."}))) } }
}

async fn login_verify(State(state): State<Arc<AppState>>, Json(payload): Json<LoginVerifyPayload>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let admin_result = sqlx::query_as!(Admin, "SELECT id, email, tc_hash, phone_hash FROM admins WHERE tc_hash = $1 AND email = $2", tc_hash, payload.email).fetch_optional(&state.db).await;
    let admin = match admin_result { Ok(Some(admin)) => admin, _ => return (StatusCode::NOT_FOUND, Json(json!({"error": "Admin not found"}))), };
    let mut store = state.otp_store.lock().unwrap();
    if let Some((stored_email_otp, stored_phone_otp, expiration)) = store.get(&admin.id) { if Utc::now().timestamp() > *expiration { store.remove(&admin.id); return (StatusCode::UNAUTHORIZED, Json(json!({"error": "OTP has expired"}))); } if *stored_email_otp == payload.email_otp && *stored_phone_otp == payload.phone_otp { store.remove(&admin.id); let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize; let claims = Claims { admin_id: admin.id, exp }; let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET.as_ref())).expect("Failed to create token"); return (StatusCode::OK, Json(json!({"message": "Login successful", "token": token}))); } }
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid OTP codes"})))
}