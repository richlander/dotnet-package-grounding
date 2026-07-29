// TODO: see the task description.

Animal[] animals = [new Dog { Name = "Rex", GoodBoy = true }, new Cat { Name = "Momo", Lives = 9 }];

abstract class Animal { public string Name { get; set; } = ""; }
sealed class Dog : Animal { public bool GoodBoy { get; set; } }
sealed class Cat : Animal { public int Lives { get; set; } }
