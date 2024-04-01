import * as path from "node:path";
import * as url from "node:url";
import ts from "typescript";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Type = string;

interface Option {
  name: string;
  type: Type;
}

interface Plugin {
  name: string;
  options?: Type | Option[];
}

function getPluginOptions(checker: ts.TypeChecker, type: ts.Type): undefined | Type | Option[] {
  if (type.isClassOrInterface()) {
    const properties = type.getProperties();
    return properties.reduce<Option[]>((result, property) => {
      const type = checker.getTypeOfSymbol(property);
      result.push({
        name: property.escapedName.toString(),
        type: checker.typeToString(type),
      });
      return result;
    }, []);
  } else {
    return checker.typeToString(type);
  }
}

function getPluginOptionsOfClass(checker: ts.TypeChecker, node: ts.ClassDeclaration) {
  const constructor = node.members.find(ts.isConstructorDeclaration);
  if (constructor) {
    const firstParameter = constructor.parameters[0];
    if (firstParameter && firstParameter.type) {
      const typeNode = firstParameter.type;
      const type = checker.getTypeAtLocation(typeNode);
      return getPluginOptions(checker, type);
    }
  }
}

function getWebpackPlugins() {
  const plugins: Plugin[] = [];
  const entry = path.join(__dirname, "webpack.ts");
  const program = ts.createProgram(
    [entry],
    {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
    }
  );
  const checker = program.getTypeChecker();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.includes("webpack")) {
      ts.forEachChild(sourceFile, visit);
    }
  }
  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const name = node.name.escapedText.toString();
      if (name.endsWith("Plugin")) {
        plugins.push({
          name,
          options: getPluginOptionsOfClass(checker, node),
        });
      }
      return;
    }
    ts.forEachChild(node, visit);
  }
  return plugins;
}
const webpackPlugins = getWebpackPlugins();

function getRspackPlugins() {
  const plugins: Plugin[] = [];
  const entry = path.join(__dirname, "rspack.ts");
  const program = ts.createProgram(
    [entry],
    {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
    }
  );
  const checker = program.getTypeChecker();
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
          const options = (function () {
            if (declaration.type) {
              if (ts.isTypeLiteralNode(declaration.type)) {
                const constructor = declaration.type.members.find(member => ts.isConstructSignatureDeclaration(member)) as ts.ConstructSignatureDeclaration;
                const firstParameter = constructor.parameters[0];
                if (firstParameter && firstParameter.type) {
                  const typeNode = firstParameter.type;
                  const type = checker.getTypeAtLocation(typeNode);
                  return getPluginOptions(checker, type);
                }
              }
            }
          })();
          plugins.push({
            name,
            options
          });
        }
      }
      return;
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
        plugins.push({
          name,
          options: getPluginOptionsOfClass(checker, node),
        });
      }
      return;
    }
    ts.forEachChild(node, visit);
  }
  return plugins;
}
const rspackPlugins = getRspackPlugins();

const data = webpackPlugins.reduce<{plugin: string, status: string}[]>((result, webpackPlugin) => {
  const status = (function() {
    const rspackPlugin = rspackPlugins.find(rspackPlugin => webpackPlugin.name === rspackPlugin.name);
    if (!rspackPlugin) {
      return "🔴 Not implemented";
    }
    if (rspackPlugin.options === webpackPlugin.options) {
      return "🟢 Fully implemented";
    }
    return "🟡 Missing";
  })();
  

  result.push({
    plugin: webpackPlugin.name,
    status,
  });
  return result;
}, []);
console.table(data);
