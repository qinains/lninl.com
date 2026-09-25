use crate::{
    endpoint::parse_endpoint_url,
    models::{ConversationInput, Provider, ValidatedChat},
};
use serde_json::Value;

pub fn validate_chat(value: Value) -> Result<ValidatedChat, &'static str> {
    let object = value.as_object().ok_or("Invalid request")?;
    let legacy = object.len() == 3;
    if (!legacy && object.len() != 6)
        || !object.contains_key("message")
        || !object.contains_key("context")
        || !object.contains_key("conversation")
        || (!legacy
            && (!object.contains_key("provider")
                || !object.contains_key("apiUrl")
                || !object.contains_key("model")))
    {
        return Err("Invalid request fields");
    }
    let (provider, api_url, model) = if legacy {
        (
            Provider::OpenAiResponses,
            "https://api.openai.com/v1/responses",
            "gpt-5-mini",
        )
    } else {
        let provider = match object.get("provider").and_then(Value::as_str) {
            Some("openai_responses") => Provider::OpenAiResponses,
            Some("anthropic_messages") => Provider::AnthropicMessages,
            _ => return Err("Invalid provider"),
        };
        let url = object
            .get("apiUrl")
            .and_then(Value::as_str)
            .ok_or("Invalid API URL")?;
        let model = object
            .get("model")
            .and_then(Value::as_str)
            .ok_or("Invalid model")?;
        (provider, url, model)
    };
    parse_endpoint_url(provider, api_url)?;
    if model.is_empty() || model.len() > 128 || model.bytes().any(|b| !(33..=126).contains(&b)) {
        return Err("Invalid model");
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
        provider,
        api_url: api_url.to_owned(),
        model: model.to_owned(),
        message: message.to_owned(),
        context: context.clone(),
        conversation,
    })
}
