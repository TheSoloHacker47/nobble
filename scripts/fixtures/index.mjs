import regexRules from './regex-rules.mjs';
import tsAstRules from './ts-ast-rules.mjs';
import rubyRules from './ruby-rules.mjs';
import pythonRules from './python-rules.mjs';

/** group name -> fixture cases. Groups become `test/fixtures/<group>/`. */
export default {
  regex: regexRules,
  ts: tsAstRules,
  ruby: rubyRules,
  python: pythonRules,
};
