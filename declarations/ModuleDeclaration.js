"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleDeclaration = void 0;
/**
 * Module (namespace) declaration. Does export a whole module or namespace that is mainly used by
 * external declaration files.
 *
 * @export
 * @class ModuleDeclaration
 * @implements {Declaration}
 */
class ModuleDeclaration {
    constructor(name, start, end) {
        this.name = name;
        this.start = start;
        this.end = end;
    }
}
exports.ModuleDeclaration = ModuleDeclaration;
