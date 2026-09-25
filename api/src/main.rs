use personal_agent_api::{router, upstream::HttpUpstream};
use std::{env, net::SocketAddr, sync::Arc};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8787".into()).parse()?;
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(
        listener,
        router(Arc::new(HttpUpstream)).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
