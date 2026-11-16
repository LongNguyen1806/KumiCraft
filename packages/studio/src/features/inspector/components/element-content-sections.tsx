// The parts of the Inspector above an element's styles: text runs, component props, data rows and
// icon (split from inspector-panel.tsx in QA K9.8-1).
import type { ClassValue, ElementSource, PropertyId } from '@kumicraft/shared';

import { ComponentPropsSection } from './component-props-section.tsx';
import { DataGridSection } from './data-grid-section.tsx';
import { InspectorIconSection } from './inspector-icon-section.tsx';
import { MixedTextEditor } from './mixed-text-editor.tsx';

type ElementContentSectionsProps = {
  readonly source: ElementSource;
  readonly editable: boolean;
  readonly isAttrLocked: boolean;
  readonly onPropChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly onRefresh: () => void;
};

export function ElementContentSections({
  source,
  editable,
  isAttrLocked,
  onPropChange,
  onRefresh,
}: ElementContentSectionsProps) {
  return (
    <>
      <ComponentPropsSection
        loc={source.loc}
        tag={source.tag}
        fileHash={source.fileHash}
        componentName={source.component?.name}
        disabled={isAttrLocked}
        onSaved={onRefresh}
      />
      <MixedTextEditor source={source} disabled={isAttrLocked} onSaved={onRefresh} />
      <DataGridSection dataContext={source.dataContext} onSaved={onRefresh} />
      <InspectorIconSection
        source={source}
        disabled={isAttrLocked}
        editable={editable}
        onTextColorChange={(hex) => {
          onPropChange('textColor', { kind: 'arbitrary', css: hex });
        }}
        onRefresh={onRefresh}
      />
    </>
  );
}
