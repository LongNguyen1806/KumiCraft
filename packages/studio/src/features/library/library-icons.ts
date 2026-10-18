// Lucide icons for library blocks (R-LB-10, explicit imports for tree-shaking).
import type { LucideIcon } from 'lucide-react';
import {
  AlignLeft,
  Columns3,
  CreditCard,
  FormInput,
  Grid,
  Heading,
  Image,
  Link,
  Menu,
  MousePointerClick,
  PanelBottom,
  Rows3,
  Sparkles,
  Square,
  Table,
  TextCursorInput,
} from 'lucide-react';

export const LIBRARY_ICONS: Record<string, LucideIcon> = {
  Rows: Rows3,
  Rows3,
  Columns: Columns3,
  Columns3,
  Grid,
  Square,
  Heading,
  AlignLeft,
  Image,
  Link,
  MousePointerClick,
  TextCursorInput,
  FormInput,
  Table,
  CreditCard,
  Menu,
  PanelBottom,
  Sparkles,
};

export function getBlockIcon(iconName: string): LucideIcon {
  return LIBRARY_ICONS[iconName] ?? Square;
}
