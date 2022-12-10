import { SyntaxKind, VariableStatement } from 'typescript';
import ts = require('typescript');

import { CallableDeclaration, Declaration } from '../declarations/Declaration';
import { VariableDeclaration } from '../declarations/VariableDeclaration';
import { Resource } from '../resources/Resource';
import { isCallableDeclaration } from '../type-guards/TypescriptHeroGuards';
import { getNodeType, isNodeExported } from './parse-utilities';


function getTypeOfVar(name : string, declarations: Declaration[]): string {
    function findNodeByName(declaration : Declaration, keyword : string): boolean{
        return declaration.name === keyword;
    }
    const node = declarations.filter(dec => findNodeByName(dec, name));
    if (node.length !== 1){
        return "Something wrong : Multiple identifier";
    }else{
        return (node[0] as unknown as { type : string }).type;
    }
}

function getBinaryExpressionType(initializer: any, declarations: Declaration[]): string {
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
            // console.log("Maybe StringConcat?");
        }
        if(initializer && initializer.kind ){
            switch(initializer.kind){
                case SyntaxKind.NumericLiteral: case SyntaxKind.BigIntLiteral: // 8, 9
                    return "number";
                case SyntaxKind.StringLiteral: // 10
                    return "string";
                case SyntaxKind.FalseKeyword: case SyntaxKind.TrueKeyword: // 91, 106
                    return "boolean";
                case SyntaxKind.ParenthesizedExpression: // 200
                    return getBinaryExpressionType(initializer.expression, declarations);
                case SyntaxKind.BinaryExpression: // 209
                    switch(initializer.operatorToken.kind){
                        case SyntaxKind.PlusToken: case SyntaxKind.MinusToken: case SyntaxKind.AsteriskToken: case SyntaxKind.SlashToken: case SyntaxKind.PercentToken: 
                        case SyntaxKind.LessThanLessThanToken: case SyntaxKind.GreaterThanGreaterThanToken: case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                        case SyntaxKind.AmpersandToken: case SyntaxKind.BarToken:
                            return "number";
                        case SyntaxKind.LessThanToken: case SyntaxKind.LessThanEqualsToken: case SyntaxKind.GreaterThanToken: case SyntaxKind.GreaterThanEqualsToken:
                            return "boolean";
                        case SyntaxKind.EqualsToken: case SyntaxKind.PlusEqualsToken: case SyntaxKind.MinusEqualsToken: case SyntaxKind.AsteriskEqualsToken: case SyntaxKind.SlashEqualsToken:
                            const target     = initializer.left;
                            const identifier = target.escapedText;
                            return getTypeOfVar(identifier, declarations);
                        case SyntaxKind.InstanceOfKeyword:
                            return "boolean";
                    }
                    return `Go deeper ${initializer.operatorToken.kind}`;
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

function getTypeFromInitializer(init: ts.Expression | undefined, declarations: Declaration[]): string {
    let initializer;
    if(!init){
        return "Undefined INIT";
    }
    switch(init?.kind) {
        case SyntaxKind.NumericLiteral: case SyntaxKind.BigIntLiteral: // 8, 9
            return "number";
        case SyntaxKind.StringLiteral: // 10
            return "string";
        case SyntaxKind.FalseKeyword: case SyntaxKind.TrueKeyword: // 91, 106
            return "boolean";
        case SyntaxKind.PrefixUnaryExpression: case SyntaxKind.PostfixUnaryExpression:
            switch(( init as unknown as { operator : any}).operator){
                case SyntaxKind.ExclamationToken:
                    return "boolean";
                case SyntaxKind.PlusToken: case SyntaxKind.MinusToken:
                case SyntaxKind.PlusPlusToken: case SyntaxKind.MinusMinusToken:
                    return "number";
                default:
                    return "Unknown Unary Expression";
            }
        case SyntaxKind.ParenthesizedExpression: // 200
            initializer = (init as unknown as  { expression : any });  
            return getTypeFromInitializer(initializer.expression, declarations);
        case SyntaxKind.TypeOfExpression: // 204
            return "string";
        case SyntaxKind.BinaryExpression: // 209
            initializer = (init as unknown as  {left : any, right : any, operatorToken : any });  
            return getBinaryExpressionType(initializer, declarations);
        case SyntaxKind.ArrowFunction: // 202
            const parameters = (init as unknown as {parameters : any}).parameters;
            let nodeType = "";
            parameters.forEach((param : any) => {
                nodeType += getNodeType(param.type)
            });
            // nodeType += getNodeType((init as unknown as {body : any}).body.type )
            nodeType += " => unknown";
            return nodeType;
        case SyntaxKind.Identifier: // 75
            const identifier = (init as unknown as {escapedText : string}).escapedText;
            return getTypeOfVar(identifier, declarations);
        default:
            // console.log(`init.kind : ${init?.kind} | ${(o.name as unknown as {escapedText : string}).escapedText}`);
            return `Undefined ${init?.kind}`;
    }
}

// function getTypeTextFromDeclaration(o : ts.VariableDeclaration, declarations : ts.NodeArray<ts.VariableDeclaration>): string {
function getTypeTextFromDeclaration(o : ts.VariableDeclaration, declarations : Declaration[]): string {
    // Rule 1 : initializer.kind == Basic Literal?
    // Rule 2 : initializer has operatorToken?
    return  getTypeFromInitializer(o.initializer, declarations);
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
            if (isCallableDeclaration(parent)) {
                // const declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getTypeTextFromDeclaration(o, parent.variables), node.getStart(), node.getEnd());
                const declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getTypeTextFromDeclaration(o, []), node.getStart(), node.getEnd());
                parent.variables.push(declaration);
            } else {
                const declaration = new VariableDeclaration(o.name.getText(), isConst, isNodeExported(node), getTypeTextFromDeclaration(o, parent.declarations), node.getStart(), node.getEnd());
                parent.declarations.push(declaration);
            }
        });
    }
}
