// Context providing the panel header element for portal actions (R-CH-02, QC-40).
import { createContext } from 'react';

export const PanelHeaderContext = createContext<HTMLDivElement | undefined>(undefined);
