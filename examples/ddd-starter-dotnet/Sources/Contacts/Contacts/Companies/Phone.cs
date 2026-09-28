using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Newtonsoft.Json;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Contacts.Companies;

[UsedImplicitly(ImplicitUseTargetFlags.WithMembers)]
[DddEntity]
public class Phone
{
    [BindNever]
    [JsonIgnore]
    public Guid CompanyId { get; set; }

    [BindRequired]
    public string Number { get; set; }
}