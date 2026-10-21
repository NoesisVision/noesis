using NoesisVision.Annotations;
using NoesisVision.Annotations.Domain.DDD;

// The whole assembly is out of the model (R3.1); its types still resolve.
[assembly: ExcludeFromDocs]

namespace Acme.Shop.Technical;

/// <summary>Annotated, but in an excluded assembly: no block (R3.1).</summary>
[DddEntity]
public abstract class Entity<TId> where TId : struct
{
    public TId Id { get; protected set; }
}

/// <summary>An unmapped generic the projection looks through (R7.6).</summary>
public sealed class Result<T>
{
    public T? Value { get; init; }
    public string? Error { get; init; }

    public static Result<T> Ok(T value) => new() { Value = value };
}

/// <summary>A step in a call chain that is no behaviour (R11.2).</summary>
public static class Guard
{
    public static T NotNull<T>(T? value) where T : class =>
        value ?? throw new ArgumentNullException(nameof(value));
}
