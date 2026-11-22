import type { UiKitReport } from '@kumicraft/shared';

export type UiKitInteractiveRender = {
  readonly jsx: string;
  readonly imports: readonly string[];
};

type Spec = {
  readonly component: string;
  readonly symbols: readonly string[];
  readonly jsx: { readonly vi: string; readonly en: string };
};

const INTERACTIVE_UIKIT_SPECS: Readonly<Record<string, Spec>> = {
  'interactive.tabs': {
    component: 'tabs',
    symbols: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],
    jsx: {
      vi: `<Tabs defaultValue="tab-1">\n  <TabsList>\n    <TabsTrigger value="tab-1">Tổng quan</TabsTrigger>\n    <TabsTrigger value="tab-2">Chi tiết</TabsTrigger>\n  </TabsList>\n  <TabsContent value="tab-1">\n    <p className="text-sm">Nội dung tổng quan của thẻ thứ nhất.</p>\n  </TabsContent>\n  <TabsContent value="tab-2">\n    <p className="text-sm">Thông tin kỹ thuật ở thẻ thứ hai.</p>\n  </TabsContent>\n</Tabs>`,
      en: `<Tabs defaultValue="tab-1">\n  <TabsList>\n    <TabsTrigger value="tab-1">Overview</TabsTrigger>\n    <TabsTrigger value="tab-2">Details</TabsTrigger>\n  </TabsList>\n  <TabsContent value="tab-1">\n    <p className="text-sm">Overview summary inside the first tab panel.</p>\n  </TabsContent>\n  <TabsContent value="tab-2">\n    <p className="text-sm">Technical specifications inside the second panel.</p>\n  </TabsContent>\n</Tabs>`,
    },
  },
  'interactive.accordion': {
    component: 'accordion',
    symbols: ['Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent'],
    jsx: {
      vi: `<Accordion type="single" collapsible>\n  <AccordionItem value="item-1">\n    <AccordionTrigger>Tính năng hoạt động như thế nào?</AccordionTrigger>\n    <AccordionContent>Dữ liệu hiển thị mượt mà với component của dự án.</AccordionContent>\n  </AccordionItem>\n  <AccordionItem value="item-2">\n    <AccordionTrigger>Tôi có thể đổi nội dung trực tiếp?</AccordionTrigger>\n    <AccordionContent>Nhấp đúp vào tiêu đề hoặc đoạn văn trên Canvas để sửa ngay.</AccordionContent>\n  </AccordionItem>\n</Accordion>`,
      en: `<Accordion type="single" collapsible>\n  <AccordionItem value="item-1">\n    <AccordionTrigger>How does this accordion work?</AccordionTrigger>\n    <AccordionContent>Rendered using your project shadcn accordion component.</AccordionContent>\n  </AccordionItem>\n  <AccordionItem value="item-2">\n    <AccordionTrigger>Can I edit text inline?</AccordionTrigger>\n    <AccordionContent>Double-click any heading or text directly on canvas.</AccordionContent>\n  </AccordionItem>\n</Accordion>`,
    },
  },
  'interactive.modal': {
    component: 'dialog',
    symbols: ['Dialog', 'DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogTitle'],
    jsx: {
      vi: `<Dialog>\n  <DialogTrigger asChild>\n    <button type="button" className="px-4 py-2 border rounded-md text-sm font-medium">Mở hộp thoại</button>\n  </DialogTrigger>\n  <DialogContent>\n    <DialogHeader>\n      <DialogTitle>Xác nhận thay đổi</DialogTitle>\n    </DialogHeader>\n    <p className="text-sm">Bạn có chắc chắn muốn áp dụng cấu hình này cho dự án?</p>\n  </DialogContent>\n</Dialog>`,
      en: `<Dialog>\n  <DialogTrigger asChild>\n    <button type="button" className="px-4 py-2 border rounded-md text-sm font-medium">Open dialog</button>\n  </DialogTrigger>\n  <DialogContent>\n    <DialogHeader>\n      <DialogTitle>Confirm changes</DialogTitle>\n    </DialogHeader>\n    <p className="text-sm">Are you sure you want to apply these workspace changes?</p>\n  </DialogContent>\n</Dialog>`,
    },
  },
  'interactive.drawer': {
    component: 'sheet',
    symbols: ['Sheet', 'SheetTrigger', 'SheetContent', 'SheetHeader', 'SheetTitle'],
    jsx: {
      vi: `<Sheet>\n  <SheetTrigger asChild>\n    <button type="button" className="px-4 py-2 border rounded-md text-sm font-medium">Mở ngăn kéo</button>\n  </SheetTrigger>\n  <SheetContent>\n    <SheetHeader>\n      <SheetTitle>Bộ lọc hiển thị</SheetTitle>\n    </SheetHeader>\n    <p className="text-sm">Điều chỉnh danh mục và tiêu chí lọc dữ liệu tại đây.</p>\n  </SheetContent>\n</Sheet>`,
      en: `<Sheet>\n  <SheetTrigger asChild>\n    <button type="button" className="px-4 py-2 border rounded-md text-sm font-medium">Open drawer</button>\n  </SheetTrigger>\n  <SheetContent>\n    <SheetHeader>\n      <SheetTitle>Display filters</SheetTitle>\n    </SheetHeader>\n    <p className="text-sm">Adjust categories and display filters inside this panel.</p>\n  </SheetContent>\n</Sheet>`,
    },
  },
  'interactive.dropdown': {
    component: 'dropdown-menu',
    symbols: ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem'],
    jsx: {
      vi: `<DropdownMenu>\n  <DropdownMenuTrigger asChild>\n    <button type="button" className="px-4 py-2 border rounded-md text-sm font-medium">Tùy chọn</button>\n  </DropdownMenuTrigger>\n  <DropdownMenuContent>\n    <DropdownMenuItem>Chỉnh sửa</DropdownMenuItem>\n    <DropdownMenuItem>Nhân bản</DropdownMenuItem>\n    <DropdownMenuItem>Xóa mục</DropdownMenuItem>\n  </DropdownMenuContent>\n</DropdownMenu>`,
      en: `<DropdownMenu>\n  <DropdownMenuTrigger asChild>\n    <button type="button" className="px-4 py-2 border rounded-md text-sm font-medium">Actions</button>\n  </DropdownMenuTrigger>\n  <DropdownMenuContent>\n    <DropdownMenuItem>Edit item</DropdownMenuItem>\n    <DropdownMenuItem>Duplicate</DropdownMenuItem>\n    <DropdownMenuItem>Delete</DropdownMenuItem>\n  </DropdownMenuContent>\n</DropdownMenu>`,
    },
  },
  'interactive.tooltip': {
    component: 'tooltip',
    symbols: ['TooltipProvider', 'Tooltip', 'TooltipTrigger', 'TooltipContent'],
    jsx: {
      vi: `<TooltipProvider>\n  <Tooltip>\n    <TooltipTrigger asChild>\n      <button type="button" className="px-3 py-1.5 border rounded-md text-sm">Di chuột xem gợi ý</button>\n    </TooltipTrigger>\n    <TooltipContent>\n      <p>Thông tin giải thích ngắn gọn cho thao tác này.</p>\n    </TooltipContent>\n  </Tooltip>\n</TooltipProvider>`,
      en: `<TooltipProvider>\n  <Tooltip>\n    <TooltipTrigger asChild>\n      <button type="button" className="px-3 py-1.5 border rounded-md text-sm">Hover for tip</button>\n    </TooltipTrigger>\n    <TooltipContent>\n      <p>Brief helpful context explaining this action.</p>\n    </TooltipContent>\n  </Tooltip>\n</TooltipProvider>`,
    },
  },
};

export function supportsInteractiveUiKit(blockId: string, uiKit: UiKitReport | undefined): boolean {
  if (uiKit?.kind !== 'shadcn') return false;
  const spec = INTERACTIVE_UIKIT_SPECS[blockId];
  return spec !== undefined && uiKit.components.includes(spec.component);
}

export function renderInteractiveUiKit(
  blockId: string,
  lang: 'vi' | 'en',
  uiKit: UiKitReport | undefined,
): UiKitInteractiveRender | undefined {
  if (uiKit?.kind !== 'shadcn') return undefined;
  const spec = INTERACTIVE_UIKIT_SPECS[blockId];
  if (spec === undefined) return undefined;
  if (!uiKit.components.includes(spec.component)) return undefined;
  const base = uiKit.importBase.replace(/\/+$/, '');
  return {
    jsx: spec.jsx[lang],
    imports: [`import { ${spec.symbols.join(', ')} } from '${base}/${spec.component}';`],
  };
}
