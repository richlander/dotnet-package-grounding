int index = Array.IndexOf(args, "--name");
string name = index >= 0 && index + 1 < args.Length ? args[index + 1] : "world";
Console.WriteLine($"Hello, {name}!");
return 0;
