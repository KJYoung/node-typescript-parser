"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVariable = void 0;
const typescript_1 = require("typescript");
const VariableDeclaration_1 = require("../declarations/VariableDeclaration");
const TypescriptHeroGuards_1 = require("../type-guards/TypescriptHeroGuards");
const parse_utilities_1 = require("./parse-utilities");
function getBinaryExpressionType(initializer) {
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
            console.log("Maybe StringConcat?");
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
                case typescript_1.SyntaxKind.BinaryExpression: // 209
                    switch (initializer.operatorToken.kind) {
                        case typescript_1.SyntaxKind.PlusToken:
                        case typescript_1.SyntaxKind.MinusToken:
                        case typescript_1.SyntaxKind.AsteriskToken:
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
                    }
                    return "Go deeper";
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
            var _a, _b, _c;
            console.log(o);
            let declaration; // = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), ${the type string!}, node.getStart(), node.getEnd());
            // Rule 1 : initializer.kind == Basic Literal?
            // Rule 2 : initializer has operatorToken?
            switch ((_a = o.initializer) === null || _a === void 0 ? void 0 : _a.kind) {
                case typescript_1.SyntaxKind.NumericLiteral:
                case typescript_1.SyntaxKind.BigIntLiteral: // 8, 9
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "number", node.getStart(), node.getEnd());
                    break;
                case typescript_1.SyntaxKind.StringLiteral: // 10
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "string", node.getStart(), node.getEnd());
                    break;
                case typescript_1.SyntaxKind.FalseKeyword:
                case typescript_1.SyntaxKind.TrueKeyword: // 91, 106
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "boolean", node.getStart(), node.getEnd());
                    break;
                case typescript_1.SyntaxKind.PrefixUnaryExpression:
                case typescript_1.SyntaxKind.PostfixUnaryExpression:
                    switch (o.initializer.operator) {
                        case typescript_1.SyntaxKind.ExclamationToken:
                            declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "boolean", node.getStart(), node.getEnd());
                            break;
                        case typescript_1.SyntaxKind.PlusToken:
                        case typescript_1.SyntaxKind.MinusToken:
                        case typescript_1.SyntaxKind.PlusPlusToken:
                        case typescript_1.SyntaxKind.MinusMinusToken:
                            declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "number", node.getStart(), node.getEnd());
                            break;
                        default:
                            declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "Unknown Unary Expression", node.getStart(), node.getEnd());
                            break;
                    }
                    break;
                case typescript_1.SyntaxKind.BinaryExpression: // 209
                    const initializer = o.initializer;
                    if (initializer.left && initializer.operatorToken) {
                        declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), getBinaryExpressionType(initializer), node.getStart(), node.getEnd());
                    }
                    else {
                        declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), parse_utilities_1.getNodeType(o.type ? o.type : (_b = o.initializer) === null || _b === void 0 ? void 0 : _b.type), node.getStart(), node.getEnd());
                    }
                    break;
                case typescript_1.SyntaxKind.ArrowFunction: // 202
                    const parameters = o.initializer.parameters;
                    let nodeType = "";
                    parameters.forEach((param) => {
                        nodeType += parse_utilities_1.getNodeType(param.type);
                    });
                    // nodeType += getNodeType((o.initializer as unknown as {body : any}).body.type )
                    nodeType += " => unknown";
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), nodeType, node.getStart(), node.getEnd());
                    break;
                default:
                    // console.log(`o.initializer.kind : ${o.initializer?.kind} | ${(o.name as unknown as {escapedText : string}).escapedText}`);
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), parse_utilities_1.getNodeType(o.type ? o.type : (_c = o.initializer) === null || _c === void 0 ? void 0 : _c.type), node.getStart(), node.getEnd());
                    break;
            }
            if (TypescriptHeroGuards_1.isCallableDeclaration(parent)) {
                parent.variables.push(declaration);
            }
            else {
                parent.declarations.push(declaration);
            }
        });
    }
}
exports.parseVariable = parseVariable;
