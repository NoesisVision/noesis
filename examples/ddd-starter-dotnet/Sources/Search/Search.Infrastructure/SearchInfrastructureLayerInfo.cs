using System.Reflection;
using System.Runtime.CompilerServices;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Technology;

[assembly: InternalsVisibleTo("MyCompany.ECommerce.Search.Startup")]
[assembly: Layer("Infrastructure")]
[assembly: DomainModel]

namespace MyCompany.ECommerce.Search;

public static class SearchInfrastructureLayerInfo
{
    public static Assembly Assembly => typeof(SearchInfrastructureLayerInfo).Assembly;
}