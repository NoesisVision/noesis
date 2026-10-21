using NoesisVision.Annotations.Domain.DDD;

namespace Acme.Shop.Products;

/// <summary>Identifies a product in the catalogue.</summary>
[DddValueObject]
public readonly record struct ProductId(Guid Value);
