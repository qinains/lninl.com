use crate::models::Provider;
use reqwest::{redirect::Policy, Url};
use std::{
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    time::Duration,
};

pub fn parse_endpoint_url(provider: Provider, raw: &str) -> Result<Url, &'static str> {
    if raw.len() > 500 || raw.chars().any(char::is_whitespace) {
        return Err("Invalid API URL");
    }
    let url = Url::parse(raw).map_err(|_| "Invalid API URL")?;
    if url.scheme() != "https"
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Invalid API URL");
    }
    let host = url.host_str().ok_or("Invalid API host")?;
    if host.parse::<IpAddr>().is_ok()
        || !host.contains('.')
        || [".local", ".localhost", ".internal", ".test"]
            .iter()
            .any(|suffix| host.ends_with(suffix))
    {
        return Err("Invalid API host");
    }
    let suffix = match provider {
        Provider::OpenAiResponses => "/responses",
        Provider::OpenAiChatCompletions => "/chat/completions",
        Provider::AnthropicMessages => "/messages",
    };
    if !url.path().ends_with(suffix) {
        return Err("Invalid API path");
    }
    Ok(url)
}

pub fn is_public_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(address) => public_v4(address),
        IpAddr::V6(address) => public_v6(address),
    }
}

fn public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(a == 0
        || a == 10
        || a == 127
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192
            && (b == 168 || (b == 0 && c == 0) || (b == 0 && c == 2) || (b == 88 && c == 99)))
        || (a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
        || (a == 203 && b == 0 && c == 113))
}

fn public_v6(ip: Ipv6Addr) -> bool {
    let segments = ip.segments();
    (0x2000..=0x3fff).contains(&segments[0])
        && !(segments[0] == 0x2001 && [0, 0xdb8, 0x10, 0x20].contains(&segments[1]))
        && segments[0] != 0x2002
}

pub async fn pinned_client(url: &Url) -> Result<reqwest::Client, &'static str> {
    let host = url.host_str().ok_or("Invalid API host")?;
    let addresses: Vec<SocketAddr> = tokio::net::lookup_host((host, 443))
        .await
        .map_err(|_| "API DNS failed")?
        .collect();
    if addresses.is_empty()
        || addresses
            .iter()
            .any(|address| !is_public_address(address.ip()))
    {
        return Err("Unsafe API address");
    }
    reqwest::Client::builder()
        .timeout(Duration::from_secs(35))
        .redirect(Policy::none())
        .no_proxy()
        .resolve_to_addrs(host, &addresses)
        .build()
        .map_err(|_| "API client failed")
}
