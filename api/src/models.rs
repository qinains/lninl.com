use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Provider {
    OpenAiResponses,
    OpenAiChatCompletions,
    AnthropicMessages,
}

#[derive(Clone, Debug, Serialize)]
pub struct ChatResponse {
    pub text: String,
    pub proposals: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deliverable: Option<DeliverableOutput>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DeliverableOutput {
    pub title: String,
    pub body: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ConversationInput {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug)]
pub struct ValidatedChat {
    pub provider: Provider,
    pub api_url: String,
    pub model: String,
    pub message: String,
    pub context: serde_json::Value,
    pub conversation: Vec<ConversationInput>,
}
