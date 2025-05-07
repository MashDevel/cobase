export const create_patch = `Generate a single copyable patch file like this:
"*** Begin Patch\n*** Update File: path/to/file.py\n@@ def example():\n-  pass\n+  return 123\n*** End Patch"

Your code should follow these CODING GUIDELINES:

Fix the problem at the root cause rather than applying surface-level patches, when possible.

Avoid unneeded complexity in your solution.

Keep changes consistent with the style of the existing codebase. Changes should be minimal and focused on the task.

NEVER add copyright or license headers or extra comments unless specifically requested.

You can include multiple edits/files within a single patch. Print the patch as ONE code block only in chat.
`

export const question = `As an expert professional programmer, answer the following question.`

export const blank = ''

