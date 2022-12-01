"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVariableDelcaration = void 0;
/**
 * Generates typescript code for a variable.
 *
 * @export
 * @param {VariableDelcaration} variable
 * @returns {string}
 */
function generateVariableDelcaration(variable) {
    return `${variable.name}${variable.type ? `: ${variable.type}` : ''}`;
}
exports.generateVariableDelcaration = generateVariableDelcaration;
