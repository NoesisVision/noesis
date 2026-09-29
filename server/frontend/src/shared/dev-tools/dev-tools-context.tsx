import { createContext, type ReactNode, useContext } from 'react';
import { z } from 'zod';
import { useLocalStorage } from '#/shared/design-system/hooks.ts';

export const LOCAL_STORAGE_KEY = 'noesis.dev-tools';
const LOCAL_STORAGE_FEATURES_KEY = 'noesis.dev-tools.features';

const featuresSchema = z.object({
  lessColorsInDesignDocTree: z.boolean(),
});

type Features = z.infer<typeof featuresSchema>;

interface DevToolsContextProps {
  enabled: boolean;
  setEnabled: (val: boolean | ((prevState: boolean) => boolean)) => void;
  features: Features;
  setFeatures: (
    features: Features | ((prevState: Features) => Features),
  ) => void;
}

const INIT_VALUE: DevToolsContextProps = {
  enabled: false,
  setEnabled: noop,
  features: {
    lessColorsInDesignDocTree: false,
  },
  setFeatures: noop,
};

const DevToolsContext = createContext<DevToolsContextProps>(INIT_VALUE);

export const DevToolsContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [enabled, setEnabled] = useLocalStorage<boolean>({
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
        setEnabled,
        features,
        setFeatures,
      }}
    >
      {children}
    </DevToolsContext>
  );
};

export function useDevToolsContext() {
  return useContext(DevToolsContext);
}

function noop() {}
