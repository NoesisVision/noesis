using JetBrains.Annotations;
using MyCompany.ECommerce.Contacts.Tags;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Contacts.Groups;

[UsedImplicitly(ImplicitUseTargetFlags.WithMembers)]
[DddEntity]
public class GroupTag
{
    public Guid GroupId { get; set; }
    public Group Group { get; set; }

    public Guid TagId { get; set; }
    public Tag Tag { get; set; }
}