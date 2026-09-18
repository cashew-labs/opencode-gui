import { Show, type Accessor } from "solid-js";
import type { MessagePart, Permission, ToolState } from "../../types";
import { ToolCallTemplate } from "./ToolCallTemplate";
import { FileDiffIcon } from "./ToolCallIcons";
import { toRelativePath, splitFilePath, usePermission, ErrorFooter } from "./ToolCallHelpers";
import { DiffViewer } from "./DiffViewer";

interface PatchedFile {
  filePath?: string;
  relativePath?: string;
  type?: string;
  additions?: number;
  deletions?: number;
}

interface PatchToolCallProps {
  part: MessagePart;
  workspaceRoot?: string;
  pendingPermissions?: Accessor<Map<string, Permission>>;
  onPermissionResponse?: (
    permissionId: string,
    response: "once" | "always" | "reject",
  ) => void;
}

export function PatchToolCall(props: PatchToolCallProps) {
  const state = () => props.part.state as ToolState;

  // Plain functions (NOT createMemo): metadata.files streams in via in-place
  // store mutation; a memo would return the same proxy ref and swallow updates.
  const files = (): PatchedFile[] =>
    (state().metadata?.files as PatchedFile[] | undefined) ?? [];

  const displayPath = (file: PatchedFile) =>
    toRelativePath(file.filePath, props.workspaceRoot) ||
    file.relativePath ||
    file.filePath ||
    "file";

  const diffStats = (): { additions: number; deletions: number } | null => {
    const list = files();
    if (list.length === 0) return null;
    let additions = 0;
    let deletions = 0;
    for (const f of list) {
      additions += f.additions ?? 0;
      deletions += f.deletions ?? 0;
    }
    return { additions, deletions };
  };

  const permission = usePermission(props.part, () =>
    props.pendingPermissions?.(),
  );

  // Call files() reactively inside JSX (Solid component bodies run once, so
  // capturing files() in a const would freeze it mid-stream).
  const singleFile = () => (files().length === 1 ? files()[0] : undefined);

  const Header = () => (
    <>
      <span class="tool-header-text">
        <Show
          when={singleFile()}
          fallback={
            <span class="tool-text">
              {files().length === 0
                ? props.part.state?.status === "pending"
                  ? "Applying patch"
                  : "Patched"
                : `Patched ${files().length} files`}
            </span>
          }
        >
          {(file) => {
            const parts = () => splitFilePath(displayPath(file()));
            return (
              <span class="tool-text tool-file-path">
                Patched{" "}
                <span class="tool-file-dir">{parts().dirPath}</span>
                <span class="tool-file-slash">{parts().slash}</span>
                <span class="tool-file-name">{parts().fileName}</span>
              </span>
            );
          }}
        </Show>
      </span>
      <Show when={diffStats()}>
        {(stats) => (
          <span class="tool-diff-stats">
            <Show when={stats().additions > 0}>
              <span class="tool-diff-stats__additions">+{stats().additions}</span>
            </Show>
            <Show when={stats().deletions > 0}>
              <span class="tool-diff-stats__deletions">-{stats().deletions}</span>
            </Show>
          </span>
        )}
      </Show>
    </>
  );

  const diff = () => state().metadata?.diff as string | undefined;
  const Output = () => (
    <Show when={diff()}>
      <DiffViewer diff={diff()!} />
    </Show>
  );

  return (
    <ToolCallTemplate
      icon={FileDiffIcon}
      header={Header}
      output={diff() ? Output : undefined}
      footer={state().error ? () => <ErrorFooter error={state().error} /> : undefined}
      isPending={props.part.state?.status === "pending"}
      needsPermission={!!permission()}
      permission={permission()}
      onPermissionResponse={(response) => {
        const perm = permission();
        if (perm?.id && props.onPermissionResponse) {
          props.onPermissionResponse(perm.id, response);
        }
      }}
    />
  );
}
