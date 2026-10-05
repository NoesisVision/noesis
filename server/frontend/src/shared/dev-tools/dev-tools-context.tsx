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

// No flags right now; a stored flag that is no longer here is dropped.
const featuresSchema = z.object({});

type Features = Record<string, boolean>;

interface DevToolsContextProps {
  enabled: boolean;
  features: Features;
  setFeatures: (
    features: Features | ((prevState: Features) => Features),
  ) => void;
}

const INIT_VALUE: DevToolsContextProps = {
  enabled: false,
  features: {},
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
// experiment, and the app flipping it would hide which behaviour they see.
export function useSetDevToolsFeatures() {
  return useContext(DevToolsContext).setFeatures;
}

function noop() {}
