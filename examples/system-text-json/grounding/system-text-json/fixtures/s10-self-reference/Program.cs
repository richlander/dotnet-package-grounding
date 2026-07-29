// TODO: see the task description.

var root = new Node { Name = "root" };
root.Next = root;

class Node
{
    public string Name { get; set; } = "";
    public Node? Next { get; set; }
}
