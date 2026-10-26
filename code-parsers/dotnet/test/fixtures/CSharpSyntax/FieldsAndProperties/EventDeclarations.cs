namespace CSharpSyntax.FieldsAndProperties;

public class EventDeclarations
{
    private EventHandler? _customBacking;

    public event EventHandler? FieldLikeEvent;

    public event EventHandler? EventWithCustomAccessors
    {
        add => _customBacking += value;
        remove => _customBacking -= value;
    }

    public event EventHandler? EventWithBlockAccessors
    {
        add
        {
            _customBacking += value;
        }
        remove
        {
            _customBacking -= value;
        }
    }

    public static event EventHandler? StaticEvent;

    public event EventHandler<EventArgs>? GenericEventHandlerEvent;

    public event Action? CustomDelegateTypeEvent;

    public event Func<int, Task>? AsyncDelegateEvent;

    protected event EventHandler? ProtectedEvent;

    private event EventHandler? PrivateEvent;

    public virtual event EventHandler? VirtualEvent;

    [Obsolete("Attributed event")]
    public event EventHandler? EventWithAttribute;

    public void RaiseAll()
    {
        FieldLikeEvent?.Invoke(this, EventArgs.Empty);
        _customBacking?.Invoke(this, EventArgs.Empty);
        StaticEvent?.Invoke(null, EventArgs.Empty);
        GenericEventHandlerEvent?.Invoke(this, EventArgs.Empty);
        CustomDelegateTypeEvent?.Invoke();
        AsyncDelegateEvent?.Invoke(1);
        ProtectedEvent?.Invoke(this, EventArgs.Empty);
        PrivateEvent?.Invoke(this, EventArgs.Empty);
        VirtualEvent?.Invoke(this, EventArgs.Empty);
    }
}

public partial class PartialEvents
{
    public partial event EventHandler? PartialEvent;
}

public partial class PartialEvents
{
    private EventHandler? _partialBacking;

    public partial event EventHandler? PartialEvent
    {
        add => _partialBacking += value;
        remove => _partialBacking -= value;
    }
}

public class EventOverrides : EventDeclarations
{
    public override event EventHandler? VirtualEvent;
}

public interface IEventsInInterface
{
    event EventHandler EventInInterface;

    static event EventHandler? StaticEventInInterface;
}

public class ExplicitEventImplementation : IEventsInInterface
{
    event EventHandler? IEventsInInterface.EventInInterface
    {
        add { }
        remove { }
    }
}
