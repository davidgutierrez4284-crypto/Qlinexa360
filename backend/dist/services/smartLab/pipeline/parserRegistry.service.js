"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWithRegisteredParsers = exports.REGISTERED_LAB_PARSERS = void 0;
const chopo_parser_1 = require("./parsers/chopo.parser");
const biomedica_parser_1 = require("./parsers/biomedica.parser");
const generic_parser_1 = require("./parsers/generic.parser");
Object.defineProperty(exports, "parseWithRegisteredParsers", { enumerable: true, get: function () { return generic_parser_1.parseWithRegisteredParsers; } });
const lapi_parser_1 = require("./parsers/lapi.parser");
const vendorStacked_parser_1 = require("./parsers/vendorStacked.parser");
exports.REGISTERED_LAB_PARSERS = [
    chopo_parser_1.chopoParser,
    vendorStacked_parser_1.saludDignaParser,
    lapi_parser_1.lapiParser,
    biomedica_parser_1.biomedicaParser,
    vendorStacked_parser_1.olabParser,
    vendorStacked_parser_1.laboratoriosRuizParser,
    vendorStacked_parser_1.carpermorParser,
    generic_parser_1.genericParser,
];
