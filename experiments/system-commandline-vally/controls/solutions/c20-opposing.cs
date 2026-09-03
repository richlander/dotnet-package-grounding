int index = Array.IndexOf(args, "--level");
string level = index >= 0 && index + 1 < args.Length ? args[index + 1] : "";
Console.WriteLine($"level={level}");
return 0;
