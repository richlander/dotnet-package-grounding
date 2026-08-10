internal sealed class Processor
{
    public async Task<string> HandleAsync(string input, CancellationToken cancellationToken)
    {
        await Task.Yield();
        cancellationToken.ThrowIfCancellationRequested();
        return $"handled={input}";
    }
}
