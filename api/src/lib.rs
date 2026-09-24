use axum::{
    body::{to_bytes, Body},
    extract::{ConnectInfo, State},
    http::{HeaderMap, Request, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::Semaphore;

pub mod models;
pub mod upstream;
pub mod validation;

struct AppState {
    upstream: Arc<dyn upstream::Upstream>,
    requests: Mutex<HashMap<String, (Instant, u32)>>,
    concurrent: Semaphore,
}

pub fn router(upstream: Arc<dyn upstream::Upstream>) -> Router {
    let state = Arc::new(AppState {
        upstream,
        requests: Mutex::new(HashMap::new()),
        concurrent: Semaphore::new(32),
    });
    Router::new()
        .route(
            "/api/health",
            get(|| async { Json(json!({"status":"ok"})) }),
        )
        .route("/api/chat", post(chat))
        .with_state(state)
}

fn client_ip(headers: &HeaderMap, peer: Option<SocketAddr>) -> String {
    let Some(peer) = peer else {
        return "unknown".into();
    };
    if peer.ip().is_loopback() {
        if let Some(ip) = headers
            .get("x-forwarded-for")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(',').next())
            .and_then(|value| value.trim().parse::<IpAddr>().ok())
        {
            return ip.to_string();
        }
    }
    peer.ip().to_string()
}

async fn chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    request: Request<Body>,
) -> Result<Json<models::ChatResponse>, (StatusCode, Json<Value>)> {
    let key = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .filter(|value| {
            !value.is_empty()
                && value.len() <= 512
                && value.bytes().all(|byte| (33..=126).contains(&byte))
        });
    let Some(key) = key else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"missing_key"})),
        ));
    };
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|value| value.0);
    let ip = client_ip(&headers, peer);
    {
        let mut requests = state.requests.lock().map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"internal"})),
            )
        })?;
        let entry = requests.entry(ip).or_insert((Instant::now(), 0));
        if entry.0.elapsed() >= Duration::from_secs(60) {
            *entry = (Instant::now(), 0);
        }
        if entry.1 >= 30 {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({"error":"rate_limited"})),
            ));
        }
        entry.1 += 1;
    }
    let _permit = state
        .concurrent
        .try_acquire()
        .map_err(|_| (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error":"busy"}))))?;
    let body = to_bytes(request.into_body(), 64 * 1024)
        .await
        .map_err(|_| {
            (
                StatusCode::PAYLOAD_TOO_LARGE,
                Json(json!({"error":"too_large"})),
            )
        })?;
    let value = serde_json::from_slice(&body).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid_json"})),
        )
    })?;
    let input = validation::validate_chat(value).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid_request"})),
        )
    })?;
    let result = state.upstream.send(key, input).await.map_err(|error| {
        let (status, code) = match error {
            upstream::UpstreamError::InvalidKey => (StatusCode::UNAUTHORIZED, "invalid_key"),
            upstream::UpstreamError::RateLimited => {
                (StatusCode::TOO_MANY_REQUESTS, "upstream_rate_limited")
            }
            upstream::UpstreamError::Timeout => (StatusCode::GATEWAY_TIMEOUT, "upstream_timeout"),
            upstream::UpstreamError::Malformed => (StatusCode::BAD_GATEWAY, "malformed_upstream"),
            upstream::UpstreamError::Failed => (StatusCode::BAD_GATEWAY, "upstream_failed"),
        };
        (status, Json(json!({"error":code})))
    })?;
    Ok(Json(result))
}
