use personal_agent_api::models::Provider;
use personal_agent_api::validation::validate_chat;
use serde_json::json;

#[test]
fn rejects_blank_messages_and_oversized_context() {
    assert!(validate_chat(json!({"message":"  ","context":{},"conversation":[]})).is_err());
    assert!(validate_chat(
        json!({"message":"Hi","context":{"about":"x".repeat(40_000)},"conversation":[]})
    )
    .is_err());
}

#[test]
fn accepts_bounded_chat_with_recent_turns() {
    let value = json!({"message":"Hi","context":{"name":"Ada"},"conversation":[{"role":"user","content":"Hello"}]});
    let validated = validate_chat(value).unwrap();
    assert_eq!(validated.message, "Hi");
    assert_eq!(validated.conversation.len(), 1);
    assert_eq!(validated.provider, Provider::OpenAiResponses);
    assert_eq!(validated.api_url, "https://api.openai.com/v1/responses");
    assert_eq!(validated.model, "gpt-5-mini");
}

#[test]
fn accepts_user_selected_responses_and_anthropic() {
    for (provider, url, expected) in [
        (
            "openai_responses",
            "https://gateway.example.com/v1/responses",
            Provider::OpenAiResponses,
        ),
        (
            "anthropic_messages",
            "https://api.anthropic.com/v1/messages",
            Provider::AnthropicMessages,
        ),
    ] {
        let value = json!({"provider":provider,"apiUrl":url,"model":"custom-model","message":"Hi","context":{},"conversation":[]});
        let validated = validate_chat(value).unwrap();
        assert_eq!(validated.provider, expected);
        assert_eq!(validated.api_url, url);
        assert_eq!(validated.model, "custom-model");
    }
}

#[test]
fn rejects_partial_or_extra_provider_configuration() {
    assert!(validate_chat(
        json!({"provider":"anthropic_messages","message":"Hi","context":{},"conversation":[]})
    )
    .is_err());
    assert!(validate_chat(json!({"provider":"openai_responses","apiUrl":"https://api.openai.com/v1/responses","model":"","message":"Hi","context":{},"conversation":[]})).is_err());
    assert!(validate_chat(json!({"provider":"openai_responses","apiUrl":"https://api.openai.com/v1/responses","model":"m","message":"Hi","context":{},"conversation":[],"secret":"x"})).is_err());
}
