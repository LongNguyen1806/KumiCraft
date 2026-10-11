// Structure rules that need the parent, the ancestors or other components: containment (V-11 to
// V-13), components (V-17, V-18, V-56), form fields (V-23), layout properties (V-26, V-27).
import type { DesignNode } from '../node.schema.ts';
import { CONTAINER_TYPES } from '../node.schema.ts';
import type { StyleProps } from '../style.schema.ts';
import { walkTree } from '../tree.ts';
import type { DocumentIndex, NodeVisit, Report } from './context.ts';

const LAYOUT_KEYS = [
  'direction',
  'gap',
  'align',
  'justify',
  'wrap',
  'columns',
  'rows',
  'autoFit',
] as const;
const GRID_ONLY_KEYS = ['columns', 'rows', 'autoFit'] as const;
const FLEX_CHILD_KEYS = ['grow', 'alignSelf'] as const;
const GRID_CHILD_KEYS = ['colSpan', 'rowSpan'] as const;

function checkContainment({ node, ancestors, tree, path }: NodeVisit, report: Report) {
  const parent = ancestors.at(-1);
  const isUnderPageRoot = tree.kind === 'page' && ancestors.length === 1;
  if (node.type === 'Section' && !isUnderPageRoot && parent?.type !== 'Container') {
    report({
      rule: 'V-11',
      path,
      message: 'A Section sits directly in the page root or a Container',
    });
  }
  if (node.type === 'Modal' && !isUnderPageRoot) {
    report({ rule: 'V-12', path, message: 'A Modal sits directly in the page root' });
  }
  if (node.type === 'Form' && ancestors.some((ancestor) => ancestor.type === 'Form')) {
    report({ rule: 'V-13', path, message: 'A Form cannot be inside another Form' });
  }
}

/** Every style object of a node: base and each breakpoint. */
function styles({ node, path }: NodeVisit): { style: StyleProps; path: string }[] {
  const all = node.style === undefined ? [] : [{ style: node.style, path: `${path}.style` }];
  for (const [key, style] of Object.entries(node.responsive ?? {})) {
    all.push({ style, path: `${path}.responsive.${key}` });
  }
  return all;
}

function checkLayout(visit: NodeVisit, report: Report) {
  const { node, ancestors } = visit;
  const parent = ancestors.at(-1);
  // A slot's or component root's real parent is known only where the component is used.
  const isParentKnown = parent !== undefined && parent.type !== 'ComponentInstance';
  const isFlexParent = isParentKnown && CONTAINER_TYPES.has(parent.type) && parent.type !== 'Grid';
  for (const { style, path } of styles(visit)) {
    const has = (key: keyof StyleProps) => style[key] !== undefined;
    for (const key of LAYOUT_KEYS) {
      if (has(key) && !CONTAINER_TYPES.has(node.type)) {
        report({ rule: 'V-26', path: `${path}.${key}`, message: `${key} is a container property` });
      }
    }
    for (const key of GRID_ONLY_KEYS) {
      if (has(key) && node.type !== 'Grid')
        report({ rule: 'V-26', path: `${path}.${key}`, message: `${key} needs a Grid` });
    }
    if (!isParentKnown) continue;
    for (const key of FLEX_CHILD_KEYS) {
      if (has(key) && !isFlexParent)
        report({ rule: 'V-27', path: `${path}.${key}`, message: `${key} needs a flex parent` });
    }
    for (const key of GRID_CHILD_KEYS) {
      if (has(key) && parent.type !== 'Grid')
        report({ rule: 'V-27', path: `${path}.${key}`, message: `${key} needs a Grid parent` });
    }
  }
}

/** V-23: field names are unique inside the nearest Form. */
function checkFieldNames(index: DocumentIndex, report: Report) {
  const seen = new Map<string, Set<string>>();
  for (const { node, ancestors, path } of index.visits) {
    const content = node.content;
    if (content === undefined || !('fieldName' in content)) continue;
    const form = ancestors.findLast((ancestor) => ancestor.type === 'Form');
    if (form === undefined) continue;
    const names = seen.get(form.id) ?? new Set<string>();
    if (names.has(content.fieldName)) {
      report({
        rule: 'V-23',
        path: `${path}.content.fieldName`,
        message: `Field "${content.fieldName}" repeats in the form`,
      });
    }
    names.add(content.fieldName);
    seen.set(form.id, names);
  }
}

/** V-18, V-56: instances use an existing component, its slot names and its prop names. */
function checkInstances(index: DocumentIndex, report: Report) {
  const { components } = index.document;
  for (const { node, path } of index.visits) {
    if (node.content?.kind !== 'instance') continue;
    const component = components[node.content.componentId];
    if (component === undefined) {
      report({
        path: `${path}.content.componentId`,
        message: `Component ${node.content.componentId} does not exist`,
      });
      continue;
    }
    const slotNames = slotNamesOf(component.root);
    for (const name of Object.keys(node.slots ?? {})) {
      if (!slotNames.has(name))
        report({
          rule: 'V-18',
          path: `${path}.slots.${name}`,
          message: `Slot "${name}" is not in ${component.name}`,
        });
    }
    const propNames = new Set(component.props.map((prop) => prop.name));
    for (const name of Object.keys(node.content.propValues)) {
      if (!propNames.has(name)) {
        report({
          rule: 'V-56',
          path: `${path}.content.propValues.${name}`,
          message: `Prop "${name}" is not in ${component.name}`,
        });
      }
    }
  }
}

/** V-17: no component uses itself, directly or through other components. */
/** Slot names declared in a component definition. */
function slotNamesOf(root: DesignNode): Set<string> {
  const names = new Set<string>();
  walkTree(root, (node) => {
    if (node.content?.kind === 'slot') names.add(node.content.name);
  });
  return names;
}

function checkComponentCycles(index: DocumentIndex, report: Report) {
  // Read every component directly: the walk may be limited to the trees an operation changed.
  const uses = new Map<string, Set<string>>();
  for (const component of Object.values(index.document.components)) {
    const used = new Set<string>();
    walkTree(component.root, (node) => {
      if (node.content?.kind === 'instance') used.add(node.content.componentId);
    });
    uses.set(component.id, used);
  }
  const reaches = (from: string, target: string, seen: Set<string>): boolean =>
    [...(uses.get(from) ?? [])].some(
      (next) =>
        next === target || (!seen.has(next) && (seen.add(next), reaches(next, target, seen))),
    );
  for (const id of Object.keys(index.document.components)) {
    if (reaches(id, id, new Set())) {
      report({ rule: 'V-17', path: `components.${id}`, message: 'The component uses itself' });
    }
  }
}

export function checkStructure(index: DocumentIndex, report: Report): void {
  for (const visit of index.visits) {
    checkContainment(visit, report);
    checkLayout(visit, report);
  }
  checkFieldNames(index, report);
  checkInstances(index, report);
  checkComponentCycles(index, report);
}
