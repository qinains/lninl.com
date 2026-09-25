use personal_agent_api::endpoint::{is_public_address, parse_endpoint_url};
use personal_agent_api::models::Provider;
use std::net::IpAddr;

#[test]
fn accepts_public_https_endpoints() {
    assert!(parse_endpoint_url(
        Provider::OpenAiResponses,
        "https://gateway.example.com/v1/responses"
    )
    .is_ok());
    assert!(parse_endpoint_url(
        Provider::AnthropicMessages,
        "https://api.anthropic.com/v1/messages"
    )
    .is_ok());
}

#[test]
fn rejects_unsafe_or_wrong_endpoints() {
    for url in [
        "http://gateway.example.com/v1/responses",
        "https://127.0.0.1/v1/responses",
        "https://localhost/v1/responses",
        "https://gateway.local/v1/responses",
        "https://u:p@gateway.example.com/v1/responses",
        "https://gateway.example.com:8443/v1/responses",
        "https://gateway.example.com/v1/responses?x=1",
        "https://gateway.example.com/v1/messages",
    ] {
        assert!(
            parse_endpoint_url(Provider::OpenAiResponses, url).is_err(),
            "{url}"
        );
    }
}

#[test]
fn only_public_addresses_can_be_pinned() {
    for address in [
        "10.0.0.1",
        "127.0.0.1",
        "169.254.169.254",
        "172.16.0.1",
        "192.168.1.1",
        "100.64.0.1",
        "::1",
        "fc00::1",
        "fe80::1",
        "2001:db8::1",
    ] {
        assert!(
            !is_public_address(address.parse::<IpAddr>().unwrap()),
            "{address}"
        );
    }
    for address in ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"] {
        assert!(
            is_public_address(address.parse::<IpAddr>().unwrap()),
            "{address}"
        );
    }
}
