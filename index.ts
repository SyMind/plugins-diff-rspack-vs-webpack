import * as path from "node:path";
import * as url from "node:url";
import ts from "typescript";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getWebpackPlugins() {
  const plugins: string[] = [];
  const entry = path.join(__dirname, "webpack.ts");
  const program = ts.createProgram(
    [entry],
    {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
    }
  );
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.includes("webpack")) {
      ts.forEachChild(sourceFile, visit);
    }
  }
  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const name = node.name.escapedText;
      if (name?.endsWith("Plugin")) {
        plugins.push(name);
      }
    }
    ts.forEachChild(node, visit);
  }
  return plugins;
}
const webpackPlugins = getWebpackPlugins();

function getRspackPlugins() {
  const plugins: string[] = [];
  const entry = path.join(__dirname, "rspack.ts");
  const program = ts.createProgram(
    [entry],
    {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
    }
  );
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.includes("@rspack/core")) {
      ts.forEachChild(sourceFile, visit);
    }
  }
  function visit(node: ts.Node) {
    // export declare const XxxPlugin: {
    //   new (options: XxxPluginOptions): {
    //   }
    // }
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.length === 2 &&
      node.modifiers[0].kind === ts.SyntaxKind.ExportKeyword &&
      node.modifiers[1].kind === ts.SyntaxKind.DeclareKeyword &&
      node.declarationList.declarations
    ) {
      const declaration = node.declarationList.declarations[0];
      if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
        const name = declaration.name.escapedText.toString();
        if (name.endsWith("Plugin")) {
          plugins.push(name);
        }
      }
    }
    // export declare class XxxPlugin extends RspackBuiltinPlugin {
    //   constructor(options: XxxPluginOptions);
    // }
    if (
      ts.isClassDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      const name = node.name.escapedText.toString();
      if (name.endsWith("Plugin")) {
        plugins.push(name);
      }
    }
    ts.forEachChild(node, visit);
  }
  return plugins;
}
const rspackPlugins = getRspackPlugins();

const data = webpackPlugins.reduce<{plugin: string, status: string}[]>((result, webpackPlugin) => {
  const status = rspackPlugins.includes(webpackPlugin) ? "🟢 Implemented" : "🔴 Not implemented";
  result.push({
    plugin: webpackPlugin,
    status,
  });
  return result;
}, []);
console.table(data);
