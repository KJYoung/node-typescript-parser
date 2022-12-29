"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVariable = void 0;
const typescript_1 = require("typescript");
const VariableDeclaration_1 = require("../declarations/VariableDeclaration");
const TypescriptHeroGuards_1 = require("../type-guards/TypescriptHeroGuards");
const parse_utilities_1 = require("./parse-utilities");
const TYPE_NUMBER = "number";
const TYPE_STRING = "string";
const TYPE_BOOLEAN = "boolean";
// TYPE string with $ means some error.
const TYPE_E_MULTIPLE = "$Wrong";
const TYPE_E_IMPORT = "$Imported";
const TYPE_E_EXPDEEP = "$Deep";
const TYPE_E_COMPEXP = "$CompExp";
const TYPE_E_COMPUNARY = "$UnaryOp";
const TYPE_E_UNDEFINED = "$UndefinedINIT";
const TYPE_E_UNCHECKED = "$NotChecked";
// TypeSet to String converter.
function typeSet2Str(typeSet) {
    let typeStr = "";
    typeSet.forEach(t => typeStr += (" | " + t));
    return typeStr.slice(3);
}
// Get Type of Variable from Previous Declaration[].
function getTypeOfVar(name, declarations) {
    function findNodeByName(declaration, keyword) {
        return declaration.name === keyword;
    }
    const node = declarations.filter(dec => findNodeByName(dec, name));
    if (node.length > 1) {
        return TYPE_E_MULTIPLE; // Maybe Multiple identifier
    }
    else if (node.length == 0) {
        return TYPE_E_IMPORT; // Maybe Imported from other TypeScript file.
    }
    else {
        return node[0].type;
    }
}
// Parse BinaryExpression Initializer.
function getBinaryExpressionType(initializer, declarations) {
    let typeSet = new Set();
    // Considered operations...
    // number, number => number +, -, *, / , %
    // number => number ++, --
    // number, number => boolean >, <, >=, <=, ==, !=
    // (hard. true && 3 => number, false && 4 => boolean : we have to know the value) => &&, ||, !
    // bitwise &, |, ^, ~, <<, >>, >>>
    // assignment =, +=, -=, *=, /=
    // unary -, string concat +, conditional 'A ? B : C'
    // typeof, instanceof
    // Check string concat first, then just evaluate except string concat.
    const isStringConcat = (initializer) => {
        var _a, _b, _c, _d, _e, _f;
        if (initializer && initializer.operatorToken) {
            if (initializer.operatorToken.kind === typescript_1.SyntaxKind.PlusToken) {
                // String?
                if (((_a = initializer.left) === null || _a === void 0 ? void 0 : _a.kind) === typescript_1.SyntaxKind.StringLiteral || ((_b = initializer.right) === null || _b === void 0 ? void 0 : _b.kind) === typescript_1.SyntaxKind.StringLiteral) {
                    return true;
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
                    return leftSet.has(TYPE_STRING) || rightSet.has(TYPE_STRING);
                }
            }
            else {
                const resultLeft = isStringConcat(initializer.left);
                const resultRight = isStringConcat(initializer.right);
                return resultLeft || resultRight;
            }
        }
        else {
            return false;
        }
    };
    const isStringConcatResult = isStringConcat(initializer);
    if (isStringConcatResult) {
        typeSet.add(TYPE_STRING);
        return typeSet;
    }
    else {
        if (initializer && initializer.kind) {
            switch (initializer.kind) {
                case typescript_1.SyntaxKind.NumericLiteral:
                case typescript_1.SyntaxKind.BigIntLiteral: // 8, 9
                    typeSet.add(TYPE_NUMBER);
                    return typeSet;
                case typescript_1.SyntaxKind.StringLiteral: // 10
                    typeSet.add(TYPE_STRING);
                    return typeSet;
                case typescript_1.SyntaxKind.FalseKeyword:
                case typescript_1.SyntaxKind.TrueKeyword: // 91, 106
                    typeSet.add(TYPE_BOOLEAN);
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
                            typeSet.add(TYPE_NUMBER);
                            return typeSet;
                        case typescript_1.SyntaxKind.LessThanToken:
                        case typescript_1.SyntaxKind.LessThanEqualsToken:
                        case typescript_1.SyntaxKind.GreaterThanToken:
                        case typescript_1.SyntaxKind.GreaterThanEqualsToken:
                            typeSet.add(TYPE_BOOLEAN);
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
                            typeSet.add(TYPE_BOOLEAN);
                            return typeSet;
                        case typescript_1.SyntaxKind.AmpersandAmpersandToken: // A && B
                            if (initializer.left.kind === typescript_1.SyntaxKind.TrueKeyword) {
                                return getTypeFromInitializer(initializer.right, declarations);
                            }
                            else if (initializer.left.kind === typescript_1.SyntaxKind.FalseKeyword) {
                                typeSet.add(TYPE_BOOLEAN);
                                return typeSet;
                            }
                            else {
                                const rightType = getTypeFromInitializer(initializer.right, declarations);
                                typeSet.add(TYPE_BOOLEAN);
                                rightType.forEach(t => typeSet.add(t));
                                return typeSet;
                            }
                        case typescript_1.SyntaxKind.BarBarToken: // A || B
                            if (initializer.left.kind === typescript_1.SyntaxKind.TrueKeyword) {
                                typeSet.add(TYPE_BOOLEAN);
                                return typeSet;
                            }
                            else if (initializer.left.kind === typescript_1.SyntaxKind.FalseKeyword) {
                                return getTypeFromInitializer(initializer.right, declarations);
                            }
                            else {
                                const rightType = getTypeFromInitializer(initializer.right, declarations);
                                typeSet.add(TYPE_BOOLEAN);
                                rightType.forEach(t => typeSet.add(t));
                                return typeSet;
                            }
                    }
                    typeSet.add(`${TYPE_E_EXPDEEP}${initializer.operatorToken.kind}`); // Should Go Deeper? OR Unchecked.
                    return typeSet;
                case typescript_1.SyntaxKind.PrefixUnaryExpression:
                case typescript_1.SyntaxKind.PostfixUnaryExpression:
                    typeSet.add(TYPE_NUMBER);
                    return typeSet;
                default:
                    typeSet.add(`${TYPE_E_COMPEXP}${initializer.kind}`); // Complex Expression
                    return typeSet;
            }
        }
        else {
            typeSet.add(TYPE_E_COMPEXP); // Complex Expression
            return typeSet;
        }
    }
}
// Parse Initializer to get TypeSet.
function getTypeFromInitializer(init, declarations) {
    const typeSet = new Set();
    let initializer;
    if (!init || !(init.kind)) {
        typeSet.add(TYPE_E_UNDEFINED);
        return typeSet;
    }
    switch (init.kind) {
        case typescript_1.SyntaxKind.NumericLiteral:
        case typescript_1.SyntaxKind.BigIntLiteral:
        case typescript_1.SyntaxKind.NumberKeyword: // 8, 9, 140
            typeSet.add(TYPE_NUMBER);
            return typeSet;
        case typescript_1.SyntaxKind.StringLiteral:
        case typescript_1.SyntaxKind.StringKeyword: // 10, 143
            typeSet.add(TYPE_STRING);
            return typeSet;
        case typescript_1.SyntaxKind.Identifier: // 75
            const identifier = init.escapedText;
            typeSet.add(getTypeOfVar(identifier, declarations));
            return typeSet;
        case typescript_1.SyntaxKind.FalseKeyword:
        case typescript_1.SyntaxKind.TrueKeyword:
        case typescript_1.SyntaxKind.BooleanKeyword: // 91, 106, 128
            typeSet.add(TYPE_BOOLEAN);
            return typeSet;
        case typescript_1.SyntaxKind.TypeReference: // 169
            const typeRefTypeName = init.typeName;
            const typeRefTypeArgs = init.typeArguments;
            let typeRefStr = "";
            if (typeRefTypeName) {
                typeRefStr += typeRefTypeName.escapedText;
                if (typeRefTypeArgs) {
                    typeRefStr += "<";
                    typeRefTypeArgs.forEach(typeRefType => {
                        typeRefStr += typeSet2Str(getTypeFromInitializer(typeRefType, declarations)) + ",";
                    });
                    typeRefStr = typeRefStr.slice(0, -1) + ">";
                }
                typeSet.add(typeRefStr);
            }
            return typeSet;
        case typescript_1.SyntaxKind.ArrayType: // 174
            const arrayType = init.elementType;
            let typeArrayStr = typeSet2Str(getTypeFromInitializer(arrayType, declarations)) + "[]";
            typeSet.add(typeArrayStr);
            return typeSet;
        case typescript_1.SyntaxKind.UnionType: // 178
            const unionTypes = init.types;
            let typeUnionStr = "(";
            unionTypes.forEach(unT => {
                typeUnionStr += typeSet2Str(getTypeFromInitializer(unT, declarations)) + "|";
            });
            typeSet.add(typeUnionStr.slice(0, -1) + ")");
            return typeSet;
        case typescript_1.SyntaxKind.ArrayLiteralExpression: // 192
            const elements = init.elements;
            elements.forEach(e => {
                const eTypeSet = getTypeFromInitializer(e, declarations);
                eTypeSet.forEach(ee => typeSet.add(ee));
            });
            let typeStr = typeSet2Str(typeSet);
            if (typeSet.size === 1) {
                typeSet.clear();
                typeSet.add(typeStr + "[]");
            }
            else {
                typeSet.clear();
                typeSet.add("(" + typeStr + ")[]");
            }
            return typeSet;
        case typescript_1.SyntaxKind.ObjectLiteralExpression: // 193
            const objProperties = init.properties;
            let objTypeStr = "{ ";
            objProperties.forEach(e => {
                objTypeStr += (e.name.escapedText + ":" + typeSet2Str(getTypeFromInitializer(e.initializer, declarations)) + ", ");
            });
            objTypeStr = objTypeStr.slice(0, -2) + " }";
            typeSet.add(objTypeStr);
            return typeSet;
        // case SyntaxKind.PropertyAccessExpression: // 194
        //     const propertyTarget = (init as unknown as { expression : any }).expression;
        //     console.log(propertyTarget);
        //     const propertyTargetType = typeSet2Str(getTypeFromInitializer(propertyTarget, declarations));
        //     console.log(propertyTargetType);
        //     return typeSet;
        case typescript_1.SyntaxKind.ParenthesizedExpression: // 200
            initializer = init;
            return getTypeFromInitializer(initializer.expression, declarations);
        case typescript_1.SyntaxKind.FunctionExpression: // 201
            const funcParameters = init.parameters;
            const funcType = init.type; // if there are explicit type annotation.
            let funcParamStr = "(";
            funcParameters.forEach(fparam => {
                funcParamStr += (fparam.name.escapedText + ":" + typeSet2Str(getTypeFromInitializer(fparam.type, declarations)) + ", ");
            });
            funcParamStr = (funcParamStr === "(" ? funcParamStr : funcParamStr.slice(0, -2)) + ") => " + typeSet2Str(getTypeFromInitializer(funcType, declarations));
            typeSet.add(funcParamStr);
            return typeSet;
        case typescript_1.SyntaxKind.ArrowFunction: // 202
            const parameters = init.parameters;
            let nodeType = "";
            parameters.forEach((param) => {
                nodeType += parse_utilities_1.getNodeType(param.type);
            });
            nodeType += " => unknown"; // TODO
            typeSet.add(nodeType);
            return typeSet;
        case typescript_1.SyntaxKind.TypeOfExpression: // 204
            typeSet.add(TYPE_STRING);
            return typeSet;
        case typescript_1.SyntaxKind.PrefixUnaryExpression:
        case typescript_1.SyntaxKind.PostfixUnaryExpression: // 207, 208
            switch (init.operator) {
                case typescript_1.SyntaxKind.ExclamationToken:
                    typeSet.add(TYPE_BOOLEAN);
                    return typeSet;
                case typescript_1.SyntaxKind.PlusToken:
                case typescript_1.SyntaxKind.MinusToken:
                case typescript_1.SyntaxKind.PlusPlusToken:
                case typescript_1.SyntaxKind.MinusMinusToken:
                    typeSet.add(TYPE_NUMBER);
                    return typeSet;
                default:
                    typeSet.add(TYPE_E_COMPUNARY); // UnChecked Unary Operation?
                    return typeSet;
            }
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
        default:
            typeSet.add(`${TYPE_E_UNCHECKED}${init === null || init === void 0 ? void 0 : init.kind}`);
            return typeSet;
    }
}
// Get Type String from Declaration.
function getTypeTextFromDeclaration(o, declarations) {
    return typeSet2Str(getTypeFromInitializer(o.initializer, declarations));
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
            if (TypescriptHeroGuards_1.isCallableDeclaration(parent)) {
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
