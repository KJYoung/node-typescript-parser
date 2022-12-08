import { SyntaxKind, VariableStatement } from 'typescript';

import { CallableDeclaration } from '../declarations/Declaration';
import { VariableDeclaration } from '../declarations/VariableDeclaration';
import { Resource } from '../resources/Resource';
import { isCallableDeclaration } from '../type-guards/TypescriptHeroGuards';
import { getNodeType, isNodeExported } from './parse-utilities';

function getExpressionType(left: any): string {
    // Consider operation...
    // +, -, *, / , %, ++, --
    // >, <, >=, <=, ==, !=
    // &&, ||, !
    // &, |, ^, ~, <<, >>, >>>
    // =, +=, -=, *=, /=
    // unary -, string concat +, conditional 'A ? B : C', typeof, instanceof
    // Should check string concat first, then just evaluate except string concat.
    if(left && left.kind ){
        switch(left.kind){
            case 8: case 9: // NumericLiteral, BigIntLiteral
                return "number";
            case 10: // StringLiteral
                return "string";
            case 91: case 106: // IfKeyword(false), VoidKeyword(true)
                return "boolean";
            case 209:
                return getExpressionType(left.left);
            default:
                return `Complicated Expression ${left.kind}`;
        }
    }else{
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
export function parseVariable(parent: Resource | CallableDeclaration, node: VariableStatement): void {
    const isConst = node.declarationList.getChildren().some(o => o.kind === SyntaxKind.ConstKeyword);
    if (node.declarationList && node.declarationList.declarations) {
        node.declarationList.declarations.forEach((o) => {
            console.log(o);
            let declaration; // = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), ${the type string!}, node.getStart(), node.getEnd());

            // Rule 1 : initializer.kind == Basic Literal?
            // Rule 2 : initializer has operatorToken?
            switch(o.initializer?.kind) {
                case 8: case 9: // NumericLiteral, BigIntLiteral
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "number", node.getStart(), node.getEnd());
                    break;
                case 10: // StringLiteral
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "string", node.getStart(), node.getEnd());
                    break;
                case 91: case 106: // IfKeyword(false), VoidKeyword(true)
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "boolean", node.getStart(), node.getEnd());
                    break;
                case 209: // ClassExpression, Follow left operand's type
                    const initializer : {left : any, operatorToken : any } = (o.initializer as unknown as  {left : any, operatorToken : any });  
                    if(initializer.left && initializer.operatorToken){
                        declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getExpressionType(initializer.left), node.getStart(), node.getEnd());
                    }else{
                        declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getNodeType(o.type ? o.type : (o.initializer as unknown as { type : any })?.type), node.getStart(), node.getEnd());
                    }
                    break;
                case 202: // PrefixUnaryExpression
                    const parameters = (o.initializer as unknown as {parameters : any}).parameters;
                    let nodeType = "";
                    parameters.forEach((param : any) => {
                        nodeType += getNodeType(param.type)
                    });
                    // nodeType += getNodeType((o.initializer as unknown as {body : any}).body.type )
                    nodeType += " => unknown";
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), nodeType, node.getStart(), node.getEnd());
                    break;
                default:
                    // console.log(`o.initializer.kind : ${o.initializer?.kind} | ${(o.name as unknown as {escapedText : string}).escapedText}`);
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
