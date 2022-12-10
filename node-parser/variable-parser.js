"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVariable = void 0;
const typescript_1 = require("typescript");
const VariableDeclaration_1 = require("../declarations/VariableDeclaration");
const TypescriptHeroGuards_1 = require("../type-guards/TypescriptHeroGuards");
const parse_utilities_1 = require("./parse-utilities");
function getTypeOfVar(name, declarations) {
    function findNodeByName(declaration, keyword) {
        return declaration.name === keyword;
    }
    const node = declarations.filter(dec => findNodeByName(dec, name));
    if (node.length !== 1) {
        return "Something wrong : Multiple identifier";
    }
    else {
        return node[0].type;
    }
}
function getBinaryExpressionType(initializer, declarations) {
    let typeSet = new Set();
    // Consider operation...
    // number, number => number +, -, *, / , %
    // number => number ++, --
    // number, number => boolean >, <, >=, <=, ==, !=
    // (hard. true && 3 => number, false && 4 => boolean : we have to know the value) &&, ||, !
    // &, |, ^, ~, <<, >>, >>>
    // =, +=, -=, *=, /=
    // unary -, string concat +, conditional 'A ? B : C', typeof, instanceof
    // Should check string concat first, then just evaluate except string concat.
    const isStringConcat = (initializer) => {
        var _a, _b, _c, _d, _e, _f;
        if (initializer && initializer.operatorToken) {
            if (initializer.operatorToken.kind === typescript_1.SyntaxKind.PlusToken) {
                // String?
                if (((_a = initializer.left) === null || _a === void 0 ? void 0 : _a.kind) === typescript_1.SyntaxKind.StringLiteral || ((_b = initializer.right) === null || _b === void 0 ? void 0 : _b.kind) === typescript_1.SyntaxKind.StringLiteral) {
                    return [true, false];
                    // Parenthesized Expression?
                }
                else if (((_c = initializer.left) === null || _c === void 0 ? void 0 : _c.kind) === typescript_1.SyntaxKind.ParenthesizedExpression && ((_d = initializer.right) === null || _d === void 0 ? void 0 : _d.kind) === typescript_1.SyntaxKind.ParenthesizedExpression) {
                    return isStringConcat({ left: initializer.left.expression, operatorToken: { kind: typescript_1.SyntaxKind.PlusToken }, right: initializer.right.expression });
                }
                else if (((_e = initializer.left) === null || _e === void 0 ? void 0 : _e.kind) === typescript_1.SyntaxKind.ParenthesizedExpression) {
                    return isStringConcat({ left: initializer.left.expression, operatorToken: { kind: typescript_1.SyntaxKind.PlusToken }, right: initializer.right });
                }
                else if (((_f = initializer.right) === null || _f === void 0 ? void 0 : _f.kind) === typescript_1.SyntaxKind.ParenthesizedExpression) {
                    return isStringConcat({ left: initializer.left, operatorToken: { kind: typescript_1.SyntaxKind.PlusToken }, right: initializer.right.expression });
                    // Else.
                }
                else {
                    const leftSet = getTypeFromInitializer(initializer.left, declarations);
                    const rightSet = getTypeFromInitializer(initializer.right, declarations);
                    if (leftSet.has("string") || rightSet.has("string")) {
                        return [true, false];
                    }
                    else {
                        return [false, false];
                    }
                }
            }
            else {
                const resultLeft = isStringConcat(initializer.left);
                const resultRight = isStringConcat(initializer.right);
                return [resultLeft[0] || resultRight[0], resultLeft[1] || resultRight[1]];
            }
        }
        else {
            return [false, false];
        }
    };
    const isStringConcatResult = isStringConcat(initializer);
    if (isStringConcatResult[0]) {
        typeSet.add("string");
        return typeSet;
    }
    else {
        if (isStringConcatResult[1]) {
            // console.log("Maybe StringConcat?");
        }
        if (initializer && initializer.kind) {
            switch (initializer.kind) {
                case typescript_1.SyntaxKind.NumericLiteral:
                case typescript_1.SyntaxKind.BigIntLiteral: // 8, 9
                    typeSet.add("number");
                    return typeSet;
                case typescript_1.SyntaxKind.StringLiteral: // 10
                    typeSet.add("string");
                    return typeSet;
                case typescript_1.SyntaxKind.FalseKeyword:
                case typescript_1.SyntaxKind.TrueKeyword: // 91, 106
                    typeSet.add("boolean");
                    return typeSet;
                case typescript_1.SyntaxKind.ParenthesizedExpression: // 200
                    return getBinaryExpressionType(initializer.expression, declarations);
                case typescript_1.SyntaxKind.BinaryExpression: // 209
                    switch (initializer.operatorToken.kind) {
                        case typescript_1.SyntaxKind.PlusToken:
                        case typescript_1.SyntaxKind.MinusToken:
                        case typescript_1.SyntaxKind.AsteriskToken:
                        case typescript_1.SyntaxKind.SlashToken:
                        case typescript_1.SyntaxKind.PercentToken:
                        case typescript_1.SyntaxKind.LessThanLessThanToken:
                        case typescript_1.SyntaxKind.GreaterThanGreaterThanToken:
                        case typescript_1.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                        case typescript_1.SyntaxKind.AmpersandToken:
                        case typescript_1.SyntaxKind.BarToken:
                            typeSet.add("number");
                            return typeSet;
                        case typescript_1.SyntaxKind.LessThanToken:
                        case typescript_1.SyntaxKind.LessThanEqualsToken:
                        case typescript_1.SyntaxKind.GreaterThanToken:
                        case typescript_1.SyntaxKind.GreaterThanEqualsToken:
                            typeSet.add("boolean");
                            return typeSet;
                        case typescript_1.SyntaxKind.EqualsToken:
                        case typescript_1.SyntaxKind.PlusEqualsToken:
                        case typescript_1.SyntaxKind.MinusEqualsToken:
                        case typescript_1.SyntaxKind.AsteriskEqualsToken:
                        case typescript_1.SyntaxKind.SlashEqualsToken:
                            const target = initializer.left;
                            const identifier = target.escapedText;
                            typeSet.add(getTypeOfVar(identifier, declarations));
                            return typeSet;
                        case typescript_1.SyntaxKind.InstanceOfKeyword:
                            typeSet.add("boolean");
                            return typeSet;
                        case typescript_1.SyntaxKind.AmpersandAmpersandToken:
                            // A && B
                            if (initializer.left.kind === typescript_1.SyntaxKind.TrueKeyword) {
                                return getTypeFromInitializer(initializer.right, declarations);
                            }
                            else if (initializer.left.kind === typescript_1.SyntaxKind.FalseKeyword) {
                                typeSet.add("boolean");
                                return typeSet;
                            }
                            else {
                                const rightType = getTypeFromInitializer(initializer.right, declarations);
                                typeSet.add("boolean");
                                rightType.forEach(t => typeSet.add(t));
                                return typeSet;
                            }
                        case typescript_1.SyntaxKind.BarBarToken:
                            // A || B
                            if (initializer.left.kind === typescript_1.SyntaxKind.TrueKeyword) {
                                typeSet.add("boolean");
                                return typeSet;
                            }
                            else if (initializer.left.kind === typescript_1.SyntaxKind.FalseKeyword) {
                                return getTypeFromInitializer(initializer.right, declarations);
                            }
                            else {
                                const rightType = getTypeFromInitializer(initializer.right, declarations);
                                typeSet.add("boolean");
                                rightType.forEach(t => typeSet.add(t));
                                return typeSet;
                            }
                    }
                    typeSet.add(`Go deeper ${initializer.operatorToken.kind}`);
                    return typeSet;
                case typescript_1.SyntaxKind.PrefixUnaryExpression:
                case typescript_1.SyntaxKind.PostfixUnaryExpression:
                    typeSet.add("number");
                    return typeSet;
                default:
                    typeSet.add(`Complicated Expression ${initializer.kind}`);
                    return typeSet;
            }
        }
        else {
            typeSet.add(`Complicated Expression`);
            return typeSet;
        }
    }
}
function getTypeFromInitializer(init, declarations) {
    const typeSet = new Set();
    let initializer;
    if (!init) {
        typeSet.add("Undefined INIT");
        return typeSet;
    }
    switch (init === null || init === void 0 ? void 0 : init.kind) {
        case typescript_1.SyntaxKind.NumericLiteral:
        case typescript_1.SyntaxKind.BigIntLiteral: // 8, 9
            typeSet.add("number");
            return typeSet;
        case typescript_1.SyntaxKind.StringLiteral: // 10
            typeSet.add("string");
            return typeSet;
        case typescript_1.SyntaxKind.Identifier: // 75
            const identifier = init.escapedText;
            typeSet.add(getTypeOfVar(identifier, declarations));
            return typeSet;
        case typescript_1.SyntaxKind.FalseKeyword:
        case typescript_1.SyntaxKind.TrueKeyword: // 91, 106
            typeSet.add("boolean");
            return typeSet;
        case typescript_1.SyntaxKind.PrefixUnaryExpression:
        case typescript_1.SyntaxKind.PostfixUnaryExpression:
            switch (init.operator) {
                case typescript_1.SyntaxKind.ExclamationToken:
                    typeSet.add("boolean");
                    return typeSet;
                case typescript_1.SyntaxKind.PlusToken:
                case typescript_1.SyntaxKind.MinusToken:
                case typescript_1.SyntaxKind.PlusPlusToken:
                case typescript_1.SyntaxKind.MinusMinusToken:
                    typeSet.add("number");
                    return typeSet;
                default:
                    typeSet.add("Unknown UnaryOp");
                    return typeSet;
            }
        case typescript_1.SyntaxKind.ParenthesizedExpression: // 200
            initializer = init;
            return getTypeFromInitializer(initializer.expression, declarations);
        case typescript_1.SyntaxKind.ArrowFunction: // 202
            const parameters = init.parameters;
            let nodeType = "";
            parameters.forEach((param) => {
                nodeType += parse_utilities_1.getNodeType(param.type);
            });
            // nodeType += getNodeType((init as unknown as {body : any}).body.type )
            nodeType += " => unknown";
            typeSet.add(nodeType);
            return typeSet;
        case typescript_1.SyntaxKind.TypeOfExpression: // 204
            typeSet.add("string");
            return typeSet;
        case typescript_1.SyntaxKind.BinaryExpression: // 209
            initializer = init;
            const binaryTypeSet = getBinaryExpressionType(initializer, declarations);
            binaryTypeSet.forEach(t => typeSet.add(t));
            return typeSet;
        case typescript_1.SyntaxKind.ConditionalExpression: // 210
            const initTernary = init;
            if (initTernary.condition.kind === typescript_1.SyntaxKind.TrueKeyword) {
                return getTypeFromInitializer(initTernary.whenTrue, declarations);
            }
            else if (initTernary.condition.kind === typescript_1.SyntaxKind.FalseKeyword) {
                return getTypeFromInitializer(initTernary.whenFalse, declarations);
            }
            else {
                const trueTypeSet = getTypeFromInitializer(initTernary.whenTrue, declarations);
                const falseTypeSet = getTypeFromInitializer(initTernary.whenFalse, declarations);
                trueTypeSet.forEach(t => typeSet.add(t));
                falseTypeSet.forEach(t => typeSet.add(t));
                return typeSet;
            }
        case typescript_1.SyntaxKind.ArrayLiteralExpression: // 192
            const elements = init.elements;
            elements.forEach(e => {
                const eTypeSet = getTypeFromInitializer(e, declarations);
                eTypeSet.forEach(ee => typeSet.add(ee));
            });
            let typeStr = "";
            typeSet.forEach(t => typeStr += (" | " + t));
            typeStr = typeStr.slice(3);
            if (typeSet.size === 1) {
                typeSet.clear();
                typeSet.add(typeStr + "[]");
            }
            else {
                typeSet.clear();
                typeSet.add("(" + typeStr + ")[]");
            }
            return typeSet;
        default:
            // console.log(`init.kind : ${init?.kind} | ${(o.name as unknown as {escapedText : string}).escapedText}`);
            typeSet.add(`Undefined ${init === null || init === void 0 ? void 0 : init.kind}`);
            return typeSet;
    }
}
// function getTypeTextFromDeclaration(o : ts.VariableDeclaration, declarations : ts.NodeArray<ts.VariableDeclaration>): string {
function getTypeTextFromDeclaration(o, declarations) {
    // Rule 1 : initializer.kind == Basic Literal?
    // Rule 2 : initializer has operatorToken?
    const typeSet = getTypeFromInitializer(o.initializer, declarations);
    let typeStr = "";
    typeSet.forEach(t => typeStr += (" | " + t));
    return typeStr.slice(3);
}
/**
 * Parse a variable. Information such as "is the variable const" are calculated here.
 *
 * @export
 * @param {(Resource | CallableDeclaration)} parent
 * @param {VariableStatement} node
 */
function parseVariable(parent, node) {
    const isConst = node.declarationList.getChildren().some(o => o.kind === typescript_1.SyntaxKind.ConstKeyword);
    if (node.declarationList && node.declarationList.declarations) {
        node.declarationList.declarations.forEach((o) => {
            // console.log(o);
            if (TypescriptHeroGuards_1.isCallableDeclaration(parent)) {
                // const declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getTypeTextFromDeclaration(o, parent.variables), node.getStart(), node.getEnd());
                const declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), getTypeTextFromDeclaration(o, []), node.getStart(), node.getEnd());
                parent.variables.push(declaration);
            }
            else {
                const declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), getTypeTextFromDeclaration(o, parent.declarations), node.getStart(), node.getEnd());
                parent.declarations.push(declaration);
            }
        });
    }
}
exports.parseVariable = parseVariable;
