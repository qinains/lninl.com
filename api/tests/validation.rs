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
}
