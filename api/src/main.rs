use personal_agent_api::{router, upstream::OpenAiUpstream};
use std::{env, net::SocketAddr, sync::Arc};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let model = env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-5-mini".into());
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8787".into()).parse()?;
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(
        listener,
        router(Arc::new(OpenAiUpstream::new(model)?))
            .into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
