use crate::models::{ConversationInput, ValidatedChat};
use serde_json::Value;

pub fn validate_chat(value: Value) -> Result<ValidatedChat, &'static str> {
    let object = value.as_object().ok_or("Invalid request")?;
    if object.len() != 3
        || !object.contains_key("message")
        || !object.contains_key("context")
        || !object.contains_key("conversation")
    {
        return Err("Invalid request fields");
    }
    let message = object
        .get("message")
        .and_then(Value::as_str)
        .ok_or("Invalid message")?
        .trim();
    if message.is_empty() || message.len() > 4000 {
        return Err("Invalid message");
    }
    let context = object.get("context").ok_or("Invalid context")?;
    if !context.is_object() || context.to_string().len() > 24_000 {
        return Err("Invalid context");
    }
    let turns = object
        .get("conversation")
        .and_then(Value::as_array)
        .ok_or("Invalid conversation")?;
    if turns.len() > 20 {
        return Err("Conversation too long");
    }
    let mut conversation = Vec::with_capacity(turns.len());
    for turn in turns {
        let turn: ConversationInput =
            serde_json::from_value(turn.clone()).map_err(|_| "Invalid conversation turn")?;
        if !matches!(turn.role.as_str(), "user" | "assistant")
            || turn.content.is_empty()
            || turn.content.len() > 4000
        {
            return Err("Invalid conversation turn");
        }
        conversation.push(turn);
    }
    Ok(ValidatedChat {
        message: message.to_owned(),
        context: context.clone(),
        conversation,
    })
}
