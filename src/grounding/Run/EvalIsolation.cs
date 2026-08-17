using System.Diagnostics;
using System.Text.Json.Nodes;
using System.Xml.Linq;

namespace Grounding.Run;

internal sealed class EvalEnvironment : IDisposable
{
    private readonly Dictionary<string, string> _environment;
    private bool _disposed;

    public required string Root { get; init; }
    public required string PackageCache { get; init; }
    public required long CopiedFiles { get; init; }
    public required long StrippedFiles { get; init; }
    public required long StrippedBytes { get; init; }
    public required long SanitizedManifests { get; init; }

    public EvalEnvironment(Dictionary<string, string> environment) => _environment = environment;

    public void ApplyTo(ProcessStartInfo psi)
    {
        psi.Environment.Remove("GH_TOKEN");
        psi.Environment.Remove("GITHUB_TOKEN");
        foreach (var (key, value) in _environment)
            psi.Environment[key] = value;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        EvalIsolation.DeleteTree(Root);
    }
}

internal static class EvalIsolation
{
    // Bump whenever the deny-list or isolation layout changes. Provenance treats this as corpus.
    public const string DocStrippedPolicy = "doc-stripped-v3";

    private static readonly HashSet<string> DocumentationDirectories =
        new(StringComparer.OrdinalIgnoreCase) { "doc", "docs", "documentation", "skills" };

    private static readonly string[] DocumentationPrefixes =
        ["readme", "agents", "skill", "changelog", "changes", "release-notes", "releasenotes"];

    private static readonly HashSet<string> DocumentationExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".md", ".mdx", ".rst", ".adoc", ".asciidoc" };

    private static readonly HashSet<string> NamedDocumentationExtensions =
        new(DocumentationExtensions, StringComparer.OrdinalIgnoreCase)
        {
            "", ".txt", ".html", ".htm", ".pdf",
        };

    public static EvalEnvironment Prepare(string unit)
    {
        var token = FirstNonEmpty(
            Environment.GetEnvironmentVariable("COPILOT_GITHUB_TOKEN"),
            Environment.GetEnvironmentVariable("GH_TOKEN"),
            Environment.GetEnvironmentVariable("GITHUB_TOKEN"));
        if (token is null)
        {
            throw new InvalidOperationException(
                "--package-baseline doc-stripped requires COPILOT_GITHUB_TOKEN (or GH_TOKEN/GITHUB_TOKEN) " +
                "because the disposable HOME cannot use the host Copilot credential store.");
        }

        var sourceCache = ResolvePackageCache();
        if (!Directory.Exists(sourceCache))
            throw new DirectoryNotFoundException($"warm NuGet package cache not found: {sourceCache}");

        var safeUnit = new string(unit.Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray());
        var root = Path.Combine(
            Path.GetTempPath(), $"grounding-{safeUnit}-{DocStrippedPolicy}-{Guid.NewGuid():N}");
        var packageCache = Path.Combine(root, ".nuget", "packages");

        try
        {
            Directory.CreateDirectory(packageCache);
            var stats = CopySanitized(sourceCache, packageCache);
            if (stats.CopiedFiles == 0)
                throw new InvalidOperationException($"warm NuGet package cache is empty: {sourceCache}");

            WriteNuGetConfig(root);
            var tools = Path.Combine(root, ".dotnet", "tools");
            Directory.CreateDirectory(tools);

            MakeReadOnly(packageCache);
            MakeReadOnly(Path.Combine(root, ".nuget", "NuGet"));
            MakeReadOnly(tools);

            var environment = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["HOME"] = root,
                ["USERPROFILE"] = root,
                ["DOTNET_CLI_HOME"] = root,
                ["NUGET_PACKAGES"] = packageCache,
                ["NUGET_HTTP_CACHE_PATH"] = Path.Combine(root, ".local", "share", "NuGet", "http-cache"),
                ["NUGET_PLUGINS_CACHE_PATH"] = Path.Combine(root, ".local", "share", "NuGet", "plugin-cache"),
                ["XDG_CACHE_HOME"] = Path.Combine(root, ".cache"),
                ["XDG_CONFIG_HOME"] = Path.Combine(root, ".config"),
                ["XDG_DATA_HOME"] = Path.Combine(root, ".local", "share"),
                ["NuGetAudit"] = "false",
                ["NUGET_XMLDOC_MODE"] = "skip",
                ["RestoreIgnoreFailedSources"] = "true",
                ["DOTNET_SKIP_FIRST_TIME_EXPERIENCE"] = "1",
                ["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1",
                ["DOTNET_NOLOGO"] = "1",
                // Copilot CLI consumes this for its server connection and removes it from agent
                // tool subprocesses; the isolation probe verifies shell tools cannot observe it.
                ["COPILOT_GITHUB_TOKEN"] = token,
            };

            return new EvalEnvironment(environment)
            {
                Root = root,
                PackageCache = packageCache,
                CopiedFiles = stats.CopiedFiles,
                StrippedFiles = stats.StrippedFiles,
                StrippedBytes = stats.StrippedBytes,
                SanitizedManifests = stats.SanitizedManifests,
            };
        }
        catch
        {
            DeleteTree(root);
            throw;
        }
    }

    private static string ResolvePackageCache()
    {
        var configured = Environment.GetEnvironmentVariable("NUGET_PACKAGES");
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(Environment.ExpandEnvironmentVariables(configured));

        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (string.IsNullOrWhiteSpace(home))
            home = Environment.GetEnvironmentVariable("HOME");
        if (string.IsNullOrWhiteSpace(home))
            throw new InvalidOperationException("cannot resolve the current user's NuGet package cache");
        return Path.Combine(home, ".nuget", "packages");
    }

    private static CopyStats CopySanitized(string source, string destination)
    {
        long copied = 0, stripped = 0, strippedBytes = 0, sanitizedManifests = 0;

        void CopyDirectory(string sourceDir, string destinationDir, string relativeDir)
        {
            Directory.CreateDirectory(destinationDir);

            foreach (var directory in Directory.EnumerateDirectories(sourceDir))
            {
                if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"NuGet package cache contains a directory link: {directory}");
                var name = Path.GetFileName(directory);
                var relative = Path.Combine(relativeDir, name);
                if (DocumentationDirectories.Contains(name))
                {
                    var skipped = CountFiles(directory);
                    stripped += skipped.Files;
                    strippedBytes += skipped.Bytes;
                    continue;
                }
                CopyDirectory(directory, Path.Combine(destinationDir, name), relative);
            }

            foreach (var file in Directory.EnumerateFiles(sourceDir))
            {
                if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"NuGet package cache contains a file link: {file}");
                var name = Path.GetFileName(file);
                var relative = Path.Combine(relativeDir, name);
                var length = new FileInfo(file).Length;
                if (IsDocumentationOrArchive(relative))
                {
                    stripped++;
                    strippedBytes += length;
                    continue;
                }

                var destinationFile = Path.Combine(destinationDir, name);
                if (name.EndsWith(".nuspec", StringComparison.OrdinalIgnoreCase))
                {
                    SanitizeNuspec(file, destinationFile);
                    sanitizedManifests++;
                }
                else if (name.Equals(".nupkg.metadata", StringComparison.OrdinalIgnoreCase))
                {
                    SanitizePackageMetadata(file, destinationFile);
                    sanitizedManifests++;
                }
                else
                {
                    File.Copy(file, destinationFile, overwrite: false);
                }
                copied++;
            }
        }

        CopyDirectory(source, destination, "");
        return new CopyStats(copied, stripped, strippedBytes, sanitizedManifests);
    }

    private static bool IsDocumentationOrArchive(string relativePath)
    {
        var name = Path.GetFileName(relativePath);
        var lowerName = name.ToLowerInvariant();
        if (lowerName.EndsWith(".nupkg", StringComparison.Ordinal)
            || lowerName.EndsWith(".snupkg", StringComparison.Ordinal)
            || lowerName.EndsWith(".nupkg.sha512", StringComparison.Ordinal))
            return true;

        var extension = Path.GetExtension(name);
        if (DocumentationExtensions.Contains(extension))
            return true;
        if (NamedDocumentationExtensions.Contains(extension)
            && DocumentationPrefixes.Any(prefix =>
                lowerName.Equals(prefix, StringComparison.Ordinal)
                || lowerName.StartsWith(prefix + ".", StringComparison.Ordinal)
                || lowerName.StartsWith(prefix + "-", StringComparison.Ordinal)
                || lowerName.StartsWith(prefix + "_", StringComparison.Ordinal)))
            return true;

        if (!extension.Equals(".xml", StringComparison.OrdinalIgnoreCase))
            return false;

        var segments = relativePath.Split(
            [Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar],
            StringSplitOptions.RemoveEmptyEntries);
        return segments.Any(segment =>
            segment.Equals("lib", StringComparison.OrdinalIgnoreCase)
            || segment.Equals("ref", StringComparison.OrdinalIgnoreCase)
            || segment.Equals("analyzers", StringComparison.OrdinalIgnoreCase));
    }

    private static (long Files, long Bytes) CountFiles(string directory)
    {
        long files = 0, bytes = 0;
        var pending = new Stack<string>();
        pending.Push(directory);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            foreach (var child in Directory.EnumerateDirectories(current))
            {
                if ((File.GetAttributes(child) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"NuGet package cache contains a directory link: {child}");
                pending.Push(child);
            }
            foreach (var file in Directory.EnumerateFiles(current))
            {
                if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"NuGet package cache contains a file link: {file}");
                files++;
                bytes += new FileInfo(file).Length;
            }
        }
        return (files, bytes);
    }

    private static void SanitizeNuspec(string source, string destination)
    {
        var document = XDocument.Load(source, LoadOptions.PreserveWhitespace);
        var metadata = document.Descendants().FirstOrDefault(element =>
            element.Name.LocalName.Equals("metadata", StringComparison.OrdinalIgnoreCase));
        if (metadata is null)
            throw new InvalidDataException($"NuGet manifest has no metadata element: {source}");

        var contextualFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "summary", "releaseNotes", "title", "tags", "projectUrl", "iconUrl",
            "readme", "repository",
        };
        foreach (var element in metadata.Elements().Where(element => contextualFields.Contains(element.Name.LocalName)).ToList())
            element.Remove();
        var description = metadata.Elements().FirstOrDefault(element =>
            element.Name.LocalName.Equals("description", StringComparison.OrdinalIgnoreCase));
        if (description is null)
            metadata.Add(new XElement(metadata.Name.Namespace + "description", "Package documentation removed for isolated evaluation."));
        else
            description.Value = "Package documentation removed for isolated evaluation.";

        document.Save(destination, SaveOptions.DisableFormatting);
    }

    private static void SanitizePackageMetadata(string source, string destination)
    {
        var root = JsonNode.Parse(File.ReadAllText(source))?.AsObject()
            ?? throw new InvalidDataException($"NuGet package metadata is not a JSON object: {source}");
        root["source"] = DocStrippedPolicy;
        File.WriteAllText(destination, root.ToJsonString());
    }

    private static void WriteNuGetConfig(string root)
    {
        var dir = Path.Combine(root, ".nuget", "NuGet");
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "NuGet.Config"),
            """
            <?xml version="1.0" encoding="utf-8"?>
            <configuration>
              <packageSources>
                <clear />
              </packageSources>
            </configuration>
            """);
    }

    private static void MakeReadOnly(string path)
    {
        if (!Directory.Exists(path) && !File.Exists(path)) return;

        if (OperatingSystem.IsWindows())
        {
            foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
                File.SetAttributes(file, File.GetAttributes(file) | FileAttributes.ReadOnly);
            return;
        }

        foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
            File.SetUnixFileMode(file, UnixFileMode.UserRead | UnixFileMode.GroupRead | UnixFileMode.OtherRead);
        foreach (var directory in Directory.EnumerateDirectories(path, "*", SearchOption.AllDirectories)
                     .OrderByDescending(p => p.Length))
            File.SetUnixFileMode(directory,
                UnixFileMode.UserRead | UnixFileMode.UserExecute
                | UnixFileMode.GroupRead | UnixFileMode.GroupExecute
                | UnixFileMode.OtherRead | UnixFileMode.OtherExecute);
        File.SetUnixFileMode(path,
            UnixFileMode.UserRead | UnixFileMode.UserExecute
            | UnixFileMode.GroupRead | UnixFileMode.GroupExecute
            | UnixFileMode.OtherRead | UnixFileMode.OtherExecute);
    }

    internal static void DeleteTree(string path)
    {
        FileAttributes attributes;
        try
        {
            attributes = File.GetAttributes(path);
        }
        catch (FileNotFoundException)
        {
            return;
        }
        catch (DirectoryNotFoundException)
        {
            return;
        }
        if ((attributes & FileAttributes.ReparsePoint) != 0)
        {
            if ((attributes & FileAttributes.Directory) != 0) Directory.Delete(path);
            else File.Delete(path);
            return;
        }

        if (File.Exists(path))
        {
            if (OperatingSystem.IsWindows())
                File.SetAttributes(path, attributes & ~FileAttributes.ReadOnly);
            else
                File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            File.Delete(path);
            return;
        }

        if (OperatingSystem.IsWindows())
            File.SetAttributes(path, attributes & ~FileAttributes.ReadOnly);
        else
            File.SetUnixFileMode(path,
                UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        foreach (var entry in Directory.EnumerateFileSystemEntries(path))
            DeleteTree(entry);
        Directory.Delete(path);
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private readonly record struct CopyStats(
        long CopiedFiles, long StrippedFiles, long StrippedBytes, long SanitizedManifests);
}
