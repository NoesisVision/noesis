import { createContext, type ReactNode, useContext } from 'react';
import { z } from 'zod';
import { useLocalStorage } from '#/shared/design-system/hooks.ts';

export const LOCAL_STORAGE_KEY = 'noesis.dev-tools';
const LOCAL_STORAGE_FEATURES_KEY = 'noesis.dev-tools.features';
type WindowWithDevTool = Window & typeof globalThis & { devtool(): void };

if (typeof window !== 'undefined') {
  (window as WindowWithDevTool).devtool = () => {
    if (localStorage.getItem(LOCAL_STORAGE_KEY) === 'true') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
    }
    window.location.reload();
  };
}

// Each flag says what it turns on (`.describe`), shown under its switch.
const featuresSchema = z.object({
  outlineDragForBigGroups: z
    .boolean()
    .default(false)
    .describe(
      'On the system model exploration, a group of more than 10 cards stays where it is while a dashed outline of it follows the pointer, and goes where the outline is let go of. Lighter to drag on a big diagram; off, every card moves as it is dragged.',
    ),
  animateEdgesWhileDragging: z
    .boolean()
    .default(true)
    .describe(
      "On the system model exploration, with the edges' animation on (the Edges menu), their dashes keep running while a card is dragged. Off, they hold still until the card is let go of, so the dragged card alone moves.",
    ),
});

type Features = z.infer<typeof featuresSchema>;

/** What a flag turns on, as its switch says it; nothing for one not here. */
export function featureDescription(name: string): string | undefined {
  return Object.hasOwn(featuresSchema.shape, name)
    ? featuresSchema.shape[name as keyof Features].description
    : undefined;
}

interface DevToolsContextProps {
  enabled: boolean;
  features: Features;
  setFeatures: (
    features: Features | ((prevState: Features) => Features),
  ) => void;
}

const INIT_VALUE: DevToolsContextProps = {
  enabled: false,
  features: {
    outlineDragForBigGroups: false,
    animateEdgesWhileDragging: true,
  },
  setFeatures: noop,
};

const DevToolsContext = createContext<DevToolsContextProps>(INIT_VALUE);

export const DevToolsContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [enabled] = useLocalStorage<boolean>({
    key: LOCAL_STORAGE_KEY,
    defaultValue: false,
    serialize: (value) => {
      return `${value}`;
    },
    deserialize: (value) => {
      return !(!value || value === 'false');
    },
  });
  const [features, setFeatures] = useLocalStorage<Features>({
    key: LOCAL_STORAGE_FEATURES_KEY,
    defaultValue: INIT_VALUE.features,
    serialize: (value) => {
      return JSON.stringify(value);
    },
    deserialize: (value) => {
      if (!value) {
        return INIT_VALUE.features;
      }
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = INIT_VALUE.features;
      }
      const output = featuresSchema.safeParse(parsed);

      if (output.success) {
        return output.data;
      }
      return INIT_VALUE.features;
    },
  });

  return (
    <DevToolsContext
      value={{
        enabled,
        features,
        setFeatures,
      }}
    >
      {children}
    </DevToolsContext>
  );
};

/** What dev tools say for the current user. Flags are read here, never set. */
export function useDevToolsContext(): Readonly<{
  enabled: boolean;
  features: Readonly<Features>;
}> {
  const { enabled, features } = useContext(DevToolsContext);
  return { enabled, features };
}

// Oxlint allows this import only in the Dev Tools view: a flag is the user's
// experiment, and the app flipping it would hide which behavior they see.
export function useSetDevToolsFeatures() {
  return useContext(DevToolsContext).setFeatures;
}

function noop() {}
