import ts from 'typescript';
export function analyze(path, source) {
  const isScript = /\.[cm]?[jt]sx?$/.test(path);
  let symbols = 0,
    complexity = 0;
  const imports = [];
  if (isScript) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const walk = (n) => {
      if (
        ts.isFunctionDeclaration(n) ||
        ts.isMethodDeclaration(n) ||
        ts.isArrowFunction(n) ||
        ts.isClassDeclaration(n) ||
        ts.isInterfaceDeclaration(n)
      )
        symbols++;
      if (
        ts.isIfStatement(n) ||
        ts.isForStatement(n) ||
        ts.isForOfStatement(n) ||
        ts.isWhileStatement(n) ||
        ts.isCaseClause(n) ||
        ts.isConditionalExpression(n)
      )
        complexity++;
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier))
        imports.push(n.moduleSpecifier.text);
      ts.forEachChild(n, walk);
    };
    walk(ast);
  }
  // A language-neutral lexical fallback is explicit, never reported as an AST parse.
  else {
    symbols = (
      source.match(/^\s*(?:pub\s+)?(?:async\s+)?(?:def|fn|func|class|struct|interface)\s+/gm) || []
    ).length;
    complexity = (source.match(/\b(?:if|for|while|match|switch)\b/g) || []).length;
  }
  return {
    symbols,
    complexity,
    imports,
    lines: source.split('\n').length,
    analysis: isScript ? 'TypeScript AST' : 'lexical',
  };
}
