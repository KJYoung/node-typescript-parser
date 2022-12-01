"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstructorDeclaration = void 0;
/**
 * Constructor declaration that is contained in a class.
 *
 * @export
 * @class ConstructorDeclaration
 * @implements {CallableDeclaration}
 */
class ConstructorDeclaration {
    constructor(name, start, end) {
        this.name = name;
        this.start = start;
        this.end = end;
        this.parameters = [];
        this.variables = [];
    }
}
exports.ConstructorDeclaration = ConstructorDeclaration;
