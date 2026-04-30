// Test entrypoint. Imports every test file (which side-effect-registers tests
// via describe/it) then prints the summary.

import './rng.test.js';
import './distributions.test.js';
import './funnel.test.js';
import './breakeven.test.js';
import './statistics.test.js';
import './sensitivity.test.js';
import './simulator.test.js';
import './reverseCalc.test.js';
import './validation.test.js';
import './integrity.test.js';
import { reportTests } from './runner.js';

reportTests();
