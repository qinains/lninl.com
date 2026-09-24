use std::sync::Arc;

use async_trait::async_trait;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use personal_agent_api::{
    models::{ChatResponse, ValidatedChat},
    router,
    upstream::{Upstream, UpstreamError},
};
use tower::ServiceExt;

struct FakeUpstream {
    result: Result<ChatResponse, UpstreamError>,
}

#[async_trait]
impl Upstream for FakeUpstream {
    async fn send(&self, _key: &str, _chat: ValidatedChat) -> Result<ChatResponse, UpstreamError> {
        self.result.clone()
    }
}

fn gateway(result: Result<ChatResponse, UpstreamError>) -> axum::Router {
    router(Arc::new(FakeUpstream { result }))
}

fn request(key: Option<&str>, body: String) -> Request<Body> {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/api/chat")
        .header("content-type", "application/json");
    if let Some(key) = key {
        builder = builder.header("authorization", format!("Bearer {key}"));
    }
    builder.body(Body::from(body)).unwrap()
}

fn valid_body() -> String {
    r#"{"message":"Help me plan","context":{},"conversation":[]}"#.to_owned()
}

#[tokio::test]
async fn health_and_missing_key() {
    let app = gateway(Ok(ChatResponse {
        text: "Hello".into(),
        proposals: vec![],
    }));
    let health = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(health.status(), StatusCode::OK);
    let body = to_bytes(health.into_body(), 1024).await.unwrap();
    assert_eq!(&body[..], br#"{"status":"ok"}"#);
    let unauthorized = app.oneshot(request(None, valid_body())).await.unwrap();
    assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn rejects_oversized_body() {
    let response = gateway(Ok(ChatResponse {
        text: "Hello".into(),
        proposals: vec![],
    }))
    .oneshot(request(Some("sk-test"), "x".repeat(65_537)))
    .await
    .unwrap();
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn returns_text_and_uncommitted_proposals() {
    let result = ChatResponse {
        text: "Try a short outline.".into(),
        proposals: vec![
            serde_json::json!({"id":"p1","kind":"create","taskId":"t2","title":"Draft outline"}),
        ],
    };
    let response = gateway(Ok(result))
        .oneshot(request(Some("sk-test-secret"), valid_body()))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), 65_536).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["proposals"][0]["kind"], "create");
    assert!(!String::from_utf8_lossy(&body).contains("sk-test-secret"));
}

#[tokio::test]
async fn maps_upstream_errors_without_leaking_keys() {
    for (error, status) in [
        (UpstreamError::InvalidKey, StatusCode::UNAUTHORIZED),
        (UpstreamError::Timeout, StatusCode::GATEWAY_TIMEOUT),
        (UpstreamError::Malformed, StatusCode::BAD_GATEWAY),
    ] {
        let response = gateway(Err(error))
            .oneshot(request(Some("sk-test-secret"), valid_body()))
            .await
            .unwrap();
        assert_eq!(response.status(), status);
        let body = to_bytes(response.into_body(), 1024).await.unwrap();
        assert!(!String::from_utf8_lossy(&body).contains("sk-test-secret"));
    }
}
