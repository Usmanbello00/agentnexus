import fs from "fs-extra";
import nodePath from "path";
import { z as val } from "zod";
import { ToolDefinition } from "../registry.js";
import { glob } from "glob";

export const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read the contents of a file in the workspace.",
  parameters: val.object({
    filePath: val.string().describe("The relative path to the file."),
  }),
  platform: "shared",
  execute: async ({ filePath }, context) => {
    const fullPath = nodePath.join(context.workspacePath, filePath);
    if (!fullPath.startsWith(context.workspacePath)) {
      throw new Error("Access denied: Path outside workspace.");
    }
    return await fs.readFile(fullPath, "utf-8");
  },
};

export const writeFileTool: ToolDefinition = {
  name: "write_file",
  description: "Write content to a file in the workspace.",
  parameters: val.object({
    filePath: val.string().describe("The relative path to the file."),
    content: val.string().describe("The content to write."),
  }),
  requiresApproval: true,
  platform: "shared",
  execute: async ({ filePath, content }, context) => {
    const fullPath = nodePath.join(context.workspacePath, filePath);
    if (!fullPath.startsWith(context.workspacePath)) {
      throw new Error("Access denied: Path outside workspace.");
    }
    await fs.ensureDir(nodePath.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    return `Successfully wrote to ${filePath}`;
  },
};

export const uploadFileTool: ToolDefinition = {
  name: "upload_file",
  description: "Upload a file to the workspace.",
  parameters: val.object({
    filePath: val.string().describe("The destination path in the workspace."),
    base64Content: val.string().describe("The base64 encoded content of the file."),
  }),
  requiresApproval: true,
  platform: "shared",
  execute: async ({ filePath, base64Content }, context) => {
    const fullPath = nodePath.join(context.workspacePath, filePath);
    if (!fullPath.startsWith(context.workspacePath)) {
      throw new Error("Access denied: Path outside workspace.");
    }
    await fs.ensureDir(nodePath.dirname(fullPath));
    const buffer = Buffer.from(base64Content, 'base64');
    await fs.writeFile(fullPath, buffer);
    return `Successfully uploaded ${filePath}`;
  },
};

export const createWordCountScriptTool: ToolDefinition = {
  name: "create_word_count_script",
  description: "Creates a Python script that counts words in a file.",
  parameters: val.object({
    filePath: val.string().describe("The path where the python script should be created (e.g., 'word_count.py')."),
  }),
  requiresApproval: true,
  platform: "nexus",
  execute: async ({ filePath }, context) => {
    const scriptContent = `
import sys
import os

def count_words(target_file):
    if not os.path.exists(target_file):
        return f"Error: File {target_file} not found."
    try:
        with open(target_file, 'r', encoding='utf-8') as f:
            content = f.read()
            words = content.split()
            return len(words)
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py <filename>")
    else:
        print(count_words(sys.argv[1]))
`;
    const fullPath = nodePath.join(context.workspacePath, filePath);
    await fs.ensureDir(nodePath.dirname(fullPath));
    await fs.writeFile(fullPath, scriptContent.trim());
    return `Word count script created at ${filePath}. Usage: python ${filePath} <target_file>`;
  },
};

export const listFilesTool: ToolDefinition = {
  name: "list_files",
  description: "List files in the workspace using a glob pattern.",
  parameters: val.object({
    pattern: val.string().optional().default("**/*").describe("Glob pattern to match files."),
  }),
  platform: "shared",
  execute: async ({ pattern }, context) => {
    return await glob(pattern, { cwd: context.workspacePath, nodir: true });
  },
};

export const searchFilesTool: ToolDefinition = {
  name: "search_files",
  description: "Search for a string in files within the workspace.",
  parameters: val.object({
    query: val.string().describe("The string to search for."),
  }),
  platform: "shared",
  execute: async ({ query }, context) => {
    const files = await glob("**/*", { cwd: context.workspacePath, nodir: true });
    const results = [];
    for (const file of files) {
      const content = await fs.readFile(nodePath.join(context.workspacePath, file), "utf-8");
      if (content.includes(query)) {
        results.push(file);
      }
    }
    return results;
  },
};
