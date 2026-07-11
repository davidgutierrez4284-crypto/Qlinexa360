"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.carpermorParser = exports.laboratoriosRuizParser = exports.olabParser = exports.saludDignaParser = void 0;
exports.getVendorStackedParser = getVendorStackedParser;
const stackedParser_utils_1 = require("../stackedParser.utils");
const COMMON_SKIP = /^(hoja:|p[aá]gina|paciente:|sexo:|fecha:|edad:|orden:|resultados$|www\.|gracias|aviso|privacidad|cup[oó]n|descuento|vigencia|producto|c[oó]digo|m[eé]todo:|informe|responsable|acreditaci[oó]n)/i;
const SECTION_START = /\b(QU[IÍ]MICA|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL\s+[A-ZÁÉÍÓÚ]+|UROAN[AÁ]LISIS|COPROLOG[IÍ]A|ORINA|TIROIDES|LIPIDOS|HEP[AÁ]TICO|RENAL)\b/i;
exports.saludDignaParser = {
    vendor: 'salud_digna',
    name: 'SaludDignaParser',
    canParse(classification) {
        return classification.vendor === 'salud_digna';
    },
    parse(text) {
        return (0, stackedParser_utils_1.parseStackedLayout)(text, {
            sectionStart: SECTION_START,
            skipLine: COMMON_SKIP,
        });
    },
};
exports.olabParser = {
    vendor: 'olab',
    name: 'OlabParser',
    canParse(classification) {
        return classification.vendor === 'olab';
    },
    parse(text) {
        return (0, stackedParser_utils_1.parseStackedLayout)(text, {
            sectionStart: SECTION_START,
            skipLine: COMMON_SKIP,
        });
    },
};
exports.laboratoriosRuizParser = {
    vendor: 'laboratorios_ruiz',
    name: 'LaboratoriosRuizParser',
    canParse(classification) {
        return classification.vendor === 'laboratorios_ruiz';
    },
    parse(text) {
        return (0, stackedParser_utils_1.parseStackedLayout)(text, {
            sectionStart: SECTION_START,
            skipLine: COMMON_SKIP,
        });
    },
};
exports.carpermorParser = {
    vendor: 'carpermor',
    name: 'CarpermorParser',
    canParse(classification) {
        return classification.vendor === 'carpermor';
    },
    parse(text) {
        return (0, stackedParser_utils_1.parseStackedLayout)(text, {
            sectionStart: SECTION_START,
            skipLine: COMMON_SKIP,
        });
    },
};
function getVendorStackedParser(vendor) {
    var _a;
    const parsers = [exports.saludDignaParser, exports.olabParser, exports.laboratoriosRuizParser, exports.carpermorParser];
    return (_a = parsers.find((p) => p.vendor === vendor)) !== null && _a !== void 0 ? _a : null;
}
