using Microsoft.Extensions.AI;

// A weather assistant built on Microsoft.Extensions.AI. It uses a chat client and
// exposes a GetWeather tool. The user asks a question; the assistant is supposed to
// call the tool and answer using the result.
IChatClient client = new StubChatClient();

var tools = new List<AITool> { AIFunctionFactory.Create(GetWeather, name: "GetWeather") };
var options = new ChatOptions { Tools = tools };

var messages = new List<ChatMessage>
{
    new(ChatRole.User, "What's the weather in Seattle?")
};

ChatResponse response = await client.GetResponseAsync(messages, options);

Console.WriteLine($"Assistant: {response.Text}");

[System.ComponentModel.Description("Gets the current weather for a city.")]
static string GetWeather(string city) => $"Sunny, 72F";
