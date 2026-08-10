internal sealed class ExportService
{
    public async Task<string> ExportAsync(
        string source,
        string format,
        CancellationToken cancellationToken)
    {
        await Task.Yield();
        cancellationToken.ThrowIfCancellationRequested();
        return $"source={source};format={format}";
    }
}
