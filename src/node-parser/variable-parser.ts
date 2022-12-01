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
                case 8: case 9:// NumericLiteral, BigIntLiteral
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "number", node.getStart(), node.getEnd());
                    break;
                case 10:
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "string", node.getStart(), node.getEnd());
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
