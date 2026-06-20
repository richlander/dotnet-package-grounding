using Microsoft.Extensions.AI;

// A simulated chat model for local, network-free testing. It mimics a real model's
// tool-calling protocol: on the first turn it asks to call the GetWeather tool, and
// once it receives the tool result it produces the final answer. Treat this as an
// opaque IChatClient (a stand-in for a real provider client) — do not modify it.
internal sealed class StubChatClient : IChatClient
{
    public Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        // If a tool result is already present in the history, answer using it.
        var result = messages
            .SelectMany(m => m.Contents)
            .OfType<FunctionResultContent>()
            .LastOrDefault();

        if (result is not null)
        {
            var answer = $"The weather in Seattle is {result.Result}.";
            return Task.FromResult(new ChatResponse(new ChatMessage(ChatRole.Assistant, answer)));
        }

        // Otherwise, request that the GetWeather tool be invoked.
        var call = new FunctionCallContent(
            callId: "call-1",
            name: "GetWeather",
            arguments: new Dictionary<string, object?> { ["city"] = "Seattle" });

        var message = new ChatMessage(ChatRole.Assistant, new List<AIContent> { call });
        return Task.FromResult(new ChatResponse(message));
    }

    public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
        => throw new NotImplementedException();

    public object? GetService(Type serviceType, object? serviceKey = null) => null;

    public void Dispose() { }
}
