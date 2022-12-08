"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVariable = void 0;
const typescript_1 = require("typescript");
const VariableDeclaration_1 = require("../declarations/VariableDeclaration");
const TypescriptHeroGuards_1 = require("../type-guards/TypescriptHeroGuards");
const parse_utilities_1 = require("./parse-utilities");
function getExpressionType(left) {
    // Consider operation...
    // +, -, *, / , %, ++, --
    // >, <, >=, <=, ==, !=
    // &&, ||, !
    // &, |, ^, ~, <<, >>, >>>
    // =, +=, -=, *=, /=
    // unary -, string concat +, conditional 'A ? B : C', typeof, instanceof
    if (left && left.kind) {
        switch (left.kind) {
            case 8:
            case 9: // NumericLiteral, BigIntLiteral
                return "number";
            case 10: // StringLiteral
                return "string";
            case 91:
            case 106: // IfKeyword(false), VoidKeyword(true)
                return "boolean";
            case 209:
                return getExpressionType(left.left);
            default:
                return `Complicated Expression ${left.kind}`;
        }
    }
    else {
        return `Complicated Expression`;
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
                case 8:
                case 9: // NumericLiteral, BigIntLiteral
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "number", node.getStart(), node.getEnd());
                    break;
                case 10: // StringLiteral
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "string", node.getStart(), node.getEnd());
                    break;
                case 91:
                case 106: // IfKeyword(false), VoidKeyword(true)
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "boolean", node.getStart(), node.getEnd());
                    break;
                case 209: // ClassExpression, Follow left operand's type
                    const initializer = o.initializer;
                    if (initializer.left && initializer.operatorToken) {
                        declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), getExpressionType(initializer.left), node.getStart(), node.getEnd());
                    }
                    else {
                        declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), parse_utilities_1.getNodeType(o.type ? o.type : (_b = o.initializer) === null || _b === void 0 ? void 0 : _b.type), node.getStart(), node.getEnd());
                    }
                    break;
                case 202: // PrefixUnaryExpression
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
