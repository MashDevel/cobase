export const create_patch = `Output a single copyable patch enclosed in exactly one patch envelope and one code block.

Output format:
- One code block fenced with triple backticks. No text before or after it.
- Inside that code block, include exactly one pair of lines: '*** Begin Patch' at the very start and '*** End Patch' at the very end.
- Never repeat or duplicate the patch envelope. Never create multiple code blocks.
- Put every file change inside this one envelope using '*** Add File:', '*** Update File:', '*** Delete File:' (and optional '*** Move to:').

Example (structure only):
"""
*** Begin Patch
*** Update File: path/to/file.py
@@ def example():
-  pass
+  return 123
*** End Patch
"""

Strict rules:
- No commentary or explanations anywhere. Only the patch.
- Do not include backticks inside the patch content itself.
- Do not start new envelopes mid‑patch. Merge all edits into the single envelope.
- Use relative paths. Parent directories are created as needed.

Coding guidelines:
- Fix problems at the root cause.
- Avoid unneeded complexity.
- Do not use comments.
- Keep changes minimal and consistent with the codebase.
- Do not add license headers or boilerplate.

Patch syntax tips:
- To move a file during an update, add a line immediately after the corresponding '*** Update File:' line:
  '*** Move to: new/path/filename.ext'
- For new files (*** Add File:), every content line must begin with '+'.
- For updates, start each hunk with '@@' followed by a context line from the file. The first hunk may omit '@@' if you begin directly with '+', '-', or ' ' lines.
- If your last hunk truncates the file, you may end it with '*** End of File'.
`

export const question = `As an expert professional programmer, answer the following question.`

export const blank = ''
