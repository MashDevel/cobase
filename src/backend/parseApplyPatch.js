export const PATCH_PREFIX         = "*** Begin Patch\n";
export const PATCH_SUFFIX         = "\n*** End Patch";
export const ADD_FILE_PREFIX      = "*** Add File: ";
export const DELETE_FILE_PREFIX   = "*** Delete File: ";
export const UPDATE_FILE_PREFIX   = "*** Update File: ";
export const MOVE_FILE_TO_PREFIX  = "*** Move File To: ";
export const END_OF_FILE_PREFIX   = "*** End of File";
export const HUNK_ADD_LINE_PREFIX = "+";

export function parseApplyPatch(patch) {
  if (!patch.startsWith(PATCH_PREFIX)) {
    return null;
  } else if (!patch.endsWith(PATCH_SUFFIX)) {
    return null;
  }
  const patchBody = patch.slice(
    PATCH_PREFIX.length,
    patch.length - PATCH_SUFFIX.length
  );
  const lines = patchBody.split("\n");
  const ops = [];

  for (const line of lines) {
    if (line.startsWith(END_OF_FILE_PREFIX)) {
      continue;
    } else if (line.startsWith(ADD_FILE_PREFIX)) {
      ops.push({
        type: "create",
        path: line.slice(ADD_FILE_PREFIX.length).trim(),
        content: ""
      });
      continue;
    } else if (line.startsWith(DELETE_FILE_PREFIX)) {
      ops.push({
        type: "delete",
        path: line.slice(DELETE_FILE_PREFIX.length).trim()
      });
      continue;
    } else if (line.startsWith(UPDATE_FILE_PREFIX)) {
      ops.push({
        type: "update",
        path: line.slice(UPDATE_FILE_PREFIX.length).trim(),
        update: "",
        added: 0,
        deleted: 0
      });
      continue;
    }

    const lastOp = ops[ops.length - 1];
    // lines after an ADD_FILE go into its .content
    if (lastOp?.type === "create") {
      const contentLine = line.startsWith(HUNK_ADD_LINE_PREFIX)
        ? line.slice(HUNK_ADD_LINE_PREFIX.length)
        : line;
      lastOp.content = appendLine(lastOp.content, contentLine);
      continue;
    }

    // otherwise we must be updating
    if (!lastOp || lastOp.type !== "update") {
      return null;
    }
    if (line.startsWith(HUNK_ADD_LINE_PREFIX)) {
      lastOp.added += 1;
    } else if (line.startsWith("-")) {
      lastOp.deleted += 1;
    }
    lastOp.update += lastOp.update ? "\n" + line : line;
  }

  return ops;
}

export function appendLine(content, line) {
  return content.length ? `${content}\n${line}` : line;
}
