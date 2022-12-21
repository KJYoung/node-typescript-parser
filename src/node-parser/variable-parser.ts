import { SyntaxKind, VariableStatement } from 'typescript';
import ts = require('typescript');

import { CallableDeclaration, Declaration } from '../declarations/Declaration';
import { VariableDeclaration } from '../declarations/VariableDeclaration';
import { Resource } from '../resources/Resource';
import { isCallableDeclaration } from '../type-guards/TypescriptHeroGuards';
import { getNodeType, isNodeExported } from './parse-utilities';

function typeSet2Str(typeSet : Set<string>) :string {
    let typeStr = "";
    typeSet.forEach(t => typeStr += (" | " + t) );
    return typeStr.slice(3);
}   

const TYPE_NUMBER = "number";
const TYPE_STRING = "string";
const TYPE_BOOLEAN = "boolean";
// TYPE string with $ means some error.

function getTypeOfVar(name : string, declarations: Declaration[]): string {
    function findNodeByName(declaration : Declaration, keyword : string): boolean{
        return declaration.name === keyword;
    }
    const node = declarations.filter(dec => findNodeByName(dec, name));
    if (node.length > 1){
        return "$Wrong"; // Maybe Multiple identifier
    }else if (node.length == 0){
        return "$Imported"; // Maybe Imported from other TypeScript file.
    }else{
        return (node[0] as unknown as { type : string }).type;
    }
}

function getBinaryExpressionType(initializer: any, declarations: Declaration[]): Set<string> {
    let typeSet = new Set<string>();
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
                // Parenthesized Expression?
                }else if(initializer.left?.kind === SyntaxKind.ParenthesizedExpression && initializer.right?.kind === SyntaxKind.ParenthesizedExpression){
                    return isStringConcat({ left : initializer.left.expression, operatorToken : { kind : SyntaxKind.PlusToken }, right : initializer.right.expression });
                }else if(initializer.left?.kind === SyntaxKind.ParenthesizedExpression){
                    return isStringConcat({ left : initializer.left.expression, operatorToken : { kind : SyntaxKind.PlusToken }, right : initializer.right });
                }else if(initializer.right?.kind === SyntaxKind.ParenthesizedExpression){
                    return isStringConcat({ left : initializer.left, operatorToken : { kind : SyntaxKind.PlusToken }, right : initializer.right.expression });
                // Else.
                }else{
                    const leftSet = getTypeFromInitializer(initializer.left, declarations);
                    const rightSet = getTypeFromInitializer(initializer.right, declarations);
                    if(leftSet.has(TYPE_STRING) || rightSet.has(TYPE_STRING)){
                        return [true, false];
                    }else{
                        return [false, false];
                    }
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
        typeSet.add(TYPE_STRING);
        return typeSet;
    }else{
        if(isStringConcatResult[1]){
            // console.log("Maybe StringConcat?");
        }
        if(initializer && initializer.kind ){
            switch(initializer.kind){
                case SyntaxKind.NumericLiteral: case SyntaxKind.BigIntLiteral: // 8, 9
                    typeSet.add(TYPE_NUMBER);
                    return typeSet;
                case SyntaxKind.StringLiteral: // 10
                    typeSet.add(TYPE_STRING);
                    return typeSet;
                case SyntaxKind.FalseKeyword: case SyntaxKind.TrueKeyword: // 91, 106
                    typeSet.add(TYPE_BOOLEAN);
                    return typeSet;
                case SyntaxKind.ParenthesizedExpression: // 200
                    return getBinaryExpressionType(initializer.expression, declarations);
                case SyntaxKind.BinaryExpression: // 209
                    switch(initializer.operatorToken.kind){
                        case SyntaxKind.PlusToken: case SyntaxKind.MinusToken: case SyntaxKind.AsteriskToken: case SyntaxKind.SlashToken: case SyntaxKind.PercentToken: 
                        case SyntaxKind.LessThanLessThanToken: case SyntaxKind.GreaterThanGreaterThanToken: case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                        case SyntaxKind.AmpersandToken: case SyntaxKind.BarToken:
                            typeSet.add(TYPE_NUMBER);
                            return typeSet;
                        case SyntaxKind.LessThanToken: case SyntaxKind.LessThanEqualsToken: case SyntaxKind.GreaterThanToken: case SyntaxKind.GreaterThanEqualsToken:
                            typeSet.add(TYPE_BOOLEAN);
                            return typeSet;
                        case SyntaxKind.EqualsToken: case SyntaxKind.PlusEqualsToken: case SyntaxKind.MinusEqualsToken: case SyntaxKind.AsteriskEqualsToken: case SyntaxKind.SlashEqualsToken:
                            const target     = initializer.left;
                            const identifier = target.escapedText;
                            typeSet.add(getTypeOfVar(identifier, declarations));
                            return typeSet;
                        case SyntaxKind.InstanceOfKeyword:
                            typeSet.add(TYPE_BOOLEAN);
                            return typeSet;
                        case SyntaxKind.AmpersandAmpersandToken: // A && B
                            if(initializer.left.kind === SyntaxKind.TrueKeyword){
                                return getTypeFromInitializer(initializer.right, declarations);
                            }else if(initializer.left.kind === SyntaxKind.FalseKeyword){
                                typeSet.add(TYPE_BOOLEAN);
                                return typeSet;
                            }else{
                                const rightType = getTypeFromInitializer(initializer.right, declarations);
                                typeSet.add(TYPE_BOOLEAN);
                                rightType.forEach(t => typeSet.add(t));
                                return typeSet;
                            }
                        case SyntaxKind.BarBarToken: // A || B
                            if(initializer.left.kind === SyntaxKind.TrueKeyword){
                                typeSet.add(TYPE_BOOLEAN);
                                return typeSet;
                            }else if(initializer.left.kind === SyntaxKind.FalseKeyword){
                                return getTypeFromInitializer(initializer.right, declarations);
                            }else{
                                const rightType = getTypeFromInitializer(initializer.right, declarations);
                                typeSet.add(TYPE_BOOLEAN);
                                rightType.forEach(t => typeSet.add(t));
                                return typeSet;
                            }
                    }
                    typeSet.add(`Deep${initializer.operatorToken.kind}`); // Should Go Deeper? OR Unchecked.
                    return typeSet;
                case SyntaxKind.PrefixUnaryExpression: case SyntaxKind.PostfixUnaryExpression:
                    typeSet.add(TYPE_NUMBER);
                    return typeSet;
                default:
                    typeSet.add(`$CompExp${initializer.kind}`); // Complex Expression
                    return typeSet;
            }
        }else{
            typeSet.add(`$CompExp`); // Complex Expression
            return typeSet;
        }
    }
}

function getTypeFromInitializer(init: ts.Expression | undefined, declarations: Declaration[]): Set<string> {
    const typeSet = new Set<string>();
    let initializer;
    if(!init){
        typeSet.add("$UndefinedINIT");
        return typeSet;
    }
    if(!(init.kind)){
        typeSet.add("$UnknownKIND");
        return typeSet;
    }
    switch(init.kind) {
        case SyntaxKind.NumericLiteral: case SyntaxKind.BigIntLiteral: case SyntaxKind.NumberKeyword: // 8, 9, 140
            typeSet.add(TYPE_NUMBER);
            return typeSet;
        case SyntaxKind.StringLiteral: case SyntaxKind.StringKeyword: // 10, 143
            typeSet.add(TYPE_STRING);
            return typeSet;
        case SyntaxKind.Identifier: // 75
            const identifier = (init as unknown as {escapedText : string}).escapedText;
            typeSet.add(getTypeOfVar(identifier, declarations));
            return typeSet;
        case SyntaxKind.FalseKeyword: case SyntaxKind.TrueKeyword: case SyntaxKind.BooleanKeyword: // 91, 106, 128
            typeSet.add(TYPE_BOOLEAN);
            return typeSet;
        case SyntaxKind.TypeReference: // 169
            const typeRefTypeName = (init as unknown as { typeName : any }).typeName;
            const typeRefTypeArgs = (init as unknown as { typeArguments : any[]}).typeArguments;
            let typeRefStr = "";
            if(typeRefTypeName){
                typeRefStr += typeRefTypeName.escapedText;
                if(typeRefTypeArgs){
                    typeRefStr += "<";
                    typeRefTypeArgs.forEach(typeRefType => {
                        typeRefStr += typeSet2Str(getTypeFromInitializer(typeRefType, declarations)) + ",";
                    });
                    typeRefStr = typeRefStr.slice(0, -1) + ">";
                }
                typeSet.add(typeRefStr);
            }
            return typeSet;
        case SyntaxKind.ArrayType: // 174
            const arrayType = (init as unknown as {elementType : any}).elementType;
            let typeArrayStr = typeSet2Str(getTypeFromInitializer(arrayType, declarations)) + "[]";
            typeSet.add(typeArrayStr);
            return typeSet;
        case SyntaxKind.UnionType: // 178
            const unionTypes = (init as unknown as { types : any[]}).types;
            let typeUnionStr = "(";
            unionTypes.forEach(unT => {
                typeUnionStr += typeSet2Str(getTypeFromInitializer(unT, declarations)) + "|";
            });
            typeSet.add(typeUnionStr.slice(0, -1) + ")");
            return typeSet;
        case SyntaxKind.ArrayLiteralExpression: // 192
            const elements = (init as unknown as { elements : any[] }).elements;
            elements.forEach(e => {
                const eTypeSet = getTypeFromInitializer(e, declarations);
                eTypeSet.forEach(ee => typeSet.add(ee));
            });
            
            let typeStr = typeSet2Str(typeSet);
            if(typeSet.size === 1){
                typeSet.clear();
                typeSet.add(typeStr + "[]");
            }else{
                typeSet.clear();
                typeSet.add("(" + typeStr + ")[]");
            }
            return typeSet;
        case SyntaxKind.ObjectLiteralExpression: // 193
            const objProperties = (init as unknown as { properties : { name : any, initializer : any}[] }).properties;
            let objTypeStr = "{ ";
            objProperties.forEach(e => {
                objTypeStr += ( e.name.escapedText + ":" + typeSet2Str(getTypeFromInitializer(e.initializer, declarations)) + ", ");
            });
            objTypeStr = objTypeStr.slice(0, -2) + " }";
            typeSet.add(objTypeStr);
            return typeSet;
        case SyntaxKind.ParenthesizedExpression: // 200
            initializer = (init as unknown as  { expression : any });  
            return getTypeFromInitializer(initializer.expression, declarations);
        case SyntaxKind.FunctionExpression: // 201
            const funcParameters = (init as unknown as { parameters : { name : any, initializer : any, type: any}[] }).parameters;
            const funcType       = (init as unknown as { type : { kind : number} }).type; // if there are explicit type annotation.
            let funcParamStr = "(";
            funcParameters.forEach(fparam => {
                funcParamStr += ( fparam.name.escapedText + ":" + typeSet2Str(getTypeFromInitializer(fparam.type, declarations)) + ", ");
            })
            funcParamStr = (funcParamStr === "(" ? funcParamStr : funcParamStr.slice(0, -2)) + ") => " + typeSet2Str(getTypeFromInitializer(funcType as ts.Expression, declarations));
            typeSet.add(funcParamStr);
            return typeSet;
        case SyntaxKind.ArrowFunction: // 202
            const parameters = (init as unknown as {parameters : any}).parameters;
            let nodeType = "";
            parameters.forEach((param : any) => {
                nodeType += getNodeType(param.type)
            });
            nodeType += " => unknown";
            typeSet.add(nodeType);
            return typeSet;
        case SyntaxKind.TypeOfExpression: // 204
            typeSet.add(TYPE_STRING);
            return typeSet;
        case SyntaxKind.PrefixUnaryExpression: case SyntaxKind.PostfixUnaryExpression: // 207, 208
            switch(( init as unknown as { operator : any}).operator){
                case SyntaxKind.ExclamationToken:
                    typeSet.add(TYPE_BOOLEAN);
                    return typeSet;
                case SyntaxKind.PlusToken: case SyntaxKind.MinusToken:
                case SyntaxKind.PlusPlusToken: case SyntaxKind.MinusMinusToken:
                    typeSet.add(TYPE_NUMBER);
                    return typeSet;
                default:
                    typeSet.add("$UnaryOp?"); // UnChecked Unary Operation?
                    return typeSet;
            }
        case SyntaxKind.BinaryExpression: // 209
            initializer = (init as unknown as  {left : any, right : any, operatorToken : any });
            const binaryTypeSet = getBinaryExpressionType(initializer, declarations);
            binaryTypeSet.forEach(t => typeSet.add(t));
            return typeSet;
        case SyntaxKind.ConditionalExpression: // 210
            const initTernary = init as unknown as { condition : any, questionToken : any, whenTrue : any, colonToken : any, whenFalse : any };
            if(initTernary.condition.kind === SyntaxKind.TrueKeyword){
                return getTypeFromInitializer(initTernary.whenTrue, declarations);
            }else if(initTernary.condition.kind === SyntaxKind.FalseKeyword){
                return getTypeFromInitializer(initTernary.whenFalse, declarations);
            }else{
                const trueTypeSet = getTypeFromInitializer(initTernary.whenTrue, declarations);
                const falseTypeSet = getTypeFromInitializer(initTernary.whenFalse, declarations);
                trueTypeSet.forEach(t => typeSet.add(t));
                falseTypeSet.forEach(t => typeSet.add(t));
                return typeSet;
            }
        default:
            typeSet.add(`$Undefined${init?.kind}`);
            return typeSet;
    }
}

// function getTypeTextFromDeclaration(o : ts.VariableDeclaration, declarations : ts.NodeArray<ts.VariableDeclaration>): string {
function getTypeTextFromDeclaration(o : ts.VariableDeclaration, declarations : Declaration[]): string {
    // Rule 1 : initializer.kind == Basic Literal?
    // Rule 2 : initializer has operatorToken?
    const typeSet = getTypeFromInitializer(o.initializer, declarations);
    return typeSet2Str(typeSet);
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
            // console.log(o);
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
