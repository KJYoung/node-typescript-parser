"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExport = void 0;
/**
 * Declares an all export (i.e. export * from ...).
 *
 * @export
 * @class AllExport
 * @implements {Export}
 */
class AllExport {
    constructor(start, end, from) {
        this.start = start;
        this.end = end;
        this.from = from;
    }
}
exports.AllExport = AllExport;
