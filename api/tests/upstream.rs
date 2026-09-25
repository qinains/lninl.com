use personal_agent_api::{
    models::{ConversationInput, Provider, ValidatedChat},
    upstream::{auth_headers, build_payload, parse_provider_response},
};
use serde_json::json;

fn chat(provider: Provider) -> ValidatedChat {
    ValidatedChat {
        provider,
        api_url: "https://gateway.example.com/v1/responses".into(),
        model: "chosen-model".into(),
        message: "Review my goal".into(),
        context: json!({"goal":"Write weekly"}),
        conversation: vec![ConversationInput {
            role: "user".into(),
            content: "Hello".into(),
        }],
    }
}

#[test]
fn responses_payload_and_bearer_header_keep_user_model() {
    let value = build_payload(&chat(Provider::OpenAiResponses));
    assert_eq!(value["model"], "chosen-model");
    assert_eq!(value["store"], false);
    assert_eq!(value["text"]["format"]["type"], "json_object");
    assert_eq!(value["input"][0]["content"], "Hello");
    assert!(value["input"][1]["content"]
        .as_str()
        .unwrap()
        .contains("Write weekly"));
    let headers = auth_headers(Provider::OpenAiResponses, "sk-secret").unwrap();
    assert_eq!(headers["authorization"], "Bearer sk-secret");
    assert!(!headers.contains_key("x-api-key"));
}

#[test]
fn anthropic_payload_and_headers_use_messages_contract() {
    let value = build_payload(&chat(Provider::AnthropicMessages));
    assert_eq!(value["model"], "chosen-model");
    assert_eq!(value["messages"][0]["content"], "Hello");
    assert!(value["messages"][1]["content"]
        .as_str()
        .unwrap()
        .contains("Write weekly"));
    assert!(value["system"].as_str().unwrap().contains("JSON"));
    let headers = auth_headers(Provider::AnthropicMessages, "anthropic-secret").unwrap();
    assert_eq!(headers["x-api-key"], "anthropic-secret");
    assert_eq!(headers["anthropic-version"], "2023-06-01");
    assert!(!headers.contains_key("authorization"));
}

#[test]
fn chat_completions_payload_and_parser_support_deepseek_contract() {
    let value = build_payload(&chat(Provider::OpenAiChatCompletions));
    assert_eq!(value["model"], "chosen-model");
    assert_eq!(value["messages"][0]["role"], "system");
    assert_eq!(value["messages"][1]["content"], "Hello");
    assert_eq!(value["response_format"]["type"], "json_object");
    let headers = auth_headers(Provider::OpenAiChatCompletions, "test-key").unwrap();
    assert_eq!(headers["authorization"], "Bearer test-key");
    let body = json!({"choices":[{"message":{"content":"{\"text\":\"Next\",\"proposals\":[]}"}}]});
    assert_eq!(
        parse_provider_response(Provider::OpenAiChatCompletions, body)
            .unwrap()
            .text,
        "Next"
    );
}

#[test]
fn parses_both_envelopes_and_rejects_malformed_text() {
    let envelope = r#"{"text":"Next step","proposals":[{"id":"p1","kind":"create","taskId":"t1","title":"Draft"}]}"#;
    let openai =
        json!({"output":[{"type":"message","content":[{"type":"output_text","text":envelope}]}]});
    let anthropic = json!({"content":[{"type":"text","text":envelope}]});
    for (provider, body) in [
        (Provider::OpenAiResponses, openai),
        (Provider::AnthropicMessages, anthropic),
    ] {
        let result = parse_provider_response(provider, body).unwrap();
        assert_eq!(result.text, "Next step");
        assert_eq!(result.proposals.len(), 1);
    }
    assert!(parse_provider_response(
        Provider::AnthropicMessages,
        json!({"content":[{"type":"text","text":"not json"}]})
    )
    .is_err());
    assert!(parse_provider_response(Provider::OpenAiResponses, json!({"output":[]})).is_err());
}
