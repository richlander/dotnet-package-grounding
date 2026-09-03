import { createHash } from "node:crypto";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(await readFile(path.join(root, "pins.json"), "utf8"));

export async function prepareIsolation() {
  const packageFile = await cachePackage();
  const isolationRoot = await mkdtemp(path.join(os.tmpdir(), "markout-vally-doc-stripped-"));
  const feed = path.join(isolationRoot, "feed");
  const bootstrap = path.join(isolationRoot, "bootstrap");
  const packages = path.join(isolationRoot, ".nuget", "packages");
  await mkdir(feed, { recursive: true });
  await mkdir(bootstrap, { recursive: true });
  await cp(packageFile, path.join(feed, "Markout.0.35.2.nupkg"));
  for (const dependency of pins.packageClosure) {
    const dependencyFile = await cacheArtifact(
      `${dependency.id}.${dependency.version}.nupkg`,
      dependency.url,
      dependency.sha256
    );
    await cp(dependencyFile, path.join(feed, `${dependency.id}.${dependency.version}.nupkg`));
  }
  await writeFile(path.join(bootstrap, "Bootstrap.csproj"), bootstrapProject);
  await writeFile(path.join(bootstrap, "global.json"), JSON.stringify({
    sdk: {
      version: pins.dotnet.sdkVersion,
      rollForward: "disable",
      allowPrerelease: false
    }
  }, null, 2));

  const env = isolatedEnvironment(isolationRoot, packages);
  run("dotnet", [
    "restore",
    path.join(bootstrap, "Bootstrap.csproj"),
    "--packages",
    packages,
    "--source",
    feed,
    "--ignore-failed-sources"
  ], env);

  const packageDir = path.join(packages, "markout", pins.markout.packageVersion);
  await stripDocumentation(packageDir);
  for (const dependency of pins.packageClosure) {
    await stripDependencyDocumentation(
      path.join(packages, dependency.id.toLowerCase(), dependency.version)
    );
  }
  await rm(feed, { recursive: true, force: true });
  await rm(bootstrap, { recursive: true, force: true });
  await writeNuGetConfig(isolationRoot);
  await makeReadOnly(packages);

  return {
    root: isolationRoot,
    env,
    async dispose() {
      if (!path.basename(isolationRoot).startsWith("markout-vally-doc-stripped-")) {
        throw new Error(`refusing to remove unexpected isolation path: ${isolationRoot}`);
      }
      await makeWritable(isolationRoot);
      await rm(isolationRoot, { recursive: true, force: true });
    }
  };
}

export function childEnvironment(isolation, { auth = false } = {}) {
  const env = {};
  for (const name of [
    "PATH",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TERM",
    "COLORTERM",
    "NO_COLOR",
    "FORCE_COLOR",
    "SHELL",
    "DOTNET_ROOT",
    "DOTNET_HOST_PATH",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "NODE_EXTRA_CA_CERTS",
  ]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  Object.assign(env, isolation.env, { USER: "eval", LOGNAME: "eval" });
  const token = process.env.COPILOT_GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (auth) {
    if (!token) {
      throw new Error("experiment execution requires COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN");
    }
    env.COPILOT_GITHUB_TOKEN = token;
  } else {
    delete env.COPILOT_GITHUB_TOKEN;
  }
  return env;
}

async function cachePackage() {
  return cacheArtifact(
    "Markout.0.35.2.nupkg",
    pins.markout.packageUrl,
    pins.markout.packageSha256
  );
}

async function cacheArtifact(fileName, url, expectedHash) {
  const cacheDir = path.join(root, ".cache");
  const packageFile = path.join(cacheDir, fileName);
  await mkdir(cacheDir, { recursive: true });
  let valid = false;
  try {
    valid = await sha256(packageFile) === expectedHash;
  } catch {
    valid = false;
  }
  if (!valid) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to download ${fileName}: HTTP ${response.status}`);
    }
    await writeFile(packageFile, Buffer.from(await response.arrayBuffer()));
  }
  const actual = await sha256(packageFile);
  if (actual !== expectedHash) {
    throw new Error(`${fileName} hash mismatch: expected ${expectedHash}, got ${actual}`);
  }
  return packageFile;
}

async function stripDocumentation(packageDir) {
  const removals = [
    "skills",
    "README.md",
    "Markout.xml",
    `markout.${pins.markout.packageVersion}.nupkg`,
    `markout.${pins.markout.packageVersion}.nupkg.sha512`
  ];
  for (const relative of removals) {
    await rm(path.join(packageDir, relative), { recursive: true, force: true });
  }

  const nuspec = path.join(packageDir, "markout.nuspec");
  let text = await readFile(nuspec, "utf8");
  text = text
    .replace(/<readme>[\s\S]*?<\/readme>/gi, "")
    .replace(/<releaseNotes>[\s\S]*?<\/releaseNotes>/gi, "")
    .replace(/<repository\b[^>]*\/>/gi, "")
    .replace(
      /<description>[\s\S]*?<\/description>/i,
      "<description>Package documentation removed for isolated evaluation.</description>"
    );
  await writeFile(nuspec, text);

  const metadata = path.join(packageDir, ".nupkg.metadata");
  try {
    const value = JSON.parse(await readFile(metadata, "utf8"));
    value.source = "doc-stripped-v3-vally-prototype";
    await writeFile(metadata, JSON.stringify(value));
  } catch {
    // NuGet versions differ on whether this file exists.
  }
}

async function stripDependencyDocumentation(packageDir) {
  for (const name of await readdir(packageDir)) {
    const lower = name.toLowerCase();
    if (lower === "skills"
      || lower === "docs"
      || lower === "doc"
      || lower.endsWith(".xml")
      || lower.endsWith(".md")
      || lower.endsWith(".nupkg")
      || lower.endsWith(".nupkg.sha512")) {
      await rm(path.join(packageDir, name), { recursive: true, force: true });
    }
  }
}

async function writeNuGetConfig(isolationRoot) {
  const directory = path.join(isolationRoot, ".nuget", "NuGet");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "NuGet.Config"), `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
  </packageSources>
</configuration>
`);
}

function isolatedEnvironment(isolationRoot, packages) {
  return {
    HOME: isolationRoot,
    USERPROFILE: isolationRoot,
    DOTNET_CLI_HOME: isolationRoot,
    NUGET_PACKAGES: packages,
    NUGET_HTTP_CACHE_PATH: path.join(isolationRoot, ".local", "share", "NuGet", "http-cache"),
    NUGET_PLUGINS_CACHE_PATH: path.join(isolationRoot, ".local", "share", "NuGet", "plugin-cache"),
    XDG_CACHE_HOME: path.join(isolationRoot, ".cache"),
    XDG_CONFIG_HOME: path.join(isolationRoot, ".config"),
    XDG_DATA_HOME: path.join(isolationRoot, ".local", "share"),
    NuGetAudit: "false",
    NUGET_XMLDOC_MODE: "skip",
    RestoreIgnoreFailedSources: "true",
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_NOLOGO: "1",
    VALLY_TELEMETRY_OPTOUT: "1"
  };
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function makeReadOnly(target) {
  for (const entry of await walk(target)) {
    await chmod(entry.path, entry.directory ? 0o555 : 0o444);
  }
  await chmod(target, 0o555);
}

async function makeWritable(target) {
  try {
    for (const entry of (await walk(target)).reverse()) {
      await chmod(entry.path, entry.directory ? 0o755 : 0o644);
    }
    await chmod(target, 0o755);
  } catch {
    // Cleanup is best effort after a failed setup.
  }
}

async function walk(target) {
  const result = [];
  for (const name of await readdir(target)) {
    const child = path.join(target, name);
    const info = await stat(child);
    result.push({ path: child, directory: info.isDirectory() });
    if (info.isDirectory()) {
      result.push(...await walk(child));
    }
  }
  return result;
}

const bootstrapProject = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Markout" Version="[0.35.2]" />
  </ItemGroup>
</Project>
`;
