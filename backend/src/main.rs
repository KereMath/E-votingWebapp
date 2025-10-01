use axum::{
    body::Body,
    extract::{Multipart, State, Path, Query},
    http::{Method, Request, StatusCode},
    middleware::{self, Next},
    response::{Json, Response},
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

mod crypto_ffi;

// --- Constants ---
const JWT_SECRET: &str = "cok-gizli-bir-anahtar-bunu-degistir";
const OTP_LIFESPAN_SECONDS: i64 = 300;

// --- Types ---
type OtpStore = Mutex<HashMap<i32, (String, String, i64)>>;
type VoterOtpStore = Mutex<HashMap<i32, (String, String, i64)>>;
type AuthorityOtpStore = Mutex<HashMap<i32, (String, String, i64)>>;

struct AppState {
    db: PgPool,
    otp_store: OtpStore,
    voter_otp_store: VoterOtpStore,
    authority_otp_store: AuthorityOtpStore,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    admin_id: i32,
    exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct VoterClaims {
    voter_id: i32,
    exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct AuthorityClaims {
    authority_id: i32,
    exp: usize,
}

#[derive(Serialize, Deserialize)]
struct AdminRegistration { 
    tc: String, 
    email: String, 
    phone: String 
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Admin { 
    id: i32, 
    email: String, 
    tc_hash: String, 
    phone_hash: String 
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Voter { 
    id: i32, 
    email: String, 
    tc_hash: String, 
    phone_hash: String 
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Authority {
    id: i32,
    email: String,
    name: String,
    tc_hash: String,
    phone_hash: String,
}

#[derive(Serialize, Deserialize)]
struct AuthorityRegistration {
    tc: String,
    email: String,
    phone: String,
    name: String,
}

#[derive(Serialize, Deserialize)]
struct LoginStartPayload { 
    tc: String, 
    email: String 
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginVerifyPayload { 
    tc: String, 
    email: String, 
    email_otp: String, 
    phone_otp: String 
}

#[derive(Debug, Deserialize, sqlx::FromRow)]
struct VoterRecord { 
    tc: String, 
    email: String, 
    phone: String 
}

#[derive(Debug, Deserialize, sqlx::FromRow)]
struct AuthorityRecord { 
    tc: String, 
    email: String, 
    phone: String,
    name: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Poll {
    id: i32,
    title: String,
    description: Option<String>,
    created_by: i32,
    status: String,
    created_at: chrono::DateTime<Utc>,
    started_at: Option<chrono::DateTime<Utc>>,
    ended_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreatePollPayload {
    title: String,
    description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PollSetup {
    id: i32,
    poll_id: i32,
    pairing_param: String,
    prime_order: String,
    g1: String,
    g2: String,
    h1: String,
    security_level: i32,
    setup_completed_at: chrono::DateTime<Utc>,
    setup_by: i32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PollMvk {
    id: i32,
    poll_id: i32,
    alpha2: String,
    beta2: String,
    beta1: String,
    threshold: i32,
    total_authorities: i32,
    generated_at: chrono::DateTime<Utc>,
    generated_by: i32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PollAuthorityKey {
    poll_id: i32,
    authority_id: i32,
    sgk1: Option<String>,
    sgk2: Option<String>,
    vkm1: Option<String>,
    vkm2: Option<String>,
    vkm3: Option<String>,
    keys_received_at: Option<chrono::DateTime<Utc>>,
}

// --- Main Function ---
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
        voter_otp_store: Mutex::new(HashMap::new()),
        authority_otp_store: Mutex::new(HashMap::new()),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::DELETE])
        .allow_headers(Any);

    // Admin protected routes
    let admin_routes = Router::new()
        .route("/admin/polls", post(create_poll))
        .route("/admin/polls", get(list_polls))
        .route("/admin/polls/:id", get(get_poll_details))
        .route("/admin/polls/:id/setup", post(trigger_setup))
        .route("/admin/polls/:id/keygen", post(trigger_keygen))
        .route("/admin/polls/:id/voters", post(add_poll_voters))
        .route("/admin/polls/:id/authorities", post(add_poll_authorities))
        .route("/admin/polls/:id/participants", get(get_poll_participants))
        .route_layer(middleware::from_fn_with_state(shared_state.clone(), auth));

    let voter_routes = Router::new()
        .route("/voter/dashboard", get(voter_dashboard))
        .route("/voter/polls", get(get_voter_polls))
        .route_layer(middleware::from_fn_with_state(shared_state.clone(), voter_auth));
    
    let authority_routes = Router::new()
        .route("/authority/dashboard", get(authority_dashboard))
        .route("/authority/polls", get(get_authority_polls))
        .route("/authority/keys/:poll_id", get(get_authority_keys))
        .route_layer(middleware::from_fn_with_state(shared_state.clone(), authority_auth));
    
    // Public routes
    let public_routes = Router::new()
        .route("/polls/:id/setup", get(get_poll_setup))
        .route("/polls/:id/mvk", get(get_poll_mvk));

    let app = Router::new()
        .route("/", get(health_check))
        .route("/admin/register", post(register_admin))
        .route("/admin/login_start", post(login_start))
        .route("/admin/login_verify", post(login_verify))
        .route("/voter/login_start", post(voter_login_start))
        .route("/voter/login_verify", post(voter_login_verify))
        .route("/authority/register", post(register_authority))
        .route("/authority/login_start", post(authority_login_start))
        .route("/authority/login_verify", post(authority_login_verify))
        .merge(public_routes)
        .merge(admin_routes)
        .merge(voter_routes)
        .merge(authority_routes)
        .with_state(shared_state)
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    tracing::debug!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// --- Authentication Middlewares ---
async fn auth(
    State(_state): State<Arc<AppState>>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    mut request: Request<Body>,
    next: Next<Body>,
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

async fn voter_auth(
    State(_state): State<Arc<AppState>>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    mut request: Request<Body>,
    next: Next<Body>,
) -> Result<Response, StatusCode> {
    let token = auth_header.token();
    let decoding_key = DecodingKey::from_secret(JWT_SECRET.as_ref());
    
    match decode::<VoterClaims>(token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            request.extensions_mut().insert(token_data.claims.voter_id);
            Ok(next.run(request).await)
        }
        Err(_) => {
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

async fn authority_auth(
    State(_state): State<Arc<AppState>>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    mut request: Request<Body>,
    next: Next<Body>,
) -> Result<Response, StatusCode> {
    let token = auth_header.token();
    let decoding_key = DecodingKey::from_secret(JWT_SECRET.as_ref());
    
    match decode::<AuthorityClaims>(token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            request.extensions_mut().insert(token_data.claims.authority_id);
            Ok(next.run(request).await)
        }
        Err(_) => {
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

// --- Helper Functions ---
fn hash_data(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_otp() -> String {
    rand::thread_rng().gen_range(100000..=999999).to_string()
}

fn calculate_threshold(num_authorities: i32) -> i32 {
    match num_authorities {
        3 => 2,
        5 => 3,
        n if n >= 7 => (n / 2) + 1,
        _ => num_authorities,  // For 1-2 authorities, all must sign
    }
}

// --- Basic Handlers ---
async fn health_check() -> (StatusCode, &'static str) {
    (StatusCode::OK, "Service is running healthy!")
}

// --- Admin Registration & Login ---
async fn register_admin(State(state): State<Arc<AppState>>, Json(payload): Json<AdminRegistration>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let phone_hash = hash_data(&payload.phone);
    let result = sqlx::query_as!(
        Admin,
        "INSERT INTO admins (tc_hash, email, phone_hash) VALUES ($1, $2, $3) RETURNING id, email, tc_hash, phone_hash",
        tc_hash, payload.email, phone_hash
    ).fetch_one(&state.db).await;
    
    match result { 
        Ok(admin) => (StatusCode::CREATED, Json(json!({
            "message": "Admin successfully registered",
            "admin_id": admin.id,
            "email": admin.email
        }))), 
        Err(e) => { 
            tracing::error!("Failed to register admin: {}", e); 
            if e.to_string().contains("duplicate key value") { 
                return (StatusCode::CONFLICT, Json(json!({"error": "Admin with this TC or email already exists."}))); 
            } 
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Could not register admin."}))) 
        } 
    }
}

async fn login_start(State(state): State<Arc<AppState>>, Json(payload): Json<LoginStartPayload>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let result = sqlx::query_as!(
        Admin,
        "SELECT id, email, tc_hash, phone_hash FROM admins WHERE tc_hash = $1 AND email = $2",
        tc_hash, payload.email
    ).fetch_optional(&state.db).await;
    
    match result { 
        Ok(Some(admin)) => { 
            let email_otp = generate_otp(); 
            let phone_otp = generate_otp(); 
            let expiration = Utc::now().timestamp() + OTP_LIFESPAN_SECONDS; 
            state.otp_store.lock().unwrap().insert(admin.id, (email_otp.clone(), phone_otp.clone(), expiration)); 
            tracing::info!("Login attempt for admin_id: {}", admin.id); 
            tracing::info!("--> Email OTP: {}", email_otp); 
            tracing::info!("--> Phone OTP: {}", phone_otp); 
            (StatusCode::OK, Json(json!({"message": "Admin found. OTP codes generated. Check server logs."}))) 
        }, 
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Admin not found with provided credentials"}))), 
        Err(e) => { 
            tracing::error!("Database error during login_start: {}", e); 
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "A database error occurred."}))) 
        } 
    }
}

async fn login_verify(State(state): State<Arc<AppState>>, Json(payload): Json<LoginVerifyPayload>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let admin_result = sqlx::query_as!(
        Admin,
        "SELECT id, email, tc_hash, phone_hash FROM admins WHERE tc_hash = $1 AND email = $2",
        tc_hash, payload.email
    ).fetch_optional(&state.db).await;
    
    let admin = match admin_result { 
        Ok(Some(admin)) => admin, 
        _ => return (StatusCode::NOT_FOUND, Json(json!({"error": "Admin not found"}))), 
    };
    
    let mut store = state.otp_store.lock().unwrap();
    if let Some((stored_email_otp, stored_phone_otp, expiration)) = store.get(&admin.id) { 
        if Utc::now().timestamp() > *expiration { 
            store.remove(&admin.id); 
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "OTP has expired"}))); 
        } 
        if *stored_email_otp == payload.email_otp && *stored_phone_otp == payload.phone_otp { 
            store.remove(&admin.id); 
            let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize; 
            let claims = Claims { admin_id: admin.id, exp }; 
            let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET.as_ref()))
                .expect("Failed to create token"); 
            return (StatusCode::OK, Json(json!({"message": "Login successful", "token": token}))); 
        } 
    }
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid OTP codes"})))
}

// --- Voter Login Endpoints ---
async fn voter_login_start(State(state): State<Arc<AppState>>, Json(payload): Json<LoginStartPayload>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let result = sqlx::query_as!(
        Voter,
        "SELECT id, email, tc_hash, phone_hash FROM voters WHERE tc_hash = $1 AND email = $2",
        tc_hash, payload.email
    ).fetch_optional(&state.db).await;
    
    match result { 
        Ok(Some(voter)) => { 
            let email_otp = generate_otp(); 
            let phone_otp = generate_otp(); 
            let expiration = Utc::now().timestamp() + OTP_LIFESPAN_SECONDS; 
            state.voter_otp_store.lock().unwrap().insert(voter.id, (email_otp.clone(), phone_otp.clone(), expiration)); 
            tracing::info!("Voter login attempt for voter_id: {}", voter.id); 
            tracing::info!("--> Email OTP: {}", email_otp); 
            tracing::info!("--> Phone OTP: {}", phone_otp); 
            (StatusCode::OK, Json(json!({"message": "Voter found. OTP codes generated. Check server logs."}))) 
        }, 
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Voter not found with provided credentials"}))), 
        Err(e) => { 
            tracing::error!("Database error during voter_login_start: {}", e); 
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "A database error occurred."}))) 
        } 
    }
}

async fn voter_login_verify(State(state): State<Arc<AppState>>, Json(payload): Json<LoginVerifyPayload>) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let voter_result = sqlx::query_as!(
        Voter,
        "SELECT id, email, tc_hash, phone_hash FROM voters WHERE tc_hash = $1 AND email = $2",
        tc_hash, payload.email
    ).fetch_optional(&state.db).await;
    
    let voter = match voter_result { 
        Ok(Some(voter)) => voter, 
        _ => return (StatusCode::NOT_FOUND, Json(json!({"error": "Voter not found"}))), 
    };
    
    let mut store = state.voter_otp_store.lock().unwrap();
    if let Some((stored_email_otp, stored_phone_otp, expiration)) = store.get(&voter.id) { 
        if Utc::now().timestamp() > *expiration { 
            store.remove(&voter.id); 
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "OTP has expired"}))); 
        } 
        if *stored_email_otp == payload.email_otp && *stored_phone_otp == payload.phone_otp { 
            store.remove(&voter.id); 
            let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize; 
            let claims = VoterClaims { voter_id: voter.id, exp }; 
            let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET.as_ref()))
                .expect("Failed to create token"); 
            return (StatusCode::OK, Json(json!({
                "message": "Voter login successful",
                "token": token,
                "voter_email": voter.email
            }))); 
        } 
    }
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid OTP codes"})))
}

// --- Authority Registration & Login ---
async fn register_authority(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AuthorityRegistration>,
) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    let phone_hash = hash_data(&payload.phone);
    
    let result = sqlx::query_as!(
        Authority,
        "INSERT INTO authorities (tc_hash, email, phone_hash, name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, email, name, tc_hash, phone_hash",
        tc_hash,
        payload.email,
        phone_hash,
        payload.name
    )
    .fetch_one(&state.db)
    .await;
    
    match result {
        Ok(authority) => (
            StatusCode::CREATED,
            Json(json!({
                "message": "Authority successfully registered",
                "authority_id": authority.id,
                "email": authority.email,
                "name": authority.name
            }))
        ),
        Err(e) => {
            tracing::error!("Failed to register authority: {}", e);
            if e.to_string().contains("duplicate key value") {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({"error": "Authority with this TC or email already exists."}))
                );
            }
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Could not register authority."}))
            )
        }
    }
}

async fn authority_login_start(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginStartPayload>,
) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    
    let result = sqlx::query_as!(
        Authority,
        "SELECT id, email, name, tc_hash, phone_hash 
         FROM authorities 
         WHERE tc_hash = $1 AND email = $2",
        tc_hash,
        payload.email
    )
    .fetch_optional(&state.db)
    .await;
    
    match result {
        Ok(Some(authority)) => {
            let email_otp = generate_otp();
            let phone_otp = generate_otp();
            let expiration = Utc::now().timestamp() + OTP_LIFESPAN_SECONDS;
            
            state.authority_otp_store
                .lock()
                .unwrap()
                .insert(authority.id, (email_otp.clone(), phone_otp.clone(), expiration));
            
            tracing::info!("Authority login attempt for authority_id: {}", authority.id);
            tracing::info!("--> Email OTP: {}", email_otp);
            tracing::info!("--> Phone OTP: {}", phone_otp);
            
            (
                StatusCode::OK,
                Json(json!({"message": "Authority found. OTP codes generated. Check server logs."}))
            )
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Authority not found with provided credentials"}))
        ),
        Err(e) => {
            tracing::error!("Database error during authority_login_start: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "A database error occurred."}))
            )
        }
    }
}

async fn authority_login_verify(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginVerifyPayload>,
) -> (StatusCode, Json<Value>) {
    let tc_hash = hash_data(&payload.tc);
    
    let authority_result = sqlx::query_as!(
        Authority,
        "SELECT id, email, name, tc_hash, phone_hash 
         FROM authorities 
         WHERE tc_hash = $1 AND email = $2",
        tc_hash,
        payload.email
    )
    .fetch_optional(&state.db)
    .await;
    
    let authority = match authority_result {
        Ok(Some(authority)) => authority,
        _ => return (StatusCode::NOT_FOUND, Json(json!({"error": "Authority not found"}))),
    };
    
    let mut store = state.authority_otp_store.lock().unwrap();
    
    if let Some((stored_email_otp, stored_phone_otp, expiration)) = store.get(&authority.id) {
        if Utc::now().timestamp() > *expiration {
            store.remove(&authority.id);
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "OTP has expired"}))
            );
        }
        
        if *stored_email_otp == payload.email_otp && *stored_phone_otp == payload.phone_otp {
            store.remove(&authority.id);
            
            let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize;
            let claims = AuthorityClaims {
                authority_id: authority.id,
                exp,
            };
            
            let token = encode(
                &Header::default(),
                &claims,
                &EncodingKey::from_secret(JWT_SECRET.as_ref()),
            )
            .expect("Failed to create token");
            
            return (
                StatusCode::OK,
                Json(json!({
                    "message": "Authority login successful",
                    "token": token,
                    "authority_email": authority.email,
                    "authority_name": authority.name
                }))
            );
        }
    }
    
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid OTP codes"})))
}

// --- Dashboard Endpoints ---
async fn voter_dashboard() -> (StatusCode, Json<Value>) {
    (StatusCode::OK, Json(json!({"message": "Welcome to voter dashboard!"})))
}

async fn authority_dashboard(
    axum::Extension(authority_id): axum::Extension<i32>,
    State(state): State<Arc<AppState>>,
) -> (StatusCode, Json<Value>) {
    let authority = sqlx::query_as!(
        Authority,
        "SELECT id, email, name, tc_hash, phone_hash FROM authorities WHERE id = $1",
        authority_id
    )
    .fetch_one(&state.db)
    .await;
    
    match authority {
        Ok(auth) => (
            StatusCode::OK,
            Json(json!({
                "message": "Welcome to authority dashboard!",
                "authority": {
                    "id": auth.id,
                    "name": auth.name,
                    "email": auth.email
                }
            }))
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch authority info"}))
        ),
    }
}

// --- Poll Management Endpoints ---
async fn create_poll(
    State(state): State<Arc<AppState>>,
    axum::Extension(admin_id): axum::Extension<i32>,
    Json(payload): Json<CreatePollPayload>,
) -> (StatusCode, Json<Value>) {
    let poll_result = sqlx::query_as!(
        Poll,
        "INSERT INTO polls (title, description, created_by, status) VALUES ($1, $2, $3, 'draft') RETURNING *",
        payload.title,
        payload.description,
        admin_id
    )
    .fetch_one(&state.db)
    .await;

    match poll_result {
        Ok(poll) => {
            (StatusCode::CREATED, Json(json!({
                "message": "Poll created successfully",
                "poll": poll
            })))
        }
        Err(e) => {
            tracing::error!("Failed to create poll: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create poll"})))
        }
    }
}

async fn list_polls(
    State(state): State<Arc<AppState>>,
) -> (StatusCode, Json<Value>) {
    let result = sqlx::query_as!(
        Poll,
        "SELECT * FROM polls ORDER BY created_at DESC"
    )
    .fetch_all(&state.db)
    .await;

    match result {
        Ok(polls) => (StatusCode::OK, Json(json!({"polls": polls}))),
        Err(e) => {
            tracing::error!("Failed to fetch polls: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch polls"})))
        }
    }
}

async fn get_poll_details(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> (StatusCode, Json<Value>) {
    let poll_result = sqlx::query_as!(
        Poll,
        "SELECT * FROM polls WHERE id = $1",
        id
    )
    .fetch_optional(&state.db)
    .await;

    match poll_result {
        Ok(Some(poll)) => {
            // Get participant counts
            let voter_count = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM poll_voters WHERE poll_id = $1",
                id
            )
            .fetch_one(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or(0);

            let authority_count = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM poll_authorities WHERE poll_id = $1",
                id
            )
            .fetch_one(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or(0);

            // Check if setup exists
            let setup_exists = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM poll_setup WHERE poll_id = $1",
                id
            )
            .fetch_one(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or(0);

            // Check if keygen exists
            let keygen_exists = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM poll_mvk WHERE poll_id = $1",
                id
            )
            .fetch_one(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or(0);

            let threshold = calculate_threshold(authority_count as i32);

            (StatusCode::OK, Json(json!({
                "poll": poll,
                "voter_count": voter_count,
                "authority_count": authority_count,
                "threshold": threshold,
                "setup_completed": setup_exists > 0,
                "keygen_completed": keygen_exists > 0
            })))
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Poll not found"}))),
        Err(e) => {
            tracing::error!("Failed to fetch poll: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch poll"})))
        }
    }
}

// Add voters to poll
async fn add_poll_voters(
    State(state): State<Arc<AppState>>,
    Path(poll_id): Path<i32>,
    mut multipart: Multipart,
) -> (StatusCode, Json<Value>) {
    let mut added_count = 0;
    let mut total_count = 0;

    while let Some(field) = multipart.next_field().await.unwrap() {
        if field.name() == Some("voters_file") {
            let data = field.bytes().await.unwrap();
            let mut rdr = csv::ReaderBuilder::new()
                .has_headers(false)
                .from_reader(data.as_ref());
            
            for result in rdr.deserialize::<VoterRecord>() {
                total_count += 1;
                if let Ok(record) = result {
                    let tc_hash = hash_data(&record.tc);
                    let phone_hash = hash_data(&record.phone);
                    
                    // Insert or get voter
                    let voter_result = sqlx::query_as!(
                        Voter,
                        "INSERT INTO voters (tc_hash, email, phone_hash) 
                         VALUES ($1, $2, $3) 
                         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                         RETURNING id, email, tc_hash, phone_hash",
                        tc_hash,
                        record.email,
                        phone_hash
                    )
                    .fetch_one(&state.db)
                    .await;

                    if let Ok(voter) = voter_result {
                        // Add voter to poll
                        let result = sqlx::query!(
                            "INSERT INTO poll_voters (poll_id, voter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                            poll_id,
                            voter.id
                        )
                        .execute(&state.db)
                        .await;
                        
                        if result.is_ok() {
                            added_count += 1;
                        }
                    }
                }
            }
        }
    }
    
    (StatusCode::OK, Json(json!({
        "message": "Voters processed",
        "total_in_file": total_count,
        "added_to_poll": added_count
    })))
}

// Add authorities to poll
async fn add_poll_authorities(
    State(state): State<Arc<AppState>>,
    Path(poll_id): Path<i32>,
    mut multipart: Multipart,
) -> (StatusCode, Json<Value>) {
    let mut added_count = 0;
    let mut total_count = 0;

    while let Some(field) = multipart.next_field().await.unwrap() {
        if field.name() == Some("authorities_file") {
            let data = field.bytes().await.unwrap();
            let mut rdr = csv::ReaderBuilder::new()
                .has_headers(false)
                .from_reader(data.as_ref());
            
            for result in rdr.deserialize::<AuthorityRecord>() {
                total_count += 1;
                if let Ok(record) = result {
                    let tc_hash = hash_data(&record.tc);
                    let phone_hash = hash_data(&record.phone);
                    
                    // Insert or get authority
                    let authority_result = sqlx::query_as!(
                        Authority,
                        "INSERT INTO authorities (tc_hash, email, phone_hash, name) 
                         VALUES ($1, $2, $3, $4) 
                         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
                         RETURNING id, email, name, tc_hash, phone_hash",
                        tc_hash,
                        record.email,
                        phone_hash,
                        record.name
                    )
                    .fetch_one(&state.db)
                    .await;

                    if let Ok(authority) = authority_result {
                        // Add authority to poll
                        let result = sqlx::query!(
                            "INSERT INTO poll_authorities (poll_id, authority_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                            poll_id,
                            authority.id
                        )
                        .execute(&state.db)
                        .await;
                        
                        if result.is_ok() {
                            added_count += 1;
                        }
                    }
                }
            }
        }
    }
    
    // Calculate and return threshold
    let total_authorities = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM poll_authorities WHERE poll_id = $1",
        poll_id
    )
    .fetch_one(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(0) as i32;
    
    let threshold = calculate_threshold(total_authorities);
    
    (StatusCode::OK, Json(json!({
        "message": "Authorities processed",
        "total_in_file": total_count,
        "added_to_poll": added_count,
        "total_authorities": total_authorities,
        "threshold": threshold
    })))
}

// Get poll participants
async fn get_poll_participants(
    State(state): State<Arc<AppState>>,
    Path(poll_id): Path<i32>,
) -> (StatusCode, Json<Value>) {
    // Get voters
    let voters = sqlx::query!(
        "SELECT v.id, v.email FROM voters v
         JOIN poll_voters pv ON v.id = pv.voter_id
         WHERE pv.poll_id = $1",
        poll_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    
    // Get authorities
    let authorities = sqlx::query!(
        "SELECT a.id, a.email, a.name FROM authorities a
         JOIN poll_authorities pa ON a.id = pa.authority_id
         WHERE pa.poll_id = $1",
        poll_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    
    let threshold = calculate_threshold(authorities.len() as i32);
    
    (StatusCode::OK, Json(json!({
        "voters": voters.iter().map(|v| json!({"id": v.id, "email": v.email})).collect::<Vec<_>>(),
        "authorities": authorities.iter().map(|a| json!({"id": a.id, "email": a.email, "name": a.name})).collect::<Vec<_>>(),
        "voter_count": voters.len(),
        "authority_count": authorities.len(),
        "threshold": threshold
    })))
}

// Trigger setup for a poll
async fn trigger_setup(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    axum::Extension(admin_id): axum::Extension<i32>,
) -> (StatusCode, Json<Value>) {
    // Check if setup already exists
    let existing_setup = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM poll_setup WHERE poll_id = $1",
        id
    )
    .fetch_one(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    if existing_setup > 0 {
        return (StatusCode::CONFLICT, Json(json!({"error": "Setup already completed for this poll"})));
    }

    // Execute cryptographic setup
    tracing::info!("Executing cryptographic setup for poll {}", id);
    let setup_params = match crypto_ffi::execute_setup(256) {
        Ok(params) => params,
        Err(e) => {
            tracing::error!("Setup failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Setup failed: {}", e)})));
        }
    };

    // Store setup parameters in database
    let result = sqlx::query_as!(
        PollSetup,
        "INSERT INTO poll_setup (poll_id, pairing_param, prime_order, g1, g2, h1, security_level, setup_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        id,
        setup_params.pairing_param,
        setup_params.prime_order,
        setup_params.g1,
        setup_params.g2,
        setup_params.h1,
        256,
        admin_id
    )
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(setup) => {
            (StatusCode::OK, Json(json!({
                "message": "Setup completed successfully",
                "setup": setup
            })))
        }
        Err(e) => {
            tracing::error!("Failed to store setup: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to store setup"})))
        }
    }
}

// Trigger keygen for a poll
async fn trigger_keygen(
    State(state): State<Arc<AppState>>,
    Path(poll_id): Path<i32>,
    axum::Extension(admin_id): axum::Extension<i32>,
) -> (StatusCode, Json<Value>) {
    // Check if setup exists
    let setup_result = sqlx::query_as!(
        PollSetup,
        "SELECT * FROM poll_setup WHERE poll_id = $1",
        poll_id
    )
    .fetch_optional(&state.db)
    .await;

    let setup = match setup_result {
        Ok(Some(setup)) => setup,
        Ok(None) => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Setup must be completed before keygen"}))),
        Err(e) => {
            tracing::error!("Failed to fetch setup: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch setup"})));
        }
    };

    // Check if keygen already exists
    let existing_keygen = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM poll_mvk WHERE poll_id = $1",
        poll_id
    )
    .fetch_one(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    if existing_keygen > 0 {
        return (StatusCode::CONFLICT, Json(json!({"error": "Keygen already completed for this poll"})));
    }

    // Get authority count
    let authority_count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM poll_authorities WHERE poll_id = $1",
        poll_id
    )
    .fetch_one(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(0) as i32;

    if authority_count == 0 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "No authorities assigned to this poll"})));
    }

    let threshold = calculate_threshold(authority_count);

    // Execute keygen
    tracing::info!("Executing keygen for poll {} with {} authorities and threshold {}", 
        poll_id, authority_count, threshold);
    
    let setup_params = crypto_ffi::SetupParams {
        pairing_param: setup.pairing_param,
        prime_order: setup.prime_order,
        g1: setup.g1,
        g2: setup.g2,
        h1: setup.h1,
        security_level: setup.security_level,
    };

    let keygen_result = match crypto_ffi::execute_keygen(&setup_params, threshold, authority_count) {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("Keygen failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Keygen failed: {}", e)})));
        }
    };

    // Store MVK
    let mvk_result = sqlx::query!(
        "INSERT INTO poll_mvk (poll_id, alpha2, beta2, beta1, threshold, total_authorities, generated_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        poll_id,
        keygen_result.mvk.alpha2,
        keygen_result.mvk.beta2,
        keygen_result.mvk.beta1,
        threshold,
        authority_count,
        admin_id
    )
    .fetch_one(&state.db)
    .await;

    if let Err(e) = mvk_result {
        tracing::error!("Failed to store MVK: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to store MVK"})));
    }

    // Store individual authority keys
    let authorities = sqlx::query!(
        "SELECT authority_id FROM poll_authorities WHERE poll_id = $1 ORDER BY authority_id",
        poll_id
    )
    .fetch_all(&state.db)
    .await;

    if let Ok(authorities) = authorities {
        for (idx, auth) in authorities.iter().enumerate() {
            if idx < keygen_result.authority_keys.len() {
                let key = &keygen_result.authority_keys[idx];
                let _ = sqlx::query!(
                    "UPDATE poll_authorities 
                     SET sgk1 = $1, sgk2 = $2, vkm1 = $3, vkm2 = $4, vkm3 = $5, keys_received_at = NOW()
                     WHERE poll_id = $6 AND authority_id = $7",
                    key.sgk1,
                    key.sgk2,
                    key.vkm1,
                    key.vkm2,
                    key.vkm3,
                    poll_id,
                    auth.authority_id
                )
                .execute(&state.db)
                .await;
            }
        }
    }

    // Update poll status
    let _ = sqlx::query!(
        "UPDATE polls SET status = 'active' WHERE id = $1",
        poll_id
    )
    .execute(&state.db)
    .await;

    (StatusCode::OK, Json(json!({
        "message": "Keygen completed successfully",
        "threshold": threshold,
        "total_authorities": authority_count
    })))
}

// Get poll setup parameters (public)
async fn get_poll_setup(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> (StatusCode, Json<Value>) {
    let result = sqlx::query_as!(
        PollSetup,
        "SELECT * FROM poll_setup WHERE poll_id = $1",
        id
    )
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(setup)) => (StatusCode::OK, Json(json!({"setup": setup}))),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "Setup not found for this poll"}))),
        Err(e) => {
            tracing::error!("Failed to fetch setup: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch setup"})))
        }
    }
}

// Get poll MVK (public broadcast)
async fn get_poll_mvk(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> (StatusCode, Json<Value>) {
    let result = sqlx::query_as!(
        PollMvk,
        "SELECT * FROM poll_mvk WHERE poll_id = $1",
        id
    )
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(mvk)) => (StatusCode::OK, Json(json!({"mvk": mvk}))),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "MVK not found for this poll"}))),
        Err(e) => {
            tracing::error!("Failed to fetch MVK: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch MVK"})))
        }
    }
}

// Get voter's polls
async fn get_voter_polls(
    State(state): State<Arc<AppState>>,
    axum::Extension(voter_id): axum::Extension<i32>,
) -> (StatusCode, Json<Value>) {
    let result = sqlx::query!(
        "SELECT p.*, pv.has_voted, pv.voted_at 
         FROM polls p 
         JOIN poll_voters pv ON p.id = pv.poll_id 
         WHERE pv.voter_id = $1 AND p.status = 'active'
         ORDER BY p.created_at DESC",
        voter_id
    )
    .fetch_all(&state.db)
    .await;

    match result {
        Ok(polls) => {
            let poll_data: Vec<_> = polls.iter().map(|p| {
                json!({
                    "id": p.id,
                    "title": p.title,
                    "description": p.description,
                    "status": p.status,
                    "has_voted": p.has_voted,
                    "voted_at": p.voted_at,
                    "started_at": p.started_at,
                    "ended_at": p.ended_at
                })
            }).collect();
            
            (StatusCode::OK, Json(json!({"polls": poll_data})))
        }
        Err(e) => {
            tracing::error!("Failed to fetch voter polls: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch polls"})))
        }
    }
}

// Get authority's polls
async fn get_authority_polls(
    State(state): State<Arc<AppState>>,
    axum::Extension(authority_id): axum::Extension<i32>,
) -> (StatusCode, Json<Value>) {
    let result = sqlx::query!(
        "SELECT p.*, pa.keys_received_at 
         FROM polls p 
         JOIN poll_authorities pa ON p.id = pa.poll_id 
         WHERE pa.authority_id = $1
         ORDER BY p.created_at DESC",
        authority_id
    )
    .fetch_all(&state.db)
    .await;

    match result {
        Ok(polls) => {
            let poll_data: Vec<_> = polls.iter().map(|p| {
                json!({
                    "id": p.id,
                    "title": p.title,
                    "description": p.description,
                    "status": p.status,
                    "keys_received": p.keys_received_at.is_some(),
                    "keys_received_at": p.keys_received_at
                })
            }).collect();
            
            (StatusCode::OK, Json(json!({"polls": poll_data})))
        }
        Err(e) => {
            tracing::error!("Failed to fetch authority polls: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch polls"})))
        }
    }
}

// Get authority's keys for a poll
async fn get_authority_keys(
    State(state): State<Arc<AppState>>,
    Path(poll_id): Path<i32>,
    axum::Extension(authority_id): axum::Extension<i32>,
) -> (StatusCode, Json<Value>) {
    let keys_result = sqlx::query!(
        "SELECT sgk1, sgk2, vkm1, vkm2, vkm3 
         FROM poll_authorities 
         WHERE poll_id = $1 AND authority_id = $2",
        poll_id,
        authority_id
    )
    .fetch_optional(&state.db)
    .await;

    match keys_result {
        Ok(Some(keys)) => {
            if keys.sgk1.is_none() {
                return (StatusCode::NOT_FOUND, Json(json!({"error": "Keys not generated yet"})));
            }
            
            // Also get MVK (public info)
            let mvk = sqlx::query!(
                "SELECT alpha2, beta2, beta1, threshold, total_authorities 
                 FROM poll_mvk 
                 WHERE poll_id = $1",
                poll_id
            )
            .fetch_optional(&state.db)
            .await;
            
            (StatusCode::OK, Json(json!({
                "secret_keys": {
                    "sgk1": keys.sgk1,
                    "sgk2": keys.sgk2
                },
                "verification_keys": {
                    "vkm1": keys.vkm1,
                    "vkm2": keys.vkm2,
                    "vkm3": keys.vkm3
                },
                "mvk": mvk.ok().flatten().map(|m| json!({
                    "alpha2": m.alpha2,
                    "beta2": m.beta2,
                    "beta1": m.beta1,
                    "threshold": m.threshold,
                    "total_authorities": m.total_authorities
                }))
            })))
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "You are not an authority for this poll"}))),
        Err(e) => {
            tracing::error!("Failed to fetch authority keys: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch keys"})))
        }
    }
}