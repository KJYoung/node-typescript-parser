import { SyntaxKind, VariableStatement } from 'typescript';

import { CallableDeclaration } from '../declarations/Declaration';
import { VariableDeclaration } from '../declarations/VariableDeclaration';
import { Resource } from '../resources/Resource';
import { isCallableDeclaration } from '../type-guards/TypescriptHeroGuards';
import { getNodeType, isNodeExported } from './parse-utilities';

/**
 * Parse a variable. Information such as "is the variable const" are calculated here.
 *
 * @export
 * @param {(Resource | CallableDeclaration)} parent
 * @param {VariableStatement} node
 */
export function parseVariable(parent: Resource | CallableDeclaration, node: VariableStatement): void {
    const isConst = node.declarationList.getChildren().some(o => o.kind === SyntaxKind.ConstKeyword);
    if (node.declarationList && node.declarationList.declarations) {
        node.declarationList.declarations.forEach((o) => {
            let declaration;
            switch(o.initializer?.kind) {
                case 8: case 9: // NumericLiteral, BigIntLiteral
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "number", node.getStart(), node.getEnd());
                    break;
                case 10: // StringLiteral
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "string", node.getStart(), node.getEnd());
                    break;
                case 202: // 
                    console.log("CASE 202");
                    const parameters = (o.initializer as unknown as {parameters : any}).parameters;
                    let nodeType = "";
                    parameters.forEach((param : any) => {
                        nodeType += getNodeType(param.type)
                    });
                    // nodeType += getNodeType((o.initializer as unknown as {body : any}).body.type )
                    nodeType += " => unknown";
                    // console.log(nodeType);
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), nodeType, node.getStart(), node.getEnd());
                    break;
                default:
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getNodeType(o.type ? o.type : (o.initializer as unknown as { type : any })?.type), node.getStart(), node.getEnd());
                    break;
            }
            if (isCallableDeclaration(parent)) {
                parent.variables.push(declaration);
            } else {
                parent.declarations.push(declaration);
            }
        });
    }
}
