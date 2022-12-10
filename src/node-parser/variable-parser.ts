import { SyntaxKind, VariableStatement } from 'typescript';

import { CallableDeclaration } from '../declarations/Declaration';
import { VariableDeclaration } from '../declarations/VariableDeclaration';
import { Resource } from '../resources/Resource';
import { isCallableDeclaration } from '../type-guards/TypescriptHeroGuards';
import { getNodeType, isNodeExported } from './parse-utilities';

function getBinaryExpressionType(initializer: any): string {
    // Consider operation...
    // number, number => number +, -, *, / , %
    // number => number ++, --
    // number, number => boolean >, <, >=, <=, ==, !=
    // (hard. true && 3 => number, false && 4 => boolean : we have to know the value) &&, ||, !
    // &, |, ^, ~, <<, >>, >>>
    // =, +=, -=, *=, /=
    // unary -, string concat +, conditional 'A ? B : C', typeof, instanceof
    // Should check string concat first, then just evaluate except string concat.
    const isStringConcat : (initializer : any) => [boolean, boolean] = (initializer: any) => {
        if(initializer && initializer.operatorToken){
            if(initializer.operatorToken.kind === SyntaxKind.PlusToken){
                // String?
                if(initializer.left?.kind === SyntaxKind.StringLiteral || initializer.right?.kind === SyntaxKind.StringLiteral){
                    return [true, false];
                }else if(initializer.left?.kind === SyntaxKind.ParenthesizedExpression && initializer.right?.kind === SyntaxKind.ParenthesizedExpression){
                    const resultLeft = isStringConcat(initializer.left.expression);
                    const resultRight = isStringConcat(initializer.right.expression);
                    return [resultLeft[0] || resultRight[0], resultLeft[1] || resultRight[1]];
                }else if(initializer.left?.kind === SyntaxKind.ParenthesizedExpression){
                    return isStringConcat(initializer.left.expression);
                }else if(initializer.right?.kind === SyntaxKind.ParenthesizedExpression){
                    return isStringConcat(initializer.right.expression);
                }else{
                    return [false, true];
                }
            }else{
                const resultLeft = isStringConcat(initializer.left);
                const resultRight = isStringConcat(initializer.right);
                return [resultLeft[0] || resultRight[0], resultLeft[1] || resultRight[1]]
            }
        }else{
            return [false, false];
        }
    }
    const isStringConcatResult = isStringConcat(initializer);
    if(isStringConcatResult[0]){
        return "string";
    }else{
        if(isStringConcatResult[1]){
            console.log("Maybe StringConcat?");
        }
        if(initializer && initializer.kind ){
            switch(initializer.kind){
                case SyntaxKind.NumericLiteral: case SyntaxKind.BigIntLiteral: // 8, 9
                    return "number";
                case SyntaxKind.StringLiteral: // 10
                    return "string";
                case SyntaxKind.FalseKeyword: case SyntaxKind.TrueKeyword: // 91, 106
                    return "boolean";
                case SyntaxKind.BinaryExpression: // 209
                    switch(initializer.operatorToken.kind){
                        case SyntaxKind.PlusToken: case SyntaxKind.MinusToken: case SyntaxKind.AsteriskToken: case SyntaxKind.PercentToken:
                        case SyntaxKind.LessThanLessThanToken: case SyntaxKind.GreaterThanGreaterThanToken: case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                        case SyntaxKind.AmpersandToken: case SyntaxKind.BarToken:
                            return "number";
                        case SyntaxKind.LessThanToken: case SyntaxKind.LessThanEqualsToken: case SyntaxKind.GreaterThanToken: case SyntaxKind.GreaterThanEqualsToken:
                            return "boolean";
                    }
                    return "Go deeper";
                case SyntaxKind.PrefixUnaryExpression: case SyntaxKind.PostfixUnaryExpression:
                    return "number";
                default:
                    return `Complicated Expression ${initializer.kind}`;
            }
        }else{
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
export function parseVariable(parent: Resource | CallableDeclaration, node: VariableStatement): void {
    const isConst = node.declarationList.getChildren().some(o => o.kind === SyntaxKind.ConstKeyword);
    if (node.declarationList && node.declarationList.declarations) {
        node.declarationList.declarations.forEach((o) => {
            console.log(o);
            let declaration; // = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), ${the type string!}, node.getStart(), node.getEnd());

            // Rule 1 : initializer.kind == Basic Literal?
            // Rule 2 : initializer has operatorToken?
            switch(o.initializer?.kind) {
                case SyntaxKind.NumericLiteral: case SyntaxKind.BigIntLiteral: // 8, 9
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "number", node.getStart(), node.getEnd());
                    break;
                case SyntaxKind.StringLiteral: // 10
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "string", node.getStart(), node.getEnd());
                    break;
                case SyntaxKind.FalseKeyword: case SyntaxKind.TrueKeyword: // 91, 106
                    declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "boolean", node.getStart(), node.getEnd());
                    break;
                case SyntaxKind.PrefixUnaryExpression: case SyntaxKind.PostfixUnaryExpression:
                    switch(( o.initializer as unknown as { operator : any}).operator){
                        case SyntaxKind.ExclamationToken:
                            declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "boolean", node.getStart(), node.getEnd());
                            break;
                        case SyntaxKind.PlusToken: case SyntaxKind.MinusToken:
                        case SyntaxKind.PlusPlusToken: case SyntaxKind.MinusMinusToken:
                            declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "number", node.getStart(), node.getEnd());
                            break;
                        default:
                            declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), "Unknown Unary Expression", node.getStart(), node.getEnd());
                            break;
                    }
                    break;
                case SyntaxKind.BinaryExpression: // 209
                    const initializer : {left : any, right: any, operatorToken : any } = (o.initializer as unknown as  {left : any, right : any, operatorToken : any });  
                    if(initializer.left && initializer.operatorToken){
                        declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getBinaryExpressionType(initializer), node.getStart(), node.getEnd());
                    }else{
                        declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getNodeType(o.type ? o.type : (o.initializer as unknown as { type : any })?.type), node.getStart(), node.getEnd());
                    }
                    break;
                case SyntaxKind.ArrowFunction: // 202
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
