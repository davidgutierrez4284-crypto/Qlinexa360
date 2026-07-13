import { chopoParser } from './parsers/chopo.parser';
import { biomedicaParser } from './parsers/biomedica.parser';
import { genericParser, parseWithRegisteredParsers } from './parsers/generic.parser';
import { lapiParser } from './parsers/lapi.parser';
import { saludDignaParser } from './parsers/saludDigna.parser';
import {
  carpermorParser,
  laboratoriosRuizParser,
  olabParser,
} from './parsers/vendorStacked.parser';
import type { LabParser } from './labParser.interface';

export const REGISTERED_LAB_PARSERS: LabParser[] = [
  chopoParser,
  saludDignaParser,
  lapiParser,
  biomedicaParser,
  olabParser,
  laboratoriosRuizParser,
  carpermorParser,
  genericParser,
];

export { parseWithRegisteredParsers };
