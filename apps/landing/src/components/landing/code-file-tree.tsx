'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import FileIcon from 'reicon-react/icons/File';
import FolderIcon from 'reicon-react/icons/Folder';
import { Tree, TreeItem, TreeItemLabel } from '@/components/ui/tree';
import type { CodeFile } from './code-files';

type FileNode = { name: string; children?: string[] };

/** Adapts the server's actual file paths to ReUI's synchronous tree data loader. */
function fileNodes(files: CodeFile[]) {
  const nodes: Record<string, FileNode> = { '': { name: 'Files', children: [] } };
  for (const file of files) {
    const parts = file.path.split('/');
    let parent = '';
    parts.forEach((name, index) => {
      const id = parts.slice(0, index + 1).join('/');
      if (!nodes[id]) {
        nodes[id] = { name, ...(index < parts.length - 1 ? { children: [] } : {}) };
        nodes[parent].children!.push(id);
      }
      parent = id;
    });
  }
  return nodes;
}

/** ReUI owns keyboard navigation and expansion; the viewer owns the open source file. */
export function CodeFileTree({
  files,
  selected,
  onSelect,
  expandedItems,
  onExpandedItemsChange,
}: {
  files: CodeFile[];
  selected: string;
  onSelect: (path: string) => void;
  expandedItems: string[];
  onExpandedItemsChange: Dispatch<SetStateAction<string[]>>;
}) {
  const nodes = useMemo(() => fileNodes(files), [files]);
  const tree = useTree<FileNode>({
    rootItemId: '',
    state: { selectedItems: [selected], expandedItems },
    setExpandedItems: onExpandedItemsChange,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => Boolean(item.getItemData().children),
    dataLoader: {
      getItem: (id) => nodes[id],
      getChildren: (id) => nodes[id].children ?? [],
    },
    onPrimaryAction: (item) => {
      if (!item.isFolder()) onSelect(item.getId());
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature, selectionFeature],
  });

  return (
    <Tree tree={tree} aria-label="Files">
      {tree.getItems().map((item) => {
        const Icon = item.isFolder() ? FolderIcon : FileIcon;
        return (
          <TreeItem key={item.getId()} item={item} title={item.getId()}>
            <TreeItemLabel>
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="truncate">{item.getItemName()}</span>
            </TreeItemLabel>
          </TreeItem>
        );
      })}
    </Tree>
  );
}
