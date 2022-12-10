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
                }
                else if (((_c = initializer.left) === null || _c === void 0 ? void 0 : _c.kind) === typescript_1.SyntaxKind.ParenthesizedExpression && ((_d = initializer.right) === null || _d === void 0 ? void 0 : _d.kind) === typescript_1.SyntaxKind.ParenthesizedExpression) {
                    const resultLeft = isStringConcat(initializer.left.expression);
                    const resultRight = isStringConcat(initializer.right.expression);
                    return [resultLeft[0] || resultRight[0], resultLeft[1] || resultRight[1]];
                }
                else if (((_e = initializer.left) === null || _e === void 0 ? void 0 : _e.kind) === typescript_1.SyntaxKind.ParenthesizedExpression) {
                    return isStringConcat(initializer.left.expression);
                }
                else if (((_f = initializer.right) === null || _f === void 0 ? void 0 : _f.kind) === typescript_1.SyntaxKind.ParenthesizedExpression) {
                    return isStringConcat(initializer.right.expression);
                }
                else {
                    return [false, true];
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
        return "string";
    }
    else {
        if (isStringConcatResult[1]) {
            // console.log("Maybe StringConcat?");
        }
        if (initializer && initializer.kind) {
            switch (initializer.kind) {
                case typescript_1.SyntaxKind.NumericLiteral:
                case typescript_1.SyntaxKind.BigIntLiteral: // 8, 9
                    return "number";
                case typescript_1.SyntaxKind.StringLiteral: // 10
                    return "string";
                case typescript_1.SyntaxKind.FalseKeyword:
                case typescript_1.SyntaxKind.TrueKeyword: // 91, 106
                    return "boolean";
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
                            return "number";
                        case typescript_1.SyntaxKind.LessThanToken:
                        case typescript_1.SyntaxKind.LessThanEqualsToken:
                        case typescript_1.SyntaxKind.GreaterThanToken:
                        case typescript_1.SyntaxKind.GreaterThanEqualsToken:
                            return "boolean";
                        case typescript_1.SyntaxKind.EqualsToken:
                        case typescript_1.SyntaxKind.PlusEqualsToken:
                        case typescript_1.SyntaxKind.MinusEqualsToken:
                        case typescript_1.SyntaxKind.AsteriskEqualsToken:
                        case typescript_1.SyntaxKind.SlashEqualsToken:
                            const target = initializer.left;
                            const identifier = target.escapedText;
                            return getTypeOfVar(identifier, declarations);
                        case typescript_1.SyntaxKind.InstanceOfKeyword:
                            return "boolean";
                    }
                    return `Go deeper ${initializer.operatorToken.kind}`;
                case typescript_1.SyntaxKind.PrefixUnaryExpression:
                case typescript_1.SyntaxKind.PostfixUnaryExpression:
                    return "number";
                default:
                    return `Complicated Expression ${initializer.kind}`;
            }
        }
        else {
            return `Complicated Expression`;
        }
    }
}
function getTypeFromInitializer(init, declarations) {
    let initializer;
    if (!init) {
        return "Undefined INIT";
    }
    switch (init === null || init === void 0 ? void 0 : init.kind) {
        case typescript_1.SyntaxKind.NumericLiteral:
        case typescript_1.SyntaxKind.BigIntLiteral: // 8, 9
            return "number";
        case typescript_1.SyntaxKind.StringLiteral: // 10
            return "string";
        case typescript_1.SyntaxKind.FalseKeyword:
        case typescript_1.SyntaxKind.TrueKeyword: // 91, 106
            return "boolean";
        case typescript_1.SyntaxKind.PrefixUnaryExpression:
        case typescript_1.SyntaxKind.PostfixUnaryExpression:
            switch (init.operator) {
                case typescript_1.SyntaxKind.ExclamationToken:
                    return "boolean";
                case typescript_1.SyntaxKind.PlusToken:
                case typescript_1.SyntaxKind.MinusToken:
                case typescript_1.SyntaxKind.PlusPlusToken:
                case typescript_1.SyntaxKind.MinusMinusToken:
                    return "number";
                default:
                    return "Unknown Unary Expression";
            }
        case typescript_1.SyntaxKind.ParenthesizedExpression: // 200
            initializer = init;
            return getTypeFromInitializer(initializer.expression, declarations);
        case typescript_1.SyntaxKind.TypeOfExpression: // 204
            return "string";
        case typescript_1.SyntaxKind.BinaryExpression: // 209
            initializer = init;
            return getBinaryExpressionType(initializer, declarations);
        case typescript_1.SyntaxKind.ArrowFunction: // 202
            const parameters = init.parameters;
            let nodeType = "";
            parameters.forEach((param) => {
                nodeType += parse_utilities_1.getNodeType(param.type);
            });
            // nodeType += getNodeType((init as unknown as {body : any}).body.type )
            nodeType += " => unknown";
            return nodeType;
        case typescript_1.SyntaxKind.Identifier: // 75
            const identifier = init.escapedText;
            return getTypeOfVar(identifier, declarations);
        default:
            // console.log(`init.kind : ${init?.kind} | ${(o.name as unknown as {escapedText : string}).escapedText}`);
            return `Undefined ${init === null || init === void 0 ? void 0 : init.kind}`;
    }
}
// function getTypeTextFromDeclaration(o : ts.VariableDeclaration, declarations : ts.NodeArray<ts.VariableDeclaration>): string {
function getTypeTextFromDeclaration(o, declarations) {
    // Rule 1 : initializer.kind == Basic Literal?
    // Rule 2 : initializer has operatorToken?
    return getTypeFromInitializer(o.initializer, declarations);
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
            console.log(o);
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
