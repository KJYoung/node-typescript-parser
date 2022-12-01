"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVariable = void 0;
const typescript_1 = require("typescript");
const VariableDeclaration_1 = require("../declarations/VariableDeclaration");
const TypescriptHeroGuards_1 = require("../type-guards/TypescriptHeroGuards");
const parse_utilities_1 = require("./parse-utilities");
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
            var _a, _b;
            let declaration;
            switch ((_a = o.initializer) === null || _a === void 0 ? void 0 : _a.kind) {
                case 8:
                case 9: // NumericLiteral, BigIntLiteral
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "number", node.getStart(), node.getEnd());
                    break;
                case 10:
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), "string", node.getStart(), node.getEnd());
                    break;
                case 202:
                    console.log("CASE 202");
                    const parameters = o.initializer.parameters;
                    let nodeType = "";
                    parameters.forEach((param) => {
                        nodeType += parse_utilities_1.getNodeType(param.type);
                    });
                    // nodeType += getNodeType((o.initializer as unknown as {body : any}).body.type )
                    nodeType += " => unknown";
                    // console.log(nodeType);
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), nodeType, node.getStart(), node.getEnd());
                    break;
                default:
                    declaration = new VariableDeclaration_1.VariableDeclaration(o.name.getText(), isConst, parse_utilities_1.isNodeExported(node), parse_utilities_1.getNodeType(o.type ? o.type : (_b = o.initializer) === null || _b === void 0 ? void 0 : _b.type), node.getStart(), node.getEnd());
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
