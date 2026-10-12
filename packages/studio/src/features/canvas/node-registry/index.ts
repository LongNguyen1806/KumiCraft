import type { NodeType } from '@reactcraft/model';
import type { FC } from 'react';

import { DetailViewNode, ListNode, TableNode } from './data-nodes.tsx';
import {
  ButtonNode,
  CheckboxNode,
  FormNode,
  InputNode,
  LinkNode,
  RadioNode,
  SelectNode,
  SwitchNode,
  TextareaNode,
} from './form-nodes.tsx';
import type { NodeRenderProps } from './layout-nodes.tsx';
import { CardNode, ContainerNode, GridNode, SectionNode, StackNode } from './layout-nodes.tsx';
import {
  ComponentInstanceNode,
  FooterNode,
  ModalNode,
  NavbarNode,
  SidebarNode,
  SlotNode,
  TabsNode,
} from './structural-nodes.tsx';
import {
  DividerNode,
  HeadingNode,
  IconNode,
  ImageNode,
  TextNode,
} from './typography-media-nodes.tsx';

export type { NodeRenderProps } from './layout-nodes.tsx';

export const NODE_RENDERERS: Record<NodeType, FC<NodeRenderProps>> = {
  Stack: StackNode,
  Grid: GridNode,
  Section: SectionNode,
  Container: ContainerNode,
  Card: CardNode,
  Text: TextNode,
  Heading: HeadingNode,
  Image: ImageNode,
  Icon: IconNode,
  Divider: DividerNode,
  Button: ButtonNode,
  Link: LinkNode,
  Form: FormNode,
  Input: InputNode,
  Textarea: TextareaNode,
  Select: SelectNode,
  Checkbox: CheckboxNode,
  Radio: RadioNode,
  Switch: SwitchNode,
  Table: TableNode,
  List: ListNode,
  DetailView: DetailViewNode,
  Navbar: NavbarNode,
  Sidebar: SidebarNode,
  Footer: FooterNode,
  Modal: ModalNode,
  Tabs: TabsNode,
  ComponentInstance: ComponentInstanceNode,
  Slot: SlotNode,
};
